import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { SourceServicesPage, Connection } from '../pages/sourceServices.page';
import { sourceServer } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * 소스 서비스(소스 컴퓨팅, cm-honeybee) 도메인 스텝.
 *
 * - 시나리오 문장(의도) ↔ Page Object(화면 위치·요소) 연결 계층.
 * - 마이그레이션 시나리오가 조립할 수 있도록 "소스서버 등록"·"인프라 수집"을
 *   재사용 가능한 상위 스텝으로 제공하고, 그 아래 유닛 스텝도 함께 둔다.
 */

/** fixtures/test-data.ts의 sourceServer + 환경변수(키/비밀번호)로 연결정보 조립 */
function connectionFromFixture(name: string): Connection {
  return {
    name,
    ip: sourceServer.ip,
    sshPort: sourceServer.sshPort,
    user: sourceServer.sshUser,
    password: process.env.TEST_SOURCE_PASSWORD || undefined,
    privateKey: process.env.TEST_SOURCE_PRIVATE_KEY || undefined,
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
  await source.createSourceGroupWithConnection(name, connectionFromFixture(name));
});

/**
 * "그리고 소스 인프라를 수집한다"
 * → 직전에 등록한 소스그룹/연결정보를 선택해 인프라 수집(import-infra)을 실행하고 결과를 확인한다.
 *   (연결정보명은 소스그룹명과 동일하게 등록되므로 sourceServer.name 기준으로 재선택)
 */
Given('소스 인프라를 수집한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  await source.openConnection(sourceServer.name);
  await source.collectInfra();
  await source.expectInfraCollected();
});

// ───────────────────────── 유닛 스텝 ─────────────────────────

/** "먼저 소스 서비스 화면을 연다" */
Given('소스 서비스 화면을 연다', async ({ page }) => {
  await new SourceServicesPage(page).goto();
});

/** "만약 \"e2e-src\" 이름으로 소스그룹을 생성하면" — 연결정보 없이 그룹만 */
When('{string} 이름으로 소스그룹을 생성하면', async ({ page }, name: string) => {
  await new SourceServicesPage(page).createSourceGroup(name);
});

/** "만약 \"e2e-src\" 소스그룹에 \"e2e-conn\" 연결정보를 등록하면" — 그룹+연결정보 동시 등록 */
When(
  '{string} 소스그룹에 {string} 연결정보를 등록하면',
  async ({ page }, groupName: string, connName: string) => {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupWithConnection(groupName, connectionFromFixture(connName));
  },
);

/** "그리고 \"e2e-src\" 소스그룹을 선택한다" */
Given('{string} 소스그룹을 선택한다', async ({ page }, name: string) => {
  await new SourceServicesPage(page).selectGroup(name);
});

/** "그리고 \"e2e-conn\" 연결정보를 선택한다" (연결 탭 진입 포함) */
Given('{string} 연결정보를 선택한다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).openConnection(connName);
});

/** "만약 인프라 수집을 실행하면" (현재 선택된 연결정보 기준) */
When('인프라 수집을 실행하면', async ({ page }) => {
  await new SourceServicesPage(page).collectInfra();
});

// ───────────────────────── 검증 스텝 ─────────────────────────

/** "그러면 소스그룹 목록에 \"e2e-src\" 이\\(가\\) 보인다" */
Then('소스그룹 목록에 {string} 이\\(가\\) 보인다', async ({ page }, name: string) => {
  await new SourceServicesPage(page).expectGroupListed(name);
});

/** "그러면 연결정보 목록에 \"e2e-conn\" 이\\(가\\) 보인다" */
Then('연결정보 목록에 {string} 이\\(가\\) 보인다', async ({ page }, connName: string) => {
  await new SourceServicesPage(page).expectConnectionListed(connName);
});

/** "그러면 인프라 수집 결과가 조회된다" (정제 결과 링크 노출) */
Then('인프라 수집 결과가 조회된다', async ({ page }) => {
  await new SourceServicesPage(page).expectInfraCollected();
});
