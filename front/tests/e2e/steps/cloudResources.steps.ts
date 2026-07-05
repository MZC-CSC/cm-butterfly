import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { CloudResourcesPage } from '../pages/cloudResources.page';
import { getCredential, vpc as vpcData } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * 클라우드 리소스 도메인 스텝 — CSP 자격증명(cb-spider)·VPC(cb-tumblebug).
 * 화면 위치·셀렉터는 CloudResourcesPage에만 둔다(여기엔 의도만).
 * 시나리오(마이그레이션 등)가 재사용할 수 있도록 파라미터화한다.
 */

// ── CSP 자격증명 ────────────────────────────────────────────────

/** "CSP 자격증명 화면을 연다" */
Given('CSP 자격증명 화면을 연다', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "CSP 자격증명 화면을 열면" (When 변형) */
When('CSP 자격증명 화면을 열면', async ({ page }) => {
  await new CloudResourcesPage(page).gotoCredentials();
});

/** "CSP 자격증명 목록이 보인다" */
Then('CSP 자격증명 목록이 보인다', async ({ page }) => {
  await new CloudResourcesPage(page).expectCredentialListVisible();
});

/**
 * ★ 재사용 스텝 — "\"aws\" CSP 자격증명을 등록한다"
 * 마이그레이션 등 다른 시나리오의 전제조건으로도 쓰인다({string}=CSP 키 또는 자격증명 이름).
 * fixture(getCredential)에서 access/secret key를 가져와 등록 모달로 Register-Credential.
 */
Given('{string} CSP 자격증명을 등록한다', async ({ page }, key: string) => {
  const cr = new CloudResourcesPage(page);
  const cred = getCredential(key);
  await cr.gotoCredentials();
  await cr.registerCredential(cred);
  await cr.expectCredentialListed(cred.name);
});

/** "\"aws\" 자격증명이 목록에 있다" (등록 이름 기준 확인) */
Then('{string} 자격증명이 목록에 있다', async ({ page }, key: string) => {
  await new CloudResourcesPage(page).expectCredentialListed(getCredential(key).name);
});

/** "\"aws\" CSP 자격증명을 해제하면" — Unregister-Credential */
When('{string} CSP 자격증명을 해제하면', async ({ page }, key: string) => {
  await new CloudResourcesPage(page).unregisterCredential(getCredential(key).name);
});

/** "\"aws\" 자격증명이 목록에서 사라진다" */
Then('{string} 자격증명이 목록에서 사라진다', async ({ page }, key: string) => {
  await new CloudResourcesPage(page).expectCredentialNotListed(getCredential(key).name);
});

// ── VPC / vNet ─────────────────────────────────────────────────

/** "VPC 화면을 연다" */
Given('VPC 화면을 연다', async ({ page }) => {
  await new CloudResourcesPage(page).gotoVpc();
});

/** "VPC 목록이 보인다" */
Then('VPC 목록이 보인다', async ({ page }) => {
  await new CloudResourcesPage(page).expectVpcListVisible();
});

/** "\"e2e-vpc\" VPC가 목록에 있다" (인자 생략 시 fixture 기본 VPC) */
Then('{string} VPC가 목록에 있다', async ({ page }, name: string) => {
  await new CloudResourcesPage(page).expectVpcListed(name || vpcData.name);
});

/** "\"e2e-vpc\" VPC를 삭제하면" — delvnet */
When('{string} VPC를 삭제하면', async ({ page }, name: string) => {
  await new CloudResourcesPage(page).deleteVpc(name || vpcData.name);
});

/** "\"e2e-vpc\" VPC가 목록에서 사라진다" */
Then('{string} VPC가 목록에서 사라진다', async ({ page }, name: string) => {
  await new CloudResourcesPage(page).expectVpcNotListed(name || vpcData.name);
});
