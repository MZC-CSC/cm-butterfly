import { test, expect } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkloadPage } from '../pages/workload.page';

/**
 * Workload lifecycle control — against a real workload, from the console.
 *
 * The functional (@mock) scenarios prove *what the screen sends*. They cannot prove that the
 * cloud does anything about it, because nothing is really there. This spec closes that gap: it
 * drives the same buttons a user would, against a workload that actually exists, and the caller
 * checks the provider side separately.
 *
 * It is a hand-run check, not part of the suite — it needs a real workload, and it changes that
 * workload's state. The workload name is passed in so it can never touch someone else's.
 *
 * Run:
 *   BASE_URL=http://localhost:5199 INFRA=wl-lifecycle-1674 \
 *   npx playwright test tests/e2e/specs/workload-lifecycle-live.spec.ts \
 *     --config=tests/e2e/playwright.runviewer.config.ts --grep "<step>"
 */

const INFRA = process.env.INFRA ?? '';

test.describe('워크로드 라이프사이클 제어 — 실제 워크로드 대상', () => {
  test.skip(!INFRA, 'INFRA 환경변수로 대상 워크로드 이름을 지정해야 한다');

  /** 로그인 후 목록에서 대상 워크로드를 고른 상태까지 만든다. */
  async function openAndSelect(page: import('@playwright/test').Page) {
    const user = getUser('cmiguser');
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.id, user.password);
    await login.expectLoggedIn();

    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await expect(wl.mciRow(INFRA)).toBeVisible({ timeout: 30_000 });
    await wl.selectMci(INFRA);
    return wl;
  }

  test('거절되는 상태에서는 사유가 화면에 그대로 나온다', async ({ page }) => {
    test.setTimeout(180_000);
    const wl = await openAndSelect(page);

    await wl.chooseInfraAction('suspend');
    // 상태가 맞지 않으면 누르기 전에 알린다 — 대상이 전이 중이면 이 경고가 떠 있어야 한다.
    await page.screenshot({ path: '/tmp/wl-live-01-confirm.png' });
    await wl.confirmLifecycle();

    // 거절이면 모달이 열린 채 사유가 남는다. 접수되면 스스로 닫힌다. 둘 중 무엇이든
    // *그대로* 기록한다 — 어느 쪽인지는 서버가 정한다.
    const refused = await page
      .getByTestId('wl-lifecycle-error')
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    await page.screenshot({ path: '/tmp/wl-live-02-after-normal.png' });
    console.log(`[live] normal suspend refused=${refused}`);
    if (refused) {
      console.log(
        `[live] reason: ${await page.getByTestId('wl-lifecycle-error').innerText()}`,
      );
    }
  });

  test('Force 로 보내면 접수된다', async ({ page }) => {
    test.setTimeout(180_000);
    const wl = await openAndSelect(page);
    await wl.chooseInfraAction('suspend');
    await wl.chooseForceMethod();
    await wl.confirmLifecycle();
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: '/tmp/wl-live-03-force-suspend.png' });
    const stillOpen = await page
      .getByTestId('wl-lifecycle-progress')
      .isVisible()
      .catch(() => false);
    console.log(`[live] force suspend — modal still open: ${stillOpen}`);
  });

  // Suspended 에서 Resume 은 허용된 전이다. 사용자가 실제로 밟는 길이므로 Force 없이 확인한다.
  test('다시 켠다', async ({ page }) => {
    test.setTimeout(180_000);
    const wl = await openAndSelect(page);
    await wl.chooseInfraAction('resume');
    await wl.confirmLifecycle();
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: '/tmp/wl-live-04-resume.png' });
    const refused = await page
      .getByTestId('wl-lifecycle-error')
      .isVisible()
      .catch(() => false);
    console.log(`[live] normal resume refused=${refused}`);
  });

  test('종료한다', async ({ page }) => {
    test.setTimeout(180_000);
    const wl = await openAndSelect(page);
    await wl.chooseInfraAction('terminate');
    // 이름을 넣기 전에는 실행이 막혀 있어야 한다 — 실제 자원 앞에서 한 번 더 확인한다.
    expect(
      await wl.isLifecycleConfirmBlocked(),
      '이름을 입력하기 전에는 종료가 막혀 있어야 한다',
    ).toBeTruthy();
    await wl.fillLifecycleKeyword(INFRA);
    await wl.confirmLifecycle();
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: '/tmp/wl-live-05-terminate.png' });
    const refused = await page
      .getByTestId('wl-lifecycle-error')
      .isVisible()
      .catch(() => false);
    console.log(`[live] normal terminate refused=${refused}`);
  });
});
