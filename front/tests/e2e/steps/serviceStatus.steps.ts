import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { ServiceStatusPage } from '../pages/serviceStatus.page';
import { humanClick } from '../support/humanize';
import {
  DEMO_SERVICE,
  isRunning,
  startService,
  stopService,
} from '../support/platformHost';

const { Given, When, Then } = createBdd(test);

Given('서비스 상태 화면을 연다', async ({ page }) => {
  await new ServiceStatusPage(page).open();
});

When('지금 다시 확인을 누르면', async ({ page }) => {
  await new ServiceStatusPage(page).recheck();
});

Then('서비스 상태 목록이 보인다', async ({ page }) => {
  await new ServiceStatusPage(page).expectListed();
});

Then('서비스 상태 요약에 정상·실패·미점검 건수가 보인다', async ({ page }) => {
  await new ServiceStatusPage(page).expectSummary();
});

Then('서비스 상태 목록에 서비스가 한 건 이상 보인다', async ({ page }) => {
  await new ServiceStatusPage(page).expectAtLeastOneService();
});

Then('각 서비스 행에 상태가 표시된다', async ({ page }) => {
  await new ServiceStatusPage(page).expectEveryRowHasStatus();
});

Then('서비스 상태 목록에 버전 열과 스펙 열이 보인다', async ({ page }) => {
  await new ServiceStatusPage(page).expectVersionAndSpec();
});

/*
  목록을 천천히 훑는다.

  ★ 확인만 하면 이 구간이 2.5초에 끝난다 — 자동 확인은 눈 깜짝할 사이지만, 영상으로 보는 사람은
    16개 서비스가 어떤 상태인지 읽을 시간이 필요하다. 확인이 빠른 것과 보여 주는 것이 충분한 것은
    별개다.
*/
Given('서비스 상태 목록을 훑어본다', async ({ page }) => {
  const rows = page.locator('[data-testid^="service-status-row-"]');
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 6); i++) {
    await rows
      .nth(i)
      .hover()
      .catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, -1_000);
  await page.waitForTimeout(700);
});

Then('서비스 상태 요약의 확인 시각이 갱신된다', async ({ page }) => {
  await new ServiceStatusPage(page).recheckAndExpectFreshTimestamp();
});

// ── 구간12: what the screen looks like when something has actually stopped ──
//
// ★ A service is really stopped. Faking the response would demonstrate the fake, and the point of
//   this screen is that it tells the truth about the lineup.
//
//   The alert is checked from wherever the reader happens to be - that is how it reaches them.
//   Whatever happens, the service is started again: the assertions live between a stop and a
//   restart that runs either way.

Given('연계 서비스 하나를 내리면', async () => {
  stopService(DEMO_SERVICE);
});

Given('내렸던 서비스를 되살리면', async () => {
  startService(DEMO_SERVICE);
  expect(isRunning(DEMO_SERVICE), `${DEMO_SERVICE} 를 되살리지 못했다`).toBe(
    true,
  );
});

Then('서비스 장애 알림이 뜬다', async ({ page }) => {
  /*
    아무것도 누르지 않고 기다린다 — 이 기능의 값어치가 거기에 있다. 보는 사람은 다른 화면에서
    자기 일을 하고 있고, 콘솔이 알아서 알려 준다.

    ★ 여기서 "지금 다시 확인"을 누르면 안 된다. 그 버튼은 상태 화면에만 있어 이 화면에서는
      찾다가 시간만 버리고, 무엇보다 *눌러서 알아냈다*가 되어 시연의 뜻이 뒤집힌다.

    콘솔은 자기 주기로 묻고 연속 실패가 임계에 닿아야 알린다(원격 dev 는 20초·2회). 페이지를
    다시 읽으면 안 된다 — 정상을 한 번도 못 본 상태에서는 실패를 세지 않으므로(everHealthy)
    알림이 영영 뜨지 않는다.
  */
  await expect(
    page.getByTestId('health-alert-body'),
    `${DEMO_SERVICE} 를 내렸는데 장애 알림이 뜨지 않는다`,
  ).toBeVisible({ timeout: 180_000 });
});

When('알림에서 서비스 상태 화면으로 이동하면', async ({ page }) => {
  await humanClick(page.getByTestId('health-alert-inspect'));
  await expect(page.getByTestId('service-status-table')).toBeVisible({
    timeout: 20_000,
  });
});

Then('서비스 상태 목록에 내린 서비스가 실패로 보인다', async ({ page }) => {
  const row = page.locator(
    `[data-testid="service-status-row-${DEMO_SERVICE}"]`,
  );
  await expect(
    row,
    `${DEMO_SERVICE} 행이 목록에 없다 — 내린 서비스가 목록에 나오지 않으면 화면이 무엇을 보고 있는지 알 수 없다`,
  ).toBeVisible({ timeout: 20_000 });
  // 화면이 쓰는 문구 그대로 — 요약이 "Healthy N / Not answering N" 으로 센다.
  await expect(row).toContainText(/Not answering/i);
});

Then('서비스 상태 목록에 실패가 없다', async ({ page }) => {
  await expect
    .poll(
      async () => {
        await new ServiceStatusPage(page).recheck().catch(() => {});
        const row = page.locator(
          `[data-testid="service-status-row-${DEMO_SERVICE}"]`,
        );
        return (await row.innerText().catch(() => '')) || '';
      },
      {
        timeout: 120_000,
        message: `${DEMO_SERVICE} 가 정상으로 돌아오지 않는다`,
      },
    )
    .toMatch(/Healthy/i);
});
