import { test, expect } from '@playwright/test';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';

/** 이 주소가 어느 빌드를 돌리고 있는지 화면으로 확인한다. */
test('로그인하고 워크플로우 목록까지', async ({ page }) => {
  test.setTimeout(180_000);
  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  await page.goto(`${config.baseURL}/main/workflow-management/workflows`);
  await page.waitForTimeout(4000);
  const rows = await page.locator('tbody tr').count();
  console.log(`  ${config.baseURL} — 워크플로우 ${rows}행`);
  expect(rows).toBeGreaterThan(0);
});
