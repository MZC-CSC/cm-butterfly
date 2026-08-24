/*
  화면에서 하는 일 자체. 점검(녹화 없이)과 촬영(녹화하며)이 **같은 이 파일을** 쓴다.

  ★ 왜 하나로 두나 — 점검과 촬영이 서로 다른 경로를 타면 점검은 확인이 아니다. 여기서 통과한
    것과 다른 것이 찍힐 수 있기 때문이다. 점검은 카메라만 끈 예행연습이어야 한다.

  누르는 것은 전부 **윈도우즈 커서를 실제로 옮겨** 누른다(조작.mjs). 사람이 직접 시험하는
  장면을 찍는 것이므로, 커서가 가서 누르는 것이 보여야 한다.
*/
import { readFileSync } from 'fs';
import { inflateRawSync } from 'zlib';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { Mouse, wait } from './조작.mjs';
import { BASE_URL as BASE, PUBLIC_HOST, REAL_HOST } from './설정.mjs';

const PROBE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '파일창.ps1',
);

const ID = process.env.TEST_USERNAME || 'cmiguser';
const PW = process.env.TEST_PASSWORD || 'cmiguserPassword!';

const rx = s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * 그룹 이름.
 *
 * ★ 무엇을 어떻게 만든 그룹인지 이름만 보고 알 수 있어야 한다. 목록에 `onprem-group-...` 이
 *   여럿 쌓이면 어느 것이 이 촬영에서 파일로 넣은 것인지 구분이 안 된다.
 */
export function groupName(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  return `excel-group-import-${day}-${p(now.getHours())}${p(now.getMinutes())}`;
}

/**
 * 엑셀(.xlsx) 안의 파일 하나를 꺼낸다.
 *
 * ★ xlsx 는 그냥 zip 이다. 표 하나에서 첫 열만 읽자고 라이브러리를 하나 더 매달 이유가 없어,
 *   중앙 디렉터리를 훑어 필요한 항목만 펴서 쓴다. 이 폴더는 통째로 옮겨 다니므로 매달린 것이
 *   적을수록 좋다(지금 매달린 것은 playwright 하나뿐이다).
 */
function unzipEntry(buf, wanted) {
  // 끝에서부터 중앙 디렉터리 끝 표지(EOCD)를 찾는다.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('엑셀 파일이 아니다 — zip 끝 표지가 없다');

  let at = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50)
      throw new Error('엑셀 파일이 깨졌다');
    const method = buf.readUInt16LE(at + 10);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);

    if (name === wanted) {
      // 압축된 크기는 지역 헤더가 0 으로 둘 수 있어(스트리밍 저장) 중앙 디렉터리 값을 쓴다.
      const size = buf.readUInt32LE(at + 20);
      const dataAt =
        localAt +
        30 +
        buf.readUInt16LE(localAt + 26) +
        buf.readUInt16LE(localAt + 28);
      const raw = buf.subarray(dataAt, dataAt + size);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`엑셀 안에 ${wanted} 이 없다`);
}

const unescapeXml = s =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * 파일에 적힌 연결 이름 — 화면에서 이것들이 보여야 제대로 들어간 것이다.
 *
 * csv 와 xlsx 를 다 받는다. 어느 쪽이든 첫 열이 이름이고 첫 줄은 머리글이다.
 */
export function connectionNames(filePath) {
  if (/\.xlsx$/i.test(filePath)) {
    const sheet = unzipEntry(
      readFileSync(filePath),
      'xl/worksheets/sheet1.xml',
    ).toString('utf8');
    const names = [];
    // 첫 열(A)만 본다. 값이 없는 칸은 `<c ... />` 로 닫혀 있어 걸리지 않는다.
    for (const m of sheet.matchAll(/<c r="A(\d+)"[^>]*>([\s\S]*?)<\/c>/g)) {
      if (m[1] === '1') continue; // 머리글
      const t = m[2].match(/<t[^>]*>([\s\S]*?)<\/t>/);
      if (t) names.push(unescapeXml(t[1]).trim());
    }
    return names.filter(Boolean);
  }

  const [, ...rows] = readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  return rows.map(r => r.split(',')[0].trim()).filter(Boolean);
}

// ───────────────────────── 화면의 각 자리 ─────────────────────────

// ★ 미리내는 data-testid 를 입력칸이 아니라 그것을 감싼 div 에 붙인다. 그 이름으로 바로 값을
//   넣으면 "입력 요소가 아니다" 로 멈춘다 — 안쪽 input 까지 짚는다.
const field = (page, name) =>
  page
    .locator(`input[data-testid="${name}"], textarea[data-testid="${name}"]`)
    .first();

