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

  /*
    안내 화면이 떠 있으면 닫는다 — 그것을 보여주는 구간만 남긴다.

    ★ 처음 들어온 계정에는 마이그레이션 안내가 먼저 뜬다. 구간1 은 그것을 보여주는 것이 일이지만,
      나머지 구간에서는 화면 절반을 덮은 채 남아 *논리적으로 맞지 않는 장면*이 된다 — 실패한 작업을
      다시 돌리는 구간에 처음 온 사람용 안내가 떠 있는 식이다 (2026-08-24 사용자 지적).

      구간1 인지는 그 구간의 태그로 가린다. 태그로 가리는 편이 "이 구간에서는 닫아라"를 스텝마다
      적어 두는 것보다 빠뜨릴 자리가 적다.
  */
  const showsWelcome = (test.info().tags ?? []).includes('@seg1');
  if (!showsWelcome) {
    const welcome = page.getByTestId('guided-setup-welcome');
    if (await welcome.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page
        .getByTestId('guided-setup-welcome-start')
        .click()
        .catch(() => {});
      await welcome
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => {});
    }
  }

  /*
    로그인이 끝난 시각을 남긴다 — 편집이 그 앞을 잘라낼 수 있게.

    ★ 구간마다 로그인을 다시 하는 것은 각 구간이 혼자서도 돌아야 하기 때문이다. 그런데 *영상*
      으로는 같은 로그인 장면이 열다섯 번 반복될 이유가 없다 — 보여줄 값어치는 구간1 에서 한 번
      이면 충분하다(사용자 지시 2026-08-20).

      화면을 보고 로그인이 끝난 지점을 찾아내는 것보다, 끝난 쪽이 직접 시각을 적어 주는 편이
      정확하다. 촬영 스크립트가 이 값을 읽어 그 앞을 버린다.
  */
  const cue = process.env.E2E_CUE_FILE;
  if (cue) {
    await import('node:fs').then(fs =>
      fs.appendFileSync(cue, `login-done ${Date.now()}\n`),
    );
  }
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
