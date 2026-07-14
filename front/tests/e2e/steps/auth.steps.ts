import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { LoginPage } from '../pages/login.page';
import { getUser } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/** "먼저 \"cmiguser\"로 로그인한다" — 로그인 화면으로 이동해 로그인하고 메인 진입까지 확인 */
Given('{string}로 로그인한다', async ({ page }, id: string) => {
  const login = new LoginPage(page);
  const u = getUser(id);
  await login.goto();
  await login.login(u.id, u.password);
  await login.expectLoggedIn();
});

/** "로그인 화면을 연다" */
Given('로그인 화면을 연다', async ({ page }) => {
  await new LoginPage(page).goto();
});

/** "\"cmiguser\"와 \"wrong-password\"로 로그인을 시도하면" */
When(
  '{string}와 {string}로 로그인을 시도하면',
  async ({ page }, id: string, pw: string) => {
    await new LoginPage(page).login(id, pw);
  },
);

/** "로그인에 실패하고 로그인 화면에 머문다" */
Then('로그인에 실패하고 로그인 화면에 머문다', async ({ page }) => {
  await new LoginPage(page).expectLoginFailed();
});
