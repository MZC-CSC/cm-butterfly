/*
  화면을 실제 마우스로 조작한다. 촬영과 점검이 같은 이 파일을 쓴다.

  ★ 왜 이것이 따로 필요한가 — playwright 의 `locator.click()` 은 브라우저 안으로 이벤트를 밀어
    넣을 뿐, **윈도우즈 커서를 움직이지 않는다.** 화면을 통째로 잡는 녹화에서 커서를 그리는 것은
    운영체제이므로, 그렇게 찍으면 아무도 건드리지 않는데 화면만 저절로 넘어가는 영상이 된다.
    실제로 첫 촬영본에서 커서는 처음부터 끝까지 한 자리에 붙어 있었다.

    그래서 여기서는 `SetCursorPos` 로 커서를 옮기고 `mouse_event` 로 누른다. 사람이 만지는 것과
    같은 입력이므로, 창이 가려지거나 화면이 밀리면 엉뚱한 곳을 누른다 — 누르기 직전에 위치를
    다시 재고, 눌러야 할 것이 보일 때까지 기다린 뒤에 움직인다.

  좌표 맞추기: 브라우저 안의 좌표(뷰포트)와 화면 좌표는 탭·주소창 높이만큼 어긋난다. 그 값은
  창 테두리와 도구 모음에 따라 달라지므로 계산으로 맞히지 않는다 — 커서를 한 번 옮겨 보고,
  페이지가 받은 좌표와 비교해 차이를 그대로 뺀다.
*/
import { spawn, execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const wait = ms => new Promise(r => setTimeout(r, ms));

/*
  창을 맨 앞으로 끌어온다.

  ★ playwright 의 `bringToFront()` 는 브라우저 *안에서* 그 탭을 앞으로 보낼 뿐, 창 자체를
    맨 앞으로 올리지는 않는다. 실제 마우스는 맨 앞 창으로 들어가므로, 다른 창이 위에 있으면
    커서를 옮겨도 페이지는 아무 것도 받지 못한다 — 그 상태로 좌표를 맞추려다 멈췄다.
*/
export function focusWindow(titlePart) {
  const ps = `
$ErrorActionPreference='Stop'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Fg {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@
$target=[IntPtr]::Zero
$cb=[Fg+EnumProc]{ param($h,$p)
  if ([Fg]::IsWindowVisible($h)) {
    $sb=New-Object System.Text.StringBuilder 512
    [void][Fg]::GetWindowText($h,$sb,512)
    if ($sb.ToString() -like '*${titlePart}*') { $script:target=$h; return $false }
  }
  return $true
}
[void][Fg]::EnumWindows($cb,[IntPtr]::Zero)
if ($target -ne [IntPtr]::Zero) {
  [void][Fg]::ShowWindow($target, 9)
  [void][Fg]::SetForegroundWindow($target)
  'ok'
} else { 'none' }
`;
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', ps], {
      encoding: 'utf8',
      timeout: 15_000,
    }).trim();
  } catch {
    return 'fail';
  }
}

/* 한 번 띄워 놓고 계속 쓰는 커서 조종기. 누를 때마다 새로 powershell 을 띄우면
   한 번에 0.2초씩 걸려 움직임이 뚝뚝 끊긴다. */
