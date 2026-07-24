import { createBdd } from 'playwright-bdd';
import { test, expect, getMock } from '../support/fixtures';
import type { ApiMock } from '../support/apiMock';
import { WorkloadPage } from '../pages/workload.page';
import { workload, testNamespace } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { snapshotCspResources, orphanReport } from '../support/orphanResources';

const { Given, When, Then } = createBdd(test);

/**
 * The infra targeted for force deletion. It is set in the step that checks the failure reason, and used by
 * the force-delete and orphan-report steps.
 * (A force delete leaves CSP resources behind, so we must hold on to which infra it was until the end to build the report.)
 */
let forceDeleteTarget: string | null = null;

/**
 * Workload steps (infra MCI + node VMs + load test).
 *
 * ★ Current design: infra lookup goes through cm-beetle (ListInfra), deletion via DeleteInfra,
 *   identifiers are infraId/nodeId. Load testing goes through cm-ant (Runloadtest, etc.).
 *
 * URLs and selectors live in WorkloadPage (the Page Object), not in this file.
 * Both the unit tests and the migration scenarios reuse these steps.
 */

// ─────────────────────────────────────────────────────────────
// MCI (infra) list and detail — ListInfra / cm-beetle/GetInfra
// ─────────────────────────────────────────────────────────────

/** Step "open the workload infra list" — enter the list screen and confirm loading */
Given('워크로드 인프라 목록을 연다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
});

/** Step "the infra list is loaded" — confirm the ListInfra result rendered */
Then('인프라 목록이 조회된다', async ({ page }) => {
  await new WorkloadPage(page).expectMciListLoaded();
});

/** Step "the {infra} infra appears in the list" */
Then('{string} 인프라가 목록에 보인다', async ({ page }, infraName: string) => {
  await new WorkloadPage(page).expectMciVisible(infraName);
});

/**
 * Step "at least three infras are in the list".
 *
 * The lookup limit only bites from the third infra on, so a check that runs against one or two
 * rows proves nothing. This step makes the precondition explicit instead of trusting the mock.
 */
Then('목록에 인프라가 3개 이상 보인다', async ({ page }) => {
  expect(await new WorkloadPage(page).mciRowCount()).toBeGreaterThanOrEqual(3);
});

/**
 * Step "no per-infra detail lookup happened".
 *
 * Reads the recorded outbound calls, not the screen. The screen looked right even while the
 * per-infra lookups were breaking it (BAR-1637), so the request count is the only honest witness.
 */
Then('인프라별 상세 조회가 발생하지 않았다', async () => {
  const mock = getMock();
  expect(
    mock,
    'this step needs the @mock tier — the call log lives on the mock',
  ).not.toBeNull();
  const detailCalls = (mock as ApiMock).calls.filter(
    c => c.operationId === 'cm-beetle/GetInfra',
  );
  expect(
    detailCalls.map(c => c.body?.pathParams?.infraId),
    'entering the list must not look up each infra separately',
  ).toEqual([]);
});

/** Step "the detail of {infra} was looked up once" — the server tab is where a detail lookup belongs. */
Then(
  '{string} 인프라의 상세 조회가 한 번 발생했다',
  // playwright-bdd reads the fixtures it must inject from this destructuring pattern, so the
  // first argument has to stay an object pattern even when the step needs no fixture — naming
  // it `_` makes spec generation fail outright.
  // eslint-disable-next-line no-empty-pattern
  async ({}, infraName: string) => {
    const mock = getMock();
    expect(mock, 'this step needs the @mock tier').not.toBeNull();
    await expect
      .poll(
        () =>
          (mock as ApiMock).calls.filter(
            c =>
              c.operationId === 'cm-beetle/GetInfra' &&
              c.body?.pathParams?.infraId === infraName,
          ).length,
        { timeout: 15_000 },
      )
      .toBe(1);
    // Guard against looking up the wrong infra alongside the right one.
    expect(
      (mock as ApiMock).calls
        .filter(c => c.operationId === 'cm-beetle/GetInfra')
        .map(c => c.body?.pathParams?.infraId),
    ).toEqual([infraName]);
  },
);

/** Step "select the {infra} infra" */
When('{string} 인프라를 선택한다', async ({ page }, infraName: string) => {
  await new WorkloadPage(page).selectMci(infraName);
});

/** Step "the infra detail is shown" — confirm the cm-beetle/GetInfra detail table */
Then('인프라 상세 정보가 보인다', async ({ page }) => {
  await new WorkloadPage(page).openDetailTab();
});

/** Step "open the server list of the {infra} infra" — select the infra, then enter the server tab */
When(
  '{string} 인프라의 서버 목록을 연다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectMci(infraName);
    await wl.openServerTab();
  },
);

/** Step "the {node} node appears in the server list" */
Then(
  '{string} 노드가 서버 목록에 보인다',
  async ({ page }, nodeName: string) => {
    await new WorkloadPage(page).expectNodeVisible(nodeName);
  },
);

