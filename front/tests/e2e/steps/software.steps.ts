import { createBdd } from 'playwright-bdd';
import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { config, testNamespace, getUser } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { WorkflowPage } from '../pages/workflow.page';

const { Then } = createBdd(test);

/**
 * Step for verifying software migration results.
 *
 * ★ What it judges — **whether our side (the console) called correctly.**
 *
 *   Whether the software actually all installed is cm-grasshopper's job, and right now it works
 *   for some software and not for others. Failing e2e over that would light it red every time even
 *   though the console is fine, hiding the regressions on our side that we actually care about.
 *
 *   So we split it this way.
 *
 *   | Situation | Verdict |
 *   |-----------|---------|
 *   | grasshopper has no record of our execution / the target isn't our infra | **Fail** — we called wrong |
 *   | The result screen (View SW) doesn't appear or errors out | **Fail** — the console can't show the result |
 *   | The execution record exists and the screen shows results, but some software failed | **Pass + report** — grasshopper's job |
 *
 *   Either way, per-software success/failure is recorded in the report. "We ran it and this is what
 *   came out" is this test's deliverable.
 */

async function loginToken(request: APIRequestContext): Promise<string> {
  const u = getUser('cmiguser');
  const res = await request.post(`${config.baseURL}/api/auth/login`, {
    data: { request: { id: u.id, password: u.password } },
  });
  const body = await res.json();
  return body?.responseData?.access_token ?? body?.access_token ?? '';
}

interface SwStatus {
  software_name: string;
  software_version?: string;
  software_install_type?: string;
  status: string;
  error_message?: string;
}

/** Execution list — which execution targets which node */
async function fetchExecutions(
  request: APIRequestContext,
  token: string,
): Promise<any[]> {
  const res = await request.post(
    `${config.baseURL}/api/cm-grasshopper/List-Software-Migration-Status`,
    { headers: { Authorization: `Bearer ${token}` }, data: {} },
  );
  if (!res.ok()) return [];
  const rd = (await res.json().catch(() => null))?.responseData;
  return Array.isArray(rd) ? rd : (rd?.status_list ?? []);
}

/** Execution detail — per-software status (the exact API the console's result screen uses) */
async function fetchExecutionDetail(
  request: APIRequestContext,
  token: string,
  executionId: string,
): Promise<any | null> {
  const res = await request.post(
    `${config.baseURL}/api/cm-grasshopper/Get-Software-Migration-Status`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { pathParams: { executionId } },
    },
  );
  if (!res.ok()) return null;
  return (await res.json().catch(() => null))?.responseData ?? null;
}

/** The *node id* of the infra this scenario created — the key for singling out the execution. */
async function fetchOurNodeId(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const res = await request.post(`${config.baseURL}/api/cm-beetle/GetInfra`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      pathParams: {
        nsId: testNamespace.id,
        infraId: scenarioState.infraId ?? scenarioState.infraName,
      },
    },
  });
  const body = await res.json().catch(() => null);
  const infra = body?.responseData?.data ?? body?.responseData ?? {};
  return (infra.node ?? [])[0]?.id ?? '';
}

/**
 * Pick only this scenario's executions.
 *
 * ★ It can't be filtered by name or by node id.
 *
 *   cm-beetle always creates the target infra with the same name (`infra101`), and cb-tumblebug
 *   **reassigns the same node id** to that infra's nodes (`vm-<subgroup>-1`). So grasshopper records
 *   left by earlier executions look identical to this one by both name and node. Two past executions
 *   were in fact picked up as this one.
 *
 *   The only thing that distinguishes them is the **time** — only those started after the moment we
 *   ran the workflow are ours. (We allow a 2-minute margin for clock skew and delay.)
 */
const CLOCK_SKEW_MS = 2 * 60_000;

function isOurs(execution: any, nodeId: string): boolean {
  const since = (scenarioState.swRunStartedAt ?? 0) - CLOCK_SKEW_MS;
  const startedAt = Date.parse(execution?.started_at ?? '');
  if (!Number.isFinite(startedAt) || startedAt < since) return false;

  return (execution?.target_mappings ?? []).some(
    (m: any) =>
      m?.target?.node_id === nodeId &&
      m?.target?.namespace_id === testNamespace.id,
  );
}

const TERMINAL =
  /^(finished|failed|success|succeeded|completed|finished with error)$/i;

/**
 * Step "then the software migration results are retrieved"
 *
 * Waits until grasshopper finishes, then collects per-software results into the report.
 * The only thing judged as a failure is *when our call was wrong*.
 */