const DRIVER = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Cur {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][Cur]::SetProcessDPIAware()
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $p = $line.Split(' ')
  switch ($p[0]) {
    'M' { [void][Cur]::SetCursorPos([int]$p[1], [int]$p[2]) }
    'D' { [Cur]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero) }
    'U' { [Cur]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero) }
    'Q' { exit }
  }
}
`;

export class Mouse {
  constructor(page) {
    this.page = page;
    this.at = { x: 0, y: 0 };
    this.origin = { x: 0, y: 0 };
    const file = path.join(os.tmpdir(), 'cmig-cursor-driver.ps1');
    writeFileSync(file, DRIVER, 'utf8');
    this.ps = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
      {
        stdio: ['pipe', 'ignore', 'inherit'],
      },
    );
  }

  send(line) {
    this.ps.stdin.write(line + '\n');
  }

  close() {
    this.send('Q');
    this.ps.stdin.end();
  }

  /**
   * 뷰포트 좌표를 화면 좌표로 바꾸는 값을 잡는다.
   *
   * 창 테두리와 도구 모음 높이를 어림한 뒤, 커서를 실제로 한 번 옮겨 페이지가 받은 좌표와
   * 비교해 남은 차이를 뺀다. 어림이 빗나가도 이 한 번으로 정확해진다.
   */
  async calibrate({ windowTitle = 'Chrome for Testing' } = {}) {
    focusWindow(windowTitle);
    await wait(600);

    const dpr = await this.page.evaluate(() => window.devicePixelRatio);
    if (dpr !== 1) {
      throw new Error(
        `디스플레이 배율이 100% 가 아니다 (devicePixelRatio=${dpr}) — 좌표가 어긋난다`,
      );
    }

    await this.page.evaluate(() => {
      window.__seen = null;
      document.addEventListener(
        'mousemove',
        e => {
          window.__seen = { x: e.clientX, y: e.clientY };
        },
        true,
      );
    });

    const m = await this.page.evaluate(() => ({
      sx: window.screenX,
      sy: window.screenY,
      ow: window.outerWidth,
      oh: window.outerHeight,
      iw: window.innerWidth,
      ih: window.innerHeight,
    }));
    const border = Math.round((m.ow - m.iw) / 2);
    this.origin = { x: m.sx + border, y: m.sy + (m.oh - m.ih) - border };

    // 페이지 한가운데로 한 번 옮겨 보고, 페이지가 받은 좌표와의 차이를 그대로 뺀다.
    const baseX = Math.round(m.iw / 2);
    const probeY = Math.round(m.ih / 2);
    let seen = null;
    let probeX = baseX;
    for (let attempt = 0; attempt < 3 && !seen; attempt++) {
      if (attempt) {
        focusWindow(windowTitle);
        await wait(700);
      }
      // 짚는 자리를 조금씩 옮긴다 — 이미 그 자리에 있으면 mousemove 자체가 일어나지 않는다.
      probeX = baseX + attempt * 12;
      await this.moveToViewport(probeX, probeY, 1);
      await wait(350);
      seen = await this.page.evaluate(() => window.__seen);
    }
    if (!seen) {
      throw new Error(
        '커서를 옮겼는데 페이지가 받지 못했다 — 다른 창이 맨 앞에 있다. ' +
          '도는 동안 마우스·키보드를 건드리면 이렇게 된다.',
      );
    }
    this.origin.x += probeX - seen.x;
    this.origin.y += probeY - seen.y;
  }

  /** 화면 좌표로 곧장 옮긴다. steps 를 늘리면 그만큼 부드럽게 흐른다. */
  async moveToScreen(x, y, steps = 24) {
    const from = { ...this.at };
    for (let i = 1; i <= steps; i++) {
      // 시작과 끝을 느리게 — 일정한 속도로 지나가면 기계가 끄는 티가 난다.
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.send(
        `M ${Math.round(from.x + (x - from.x) * e)} ${Math.round(from.y + (y - from.y) * e)}`,
      );
      if (steps > 1) await wait(10);
    }
    this.at = { x, y };
  }

  async moveToViewport(x, y, steps = 24) {
    await this.moveToScreen(this.origin.x + x, this.origin.y + y, steps);
  }

  async press() {
    this.send('D');
    await wait(70);
    this.send('U');
    await wait(120);
  }

  /**
   * 요소를 눌러야 할 자리로 커서를 옮겨 실제로 누른다.
   *
   * ★ 위치는 옮기기 *직전에* 다시 잰다. 화면이 밀린 뒤의 옛 좌표를 누르면 엉뚱한 것이 눌리고,
   *   그 클릭은 성공한 것처럼 보이므로 한참 뒤 엉뚱한 데서 시간 초과가 난다.
   */
  async click(locator, { steps = 24, settle = 250 } = {}) {
    await locator.waitFor({ state: 'visible', timeout: 30_000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await wait(settle);

    const box = await locator.boundingBox();
    if (!box) throw new Error('누를 자리를 잴 수 없다 — 요소가 화면에 없다');

    await this.moveToViewport(
      Math.round(box.x + box.width / 2),
      Math.round(box.y + box.height / 2),
      steps,
    );
    await wait(140);
    await this.press();
  }

  /** 입력칸을 눌러 잡고 사람이 치듯 넣는다. */
  async type(locator, text, { delay = 55 } = {}) {
    await this.click(locator);
    await this.page.keyboard.type(text, { delay });
  }
}

export { wait };