/** Step "select the {node} node" — click the node card (activates the info / load-test tabs) */
When('{string} 노드를 선택한다', async ({ page }, nodeName: string) => {
  await new WorkloadPage(page).selectNode(nodeName);
});

// ─────────────────────────────────────────────────────────────
// Deletion — DeleteInfra (@costly / destructive)
// ─────────────────────────────────────────────────────────────

/** Step "delete the {infra} infra" — select -> delete modal -> keyword confirmation -> confirm */
When('{string} 인프라를 삭제한다', async ({ page }, infraName: string) => {
  const wl = new WorkloadPage(page);
  await wl.selectMci(infraName);
  await wl.openDeleteModal();
  await wl.confirmDelete(infraName, 'normal');
});

/** Step "the {infra} infra disappears from the list" — re-fetch the list after deletion and confirm */
Then(
  '{string} 인프라가 목록에서 사라진다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    // Confirm the row is absent after re-fetching
    await expect(wl.mciRow(infraName)).toHaveCount(0, { timeout: 20_000 });
  },
);

// ── BAR-1444 asynchronous deletion flow ──────────────────────────────────

/** Step "deleting the {infra} infra shows a deletion-in-progress screen" — select -> modal -> confirm -> confirm progress */
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

/** Step "the {infra} infra is deleted and disappears from the list" — refresh the list until done and confirm absence (all pages) */
Then(
  '{string} 인프라가 삭제되어 목록에서 사라진다',
  async ({ page }, infraName: string) => {
    await new WorkloadPage(page).expectInfraGone(infraName);
  },
);

/** Step "close the deletion-in-progress modal" — [Close] on the progress step. Return to the list and look at the delete-status column. */
When('삭제 처리 중 모달을 닫는다', async ({ page }) => {
  await new WorkloadPage(page).closeDeleteModal();
});

/** Step "in the list, the delete status of {infra} shows as \"in progress\"" */
Then(
  '목록에서 {string} 의 삭제 상태가 {string} 으로 보인다',
  async ({ page }, _infraName: string, status: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await wl.expectRowDeleteStatus(status as '진행 중' | '에러');
  },
);

/** Step "trying to delete the {infra} infra again shows an already-in-progress notice" — duplicate-delete guard */
When(
  '{string} 인프라를 다시 삭제하려 하면 이미 처리 중 안내가 나온다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    // Closing the modal re-renders the list and clears the selection, so re-select first.
    await wl.reselectAndTriggerDelete(infraName);
    await wl.expectDeleteAlreadyInProgress();
  },
);

/** Step "open the delete modal of the {infra} infra" — opens only the modal, sends no request. */
When(
  '{string} 인프라의 삭제 모달을 연다',
  async ({ page }, infraName: string) => {
    const wl = new WorkloadPage(page);
    await wl.selectMci(infraName);
    await wl.openDeleteModal();
  },
);

/**
 * Step "the modal blocks the background so you cannot navigate away"
 *
 * Judged by whether an element is *actually clickable*, not whether it is visible. If the modal covers the
 * background, the click attempt should be blocked and fail.
 */
Then('모달이 배경을 막아 다른 화면으로 이동할 수 없다', async ({ page }) => {
  await new WorkloadPage(page).expectBackgroundBlocked();
});

/** Step "refresh the screen" */
When('화면을 새로고침한다', async ({ page }) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .waitForLoadState('networkidle', { timeout: 30_000 })
    .catch(() => {});
});

/**
 * Step "the screen is not locked and can be operated"
 *
 * ★ Why check this — if the modal closed but only the overlay remains, the screen behaves as if frozen while
 *   *looking normal to the eye.* Element presence does not catch it, so we assert on actual clickability.
 */
Then('화면이 잠기지 않고 조작할 수 있다', async ({ page }) => {
  await new WorkloadPage(page).expectScreenInteractive();
});

/** A synonymous step to absorb the Korean particle difference "ro/euro" (the "shows as error" phrasing). */
Then(
  '목록에서 {string} 의 삭제 상태가 {string} 로 보인다',
  async ({ page }, _infraName: string, status: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    await wl.expectRowDeleteStatus(status as '진행 중' | '에러');
  },
);

/** Step "trying to delete the {infra} infra again shows the failure reason along with recovery options" */
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
 * Step "running a force delete shows a deletion-in-progress screen"
 *
 * ★ A force delete leaves CSP resources behind. Once deleted there is no way to tell what remains, so *just
 *   before* running it we take a snapshot of the resource IDs (the orphan-report step below uses this snapshot).
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

/** Step "record the CSP resources left by the force delete in the result report" — orphan-resource post-processing report */
Then('강제 삭제로 남은 CSP 리소스를 결과서에 기록한다', async () => {
  if (!forceDeleteTarget) {
    throw new Error('대상 인프라를 알 수 없어 고아 리포트를 만들 수 없다.');
  }
  const md = orphanReport(
    forceDeleteTarget,
    '강제 삭제(force) 수행 — 시나리오',
  );
  // Emit the report body to the test log so it can be copied verbatim into the result report.
  console.log(md);
});

