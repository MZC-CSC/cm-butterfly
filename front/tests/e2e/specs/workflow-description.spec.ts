import { test, expect } from '@playwright/test';
import { getUser, descriptions } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * Is the workflow's description box where we think it is?
 *
 * It was not, the first time: the identifier went onto the description of a *task container* in the
 * designer, which is a different box in a different component. The name and description of the
 * workflow itself live in the editor header (`WorkflowEditor.vue`).
 *
 * Opens the editor from a target model, fills the name and description, and leaves without saving.
 *
 *   BASE_URL=http://localhost:5173 npx playwright test \
 *     --config=tests/e2e/playwright.specs.config.ts workflow-description
 */
test('the workflow description is filled in @integration', async ({ page }) => {
  test.setTimeout(5 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const models = new ModelsPage(page);
  await models.gotoTargetModels();
  const name = await models.selectFirstModel();
  expect(
    name,
    '타겟 모델이 하나도 없다 — 앞선 시나리오가 남긴 것이 있어야 한다',
  ).toBeTruthy();

  const wf = new WorkflowPage(page);
  await page.getByTestId('target-make-workflow').click();
  await wf.expectDesignerOpen();

  await wf.fillWorkflowName('desc-check', descriptions.infraWorkflow5555);

  // data-testid 는 mirinae 가 감싼 껍데기에 붙는다. 값이 들어 있는 것은 그 안의 input.
  const box = page
    .getByTestId('workflow-description-input')
    .locator('input')
    .first();
  await expect(
    box,
    '워크플로우 설명란을 찾지 못했다 — 식별자가 편집기 헤더에 있는지 확인한다',
  ).toBeVisible();
  await expect(box).toHaveValue(descriptions.infraWorkflow5555);
});