/* 설명칸은 testid 가 붙기 전 화면도 있어, 없으면 등록 창 안의 textarea 로 떨어진다. */
const descriptionField = page =>
  page
    .locator(
      'input[data-testid="source-service-description"], textarea[data-testid="source-service-description"]',
    )
    .or(
      page
        .locator('.source-service-button-modal .layout')
        .first()
        .locator('textarea'),
    )
    .first();

const groupTable = page => page.getByTestId('source-group-list-table');

/* 등록 창을 닫은 직후에는 같은 이름을 담은 행이 표 *밖에도* 하나 남는다. 표 안으로 한정하지
   않으면 그 쪽이 잡히고, 눌러도 아무 일이 일어나지 않는다. (e2e sourceServices.page.ts 와 같은 이유) */
const groupRow = (page, name) =>
  groupTable(page)
    .getByTestId(`source-group-row-${name}`)
    .or(groupTable(page).getByRole('row', { name: rx(name) }))
    .first();

/* 미리내 PButtonTab 은 탭 버튼에 testid 를 달 수 없다 — 접근성 이름으로 짚는다. */
const connectionsTab = page =>
  page.getByRole('tab', { name: /Connections/i }).first();

const connectionRow = (page, name) =>
  page
    .getByTestId('source-connection-list-table')
    .or(page.locator('table'))
    .getByRole('row', { name: rx(name) })
    .first();

// ───────────────────────── 파일 고르는 창 ─────────────────────────

/**
 * 파일 창에서 파일을 **눌러서** 고른다.
 *
 * ★ 경로를 붙여 넣고 엔터를 쳐도 열리기는 한다. 그러나 사람이 파일을 고르는 장면은 그것이 아니다 —
 *   폴더에 놓인 파일을 눈으로 찾아 누르고 "열기" 를 누르는 것이 사람이 하는 일이고, 이 촬영은
 *   사람이 직접 시험하는 장면을 담는 것이다. 그래서 창 안에서 파일이 그려진 자리를 알아내
 *   (파일창.ps1 이 UI Automation 으로 알려준다) 그리로 커서를 옮겨 누른다.
 *
 * 창이 열리는 폴더는 브라우저 프로필에 미리 적어 둔다 — 촬영.mjs 의 `selectfile.last_directory`.
 */
export async function pickFileByMouse(mouse, fileName) {
  let found;
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        PROBE,
        '-FileName',
        fileName,
      ],
      { encoding: 'utf8', timeout: 40_000 },
    );
    found = JSON.parse(out.trim());
  } catch (e) {
    // 창이 열린 채로 두면 브라우저를 닫지 못해 실행이 매달린다 — 닫고 나서 알린다.
    closeFileDialog();
    throw new Error(
      `파일 창에서 누를 자리를 찾지 못했다 — ${(e.stdout || e.message).toString().trim()}`,
    );
  }
  if (found.error) {
    closeFileDialog();
    throw new Error(`파일 창에서 누를 자리를 찾지 못했다 — ${found.error}`);
  }

  // 파일을 고르고, 한 박자 쉰 뒤 "열기" 를 누른다. 무엇을 골라서 창이 닫혔는지 보이도록.
  await mouse.moveToScreen(found.item.x, found.item.y, 30);
  await wait(350);
  await mouse.press();
  await wait(600);

  await mouse.moveToScreen(found.open.x, found.open.y, 22);
  await wait(300);
  await mouse.press();
}

function closeFileDialog() {
  try {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "$w = New-Object -ComObject wscript.shell; $w.SendKeys('{ESC}')",
      ],
      { timeout: 10_000 },
    );
  } catch {
    /* 닫지 못해도 여기서 더 할 것은 없다 */
  }
}

// ───────────────────────── 단계 ─────────────────────────

/**
 * 주소창에 나갈 이름이 개발 서버를 가리키게 맞춘다.
 *
 * ★ IP 를 적어 두지 않는다. 개발 서버는 평소 꺼 두었다가 켜는데 켤 때마다 공인 IP 가 새로 붙어서,
 *   적어 둔 값은 다음 회차에 이미 틀린 값이다. 실제 도메인(REAL_HOST)이 늘 현재 IP 를 가리키므로
 *   **실행할 때 그것을 조회해** hosts 를 맞춘다.
 *
 * ★ 손대는 것은 이 이름이 적힌 줄 하나뿐이다. hosts 에는 다른 것도 들어 있으므로 그 줄만 지우고
 *   새로 쓴다. 이미 맞으면 아무 것도 하지 않는다.
 *
 * 관리자 권한이 아니면 고칠 수 없다 — 그때는 넣을 줄을 그대로 알려 준다.
 */
