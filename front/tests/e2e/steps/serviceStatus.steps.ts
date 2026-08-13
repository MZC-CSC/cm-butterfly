import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { ServiceStatusPage } from '../pages/serviceStatus.page';

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
  await new ServiceStatusPage(page).expectVersionAndSpecColumns();
});

Then('서비스 상태 요약의 확인 시각이 갱신된다', async ({ page }) => {
  await new ServiceStatusPage(page).recheckAndExpectFreshTimestamp();
});
