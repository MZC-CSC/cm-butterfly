import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkloadPage } from '../pages/workload.page';
import { workload, testNamespace } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { snapshotCspResources, orphanReport } from '../support/orphanResources';

const { Given, When, Then } = createBdd(test);

/**
 * 강제 삭제 대상 인프라. 실패 사유를 확인하는 스텝에서 정해지고, 강제 삭제 실행·고아 리포트 스텝이 쓴다.
 * (강제 삭제는 CSP 자원을 남기므로 어떤 인프라였는지 끝까지 붙들고 있어야 리포트를 만들 수 있다.)
 */
let forceDeleteTarget: string | null = null;

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
When(
  '{string} 인프라의 서버 목록을 연다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectMci(infraName);
    await wl.openServerTab();
  },
);

/** "\"e2e-target-node\" 노드가 서버 목록에 보인다" */
Then(
  '{string} 노드가 서버 목록에 보인다',
  async ({ page }, nodeName: string) => {
    await new WorkloadPage(page).expectNodeVisible(nodeName);
  },
);

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
Then(
  '{string} 인프라가 목록에서 사라진다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    // 재조회 후 행 부재 확인
    await expect(wl.mciRow(infraName)).toHaveCount(0, { timeout: 20_000 });
  },
);

// ── BAR-1444 비동기 삭제 흐름 ──────────────────────────────────────────────

/** "\"e2e-del-infra\" 인프라를 삭제하면 삭제 처리 중 화면이 뜬다" — 선택→모달→confirm→progress 확인 */
When(
  '{string} 인프라를 삭제하면 삭제 처리 중 화면이 뜬다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectMci(infraName);
    await wl.openDeleteModal();
    await wl.confirmDelete(infraName, 'normal');
    await wl.expectDeleteInProgress();
  },
);

/** "\"e2e-del-infra\" 인프라가 삭제되어 목록에서 사라진다" — 완료까지 목록을 새로고침하며 부재 확인(전 페이지) */
Then(
  '{string} 인프라가 삭제되어 목록에서 사라진다',
  async ({ page }, infraName: string) => {
    await new WorkloadPage(page).expectInfraGone(infraName);
  },
);

/** "삭제 처리 중 모달을 닫는다" — progress 단계 [닫기]. 목록으로 돌아가 삭제 상태 컬럼을 본다. */
When('삭제 처리 중 모달을 닫는다', async ({ page }) => {
  await new WorkloadPage(page).closeDeleteModal();
});

/** "목록에서 \"e2e-dup-infra\" 의 삭제 상태가 \"진행 중\" 으로 보인다" */
Then(
  '목록에서 {string} 의 삭제 상태가 {string} 으로 보인다',
  async ({ page }, _infraName: string, status: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await wl.expectRowDeleteStatus(status as '진행 중' | '에러');
  },
);

/** "\"e2e-dup-infra\" 인프라를 다시 삭제하려 하면 이미 처리 중 안내가 나온다" — 중복 삭제 방어 */
When(
  '{string} 인프라를 다시 삭제하려 하면 이미 처리 중 안내가 나온다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectMci(infraName);
    await wl.triggerDeleteMenu();
    await wl.expectDeleteAlreadyInProgress();
  },
);

/** 조사 "로/으로" 차이를 흡수하기 위한 같은 뜻의 스텝("에러 로 보인다"). */
Then(
  '목록에서 {string} 의 삭제 상태가 {string} 로 보인다',
  async ({ page }, _infraName: string, status: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await wl.expectRowDeleteStatus(status as '진행 중' | '에러');
  },
);

/** "\"e2e-del-infra\" 인프라를 다시 삭제하려 하면 실패 사유와 함께 복구 선택지가 나온다" */
When(
  '{string} 인프라를 다시 삭제하려 하면 실패 사유와 함께 복구 선택지가 나온다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    forceDeleteTarget = infraName;
    await wl.selectMci(infraName);
    await wl.triggerDeleteMenu();
    await wl.expectDeleteErrorDialog();
  },
);

/**
 * "강제 삭제를 실행하면 삭제 처리 중 화면이 뜬다"
 *
 * ★ 강제 삭제는 CSP 자원을 남긴다. 지우고 나면 무엇이 남았는지 알 수 없으므로, 실행 *직전에*
 *   자원 ID 스냅샷을 떠 둔다(아래 고아 리포트 스텝이 이 스냅샷을 쓴다).
 */
When('강제 삭제를 실행하면 삭제 처리 중 화면이 뜬다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  const target = forceDeleteTarget;
  if (target) {
    await snapshotCspResources(page, testNamespace.id, target);
  }
  await wl.forceDeleteFromError();
  await wl.expectDeleteInProgress();
});

/** "강제 삭제로 남은 CSP 리소스를 결과서에 기록한다" — 고아 리소스 후처리 리포트 */
Then('강제 삭제로 남은 CSP 리소스를 결과서에 기록한다', async () => {
  if (!forceDeleteTarget) {
    throw new Error('대상 인프라를 알 수 없어 고아 리포트를 만들 수 없다.');
  }
  const md = orphanReport(
    forceDeleteTarget,
    '강제 삭제(force) 수행 — 시나리오',
  );
  // 리포트 본문을 테스트 로그에 남겨, 결과서에 그대로 옮길 수 있게 한다.
  console.log(md);
});