// ─────────────────────────────────────────────────────────────
// Load test — Runloadtest / Getlastloadtest* (@costly)
// ─────────────────────────────────────────────────────────────

/** Step "run a load test on the {node} node" — Evaluate Perf tab -> Load Config -> run */
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

/** Step "the load-test result is displayed" — confirm the summary table and result/resource metrics rendered */
Then('부하테스트 결과가 표시된다', async ({ page }) => {
  await new WorkloadPage(page).expectLoadTestResult(
    scenarioState.infraName ?? workload.infraName,
    workload.nodeName,
  );
});

// ─────────────────────────────────────────────────────────────
// Scenario catalog — *LoadTestScenarioCatalog*
// ─────────────────────────────────────────────────────────────

/** Step "save the load-test scenario template {name}" */
When(
  '부하테스트 시나리오 템플릿 {string}을 저장한다',
  async ({ page }, name: string) => {
    const wl = new WorkloadPage(page);
    // The scenario-template button is on the Evaluate Perf tab of the node detail.
    await wl.openEvaluatePerfTab();
    await wl.openScenarioTemplates();
    await wl.saveScenarioTemplate(name);
  },
);

/** Step "the scenario template {name} appears in the catalog" */
Then(
  '시나리오 템플릿 {string}이 카탈로그에 보인다',
  async ({ page }, name: string) => {
    await new WorkloadPage(page).expectScenarioTemplate(name);
  },
);

// ─────────────────────────────────────────────────────────────
// ★ Migration scenario reuse — verify instance creation / stop
// ─────────────────────────────────────────────────────────────

/**
 * Step "then the target EC2 instance is created successfully"
 * Confirm that the infra (and node) created by the migration actually exists in the workload list.
 * Based on workload.infraName / workload.nodeName from fixtures/test-data.ts.
 */
Then('타깃 EC2 인스턴스가 정상 생성된다', async ({ page }) => {
  // If the infra was renamed in the workflow tool, we must verify against *that name*.
  // Looking only at the fixed name (infra101) would not tell us whether the rename actually took effect.
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).expectInstanceCreated(
    infraName,
    workload.nodeName,
  );

  // The infra verified here is the target of the later steps (software migration, remote command, load test).
  // In cb-tumblebug/cm-beetle, an infra's id is its name.
  scenarioState.infraName = infraName;
  scenarioState.infraId = infraName;
});

/**
 * Step "then the created infra reaches the Running state"
 * The node name is chosen by cm-beetle, so it is hard to assert in advance. So here we only confirm that
 * *the infra (MCI) exists and the node is Running* (we do not match the node name). We look it up by the
 * name changed in the workflow tool (scenarioState.infraName).
 */
Then('생성된 인프라가 Running 상태가 된다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).expectInstanceCreated(infraName);
  scenarioState.infraId = infraName;
});

/**
 * Step "and stop the created instance"
 * Cost protection — no terminate, only suspend/stop. Reused in the migration scenario cleanup step.
 */
Given('생성된 인스턴스를 중지한다', async ({ page }) => {
  await new WorkloadPage(page).stopInstance(workload.infraName);
});

/**
 * Step "and stop the created infra" — stop it by the name changed in the workflow tool (scenarioState.infraName).
 * Per the §6-4 policy: after verification, the infra is *only stopped, not deleted* (models and connections are preserved too).
 */
Given('생성된 인프라를 중지한다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;
  await new WorkloadPage(page).stopInstance(infraName);
});

// ─────────────────────────────────────────────────────────────
// ★ Scenario reuse — verify the detail and nodes of the created infra
//
// These two checks only hold if the infra is *actually alive*. The only way to create an infra is the
// migration workflow (= EC2 provisioning), so isolating them as functional (@unit) tests left no one to
// create it, and they always died on timeout. So we run them inside the scenario that actually creates the
// infra, while the data is still alive.
// ─────────────────────────────────────────────────────────────

/** Step "and the detail of the created infra is shown" — cm-beetle/GetInfra detail */
Given('생성된 인프라의 상세 정보가 보인다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(scenarioState.infraName ?? workload.infraName);
  await wl.openDetailTab();
});

/** Step "and the node list of the created infra is shown" — server (node) tab */
Given('생성된 인프라의 노드 목록이 보인다', async ({ page }) => {
  const wl = new WorkloadPage(page);
  // ⚠️ Do not call selectMci again here — row selection is a checkbox toggle, so pressing again on what a
  //    previous step already selected *clears the selection*. Once cleared, the Detail/Server tabs disappear
  //    and the server tab cannot be found. (This actually failed that way.) Reuse the selected state that the
  //    previous step ("the detail is shown") left in place.
  await wl.openServerTab();
  await wl.expectNodeVisible(workload.nodeName);
});

/** Step "first clean up the workload left by a previous run" — if a dead infra with the same name (infra101) remains, remove it before starting */
Given('앞선 실행이 남긴 워크로드를 정리한다', async ({ page }) => {
  await new WorkloadPage(page).removeStaleInfra(workload.infraName);
});
