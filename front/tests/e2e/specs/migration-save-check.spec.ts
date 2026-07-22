import { test } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * A-1 verification — create a workflow from the target model and *only save it* (no run).
 *
 * Purpose: a minimal UI flow to verify via the cicada API that the saved workflow's beetle
 *   migration task body is
 *   (1) a single literal task (not a reference/skeleton), and
 *   (2) targetInfra.nodeGroups[].specId/imageId are filled with the target model's actual values.
 * The body is not edited (since the literal filled from the target model must be saved as-is).
 *
 * Run:
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
    // ★ body not edited — save the literal filled from the target model as-is.
    await workflow.saveWorkflow();

    await workflow.gotoWorkflows();
    await workflow.expectWorkflowVisible(name);

    // log the saved workflow name (the body is then inspected via the cicada API).
    console.log(`[a1-check] SAVED_WORKFLOW_NAME=${name}`);
  });
});
