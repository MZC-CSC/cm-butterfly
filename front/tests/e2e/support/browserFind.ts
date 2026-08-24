/**
 * 브라우저의 찾기 창(Ctrl+F)으로 값을 짚는다.
 *
 * ★ 왜 이것이 필요한가 — 값을 짚어 보이려고 강조 고리를 그렸는데, 넓은 입력칸에서는 값이 없는
 *   오른쪽까지 감싸고 화면이 다시 그려지면 혼자 남아 뚝뚝 끊겼다. 브라우저가 스스로 하는 찾기는
 *   *글자 자체*를 물들이므로 그런 문제가 없고, 몇 군데 있는지도 함께 알려 준다.
 *
 * ★ 이 창은 운영체제가 아니라 **크로미움이 그린다.** 파일 고르는 창과 달리 리눅스·윈도우즈에서
 *   같은 모습이라, 어느 장비에서 찍어도 화면이 달라지지 않는다.
 *
 * ★ Playwright 의 키 입력으로는 열 수 없다 — 그 키는 페이지로 가고 찾기 창은 페이지 밖이다.
 *   그래서 화면 전체를 녹화할 때만, 창을 가진 실제 화면에 키를 보내 연다(리눅스는 xdotool).
 *   그런 화면이 없으면 아무 것도 하지 않고 false 를 돌려주므로, 부르는 쪽이 다른 방법으로 짚는다.
 */
import { execFileSync } from 'child_process';
import { Page } from '@playwright/test';

function canDrive(): boolean {
  return !!process.env.DISPLAY && process.env.E2E_DEMO_PACE === '1';
}

function key(...args: string[]): void {
  execFileSync('xdotool', args, { timeout: 10_000 });
}

/**
 * 값을 찾아 물들이고 잠깐 둔다. 창을 열 수 없으면 false.
 *
 * 찾기 창은 닫지 않고 남긴다 — 물든 글자와 "1/2" 같은 개수가 함께 보이는 것이 요점이다.
 * 다음 조작으로 넘어가기 전에 `closeFind` 로 닫는다.
 */
export async function findInBrowser(
  page: Page,
  text: string,
  holdMs = 1_500,
): Promise<boolean> {
  if (!canDrive()) return false;
  try {
    /*
      앞선 찾기를 먼저 닫는다.

      ★ 찾기 창은 지난 낱말을 그대로 들고 있고 물든 자리도 남는다. 그대로 다음 것을 찾으면 화면에
        **앞의 결과가 함께 보인다** — 스펙을 찾은 자리가 포트를 찾을 때까지 남아 있었다
        (2026-08-24 사용자 지적).
    */
    key('key', 'Escape');
    await page.waitForTimeout(300);

    key('key', '--clearmodifiers', 'ctrl+f');
    await page.waitForTimeout(700);
    key('type', '--delay', '60', text);
    await page.waitForTimeout(holdMs);
    return true;
  } catch {
    // 키를 보낼 수 없는 환경이면 부르는 쪽이 다른 방법을 쓴다.
    return false;
  }
}

export async function closeFind(page: Page): Promise<void> {
  if (!canDrive()) return;
  try {
    key('key', 'Escape');
    await page.waitForTimeout(400);
  } catch {
    /* 이미 닫혔거나 보낼 수 없다 */
  }
}
