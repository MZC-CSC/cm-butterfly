import { test, expect } from '@playwright/test';
import { getUser, workflowData } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * What does the workflow editor actually draw for the request body?
 *
 * The clone track changes a firewall port in the workflow rather than in the model, and the field
 * has to be found by its schema path. Guessing cost a run: nothing matched and the segment failed
 * after the clone had already been made.
 *
 * The value is definitely in the body - `targetSecurityGroupList[0].firewallRules[5].Ports` is
 * `5555` in the saved workflow. The question is whether the editor renders an input that deep;
 * `targetInfra.nodeGroups[0].specId` is one level shallower and is found.
 *
 * Opens the editor on a target model and prints every field it finds. Saves nothing.
 *
 *   BASE_URL=http://cmig.dev.cscmzc.com TEST_TARGET_MODEL=<name> \
 *     npx playwright test --config=tests/e2e/playwright.specs.config.ts body-fields-dump
 */
test('what the workflow editor draws for the body @integration', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const models = new ModelsPage(page);
  await models.gotoTargetModels();

  const wanted = process.env.TEST_TARGET_MODEL;
  let name: string | undefined = wanted;
  if (wanted) {
    await models.selectModel(wanted);
  } else {
    name = await models.selectFirstModel();
  }
  expect(name, '타깃 모델을 고르지 못했다').toBeTruthy();
  console.log(`[dump] 타깃 모델 = ${name}`);

  const wf = new WorkflowPage(page);
  await page.getByTestId('target-make-workflow').click();
  await wf.expectDesignerOpen();
  await wf.selectTaskInDesigner(workflowData.infraMigrationTask);

  // The panel builds its fields from a schema fetched when it opens - wait rather than count an
  // empty list.
  await page.waitForTimeout(3_000);

  const fields = page.locator('[data-testid^="wf-field-"]');
  const count = await fields.count();
  console.log(`[dump] 그려진 필드 ${count} 개`);

  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const f = fields.nth(i);
    const id = (await f.getAttribute('data-testid')) ?? '';
    const value = await f.inputValue().catch(() => '<읽을 수 없음>');
    rows.push(`${id} = ${JSON.stringify(value)}`);
  }
  for (const r of rows) console.log(`[dump] ${r}`);

  console.log('[dump] ── 보안그룹·방화벽·포트 경로 ──');
  const security = rows.filter(r => /securitygroup|firewall|port/i.test(r));
  console.log(
    security.length
      ? security.map(r => `[dump]   ${r}`).join('\n')
      : '[dump]   없음 — 편집기가 그 깊이까지 그리지 않는다',
  );

  console.log('[dump] ── 가장 깊은 경로 ──');
  const deepest = rows
    .map(r => r.split(' = ')[0])
    .sort((a, b) => b.split('.').length - a.split('.').length)[0];
  console.log(`[dump]   ${deepest ?? '없음'}`);

  expect(count, '본문 필드가 하나도 그려지지 않았다').toBeGreaterThan(0);
});
