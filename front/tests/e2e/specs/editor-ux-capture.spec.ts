import { test, expect } from '@playwright/test';
import { getUser, workflowData } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * Photograph the task editor as it arrives, and again once everything is open.
 *
 * Evidence for the parameter-panel analysis: what a person sees first, what is folded away, and
 * how much of what is on screen has any bearing on the result. Saves nothing to the environment.
 *
 *   BASE_URL=http://cmig.dev.cscmzc.com TEST_TARGET_MODEL=<name> SHOT_DIR=/tmp/uxshots \
 *     npx playwright test --config=tests/e2e/playwright.specs.config.ts editor-ux-capture
 */
test('what the parameter panel shows @integration', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const dir = process.env.SHOT_DIR || '/tmp/claude-1000/uxshots';

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const models = new ModelsPage(page);
  await models.gotoTargetModels();
  const wanted = process.env.TEST_TARGET_MODEL;
  if (wanted) await models.selectModel(wanted);
  else await models.selectFirstModel();

  const wf = new WorkflowPage(page);
  await page.getByTestId('target-make-workflow').click();
  await wf.expectDesignerOpen();
  await wf.selectTaskInDesigner(workflowData.infraMigrationTask);
  await page.waitForTimeout(3_000);

  const panel = page.getByTestId('wf-task-editor');

  // 1. As it arrives.
  await panel.screenshot({ path: `${dir}/01-패널-처음상태.png` });
  const before = await page.locator('[data-testid^="wf-field-"]').count();

  // What the visible fields belong to, before anything is opened.
  const groupOf = (id: string) => {
    const m = id.match(/^wf-field-body_params\.([A-Za-z0-9_]+)/);
    return m ? m[1] : '기타';
  };
  const tally: Record<string, number> = {};
  const ids = await page
    .locator('[data-testid^="wf-field-body_params."]')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid') || ''));
  for (const id of ids) {
    const g = groupOf(id);
    tally[g] = (tally[g] ?? 0) + 1;
  }
  console.log(`[ux] 처음 보이는 필드 ${before} 개`);
  for (const [g, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`[ux]   ${g}: ${n}`);
  }

  // 2. The first screenful - what a person actually looks at.
  await page.screenshot({ path: `${dir}/02-화면-처음상태.png` });

  // 3. Everything opened.
  const opened = await wf.expandAllParams();
  const after = await page.locator('[data-testid^="wf-field-"]').count();
  console.log(`[ux] 펼친 뒤 ${after} 개 (토글 ${opened} 회)`);
  await panel.screenshot({ path: `${dir}/03-패널-모두펼침.png` });

  const tally2: Record<string, number> = {};
  const ids2 = await page
    .locator('[data-testid^="wf-field-body_params."]')
    .evaluateAll(els => els.map(e => e.getAttribute('data-testid') || ''));
  for (const id of ids2) {
    const g = groupOf(id);
    tally2[g] = (tally2[g] ?? 0) + 1;
  }
  console.log('[ux] 펼친 뒤 묶음별');
  for (const [g, n] of Object.entries(tally2).sort((a, b) => b[1] - a[1])) {
    console.log(`[ux]   ${g}: ${n}`);
  }

  // 4. The two that decide the outcome.
  const spec = page
    .locator('[data-testid$="specId"][data-testid*="nodeGroups"]')
    .first();
  if (await spec.isVisible().catch(() => false)) {
    await spec.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/04-노드스펙-펼친뒤.png` });
  }
  const port = page
    .locator('[data-testid*="firewallRules"][data-testid$="Ports"]')
    .first();
  if (await port.isVisible().catch(() => false)) {
    await port.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/05-방화벽포트-펼친뒤.png` });
  }

  // 5. The catalogue that is open from the start and changes nothing.
  const catalogue = page
    .locator('[data-testid^="wf-field-body_params.targetSpecList"]')
    .first();
  if (await catalogue.isVisible().catch(() => false)) {
    await catalogue.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/06-후보카탈로그-처음부터펼침.png` });
  }

  expect(after).toBeGreaterThan(before);
});
