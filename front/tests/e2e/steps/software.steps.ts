import { createBdd } from 'playwright-bdd';
import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { config, testNamespace, getUser } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { WorkflowPage } from '../pages/workflow.page';

const { Then } = createBdd(test);

/**
 * 소프트웨어 마이그레이션 결과 확인 스텝.
 *
 * ★ 무엇을 판정하나 — **우리(콘솔) 쪽이 제대로 호출했는가** 다.
 *
 *   소프트웨어가 실제로 다 설치됐는지는 cm-grasshopper의 몫이고, 지금은 소프트웨어에 따라 되는 것도 있고
 *   안 되는 것도 있다. 그걸 이유로 e2e를 실패시키면, 콘솔이 멀쩡한데도 매번 빨간 불이 켜져 정작 우리 쪽
 *   회귀를 못 본다.
 *
 *   그래서 이렇게 가른다.
 *
 *   | 상황 | 판정 |
 *   |------|------|
 *   | grasshopper에 우리 실행 기록이 없다 / 대상이 우리 인프라가 아니다 | **실패** — 우리가 잘못 불렀다 |
 *   | 결과 화면(View SW)이 안 뜨거나 오류를 낸다 | **실패** — 콘솔이 결과를 못 보여준다 |
 *   | 실행 기록도 있고 화면도 결과를 보여주는데, 일부 소프트웨어가 failed | **통과 + 보고** — grasshopper 몫 |
 *
 *   어느 쪽이든 소프트웨어별 성공/실패는 리포트에 남긴다. "돌렸더니 이렇게 나왔다"가 이 테스트의 산출물이다.
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

/** 실행 목록 — 어떤 실행이 어느 노드를 대상으로 도는지 */
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

/** 실행 상세 — 소프트웨어별 상태(콘솔의 결과 화면이 쓰는 바로 그 API) */
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

/** 이번 시나리오가 만든 인프라의 *노드 id* — 실행을 가려내는 열쇠다. */
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
 * 이번 시나리오의 실행만 고른다.
 *
 * ★ 이름으로도 노드 id로도 거를 수 없다.
 *
 *   cm-beetle은 타깃 인프라를 늘 같은 이름(`infra101`)으로 만들고, cb-tumblebug은 그 인프라의 노드에
 *   **같은 노드 id를 다시 부여한다**(`vm-<subgroup>-1`). 그래서 앞선 실행이 남긴 grasshopper 기록이
 *   이름으로도 노드로도 이번 것과 똑같아 보인다. 실제로 지난 실행 2건이 이번 것으로 잡혔다.
 *
 *   구분되는 건 **시각**뿐이다 — 워크플로우를 실행한 시점 이후에 시작된 것만 우리 것이다.
 *   (시계 차이·지연을 고려해 2분 여유를 둔다.)
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
 * "그러면 소프트웨어 마이그레이션 결과가 조회된다"
 *
 * grasshopper가 끝날 때까지 기다렸다가, 소프트웨어별 결과를 모아 리포트에 남긴다.
 * 실패로 판정하는 건 *우리 호출이 잘못됐을 때*뿐이다.
 */
Then(
  '소프트웨어 마이그레이션 결과가 조회된다',
  async ({ request, $testInfo }) => {
    test.setTimeout(60 * 60_000);
    const token = await loginToken(request);
    const infraId = scenarioState.infraId ?? scenarioState.infraName;

    // 0) 이번에 만든 노드 id — 이게 있어야 앞선 실행이 남긴 기록과 구분된다(인프라 이름은 늘 같다).
    const nodeId =
      scenarioState.nodeId || (await fetchOurNodeId(request, token));
    scenarioState.nodeId = nodeId;
    expect(
      nodeId,
      `"${infraId}" 의 노드 id를 확인하지 못했다 — 인프라 생성이 끝나지 않았을 수 있다.`,
    ).toBeTruthy();

    // 1) 우리 노드를 대상으로 하는 실행이 잡힐 때까지 기다린다. 이게 안 잡히면 우리가 잘못 부른 것이다.
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
      `[sw] 이번 노드(${nodeId}) 대상 실행 ${ours.length}건: ${scenarioState.swExecutionIds.join(', ')}`,
    );

    // 2) 끝날 때까지 기다린다(최대 45분). 안 끝나도 그 시점까지의 결과를 보고한다.
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

    // 3) 결과를 사람이 읽을 수 있게 정리해 리포트에 붙인다.
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

    // 4) 여기서 실패시키지 않는다 — 소프트웨어별 성패는 grasshopper 몫이고, 우리는 결과를 확인·보고한다.
    //    다만 *아무 소프트웨어도 처리되지 않았다면* grasshopper가 요청을 아예 못 받은 것이니 우리 쪽을 의심한다.
    expect(
      rows.length,
      '소프트웨어 마이그레이션 대상이 하나도 없다 — 타깃 SW 모델이 비어 있거나 요청 본문이 잘못 갔다(우리 쪽 문제).',
    ).toBeGreaterThan(0);
  },
);

/**
 * "그리고 소프트웨어 마이그레이션 결과 화면에 소프트웨어별 상태가 보인다"
 *
 * 실행 이력의 "View SW" → 결과 화면. 사용자가 결과를 보는 경로가 여기다.
 * 화면이 보여주는 것과 API가 말하는 것이 같은지도 대조한다 — 다르면 화면이 거짓말을 하고 있는 것이다.
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
      `[sw] 결과 화면 ${shown.length}행 — ${shown
        .slice(0, 5)
        .map(r => `${r.name}:${r.status}`)
        .join(', ')}${shown.length > 5 ? ' …' : ''}`,
    );

    expect(
      shown.length,
      '결과 화면에 소프트웨어가 한 줄도 없다 — API는 결과를 주는데 화면이 못 그리고 있다.',
    ).toBeGreaterThan(0);

    // API가 말한 소프트웨어가 화면에도 있는지 대조한다(화면이 빈 껍데기를 보여주고 있지 않은지).
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
