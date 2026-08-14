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
    The console asks on its own schedule - five minutes by default - and only says so after two
    failures in a row, so waiting for it would take longer than the take. The interval is settable,
    and the check that drives it is the same one the button uses; pressing it is what a reader does
    when they suspect something anyway.
  */
  const status = new ServiceStatusPage(page);
  await expect
    .poll(
      async () => {
        await status.recheck().catch(() => {});
        return page
          .getByTestId('health-alert-body')
          .isVisible()
          .catch(() => false);
      },
      {
        timeout: 120_000,
        message: `${DEMO_SERVICE} 를 내렸는데 장애 알림이 뜨지 않는다`,
      },
    )
    .toBe(true);
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
