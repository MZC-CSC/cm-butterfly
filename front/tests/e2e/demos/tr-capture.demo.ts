import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';
import { seedChainOfTasks, deleteWorkflowById } from '../support/seedWorkflow';

/**
 * 테스트 결과서에 넣을 화면을 남긴다.
 *
 * 통과 여부는 시나리오가 판정한다. 여기서 남기는 것은 *사람이 보고 판단할* 그림이다 —
 * 강조가 값 위에 제대로 그려지는지, 표시가 눈에 띄는지 같은 것은 통과로는 알 수 없다.
 */
const OUT = '/tmp/tr';
let n = 0;
async function shot(page: Page, name: string) {
  n += 1;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png`,
  });
  console.log(`  캡처 ${String(n).padStart(2, '0')}-${name}`);
}

async function signIn(page: Page): Promise<string> {
  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const m = (localStorage.getItem(k) ?? '').match(
        /"access_token"\s*:\s*"([^"]+)"/,
      );
      if (m) return m[1];
    }
    return '';
  });
}

test('결과서용 화면 — 값 참조 한 바퀴', async ({ page }) => {
  test.setTimeout(900_000);
  const token = await signIn(page);
  const name = `tr-${String(Date.now()).slice(-6)}`;
  const id = await seedChainOfTasks({
    request: page.request,
    token,
    name,
    taskNames: ['recommend_step', 'migrate_step'],
    components: [
      'damselfly_task_get_cloud_infra_model',
      'beetle_task_infra_migration',
    ],
  });

  const wf = new WorkflowPage(page);
  try {
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await page.waitForTimeout(2500);
    await shot(page, '워크플로우-에디터');

    await wf.selectTaskInDesigner('', 'migrate_step');
    await expect(page.getByTestId('wf-task-editor')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(1200);
    await shot(page, '태스크-설정-두-갈래');

    // 선택지 설명
    await page.getByTestId('wf-body-source-fields').hover();
    await page.waitForTimeout(500);
    await shot(page, '설명-칸마다-채우기');
    await page.getByTestId('wf-body-source-whole').hover();
    await page.waitForTimeout(500);
    await shot(page, '설명-앞선-태스크에서-가져오기');
    await page.locator('h4').first().hover();
    await page.waitForTimeout(300);

    // 개별 칸에 참조 걸기
    await page.getByTestId('wf-field-ref-add-body_params.description').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(600);
    await shot(page, '값-고르기-창');

    await wf.chooseReferenceValue(
      'recommend_step',
      '$.cloudInfraModel.targetInfra.name',
    );
    await page.waitForTimeout(500);
    await shot(page, '값-고른-뒤-저장될-참조');
    await wf.applyReference();
    await page.waitForTimeout(800);
    await shot(page, '칸에-걸린-참조');

    // 맞지 않는 타입은 고를 수 없다
    await page
      .getByTestId('wf-field-ref-add-body_params.targetInfra.nodeGroups')
      .click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await wf.chooseReferenceValue(
      'recommend_step',
      '$.cloudInfraModel.targetInfra.name',
    );
    await page.waitForTimeout(600);
    await shot(page, '맞지-않는-타입은-고를-수-없다');

    // 배열 통째로 받기
    await wf.chooseReferenceValue(
      'recommend_step',
      '$.cloudInfraModel.targetInfra.nodeGroups',
    );
    await page.waitForTimeout(500);
    await wf.applyReference();
    await page.waitForTimeout(900);
    await shot(page, '배열-전체를-참조로');

    // 본문 전체를 앞선 태스크 결과로
    await page.getByTestId('wf-body-source-whole').click();
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(800);
    await shot(page, '캔버스와-목록이-함께-열린다');
    await page.getByTestId('wf-ref-pick-cancel').click();
    await page.waitForTimeout(600);
    await shot(page, '그만두면-되돌아온다');
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});