// ─────────────────────────────────────────────────────────────
// 부하테스트 — Runloadtest / Getlastloadtest* (@costly)
// ─────────────────────────────────────────────────────────────

/** "\"e2e-target-node\" 노드로 부하테스트를 실행한다" — Evaluate Perf 탭→Load Config→실행 */
When(
  '{string} 노드로 부하테스트를 실행한다',
  async ({ page }, nodeName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectNode(nodeName);
    await wl.openEvaluatePerfTab();
    await wl.openLoadConfig();
    await wl.fillLoadConfig(workload.loadTest);
    await wl.submitLoadConfig();
  },
);

/** "부하테스트 결과가 표시된다" — 집계 테이블·결과/리소스 메트릭 렌더 확인 */
Then('부하테스트 결과가 표시된다', async ({ page }) => {
  await new WorkloadPage(page).expectLoadTestResult(
    scenarioState.infraName ?? workload.infraName,
    workload.nodeName,
  );
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
  // 워크플로우 툴에서 인프라 이름을 바꿨다면 *그 이름*으로 확인해야 한다.
  // 고정 이름(infra101)만 보면, 이름을 바꾼 게 실제로 반영됐는지 알 수 없다.
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).expectInstanceCreated(
    infraName,
    workload.nodeName,
  );

  // 여기서 확인된 인프라가 이후 단계(소프트웨어 마이그레이션·원격명령·부하테스트)의 대상이다.
  // cb-tumblebug/cm-beetle 에서 인프라의 id는 곧 이름이다.
  scenarioState.infraName = infraName;
  scenarioState.infraId = infraName;
});

/**
 * "그러면 생성된 인프라가 Running 상태가 된다"
 * 노드 이름은 cm-beetle이 정하는 값이라 사전에 단정하기 어렵다. 그래서 여기서는 *인프라(MCI)가 실재하고
 * 노드가 Running 인지*까지만 확인한다(노드 이름 대조는 하지 않는다). 워크플로우 툴에서 바꾼 이름
 * (scenarioState.infraName)으로 조회한다.
 */
Then('생성된 인프라가 Running 상태가 된다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).expectInstanceCreated(infraName);
  scenarioState.infraId = infraName;
});

/**
 * "그리고 생성된 인스턴스를 중지한다"
 * 요금 보호 — terminate 금지, suspend/stop 만. 마이그레이션 시나리오 정리 단계에서 재사용.
 */
Given('생성된 인스턴스를 중지한다', async ({ page }) => {
  await new WorkloadPage(page).stopInstance(workload.infraName);
});

/**
 * "그리고 생성된 인프라를 중지한다" — 워크플로우 툴에서 바꾼 이름(scenarioState.infraName)으로 중지한다.
 * §6-4 방침: 검증 후 인프라는 *삭제하지 않고 중지만* 한다(모델·커넥션도 보존).
 */
Given('생성된 인프라를 중지한다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).stopInstance(infraName);
});

// ─────────────────────────────────────────────────────────────
// ★ 시나리오 재사용 — 생성된 인프라의 상세·노드 확인
//
// 이 두 검증은 인프라가 *실제로 살아 있어야* 성립한다. 인프라를 만드는 유일한 경로가
// 마이그레이션 워크플로우(=EC2 프로비저닝)라서, 기능(@unit) 테스트로 떼어 두면 만들어 줄 사람이 없어
// 항상 타임아웃으로 죽었다. 그래서 인프라를 실제로 만드는 시나리오 안에서, 데이터가 살아 있는 동안 본다.
// ─────────────────────────────────────────────────────────────

/** "그리고 생성된 인프라의 상세 정보가 보인다" — cm-beetle/GetInfra 상세 */
Given('생성된 인프라의 상세 정보가 보인다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(scenarioState.infraName ?? workload.infraName);
  await wl.openDetailTab();
});

/** "그리고 생성된 인프라의 노드 목록이 보인다" — 서버(노드) 탭 */
Given('생성된 인프라의 노드 목록이 보인다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  // ⚠️ 여기서 selectMci를 다시 부르면 안 된다 — 행 선택은 체크박스 토글이라, 앞 스텝에서 이미 선택해 둔 것을
  //    한 번 더 누르면 *선택이 풀린다*. 선택이 풀리면 Detail/Server 탭 자체가 사라져서 서버 탭을 못 찾는다.
  //    (실제로 그렇게 실패했다.) 앞 스텝(상세 정보가 보인다)이 선택해 둔 상태를 그대로 쓴다.
  await wl.openServerTab();
  await wl.expectNodeVisible(workload.nodeName);
});

/** "먼저 앞선 실행이 남긴 워크로드를 정리한다" — 같은 이름(infra101)의 죽은 인프라가 남아 있으면 지우고 시작 */
Given('앞선 실행이 남긴 워크로드를 정리한다', async ({ page }) => {
  await new WorkloadPage(page).removeStaleInfra(workload.infraName);
});
