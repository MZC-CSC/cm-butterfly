import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { LoginPage } from '../pages/login.page';
import { getUser } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/** Step "log in as {string}" — go to the login screen, log in, and verify entry into main */
Given('{string}로 로그인한다', async ({ page }, id: string) => {
  // This is the first step of every scenario that logs in, including the long
  // migration flow (infra migration + SW migration + load test in one scenario).
  // Set a single generous total budget here so the whole flow fits — mid-scenario
  // steps must not cap it lower than the time already spent on earlier apiWaits.
  // Short scenarios never approach this ceiling, so it is harmless for them.
  test.setTimeout(40 * 60_000);
  const login = new LoginPage(page);
  const u = getUser(id);
  await login.goto();
  await login.login(u.id, u.password);
  await login.expectLoggedIn();
});

/** Step "open the login screen" */
Given('로그인 화면을 연다', async ({ page }) => {
  await new LoginPage(page).goto();
});

/** Step "when attempting to log in with {string} and {string}" */
When(
  '{string}와 {string}로 로그인을 시도하면',
  async ({ page }, id: string, pw: string) => {
    await new LoginPage(page).login(id, pw);
  },
);

/** Step "login fails and stays on the login screen" */
Then('로그인에 실패하고 로그인 화면에 머문다', async ({ page }) => {
  await new LoginPage(page).expectLoginFailed();
});
