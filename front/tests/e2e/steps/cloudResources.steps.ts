import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { CloudResourcesPage } from '../pages/cloudResources.page';

const { Given, When, Then } = createBdd(test);

/**
 * Cloud resources domain steps — listing CSP credentials (cb-spider).
 *
 * No register/deregister steps (the register modal doesn't work yet). No VPC step either —
 * that screen doesn't exist. See the CloudResourcesPage comments for details.
 */

/** "Open the CSP credentials screen" */
Given('CSP 자격증명 화면을 연다', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "When the CSP credentials screen is opened" (When variant) */
When('CSP 자격증명 화면을 열면', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "The CSP credentials list is shown" — showing the list screen is fine even with 0 entries */
Then('CSP 자격증명 목록이 보인다', async ({ page }) => {
  await new CloudResourcesPage(page).expectCredentialListVisible();
});
