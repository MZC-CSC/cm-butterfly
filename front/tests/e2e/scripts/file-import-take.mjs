// 파일 선택 창을 실제로 거쳐 소스 연결정보를 올린다.
//
// ★ 나머지 구간과 달리 여기서는 `setInputFiles` 를 쓰지 않는다. 그 방식은 창을 열지 않고 파일을
//   넣어 버리므로, 화면에는 파일명이 갑자기 나타날 뿐이다. 이 한 구간의 목적이 *파일을 고르는
//   장면*이라 창을 열고 경로를 입력해 연다 — 그래서 브라우저를 화면에 띄우고 화면째 녹화한다.
//
// 창을 다루는 것은 xdotool 이다. 파일 대화상자는 브라우저 밖(GTK)에 있어 playwright 가 닿지
// 못한다.
import { chromium } from '@playwright/test';
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.BASE_URL;
const RUN = process.env.E2E_RUN_ID ?? String(Date.now()).slice(-6);
const GROUP = `onprem-group-${RUN}`;
const CSV_PATH = '/tmp/claude-import/연결정보.csv';

mkdirSync('/tmp/claude-import', { recursive: true });
writeFileSync(
  CSV_PATH,
  '﻿' +
    [
      'name,description,ip_address,ssh_port,user,password,private_key',
      `onprem-web-${RUN},웹 서버,${process.env.TEST_SOURCE_NANO_IP ?? ''},22,ubuntu,,`,
      `onprem-app-${RUN},애플리케이션 서버,${process.env.TEST_SOURCE_MICRO_IP ?? ''},22,ubuntu,,`,
    ].join('\n') +
    '\n',
  'utf-8',
);

function key(...args) {
  try {
    execFileSync('xdotool', args, { timeout: 10_000 });
  } catch {
    /* 창이 아직 없을 수 있다 — 호출하는 쪽에서 기다린다 */
  }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: false,
  args: [`--window-size=1600,1000`, '--window-position=0,0'],
});
const page = await browser.newPage({ viewport: null });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page
  .locator('input[data-testid="login-id"], textarea[data-testid="login-id"]')
  .first()
  .fill('cmiguser');
await page
  .locator(
    'input[data-testid="login-password"], textarea[data-testid="login-password"]',
  )
  .first()
  .fill('cmiguserPassword!');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/main/, { timeout: 30_000 });

const welcome = page.getByTestId('guided-setup-welcome');
if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) {
  await page.getByTestId('guided-setup-welcome-start').click();
} else {
  await page.goto(`${BASE}/main/source-computing/source-services`);
}
await page.waitForTimeout(3_000);

// 그룹을 만들면서 연결정보를 파일로 넣는다.
await page.getByTestId('source-group-add').click();
await page.waitForTimeout(1_200);
await page
  .locator('input[data-testid="source-service-name"]')
  .first()
  .fill(GROUP);
await page.waitForTimeout(800);
await page.getByTestId('source-service-with-connection').click();
await page.waitForTimeout(1_200);

// 여기부터가 이 테이크의 이유 — 창이 열린다.
await page.getByTestId('source-import-file').click();
await page.waitForTimeout(2_500);

/*
  GTK 파일 창을 다룬다.

  ★ 경로를 한 글자씩 치면 자동완성 목록이 따라 열려 화면이 어지럽다. 창이 처음 여는 자리를
    파일이 있는 폴더로 맞춰 두고(홈이 아니라), 이름만 넣어 연다 — 사람이 폴더를 열어 파일을
    고르는 모습에 가깝고 목록이 끼어들지 않는다.
*/
key('key', '--clearmodifiers', 'ctrl+l');
await wait(700);
key('type', '--delay', '55', CSV_PATH);
await wait(1_200);
// Escape 는 쓰지 않는다 — 자동완성만 닫힐 것 같지만 창이 통째로 닫힌다(실제로 그랬다).
// 목록은 Return 으로 파일이 열리면 함께 사라진다.
key('key', 'Return');
await wait(2_500);

await page.getByTestId('source-import-count').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1_500);
await page
  .locator('button', { has: page.getByTestId('source-service-confirm') })
  .first()
  .click();
await page.waitForTimeout(3_000);

console.log(`[import] ${GROUP} 등록 완료`);
await browser.close();
