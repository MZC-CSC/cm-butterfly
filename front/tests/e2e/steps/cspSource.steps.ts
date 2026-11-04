import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { CspSourcePage } from '../pages/cspSource.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { cspAccess } from '../support/cspAccess';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

// 이번 실행에서 만든 그룹 이름. 시나리오 안에서만 쓰고 마지막에 지운다.
let groupName = '';

Given('소스 서비스 등록 창에서 클라우드 유형을 고른다', async ({ page }) => {
  await new SourceServicesPage(page).goto();
  await new CspSourcePage(page).openCspRegistration();
});

Then('CSP 목록에 {string} 이 있다', async ({ page }, provider: string) => {
  await new CspSourcePage(page).expectProviderOffered(provider);
});

When('계정의 CSP 를 고르면', async ({ page }) => {
  await new CspSourcePage(page).selectProvider(cspAccess().provider);
});

Then('그 CSP 의 인증 항목이 입력 칸으로 나타난다', async ({ page }) => {
  expect(await new CspSourcePage(page).credentialFieldCount()).toBeGreaterThan(
    0,
  );
});

Then('인증 값을 넣기 전에는 등록 버튼이 잠겨 있다', async ({ page }) => {
  expect(await new CspSourcePage(page).isAddEnabled()).toBe(false);
});

When('이름·인증·리전을 모두 채우면', async ({ page }) => {
  groupName = uniqueName('e2e-csp');
  await new CspSourcePage(page).fill(groupName, cspAccess());
});

Then('등록 버튼이 열린다', async ({ page }) => {
  expect(await new CspSourcePage(page).isAddEnabled()).toBe(true);
});

When('등록하면', async ({ page }) => {
  await new CspSourcePage(page).register();
});

Then('목록에 클라우드 유형으로 보인다', async ({ page }) => {
  await new CspSourcePage(page).expectGroupShownAsCloud(groupName, cspAccess());
});

let pickedVm = '';

When(
  '그 서비스의 연결 추가에서 계정의 VM 을 탐색해 시험용 VM 을 고른다',
  async ({ page }) => {
    await new SourceServicesPage(page).selectGroup(groupName);
    const csp = new CspSourcePage(page);
    await page.getByRole('tab', { name: /Connections/i }).click();
    await csp.openCspConnectionModal();
    pickedVm = await csp.discoverAndPick(cspAccess().testVmId);
  },
);

When('추가하면', async ({ page }) => {
  await new CspSourcePage(page).addPickedResources();
});

// 커넥션 이름은 `vm-<자원ID>-<그룹ID 앞 8자리>` 다. 그룹 ID 는 화면이 정하므로 자원 ID 로 본다.
Then('고른 VM 이 커넥션 목록에 보인다', async ({ page }) => {
  await expect(page.getByTestId('source-connection-list-table')).toContainText(
    `vm-${pickedVm}`,
    { timeout: 30_000 },
  );
});

Then('만든 CSP 소스 서비스를 지운다', async ({ page }) => {
  const sources = new SourceServicesPage(page);
  await sources.selectGroup(groupName);
  await sources.deleteSelectedGroup();
});
