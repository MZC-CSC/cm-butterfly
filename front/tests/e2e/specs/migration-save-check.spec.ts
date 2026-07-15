import { test } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * A-1 검증 — 타깃 모델에서 워크플로우를 만들어 *저장까지만* 한다(실행 없음).
 *
 * 목적: 저장된 워크플로우의 beetle 마이그레이션 task 본문이
 *   (1) 단일 리터럴 task 이고 (참조/스켈레톤이 아니라)
 *   (2) targetInfra.nodeGroups[].specId/imageId 가 타깃 모델의 실제 값으로 채워졌는지
 * 를 cicada API 로 확인하기 위한 최소 UI 흐름이다. body 는 편집하지 않는다
 * (타깃 모델에서 채워진 리터럴을 그대로 저장해야 하므로).
 *
 * 실행:
 *   BASE_URL=http://cmig.dev.cscmzc.com TARGET_MODEL_NAME=e2e-lowcost-target-974924 \
 *   npx playwright test tests/e2e/specs/migration-save-check.spec.ts \
 *     --config=tests/e2e/playwright.runviewer.config.ts
 */
const TARGET = process.env.TARGET_MODEL_NAME ?? 'e2e-lowcost-target-974924';

test.describe('타깃 모델 → 워크플로우 저장 (A-1 단일 리터럴 task)', () => {
  test.beforeEach(async ({ page }) => {
    const user = getUser('cmiguser');
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.id, user.password);
    await login.expectLoggedIn();
  });

  test('타깃 모델로 워크플로우를 만들어 편집 없이 저장한다', async ({
    page,
  }) => {
    const models = new ModelsPage(page);
    const workflow = new WorkflowPage(page);
    const name = `a1-check-${Date.now()}`;

    await models.openWorkflowEditorFromTarget(TARGET);
    await workflow.expectDesignerOpen();
    await workflow.fillWorkflowName(name);
    // ★ body 미편집 — 타깃 모델에서 채워진 리터럴을 그대로 저장한다.
    await workflow.saveWorkflow();

    await workflow.gotoWorkflows();
    await workflow.expectWorkflowVisible(name);

    // 저장된 워크플로우 이름을 로그로 남겨(뒤이어 cicada API 로 본문을 검사).
    console.log(`[a1-check] SAVED_WORKFLOW_NAME=${name}`);
  });
});
