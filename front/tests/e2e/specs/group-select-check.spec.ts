import { test, expect } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { SourceServicesPage } from '../pages/sourceServices.page';

/**
 * Does clicking a source group row open its detail, and what does the row look like before?
 *
 * The file-import segment times out waiting for the Connections tab, and the screenshot shows
 * nothing selected at all. Either the click never happened or it happened and toggled the row off.
 * Guessing between those cost a run each time, so this prints the row's class before and after and
 * says whether the tab turned up.
 *
 *   BASE_URL=http://cmig.dev.cscmzc.com TEST_GROUP=onprem-group-460311 \
 *     npx playwright test --config=tests/e2e/playwright.specs.config.ts group-select-check
 */
test('clicking a source group opens its detail @integration', async ({
  page,
}) => {
  test.setTimeout(3 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const source = new SourceServicesPage(page);
  await source.goto();

  const name = process.env.TEST_GROUP ?? '';
  expect(name, 'TEST_GROUP 이 필요하다').toBeTruthy();

  const row = page.getByRole('row', { name: new RegExp(name) }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  console.log(`[sel] 클릭 전 class = ${await row.getAttribute('class')}`);

  await row.click();
  await page.waitForTimeout(2_000);
  console.log(`[sel] 클릭 후 class = ${await row.getAttribute('class')}`);

  const tab = page.getByRole('tab', { name: /Connections/i });
  const there = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
  console.log(`[sel] Connections 탭 = ${there ? '보인다' : '없다'}`);

  // 이제 시나리오가 실제로 쓰는 경로 그대로.
  console.log('[sel] ── 선택이 없는 상태에서 showImportedConnections ──');
  // 새로 그린다. 앞의 클릭으로 남은 선택이 있으면 가드가 건너뛰어, 정작 실패하는 경로를 지나친다.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_000);
  const before = await page
    .getByRole('row', { name: new RegExp(name) })
    .first()
    .getAttribute('class');
  console.log(`[sel] 새로 그린 뒤 class = ${before}`);
  await source
    .showImportedConnections(name, [`${name}-nano`, `${name}-micro`])
    .then(() => console.log('[sel] showImportedConnections 통과'))
    .catch(e =>
      console.log(
        `[sel] showImportedConnections 실패: ${e.message.split('\n')[0]}`,
      ),
    );

  if (!there) {
    const tabs = await page.getByRole('tab').allInnerTexts();
    console.log(`[sel] 화면의 탭 = ${JSON.stringify(tabs)}`);
    const panes = await page
      .locator('.p-tab, [role="tablist"]')
      .allInnerTexts()
      .catch(() => []);
    console.log(`[sel] tablist 내용 = ${JSON.stringify(panes).slice(0, 400)}`);
  }
});