Then(
  '소프트웨어 마이그레이션 결과가 조회된다',
  async ({ request, $testInfo }) => {
    test.setTimeout(60 * 60_000);
    const token = await loginToken(request);
    const infraId = scenarioState.infraId ?? scenarioState.infraName;

    // 0) The node id created this time — needed to distinguish from records left by earlier executions (the infra name is always the same).
    const nodeId =
      scenarioState.nodeId || (await fetchOurNodeId(request, token));
    scenarioState.nodeId = nodeId;
    expect(
      nodeId,
      `"${infraId}" 의 노드 id를 확인하지 못했다 — 인프라 생성이 끝나지 않았을 수 있다.`,
    ).toBeTruthy();

    // 1) Wait until an execution targeting our node is found. If none is found, we called wrong.
    let ours: any[] = [];
    for (let i = 0; i < 20 && ours.length === 0; i++) {
      ours = (await fetchExecutions(request, token)).filter(e =>
        isOurs(e, nodeId),
      );
      if (ours.length === 0) await new Promise(r => setTimeout(r, 30_000));
    }

    expect(
      ours.length,
      `cm-grasshopper에 이번 노드(${nodeId} / ${infraId})를 대상으로 하는 마이그레이션 실행이 없다 — ` +
        '워크플로우 툴에서 넣은 nsId·infraId 가 grasshopper까지 전달되지 않았다(우리 쪽 호출 문제).',
    ).toBeGreaterThan(0);

    scenarioState.swExecutionIds = ours.map(e => e.execution_id);
    console.log(
      `[sw] ${ours.length} execution(s) targeting this node (${nodeId}): ${scenarioState.swExecutionIds.join(', ')}`,
    );

    // 2) Wait until it finishes (up to 45 minutes). If it doesn't finish, report the results up to that point.
    const deadline = Date.now() + 45 * 60_000;
    let rows: SwStatus[] = [];
    let settled = false;
    for (;;) {
      rows = [];
      let allDone = true;
      for (const id of scenarioState.swExecutionIds) {
        const detail = await fetchExecutionDetail(request, token, id);
        for (const m of detail?.target_mappings ?? []) {
          if (!TERMINAL.test(m?.status ?? '')) allDone = false;
          rows.push(...(m?.software_migration_status_list ?? []));
        }
      }
      if (allDone && rows.length > 0) {
        settled = true;
        break;
      }
      if (Date.now() > deadline) break;
      await new Promise(r => setTimeout(r, 60_000));
    }

    scenarioState.swMigrationRows = rows;

    // 3) Format the results into something human-readable and attach it to the report.
    const done = rows.filter(r => /finish|success|complete/i.test(r.status));
    const failed = rows.filter(r => /fail|error/i.test(r.status));
    const md = [
      '# 소프트웨어 마이그레이션 결과',
      '',
      `- 대상 인프라: ${infraId} (namespace ${testNamespace.id})`,
      `- 실행: ${scenarioState.swExecutionIds.join(', ')}`,
      `- 종료 여부: ${settled ? '종료' : '**시간 내 미종료(45분)** — 그 시점까지의 결과'}`,
      '',
      `| 전체 | 성공 | 실패 |`,
      `|------|------|------|`,
      `| ${rows.length} | ${done.length} | ${failed.length} |`,
      '',
      ...(failed.length
        ? [
            '## 실패한 소프트웨어',
            '',
            '| 소프트웨어 | 설치방식 | 상태 | 오류 |',
            '|-----------|---------|------|------|',
            ...failed
              .slice(0, 40)
              .map(
                r =>
                  `| ${r.software_name} | ${r.software_install_type ?? '-'} | ${r.status} | ${(r.error_message ?? '').slice(0, 160).replace(/\|/g, '/')} |`,
              ),
          ]
        : ['소프트웨어 전부 성공.']),
    ].join('\n');

    await $testInfo.attach('소프트웨어-마이그레이션-결과', {
      body: md,
      contentType: 'text/markdown',
    });
    console.log('\n' + md + '\n');

    // 4) Don't fail here — per-software success/failure is grasshopper's job, and we verify and report the results.
    //    But *if no software was processed at all*, grasshopper never received the request, so we suspect our side.
    expect(
      rows.length,
      '소프트웨어 마이그레이션 대상이 하나도 없다 — 타깃 SW 모델이 비어 있거나 요청 본문이 잘못 갔다(우리 쪽 문제).',
    ).toBeGreaterThan(0);
  },
);

/**
 * Step "and the software migration result screen shows per-software status"
 *
 * The execution history's "View SW" → the result screen. This is the path where the user sees the
 * results. It also cross-checks that what the screen shows matches what the API says — if they
 * differ, the screen is lying.
 */
Then(
  '소프트웨어 마이그레이션 결과 화면에 소프트웨어별 상태가 보인다',
  async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const wf = new WorkflowPage(page);

    await wf.gotoWorkflows();
    if (scenarioState.softwareWorkflowName) {
      await wf.selectWorkflow(scenarioState.softwareWorkflowName);
    }
    await wf.openHistoryTab();

    expect(
      await wf.hasSoftwareMigrationResult(),
      '실행 이력에 "View SW" 버튼이 없다 — 콘솔이 이 실행을 소프트웨어 마이그레이션으로 인식하지 못했다.',
    ).toBeTruthy();

    await wf.openSoftwareMigrationResult();

    const error = await wf.softwareMigrationErrorText();
    expect(
      error,
      `결과 화면이 소프트웨어 마이그레이션 상태를 가져오지 못했다: ${error}`,
    ).toBe('');

    const shown = await wf.readSoftwareMigrationRows();
    console.log(
      `[sw] result screen ${shown.length} row(s) — ${shown
        .slice(0, 5)
        .map(r => `${r.name}:${r.status}`)
        .join(', ')}${shown.length > 5 ? ' …' : ''}`,
    );

    expect(
      shown.length,
      '결과 화면에 소프트웨어가 한 줄도 없다 — API는 결과를 주는데 화면이 못 그리고 있다.',
    ).toBeGreaterThan(0);

    // Cross-check that the software the API reported is also on the screen (that the screen isn't just an empty shell).
    const fromApi = new Set(
      (scenarioState.swMigrationRows ?? []).map(
        (r: SwStatus) => r.software_name,
      ),
    );
    const missing = [...fromApi].filter(
      name => !shown.some(s => s.name === name),
    );
    expect(
      missing.length,
      `API가 알려준 소프트웨어가 화면에 없다: ${missing.slice(0, 10).join(', ')}`,
    ).toBe(0);
  },
);
