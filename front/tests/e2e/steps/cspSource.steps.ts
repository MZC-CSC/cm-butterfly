import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { CspSourcePage } from '../pages/cspSource.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { cspAccess, testVm } from '../support/cspAccess';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

// 이번 실행에서 만든 그룹 이름. 시나리오 안에서만 쓰고 마지막에 지운다.
let groupName = '';

Given('소스 서비스 등록 창에서 클라우드 유형을 고른다', async ({ page }) => {
  await new SourceServicesPage(page).gotoCloud();
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

// 실제로 일어난 오입력(ap-northeast2)을 계정 리전에서 만든다 — 마지막 하이픈을 뺀다.
function withoutLastHyphen(region: string): string {
  const i = region.lastIndexOf('-');
  return i < 0 ? `${region}x` : region.slice(0, i) + region.slice(i + 1);
}

Then(
  '리전 이름의 하이픈을 하나 빼고 치면 고를 리전이 없다',
  async ({ page }) => {
    const typo = withoutLastHyphen(cspAccess().region);
    expect(await new CspSourcePage(page).region.matchesFor(typo)).toEqual([]);
  },
);

Then('계정 리전을 치면 그 리전이 남고 고를 수 있다', async ({ page }) => {
  const { region } = cspAccess();
  const control = new CspSourcePage(page).region;
  expect(await control.matchesFor(region)).toContain(region);
  await control.pick(region);
  expect(await control.value()).toBe(region);
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
    pickedVm = await csp.discoverAndPick(testVm());
  },
);

Then(
  '연결 추가 창을 다시 열면 시험용 VM 이 등록됨으로 잠겨 있다',
  async ({ page }) => {
    const csp = new CspSourcePage(page);
    await csp.openCspConnectionModal();
    await csp.expectRegistered(testVm());
    await csp.closeConnectionModal();
  },
);

Then(
  '그 연결을 고르고 Add·Edit 로 설명을 바꾸면 목록에 반영된다',
  async ({ page }) => {
    await new CspSourcePage(page).editConnectionDescription(
      new RegExp(`vm-${testVm()}`),
      `edited by e2e ${groupName}`,
    );
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

// 문구는 화면이 내보내는 사유 그대로가 아니라 핵심만 본다 — 문장을 다듬어도 깨지지 않게.
const NO_SSH = /SSH access/;

// SSH 없는 VM 은 에이전트로 읽을 수 없어 Collect SW 만 잠긴다. 인프라는 cm-honeybee 가 클라우드
// 쪽 정보로 수집하므로 Collect Infra 는 열려 있다(그룹 capabilities 의 isCollectInfra).
Then(
  '그룹의 Collect SW 에 마우스를 올리면 SSH 가 없다는 사유가 보인다',
  async ({ page }) => {
    const csp = new CspSourcePage(page);
    await csp.openGroupDetailTab();
    await csp.expectCollectReasonOnHover(
      'source-group-collect-sw-trigger',
      'source-group-collect-sw',
      NO_SSH,
    );
  },
);

Then(
  '잠긴 Collect SW 를 눌러도 수집 요청이 나가지 않는다',
  async ({ page }) => {
    await new CspSourcePage(page).expectGroupSoftwareCollectSendsNothing();
  },
);

Then(
  '그룹의 Collect Infra 로 수집하면 클라우드 정보로 그 VM 이 노드로 들어온다',
  async ({ page }) => {
    await new CspSourcePage(page).collectGroupInfraAndExpectNode(testVm());
  },
);

Then('그 연결의 Collect Infra 도 열려 있다', async ({ page }) => {
  const csp = new CspSourcePage(page);
  await csp.openConnectionInfraCollect(new RegExp(`vm-${testVm()}`));
  await csp.expectCollectOpen('collect-infra-trigger');
});

Then('만든 CSP 소스 서비스를 지운다', async ({ page }) => {
  const sources = new SourceServicesPage(page);
  await sources.selectGroup(groupName);
  await sources.deleteSelectedGroup();
});

// 리전은 입력한 인증으로 그 계정에서 읽어 온다 — 인증이 없으면 읽을 수 없다.
// aws 는 버킷도 기본 인증으로 읽으므로 cm-honeybee 가 선택 키를 주지 않는다 — 칸이 없어야 한다.
Then('aws 에는 버킷용 선택 키 칸이 없다', async ({ page }) => {
  await new CspSourcePage(page).expectNoOptionalFields();
});

Then('인증 값을 넣기 전에는 리전을 불러올 수 없다', async ({ page }) => {
  expect(await new CspSourcePage(page).isLoadRegionsEnabled()).toBe(false);
});

When('인증 값을 넣고 계정의 리전을 불러오면', async ({ page }) => {
  const csp = new CspSourcePage(page);
  await csp.fillCredential(cspAccess());
  expect(await csp.isLoadRegionsEnabled()).toBe(true);
  await csp.loadRegions();
});

When('{string} CSP 를 고르면', async ({ page }, provider: string) => {
  await new CspSourcePage(page).selectProvider(provider);
});

Then(
  '버킷용 선택 키 {int}개가 필수 항목과 따로 보인다',
  async ({ page }, n: number) => {
    expect(await new CspSourcePage(page).optionalFieldCount()).toBe(n);
  },
);

When('선택 키를 하나만 넣으면', async ({ page }) => {
  await new CspSourcePage(page).fillOptional(0, 'e2e-only-one-key');
});

Then(
  '둘 다 넣거나 비우라는 안내가 보이고 등록 버튼이 잠겨 있다',
  async ({ page }) => {
    const csp = new CspSourcePage(page);
    await csp.expectOptionalPairError();
    expect(await csp.isAddEnabled()).toBe(false);
  },
);

let manualBucket = '';

When(
  '그 서비스의 연결 추가에서 계정에 없는 버킷 이름을 직접 넣어 추가하면',
  async ({ page }) => {
    await new SourceServicesPage(page).selectGroup(groupName);
    const csp = new CspSourcePage(page);
    await page.getByRole('tab', { name: /Connections/i }).click();
    await csp.openCspConnectionModal();
    await csp.chooseResourceType('Object Storage');
    manualBucket = uniqueName('e2e-no-such-bucket');
    await csp.enterResourceByHand(manualBucket);
    refusal = await csp.addPickedResourcesExpectingRefusal();
  },
);

let refusal = '';

Then('계정에 없는 자원이라 등록되지 않았다는 오류가 보인다', async () => {
  expect(refusal).toContain(manualBucket);
});

Then('그 버킷은 커넥션 목록에 없다', async ({ page }) => {
  const csp = new CspSourcePage(page);
  await csp.closeConnectionModal();
  await expect(
    page.getByTestId('source-connection-list-table'),
  ).not.toContainText(manualBucket);
});

Then('VM 연결의 수정 창에는 SSH 입력 칸이 있다', async ({ page }) => {
  await new CspSourcePage(page).expectVmEditOffersSsh(
    new RegExp(`vm-${testVm()}`),
  );
});
