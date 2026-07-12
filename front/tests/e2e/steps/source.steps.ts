import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { SourceServicesPage, Connection } from '../pages/sourceServices.page';
import { sourceServer } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';

const { Given, When, Then } = createBdd(test);

/**
 * 지금 다루고 있는 소스그룹 이름.
 * 등록 스텝이 기억해 둔 값을 쓰고, 없으면(등록 없이 수집만 하는 경우) fixtures 기본값으로 되돌아간다.
 */
function currentSourceGroup(): string {
  return scenarioState.sourceGroupName ?? uniqueName(sourceServer.name);
}

/**
 * 소스 서비스(소스 컴퓨팅, cm-honeybee) 도메인 스텝.
 *
 * - 시나리오 문장(의도) ↔ Page Object(화면 위치·요소) 연결 계층.
 * - 마이그레이션 시나리오가 조립할 수 있도록 "소스서버 등록"·"인프라 수집"을
 *   재사용 가능한 상위 스텝으로 제공하고, 그 아래 유닛 스텝도 함께 둔다.
 */

/** fixtures/test-data.ts의 sourceServer + 환경변수(키/비밀번호)로 연결정보 조립.
 *  연결 이름도 honeybee에서 UNIQUE 제약이라 런별 고유 접미사를 붙인다. */
function connectionFromFixture(name: string): Connection {
  return {
    name: uniqueName(name),
    ip: sourceServer.ip,
    sshPort: sourceServer.sshPort,
    user: sourceServer.sshUser,
    // privateKey가 있으면 key 인증을 우선(둘 다 채우면 인증 방식이 모호해짐)
    password: sourceServer.privateKey ? undefined : sourceServer.password || undefined,
    privateKey: sourceServer.privateKey || undefined,
  };
}

// ───────────────────────── 상위(재사용) 스텝 — 마이그레이션 시나리오가 조립 ─────────────────────────

/**
 * "그리고 소스 서비스에 \"nano\"소스서버를 등록한다"
 * → 소스 서비스 화면으로 이동해 소스그룹 {string} 을 만들고, 같은 이름의 연결정보를 함께 등록한다.
 *   (온프렘 소스 서버 자리 = fixtures sourceServer)
 */
Given('소스 서비스에 {string} 소스서버를 등록한다', async ({ page }, name: string) => {
  const source = new SourceServicesPage(page);
  await source.goto();
  await source.createSourceGroupWithConnection(uniqueName(name), connectionFromFixture(name));
  // 뒤따르는 수집·저장 스텝이 *방금 등록한 그룹*을 대상으로 삼도록 기억해 둔다.
  // (예전엔 fixtures의 sourceServer.name을 그대로 박아 써서, 다른 이름으로 등록해도 엉뚱한 그룹을 집었다.)
  scenarioState.sourceGroupName = uniqueName(name);
});

/**
 * "그리고 소스 인프라를 수집한다"
 * → 등록한 소스그룹을 선택하면 하단 상세가 열리고, 상세의 Refresh로 연결 상태를 점검한 뒤
 *   Collect Infra(그룹단위 import-infra)를 실행해 결과(View Infra Meta 링크)를 확인한다.
 */
Given('소스 인프라를 수집한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  await source.selectGroup(currentSourceGroup());
  await source.collectInfra();
  await source.expectInfraCollected();
});

/**
 * "그리고 수집된 정보를 소스 모델로 저장한다"
 * → 수집 결과 팝업(Refine)에서 Convert → Save → 이름 입력 → 확인으로 인프라 소스모델(OnPremiseModel, "Basic")을 저장한다.
 *   이름은 소스그룹명(uniqueName)과 동일하게 해 이후 추천 단계에서 그 모델을 선택한다.
 */
Given('수집된 정보를 소스 모델로 저장한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  // 소스 모델 이름은 소스그룹 이름과 같게 둔다 — 이후 추천 단계가 그 이름으로 모델을 찾는다.
  const modelName = currentSourceGroup();
  await source.saveCollectedInfraAsSourceModel(modelName);
  scenarioState.sourceModelName = modelName;
});

// ───────────────────────── 유닛 스텝 ─────────────────────────

/** "먼저 소스 서비스 화면을 연다" */
Given('소스 서비스 화면을 연다', async ({ page }) => {
  await new SourceServicesPage(page).goto();
});

/** "만약 \"e2e-src\" 이름으로 소스그룹을 생성하면" — 연결정보 없이 그룹만 */
When('{string} 이름으로 소스그룹을 생성하면', async ({ page }, name: string) => {
  await new SourceServicesPage(page).createSourceGroup(uniqueName(name));
});

/** "만약 \"e2e-src\" 소스그룹에 \"e2e-conn\" 연결정보를 등록하면" — 그룹+연결정보 동시 등록 */
When(
  '{string} 소스그룹에 {string} 연결정보를 등록하면',
  async ({ page }, groupName: string, connName: string) => {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupWithConnection(uniqueName(groupName), connectionFromFixture(connName));
  },
);

/** "그리고 \"e2e-src\" 소스그룹을 선택한다" */
Given('{string} 소스그룹을 선택한다', async ({ page }, name: string) => {
  await new SourceServicesPage(page).selectGroup(uniqueName(name));
});

/** "그리고 \"e2e-conn\" 연결정보를 선택한다" (연결 탭 진입 포함) */
Given('{string} 연결정보를 선택한다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).openConnection(uniqueName(connName));
});

/** "만약 인프라 수집을 실행하면" (현재 선택된 연결정보 기준) */
When('인프라 수집을 실행하면', async ({ page }) => {
  await new SourceServicesPage(page).collectInfra();
});

// ───────────────────────── 검증 스텝 ─────────────────────────

/** "그러면 소스그룹 목록에 \"e2e-src\" 이\\(가\\) 보인다" */
Then('소스그룹 목록에 {string} 이\\(가\\) 보인다', async ({ page }, name: string) => {
  // 생성은 uniqueName으로 하는데 확인은 원래 이름으로 하고 있었다 — 같은 이름으로 맞춘다.
  await new SourceServicesPage(page).expectGroupListed(uniqueName(name));
});

/** "그러면 연결정보 목록에 \"e2e-conn\" 이\\(가\\) 보인다" */
Then('연결정보 목록에 {string} 이\\(가\\) 보인다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).expectConnectionListed(uniqueName(connName));
});

/** "그러면 인프라 수집 결과가 조회된다" (정제 결과 링크 노출) */
Then('인프라 수집 결과가 조회된다', async ({ page }) => {
  await new SourceServicesPage(page).expectInfraCollected();
});