const HOSTS = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

async function ensureHostsEntry() {
  const host = new URL(BASE).hostname;
  if (host !== PUBLIC_HOST) return; // 다른 주소를 직접 준 경우는 건드리지 않는다

  const { promises: dns } = await import('dns');
  const server = await dns.lookup(REAL_HOST).catch(() => null);
  if (!server) {
    // 개발 서버가 꺼져 있으면 도메인도 풀리지 않는다. 여기서 단정하지 않고 그대로 알린다.
    const mine = await dns.lookup(PUBLIC_HOST).catch(() => null);
    if (mine) {
      console.log(
        `\n  ${REAL_HOST} 이 풀리지 않아 hosts 가 맞는지는 확인하지 못했다 — 그대로 진행한다`,
      );
      return;
    }
    throw new Error(
      `${PUBLIC_HOST} 도 ${REAL_HOST} 도 풀리지 않는다 — 개발 서버가 꺼져 있는 것 같다. 켜 달라고 요청한다.`,
    );
  }

  const mine = await dns.lookup(PUBLIC_HOST).catch(() => null);
  if (mine && mine.address === server.address) return; // 이미 맞다

  const line = `${server.address}\t${PUBLIC_HOST}`;
  // 지울 줄을 찾는 패턴 — 점은 글자 그대로여야 한다(정규식에서 점은 아무 글자나 맞는다).
  const namePattern = PUBLIC_HOST.replace(/\./g, '\\.');
  const ps = `
$ErrorActionPreference='Stop'
$p='${HOSTS}'
$keep = Get-Content -LiteralPath $p | Where-Object { $_ -notmatch '\\s${namePattern}\\s*$' }
Set-Content -LiteralPath $p -Value ($keep + '${line}') -Encoding ascii
ipconfig /flushdns | Out-Null
'ok'`;
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', ps], {
      timeout: 20_000,
    });
  } catch {
    throw new Error(
      `${PUBLIC_HOST} 을 ${server.address} 로 맞춰야 하는데 hosts 를 고치지 못했다 — 관리자 권한이 아니다.\n` +
        `관리자 권한 PowerShell 에서 아래를 한 뒤 다시 돌린다. 그 줄에는 아스키만 적는다.\n` +
        `  Add-Content ${HOSTS} "\`n${line}"\n  ipconfig /flushdns`,
    );
  }
  console.log(`\n  hosts 를 맞췄다 — ${PUBLIC_HOST} → ${server.address}`);
}

export async function openLoginScreen(page) {
  await ensureHostsEntry();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await field(page, 'login-id').waitFor({ state: 'visible', timeout: 60_000 });
}

export async function login(page, mouse) {
  await mouse.type(field(page, 'login-id'), ID);
  await mouse.type(field(page, 'login-password'), PW);
  await mouse.click(page.getByTestId('login-submit'));
  await page.waitForURL(/\/main/, { timeout: 30_000 });

  // 처음 들어온 계정이면 안내 화면이 먼저 뜬다.
  const welcome = page.getByTestId('guided-setup-welcome');
  if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mouse.click(page.getByTestId('guided-setup-welcome-start'));
  }
  await page.goto(`${BASE}/main/source-computing/source-services`);
  await groupTable(page).waitFor({ timeout: 30_000 });
  await wait(1_500);
}

/**
 * 그룹을 만들고 파일로 연결정보를 넣는다.
 *
 * `answerDialog` 는 파일 고르는 창에 답하는 방법이다. 창이 뜬 뒤에 불린다.
 */
