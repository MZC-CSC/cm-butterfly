import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { CloudResourcesPage } from '../pages/cloudResources.page';

const { Given, When, Then } = createBdd(test);

/**
 * 클라우드 리소스 도메인 스텝 — CSP 자격증명(cb-spider) 목록 조회.
 *
 * 등록·해제 스텝은 두지 않는다(등록 모달이 아직 동작하지 않음). VPC 스텝도 없다 — 그 화면 자체가 없다.
 * 자세한 배경은 CloudResourcesPage 주석 참조.
 */

/** "CSP 자격증명 화면을 연다" */
Given('CSP 자격증명 화면을 연다', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "CSP 자격증명 화면을 열면" (When 변형) */
When('CSP 자격증명 화면을 열면', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "CSP 자격증명 목록이 보인다" — 0건이어도 목록 화면이 뜨면 정상 */
Then('CSP 자격증명 목록이 보인다', async ({ page }) => {
  await new CloudResourcesPage(page).expectCredentialListVisible();
});
