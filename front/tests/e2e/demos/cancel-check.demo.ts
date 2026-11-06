import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';
import { seedChainOfTasks, deleteWorkflowById } from '../support/seedWorkflow';

/**
 * 고르기를 그만두는 길이 전부 열려 있는지 본다.
 *
 * 지금까지 Esc 하나만 들었다. 그것을 아는 사람만 빠져나올 수 있었다는 뜻이다.
 */
const OUT = '/tmp/cancel';
let n = 0;
async function shot(page: Page, name: string) {
  n += 1;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png`,
  });
}

const picking = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector(
      '.sqd-designer,[class*="sqd-designer"]',
    );
    return JSON.stringify({
      rootPicking: !!document.querySelector('.sqd-picking-a-task'),
      allowed: document.querySelectorAll('.sqd-step-task.sqd-pick-allowed')
        .length,
      popover: document.querySelectorAll('[data-testid="wf-ref-popover"]')
        .length,
      stopBtn: document.querySelectorAll('[data-testid="wf-ref-pick-cancel"]')
        .length,
      whole: (
        document.querySelector(
          '[data-testid="wf-body-source-whole"]',
        ) as HTMLInputElement | null
      )?.checked,
      fields: (
        document.querySelector(
          '[data-testid="wf-body-source-fields"]',
        ) as HTMLInputElement | null
      )?.checked,
      root: !!root,
    });
  });

test('그만두는 길이 모두 열려 있다', async ({ page }) => {
  test.setTimeout(600_000);
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning')
      console.log(`[browser ${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', e =>
    console.log(`[pageerror] ${String(e).slice(0, 300)}`),
  );
  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const token = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const m = (localStorage.getItem(k) ?? '').match(
        /"access_token"\s*:\s*"([^"]+)"/,
      );
      if (m) return m[1];
    }
    return '';
  });

  const name = `cancel-check-${String(Date.now()).slice(-6)}`;
  const id = await seedChainOfTasks({
    request: page.request,
    token,
    name,
    taskNames: ['first_step', 'second_step', 'third_step'],
  });

  try {
    // ★ 목록을 훑어 찾지 않는다. 워크플로우는 지워지지 않고 쌓이므로 방금 만든 것이
    //   둘째 페이지로 밀리면 영영 못 찾는다 — 실제로 그렇게 멈췄다. 검색으로 좁힌다.
    const wf = new WorkflowPage(page);
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await page
      .locator('.sqd-step-task')
      .filter({ hasText: 'third_step' })
      .last()
      .click();
    await expect(page.getByTestId('wf-task-editor')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(600);

    // ⓪ 두 선택지의 설명이 호버로 뜨는가
    await page.getByTestId('wf-body-source-fields').hover();
    await page.waitForTimeout(400);
    await shot(page, '0-설명-칸마다채우기');
    await page.getByTestId('wf-body-source-whole').hover();
    await page.waitForTimeout(400);
    await shot(page, '0-설명-가져오기');
    await page.locator('h4').first().hover();
    await page.waitForTimeout(300);

    // ① 앞선 태스크에서 가져오기 → Stop picking 버튼
    await page.getByTestId('wf-body-source-whole').click();
    await page.waitForTimeout(800);
    console.log(
      `① 고르기 시작 — 밝은 태스크=${await picking(page)} 창=${await page.getByTestId('wf-ref-popover').count()}`,
    );
    await shot(page, 'A-고르기중-그만두기버튼');
    await page.getByTestId('wf-ref-pick-cancel').click();
    await page.waitForTimeout(500);
    console.log(
      `① Stop picking 후 — 밝은태스크=${await picking(page)} 창=${await page.getByTestId('wf-ref-popover').count()} 칸마다=${await page.getByTestId('wf-body-source-fields').isChecked()}`,
    );

    // ② 이미 선택된 라디오를 눌러 그만두기
    await page.getByTestId('wf-body-source-whole').click();
    await page.waitForTimeout(700);
    await page.getByTestId('wf-body-source-fields').click();
    await page.waitForTimeout(500);
    console.log(
      `② 칸마다 채우기 클릭 후 — 밝은태스크=${await picking(page)} 창=${await page.getByTestId('wf-ref-popover').count()}`,
    );

    // ③ 결과 전체 → 캔버스도 밝아지는가
    await page.getByTestId('wf-body-source-whole').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(600);
    console.log('③ 가져오기 — 캔버스도 함께 밝은가:', await picking(page));
    await shot(page, 'B-결과전체-캔버스도밝음');

    // ④ 결과 전체 → Cancel 버튼
    await page.getByTestId('wf-ref-cancel').click();
    await page.waitForTimeout(600);
    console.log(
      `④ Cancel 후 — 창=${await page.getByTestId('wf-ref-popover').count()} 밝은태스크=${await picking(page)} 칸마다=${await page.getByTestId('wf-body-source-fields').isChecked()}`,
    );
    await shot(page, 'C-Cancel후');

    // ⑤ 결과 전체 → 다른 라디오로 그만두기
    await page.getByTestId('wf-body-source-whole').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('wf-body-source-fields').click();
    await page.waitForTimeout(600);
    console.log(
      `⑤ 다른 옵션 클릭 후 — 창=${await page.getByTestId('wf-ref-popover').count()} 밝은태스크=${await picking(page)} 칸마다=${await page.getByTestId('wf-body-source-fields').isChecked()}`,
    );
    await shot(page, 'D-다른옵션으로-그만둠');
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});
