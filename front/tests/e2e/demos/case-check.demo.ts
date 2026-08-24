import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { seedChainOfTasks, deleteWorkflowById } from '../support/seedWorkflow';

/**
 * 고친 자리를 화면에서 하나씩 눌러 확인한다.
 *
 * 단언만으로는 부족한 것들이라 — 버튼이 어디 놓였는지, 결과 전체 행이 구분되는지,
 * 설명이 어떻게 뜨는지 — 각 대목을 캡처해 사람이 보고 판단하게 둔다.
 */
const OUT = '/tmp/cases';
let n = 0;
async function shot(page: Page, name: string) {
  n += 1;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png`,
  });
}

test('고친 자리를 케이스별로 확인', async ({ page }) => {
  test.setTimeout(600_000);
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

  const name = `case-check-${String(Date.now()).slice(-6)}`;
  const id = await seedChainOfTasks({
    request: page.request,
    token,
    name,
    taskNames: ['first_step', 'second_step', 'third_step'],
  });

  try {
    await page.goto(`${config.baseURL}/main/workflow-management/workflows`);
    await page.reload();
    await page
      .locator('tbody tr')
      .filter({ hasText: name })
      .first()
      .locator('td')
      .nth(1)
      .click();
    await page.waitForTimeout(1200);
    await page.getByTestId('workflow-viewer-edit-btn').click();
    await expect(page.getByTestId('workflow-designer')).toBeVisible({
      timeout: 20_000,
    });
    await page
      .locator('.sqd-step-task')
      .filter({ hasText: 'third_step' })
      .last()
      .click();
    await expect(page.getByTestId('wf-task-editor')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(600);

    // 참조 버튼이 레이블 왼쪽에 있는가
    await shot(page, 'A-버튼위치');

    // 칸 도움말 — 눌러서 여닫기
    const label = page.locator('.field-label.has-tooltip').first();
    if (await label.count()) {
      await label.click();
      await page.waitForTimeout(400);
      const open = await page.locator('.field-help-layer').count();
      console.log('도움말 열림:', open);
      await shot(page, 'B-도움말-열림');
      await label.click();
      await page.waitForTimeout(300);
      console.log('다시 눌러 닫힘:', await page.locator('.field-help-layer').count());
      await shot(page, 'C-도움말-닫힘');
    } else {
      console.log('! 설명이 있는 칸이 없다');
    }

    // 결과 전체 구분 + 값 설명 호버
    await page.getByTestId('wf-field-ref-add-body_params.ns_id').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(500);
    await shot(page, 'D-값목록-결과전체구분');
    await page.locator('.rp-node').first().hover();
    await page.waitForTimeout(500);
    await shot(page, 'E-값설명-호버');
    await page.getByTestId('wf-ref-cancel').click();
    await page.waitForTimeout(400);

    // 캔버스에서 고르기 → 그 태스크로 좁혀지고 결과 전체가 정해지는가
    await page.getByTestId('wf-ref-pick-on-canvas').click();
    await expect(
      page.locator('.sqd-step-task.sqd-pick-allowed').first(),
    ).toBeVisible({ timeout: 15_000 });
    await shot(page, 'F-캔버스-고르기');
    await page
      .locator('.sqd-step-task.sqd-pick-allowed')
      .filter({ hasText: 'first_step' })
      .last()
      .click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(500);
    await shot(page, 'G-캔버스선택후-좁혀짐');
    console.log(
      '캔버스에서 고른 뒤 저장될 값:',
      (await page.getByTestId('wf-ref-preview').innerText()).trim(),
    );

    // 태스크 이름을 눌러도 결과 전체
    await page.getByTestId('wf-ref-show-all').click();
    await page.waitForTimeout(400);
    await shot(page, 'H-전체보기-복귀');
    await page.getByTestId('wf-ref-task-second_step').click();
    await page.waitForTimeout(300);
    console.log(
      '이름을 누른 뒤 저장될 값:',
      (await page.getByTestId('wf-ref-preview').innerText()).trim(),
    );
    await shot(page, 'I-태스크이름-클릭');
    await page.getByTestId('wf-ref-cancel').click();
    await page.waitForTimeout(400);

    // 취소하면 라디오가 되돌아오는가
    await page.getByTestId('wf-body-source-whole').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('wf-ref-cancel').click();
    await page.waitForTimeout(500);
    console.log(
      `취소 후 — 칸마다=${await page.getByTestId('wf-body-source-fields').isChecked()} 결과전체=${await page.getByTestId('wf-body-source-whole').isChecked()}`,
    );
    await shot(page, 'J-취소후-라디오복귀');

    // 고르기 중 Esc
    await page.getByTestId('wf-ref-pick-on-canvas').click();
    await expect(
      page.locator('.sqd-step-task.sqd-pick-allowed').first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log(
      'Esc 후 남은 강조:',
      await page.locator('.sqd-step-task.sqd-pick-allowed').count(),
    );
    await shot(page, 'K-Esc로-빠져나옴');
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});