export async function createGroupFromFile(
  page,
  mouse,
  { name, description, expectedCount, answerDialog },
) {
  await mouse.click(page.getByTestId('source-group-add'));
  await wait(1_000);

  await mouse.type(field(page, 'source-service-name'), name);
  await wait(600);

  /* ★ 한글은 한 글자씩 치지 않는다. 브라우저에 넣는 키 입력은 조합 과정을 거치지 않아
       "ㅇㅔㄱㅅㅔㄹ" 처럼 자모가 흩어진다 — 넣고 나서 한 박자 쉬어 읽히게 한다. */
  if (description) {
    await mouse.click(descriptionField(page));
    await descriptionField(page).fill(description);
    await wait(800);
  }

  await mouse.click(page.getByTestId('source-service-with-connection'));
  await wait(800);

  await mouse.click(page.getByTestId('source-import-file'));

  /*
    창이 뜨면 곧바로 답하러 간다.

    ★ 여기서 오래 기다리지 않는다. 답하는 쪽이 창 안에서 누를 자리를 찾는 데 이미 한 박자가
      걸리므로(운영체제에 물어본다), 그 위에 기다림을 더하면 아무도 아무 것도 하지 않는 화면이
      3초 넘게 이어진다 — 다른 편들의 가장 긴 멈춤이 1.3초쯤이라 그 편만 늘어져 보였다.
  */
  await wait(500);
  await answerDialog();

  await page.getByTestId('source-import-count').waitFor({ timeout: 60_000 });
  const counted = await page.getByTestId('source-import-count').innerText();
  if (!counted.includes(String(expectedCount))) {
    throw new Error(
      `읽힌 건수가 ${expectedCount} 가 아니다: "${counted.trim()}"`,
    );
  }
  await wait(2_000);

  await mouse.click(
    page
      .locator('button', { has: page.getByTestId('source-service-confirm') })
      .first(),
  );

  /*
    ★ 등록은 성공이든 실패든 알림으로 답한다. 창이 닫히는 것만 기다리면 실패를 성공으로 읽는다 —
      실제로 이름이 겹쳐 붉은 알림이 뜬 채 창이 닫힌 적이 있다. 그때 찍힌 것을 성공본으로 넘길 뻔했다.
  */
  const failed = page
    .locator('text=/UNIQUE constraint|Error occurred|failed/i')
    .first();
  const modalOpen = page.getByTestId('source-service-confirm');
  const started = Date.now();
  for (;;) {
    if (await failed.isVisible().catch(() => false)) {
      throw new Error(
        `등록이 거절됐다 — ${(await failed.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`,
      );
    }
    if (!(await modalOpen.isVisible().catch(() => false))) break;
    if (Date.now() - started > 120_000)
      throw new Error('등록 창이 2분 동안 닫히지 않았다');
    await wait(400);
  }
  await wait(1_500);
}

/** 목록에서 그룹을 찾는다. 등록 직후 목록이 자동으로 갱신되지 않는 경우가 있어 한 번 새로 받는다. */
async function revealGroup(page, name) {
  if (
    await groupRow(page, name)
      .isVisible()
      .catch(() => false)
  )
    return;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await groupTable(page).waitFor({ timeout: 30_000 });
  await groupRow(page, name).waitFor({ timeout: 30_000 });
}

/**
 * 만든 그룹을 열어 Connections 탭에 무엇이 들어갔는지 보여준다.
 *
 * ★ 여기가 이번에 더한 부분이다. "등록 성공" 만으로는 *무엇이* 어떻게 등록됐는지 알 수 없다.
 *   파일 한 장이 서버 여러 대를 한 번에 데려온다는 것이 파일로 넣는 이유인데, 목록에 그룹 한 줄이
 *   늘어난 것만 보여서는 그 부분이 화면에 없다.
 */
export async function showConnections(
  page,
  mouse,
  name,
  expected,
  // 마지막 화면 - 읽을 만큼만 머무른다. 여섯 초는 다른 편들에 비해 길었다.
  holdMs = 2_000,
) {
  await revealGroup(page, name);
  await mouse.click(groupRow(page, name));

  // 탭이 뜨는 것을 먼저 본다 — 없는 것을 누르러 가면 커서만 가 있고 아무 일도 일어나지 않는다.
  await connectionsTab(page).waitFor({ timeout: 30_000 });
  await wait(800);
  await mouse.click(connectionsTab(page));

  for (const conn of expected) {
    await connectionRow(page, conn).waitFor({ timeout: 30_000 });
  }
  await wait(holdMs);
}

/**
 * 그룹 하나를 지운다. 없으면 아무 것도 하지 않고 false 를 돌려준다.
 *
 * ★ 행을 그냥 누르면 상세가 열릴 뿐이다. 삭제 아이콘은 *체크박스로* 고른 행에만 걸린다.
 *   그 아이콘은 표가 다시 그려질 때마다 다시 꽂히는 동적 요소라, 목록이 다 뜬 뒤에 짚는다.
 */
export async function deleteGroup(page, mouse, name) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await groupTable(page).waitFor({ timeout: 30_000 });
  await wait(1_500);

  if (
    !(await groupRow(page, name)
      .isVisible()
      .catch(() => false))
  )
    return false;

  await mouse.click(
    groupRow(page, name)
      .locator(
        'td.select-checkbox .p-checkbox, td.select-checkbox, input[type="checkbox"]',
      )
      .first(),
  );
  await wait(600);
  await mouse.click(page.getByTestId('source-group-delete'));
  await wait(800);
  await mouse.click(page.getByTestId('source-group-delete-confirm'));

  await groupRow(page, name)
    .waitFor({ state: 'detached', timeout: 30_000 })
    .catch(() => {});
  await wait(1_500);
  return true;
}

export { Mouse, wait };
