import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkloadPage } from '../pages/workload.page';
import { workload } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * 워크로드(인프라 MCI + 노드 VM + 부하테스트) 스텝.
 *
 * ★ 현행화: 인프라 조회는 cm-beetle 경유(ListInfra), 삭제는 DeleteInfra,
 *   식별자는 infraId/nodeId. 부하테스트는 cm-ant(Runloadtest 등).
 *
 * 화면 위치·셀렉터는 이 파일이 아니라 WorkloadPage(Page Object)에 있다.
 * 유닛 테스트와 마이그레이션 시나리오가 이 스텝을 함께 재사용한다.
 */

// ─────────────────────────────────────────────────────────────
// MCI(인프라) 목록·상세 — ListInfra / cm-beetle/GetInfra
// ─────────────────────────────────────────────────────────────

/** "워크로드 인프라 목록을 연다" — 목록 화면 진입 후 로딩 확인 */
Given('워크로드 인프라 목록을 연다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
});

/** "인프라 목록이 조회된다" — ListInfra 결과 렌더 확인 */
Then('인프라 목록이 조회된다', async ({ page }) => {
  await new WorkloadPage(page).expectMciListLoaded();
});

/** "\"e2e-target-infra\" 인프라가 목록에 보인다" */
Then('{string} 인프라가 목록에 보인다', async ({ page }, infraName: string) => {
  await new WorkloadPage(page).expectMciVisible(infraName);
});

/** "\"e2e-target-infra\" 인프라를 선택한다" */
When('{string} 인프라를 선택한다', async ({ page }, infraName: string) => {
  await new WorkloadPage(page).selectMci(infraName);
});

/** "인프라 상세 정보가 보인다" — cm-beetle/GetInfra 상세 테이블 확인 */
Then('인프라 상세 정보가 보인다', async ({ page }) => {
  await new WorkloadPage(page).openDetailTab();
});

/** "\"e2e-target-infra\" 인프라의 서버 목록을 연다" — 인프라 선택 후 서버 탭 진입 */
When('{string} 인프라의 서버 목록을 연다', async ({ page }, infraName: string) => {
  const wl = new WorkloadPage(page);
  await wl.selectMci(infraName);
  await wl.openServerTab();
});

/** "\"e2e-target-node\" 노드가 서버 목록에 보인다" */
Then('{string} 노드가 서버 목록에 보인다', async ({ page }, nodeName: string) => {
  await new WorkloadPage(page).expectNodeVisible(nodeName);
});

/** "\"e2e-target-node\" 노드를 선택한다" — 노드 카드 클릭(정보/부하테스트 탭 활성화) */
When('{string} 노드를 선택한다', async ({ page }, nodeName: string) => {
  await new WorkloadPage(page).selectNode(nodeName);
});

// ─────────────────────────────────────────────────────────────
// 삭제 — DeleteInfra (@costly / 파괴적)
// ─────────────────────────────────────────────────────────────

/** "\"e2e-target-infra\" 인프라를 삭제한다" — 선택→삭제 모달→키워드 확인→confirm */
When('{string} 인프라를 삭제한다', async ({ page }, infraName: string) => {
  const wl = new WorkloadPage(page);
  await wl.selectMci(infraName);
  await wl.openDeleteModal();
  await wl.confirmDelete(infraName, 'normal');
});

/** "\"e2e-target-infra\" 인프라가 목록에서 사라진다" — 삭제 후 목록 재조회 확인 */
Then('{string} 인프라가 목록에서 사라진다', async ({ page }, infraName: string) => {
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  // 재조회 후 행 부재 확인
  await expect(wl.mciRow(infraName)).toHaveCount(0, { timeout: 20_000 });
});

// ─────────────────────────────────────────────────────────────
// 부하테스트 — Runloadtest / Getlastloadtest* (@costly)
// ─────────────────────────────────────────────────────────────

/** "\"e2e-target-node\" 노드로 부하테스트를 실행한다" — Evaluate Perf 탭→Load Config→실행 */
When('{string} 노드로 부하테스트를 실행한다', async ({ page }, nodeName: string) => {
  const wl = new WorkloadPage(page);
  await wl.selectNode(nodeName);
  await wl.openEvaluatePerfTab();
  await wl.openLoadConfig();
  await wl.fillLoadConfig(workload.loadTest);
  await wl.submitLoadConfig();
});

/** "부하테스트 결과가 표시된다" — 집계 테이블·결과/리소스 메트릭 렌더 확인 */
Then('부하테스트 결과가 표시된다', async ({ page }) => {
  await new WorkloadPage(page).expectLoadTestResult();
});

// ─────────────────────────────────────────────────────────────
// 시나리오 카탈로그 — *LoadTestScenarioCatalog*
// ─────────────────────────────────────────────────────────────

/** "부하테스트 시나리오 템플릿 \"e2e-template\"을 저장한다" */
When(
  '부하테스트 시나리오 템플릿 {string}을 저장한다',
  async ({ page }, name: string) => {
    const wl = new WorkloadPage(page);
    // 시나리오 템플릿 버튼은 노드 상세의 Evaluate Perf 탭에 있다.
    await wl.openEvaluatePerfTab();
    await wl.openScenarioTemplates();
    await wl.saveScenarioTemplate(name);
  },
);

/** "시나리오 템플릿 \"e2e-template\"이 카탈로그에 보인다" */
Then(
  '시나리오 템플릿 {string}이 카탈로그에 보인다',
  async ({ page }, name: string) => {
    await new WorkloadPage(page).expectScenarioTemplate(name);
  },
);

// ─────────────────────────────────────────────────────────────
// ★ 마이그레이션 시나리오 재사용 — 인스턴스 생성 확인 / 중지
// ─────────────────────────────────────────────────────────────

/**
 * "그러면 타깃 EC2 인스턴스가 정상 생성된다"
 * 워크로드 목록에서 마이그레이션으로 생성된 인프라(및 노드)가 실재하는지 확인.
 * fixtures/test-data.ts의 workload.infraName / workload.nodeName 기준.
 */
Then('타깃 EC2 인스턴스가 정상 생성된다', async ({ page }) => {
  await new WorkloadPage(page).expectInstanceCreated(
    workload.infraName,
    workload.nodeName,
  );
});

/**
 * "그리고 생성된 인스턴스를 중지한다"
 * 요금 보호 — terminate 금지, suspend/stop 만. 마이그레이션 시나리오 정리 단계에서 재사용.
 */
Given('생성된 인스턴스를 중지한다', async ({ page }) => {
  await new WorkloadPage(page).stopInstance(workload.infraName);
});
