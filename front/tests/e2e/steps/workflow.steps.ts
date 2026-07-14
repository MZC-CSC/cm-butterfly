import { createBdd } from 'playwright-bdd';
import { test, expect, getSentRequests } from '../support/fixtures';
import { captureScreen } from '../support/screenshot';
import { WorkflowPage } from '../pages/workflow.page';
import { ModelsPage } from '../pages/models.page';
import { workflowData, testNamespace } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';

const { Given, When, Then } = createBdd(test);

/**
 * 워크플로우 관리(cm-cicada) 스텝.
 * - 단위(@unit): 목록 조회 / 템플릿 / Task Component / 생성(디자이너) / 실행·상태 폴링.
 * - 재사용(@scenario): "마이그레이션 워크플로우를 생성하고 실행하면" — 인프라 마이그레이션 시나리오가 조립.
 *
 * 화면 위치·셀렉터는 모두 WorkflowPage(Page Object)에 있다.
 */

// ── 워크플로우 목록 ───────────────────────────────────────────────────────

Given('워크플로우 목록 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoWorkflows();
});

Then('워크플로우 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.expectWorkflowsLoaded();
  // 조회 자체가 성공(테이블 노출)했는지 확인. 건수는 환경에 따라 0 이상.
  expect(await wf.workflowCount()).toBeGreaterThanOrEqual(0);
});

Then(
  '워크플로우 목록에 {string} 워크플로우가 보인다',
  async ({ page }, name: string) => {
    await new WorkflowPage(page).expectWorkflowVisible(name);
  },
);

// ── 워크플로우 템플릿 ─────────────────────────────────────────────────────

Given('워크플로우 템플릿 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoTemplates();
});

Then('워크플로우 템플릿 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  expect(await wf.templateCount()).toBeGreaterThanOrEqual(0);
});

Then(
  '워크플로우 템플릿에 {string} 템플릿이 보인다',
  async ({ page }, name: string) => {
    await new WorkflowPage(page).expectTemplateVisible(name);
  },
);

// ── Task Component (type/spec 스키마) ─────────────────────────────────────

Given('Task Component 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoTaskComponents();
});

Then('Task Component 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.expectTaskComponentsLoaded();
  expect(await wf.taskComponentCount()).toBeGreaterThanOrEqual(0);
});

Then(
  'Task Component 목록에 {string} 컴포넌트가 보인다',
  async ({ page }, name: string) => {
    await new WorkflowPage(page).expectTaskComponentVisible(name);
  },
);

// ── 워크플로우 생성 — 디자이너/에디터 (type/spec task) ─────────────────────

When('워크플로우 디자이너를 연다', async ({ page }) => {
  await new WorkflowPage(page).openDesigner();
});

Then('워크플로우 디자이너가 표시된다', async ({ page }) => {
  await new WorkflowPage(page).expectDesignerOpen();
});

/**
 * "{string} 템플릿으로 \"e2e-wf\" 워크플로우를 생성하면"
 * 디자이너에서 이름 입력 → 템플릿 선택 → 저장까지. (type/spec task는 템플릿에 포함)
 */
When(
  '{string} 템플릿으로 {string} 워크플로우를 생성하면',
  async ({ page }, templateName: string, name: string) => {
    const wf = new WorkflowPage(page);
    await wf.openDesigner();
    await wf.fillWorkflowName(name);
    await wf.selectTemplate(templateName);
    await wf.saveWorkflow();
  },
);

Then('워크플로우 JSON 뷰어가 표시된다', async ({ page }) => {
  await new WorkflowPage(page).expectJsonViewerVisible();
});

// ── 워크플로우 실행(run) + 상태 폴링 ──────────────────────────────────────
// ⚠️ @unit 실행은 반드시 요금 안전(예제 bash 등, 인프라 미프로비저닝) 워크플로우로만.

When('{string} 워크플로우를 실행하면', async ({ page }, name: string) => {
  // 실행 → DAG run 트리거 → 상태 전이(queued→running→success)까지 기다린다. 기본 90초로는 모자라다.
  test.setTimeout(10 * 60_000);

  const wf = new WorkflowPage(page);
  await wf.gotoWorkflows();
  // 시드가 워크플로우를 만들고 *DAG 등록까지 확인*해 두므로, 여기서는 목록에서 한 번 실행하면 된다.
  await wf.runWorkflow(uniqueName(name));
});

Then('워크플로우 실행 이력이 생성된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf
    .selectWorkflow(uniqueName(workflowData.safeRunWorkflowName))
    .catch(() => {});
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
});

Then('워크플로우 실행이 정상 완료된다', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const wf = new WorkflowPage(page);
  await wf.openHistoryTab().catch(() => {});
  const state = await wf.pollLatestRunState();
  // 종료 상태 도달 확인. 예제 워크플로우는 success 기대.
  expect(['success', 'failed']).toContain(state);
  expect(state, `워크플로우 실행 최종 상태=${state}`).toBe('success');
});

// ── 재사용(마이그레이션 시나리오) ────────────────────────────────────────
/**
 * "그리고 마이그레이션 워크플로우를 생성하고 실행하면"
 * 인프라마이그레이션.feature(@scenario)가 조립하는 재사용 스텝.
 * 앞선 타깃 모델 스텝이 저장한 추천 타깃 모델을 바탕으로 add-mode 디자이너가
 * migrate_infra_workflow 템플릿을 자동 선택 → beetle_task_infra_migration(type/spec) task 구성 →
 * 저장(생성) 후 목록에서 실행(run). 실제 EC2 프로비저닝이 트리거되므로 시나리오 종료 시 정리 필수.
 */
/**
 * 마이그레이션 워크플로우를 만들고 실행한다.
 *
 * @param editInfraName 넘기면 워크플로우 툴에서 *생성될 인프라 이름*을 이 값으로 바꿔 저장한다.
 *                      넘기지 않으면 기본값(타깃 모델이 지정한 이름, 보통 `infra101`) 그대로 간다.
 */
async function createAndRunMigrationWorkflow(
  page: import('@playwright/test').Page,
  editInfraName?: string,
): Promise<void> {
  const models = new ModelsPage(page);
  const wf = new WorkflowPage(page);
  const name = `${workflowData.createNamePrefix}-migrate-${Date.now()}`;

  // 1) 타깃 모델 상세 "Make Workflow" → 워크플로우 에디터 → 이름/템플릿 → 저장(생성)
  //    (Workflows 목록의 Add는 disabled — 생성은 타깃 모델에서 시작)
  await models.openWorkflowEditorFromTarget(
    uniqueName(process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target'),
  );
  await wf.expectDesignerOpen();
  await wf.fillWorkflowName(name);
  // add-mode 에디터는 타깃 모델의 migrationType으로 템플릿·task(beetle_task_infra_migration)를
  // 자동 구성하므로 템플릿을 수동 선택하지 않는다(수동 선택은 자동 구성을 방해해 저장 실패).

  if (editInfraName) {
    // ★ 워크플로우 툴에서 생성될 인프라 이름을 바꾼다.
    //
    //   cm-beetle 은 타깃 인프라 이름을 타깃 모델에 적힌 값(기본 `infra101`)으로 만든다. 그래서 같은
    //   과정을 반복하면 늘 같은 이름으로만 생성되고, 앞선 실행이 남긴 인프라와 구분되지 않는다.
    //   워크플로우 툴은 그 값을 바꿀 수 있게 돼 있고, *그게 실제로 동작하는지* 확인하는 게 이 경로다.
    await wf.selectTaskInDesigner(workflowData.infraMigrationTask);
    await wf.setTaskParam('body', 'targetInfra.name', editInfraName);
    scenarioState.infraName = editInfraName;
  }

  await wf.saveWorkflow();

  // cm-cicada는 생성 시 DAG YAML을 디스크에 기록만 하고, airflow가 이를 파싱해 등록한다.
  // 등록 전에 run을 쏘면 "provided dag_id is not exist"로 거부된다. DAG가 늘수록 파싱이 느려져
  // 실측 1분 안팎까지 걸리므로(예전 20초 대기로는 모자랐다) 넉넉히 기다린 뒤 *한 번만* 실행한다.
  //
  // ⚠️ 여기서는 재시도하지 않는다 — 마이그레이션 워크플로우는 실행할 때마다 EC2를 만든다.
  //    거부되면 실행 자체가 안 된 것이라 자원 낭비는 없고, 아래 이력 확인에서 실패로 드러난다.
  await wf.gotoWorkflows();
  await wf.expectWorkflowVisible(name);
  await new Promise(r => setTimeout(r, 120_000));

  // 2) 목록에서 생성된 워크플로우 실행(run)
  await wf.runWorkflow(name);

  // 3) 실행 이력이 생성될 때까지 대기 (완료 여부는 후속 EC2 확인 스텝에서 검증)
  await wf.selectWorkflow(name);
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
}

/** 기본값 그대로 — 타깃 모델이 지정한 인프라 이름으로 생성된다 */
When('마이그레이션 워크플로우를 생성하고 실행하면', async ({ page }) => {
  await createAndRunMigrationWorkflow(page);
});

/**
 * "만약 워크플로우 툴에서 인프라 이름을 {string} 로 바꿔 마이그레이션 워크플로우를 생성하고 실행하면"
 *
 * 워크플로우 툴이 실제로 동작하는지 보는 경로다. 기본값으로만 돌리면 그 화면이 값을 반영하는지 알 수 없다.
 */
When(
  '워크플로우 툴에서 인프라 이름을 {string} 로 바꿔 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, infraName: string) => {
    await createAndRunMigrationWorkflow(page, uniqueName(infraName));
  },
);

// ── 소프트웨어 마이그레이션 ──────────────────────────────────────────────
/**
 * 소프트웨어 마이그레이션 워크플로우를 만들고 실행한다.
 *
 * 인프라 마이그레이션과 결정적으로 다른 점 — **어느 인프라에 설치할지를 워크플로우 툴에서 지정해야 한다.**
 * grasshopper_task_software_migration 은 `nsId`·`infraId` 를 *필수 query 파라미터*로 받는데, 타깃 SW
 * 모델은 "무엇을 설치할지"만 알고 "어디에 설치할지"는 모른다. 그래서 앞선 인프라 마이그레이션이 만든
 * 인프라의 id 를 여기서 채워 넣는다. 비워 두면 grasshopper 가 대상을 못 찾는다.
 */
async function createAndRunSoftwareMigrationWorkflow(
  page: import('@playwright/test').Page,
  targetModelName: string,
): Promise<void> {
  const models = new ModelsPage(page);
  const wf = new WorkflowPage(page);
  const name = `${workflowData.createNamePrefix}-swmigrate-${Date.now()}`;

  const infraId = scenarioState.infraId ?? scenarioState.infraName;
  expect(
    infraId,
    'SW 마이그레이션은 설치 대상 인프라가 있어야 한다 — 인프라 마이그레이션이 먼저 성공해야 한다',
  ).toBeTruthy();

  // 타깃 SW 모델 상세의 "Make Workflow" → 디자이너가 migrate_software_workflow 템플릿과
  // grasshopper_task_software_migration 태스크를 모델 타입(software)에 따라 자동 구성한다.
  await models.openWorkflowEditorFromTarget(targetModelName);
  await wf.expectDesignerOpen();
  await wf.fillWorkflowName(name);

  await wf.selectTaskInDesigner(workflowData.softwareMigrationTask);
  await wf.setTaskParam('query', 'nsId', testNamespace.id);
  await wf.setTaskParam('query', 'infraId', infraId!);

  await wf.saveWorkflow();
  scenarioState.softwareWorkflowName = name;

  // 인프라 마이그레이션과 같은 이유로 DAG 등록을 기다린다(cm-cicada는 YAML만 쓰고 airflow가 파싱).
  await wf.gotoWorkflows();
  await wf.expectWorkflowVisible(name);
  await new Promise(r => setTimeout(r, 120_000));

  // ★ 실행 직전 시각을 기록한다. grasshopper 실행 기록을 우리 것으로 가려낼 유일한 열쇠다 —
  //   인프라 이름도 노드 id도 cb-tumblebug이 같은 값을 다시 쓰기 때문에, 앞선 실행이 남긴 기록과
  //   구분되지 않는다(실제로 지난 실행의 기록이 이번 것으로 잡혔다).
  scenarioState.swRunStartedAt = Date.now();
  await wf.runWorkflow(name);

  await wf.selectWorkflow(name);
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
}

/**
 * "만약 {string} 타깃 SW 모델로 소프트웨어 마이그레이션 워크플로우를 생성하고 실행하면"
 *
 * 설치 대상 인프라(infraId)는 앞선 인프라 마이그레이션이 만든 것을 쓴다 — 워크플로우 툴에서 채운다.
 */
When(
  '{string} 타깃 SW 모델로 소프트웨어 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, targetModelName: string) => {
    await createAndRunSoftwareMigrationWorkflow(
      page,
      uniqueName(targetModelName),
    );
  },
);

/** "그러면 워크플로우 툴의 인프라 이름 기본값은 {string} 이다" — 기본값이 무엇인지 명시적으로 확인 */
Then(
  '워크플로우 툴의 인프라 이름 기본값은 {string} 이다',
  async ({ page }, expected: string) => {
    const wf = new WorkflowPage(page);
    const actual = await wf.readTaskParam('body', 'targetInfra.name');
    expect(
      actual,
      `워크플로우 툴이 보여주는 인프라 이름 기본값이 "${expected}" 가 아니다`,
    ).toBe(expected);
  },
);

// ── cm-cicada type/spec 스키마 회귀 (BAR-1389) ────────────────────────────
//
// cm-cicada가 TaskComponent를 type/spec 스키마로 바꾸면서, 콘솔의 두 화면이
// 업스트림 패치에서 빠져 우리가 직접 보완했다.
//   - Task Components  : 저장 payload가 구 {data:{options}} 래핑이면 cicada가 거부한다
//   - Workflow JSON 뷰어: run_script가 spec.request_body로 옮겨가 디코드가 안 되면 base64가 노출된다
// 화면이 멀쩡해 보여도 나가는 요청이 구 스키마일 수 있어, 요청 기록까지 함께 본다.

/** 테스트용 스크립트 원문과 그 base64 — 디코드 여부 판정의 기준점 */
const RUN_SCRIPT_MARKER = 'e2e run_script decode check';
const RUN_SCRIPT_PLAIN = `#!/bin/bash\necho "${RUN_SCRIPT_MARKER}"\nuptime`;
const RUN_SCRIPT_B64 = Buffer.from(RUN_SCRIPT_PLAIN).toString('base64');

Then('콘솔이 구 스키마 요청을 보내지 않는다', async () => {
  const legacy = getSentRequests().filter(r =>
    /"data"\s*:\s*\{[^}]*"options"/.test(r.body),
  );
  expect(
    legacy.map(r => r.url),
    '구 options/{data} 래핑 payload를 보내면 cm-cicada가 거부한다',
  ).toEqual([]);
});

/**
 * run_script 스크립트가 담긴 워크플로우를 준비한다.
 * 콘솔이 쓰는 프록시(operationId `create-workflow`)를 그대로 호출해, 로그인 세션·경로를
 * 실제 사용 흐름과 동일하게 태운다.
 */
Given(
  'run_script 스크립트가 담긴 {string} 워크플로우가 있다',
  async ({ page }, name: string) => {
    // cm-cicada는 워크플로우 이름에 UNIQUE 제약이 있다. 고정 이름으로 만들면 두 번째 실행부터
    // "UNIQUE constraint failed: workflows.name"으로 준비 단계가 항상 깨진다.
    // 런별 접미사를 붙여 매번 새로 만든다(같은 런 안에서는 uniqueName이 같은 값을 주므로
    // 뒤따르는 뷰어 열기 스텝이 같은 이름으로 찾아간다).
    const body = {
      name: uniqueName(name),
      description: 'e2e — cm-cicada run_script decode check',
      data: {
        task_groups: [
          {
            name: 'tg1',
            description: 'task group',
            tasks: [
              {
                name: 'run-script-task',
                task_component: 'cicada_task_run_script',
                spec: {
                  request_body: JSON.stringify({
                    ns_id: 'default',
                    infra_id: 'infra101',
                    node_id: 'node1',
                    content: RUN_SCRIPT_B64,
                  }),
                },
                dependencies: [],
              },
            ],
          },
        ],
      },
    };

    // 콘솔은 프록시 호출에 Bearer 토큰을 붙인다. 로그인 세션이 localStorage에 보관한 토큰을 그대로 쓴다.
    const token = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        const v = localStorage.getItem(k) ?? '';
        const m = v.match(/"access_token"\s*:\s*"([^"]+)"/);
        if (m) return m[1];
      }
      return '';
    });
    expect(token, '로그인 세션에서 access token을 찾지 못했다').not.toEqual('');

    const res = await page.request.post('/api/cm-cicada/create-workflow', {
      data: { request: body },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    expect(
      res.ok(),
      `워크플로우 준비 실패: ${res.status()} ${await res.text()}`,
    ).toBeTruthy();
  },
);

When(
  '{string} 워크플로우의 JSON 뷰어를 연다',
  async ({ page }, name: string) => {
    const wf = new WorkflowPage(page);
    await wf.gotoWorkflows();
    // 준비 스텝이 uniqueName으로 만들었으니 같은 이름으로 찾는다.
    await wf.openJsonViewer(uniqueName(name));
  },
);

Then('JSON 뷰어에 스크립트가 디코드되어 보인다', async ({ page }) => {
  await new WorkflowPage(page).expectScriptDecoded(
    RUN_SCRIPT_MARKER,
    RUN_SCRIPT_B64.slice(0, 20),
  );
});

Then('화면을 {string} 이름으로 캡처한다', async ({ page }, name: string) => {
  await captureScreen(page, test.info(), name);
});

/**
 * "만약 워크플로우 툴을 열고 마이그레이션 태스크를 선택하면"
 *
 * 저장하지 않고 편집 패널만 연다. 워크플로우 툴이 *무엇을 기본값으로 보여주는지* 확인하기 위한 경로라,
 * 클라우드 자원을 만들지 않는다.
 */
When(
  '워크플로우 툴을 열고 마이그레이션 태스크를 선택하면',
  async ({ page }) => {
    const models = new ModelsPage(page);
    const wf = new WorkflowPage(page);

    await models.openWorkflowEditorFromTarget(
      uniqueName(process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target'),
    );
    await wf.expectDesignerOpen();
    await wf.selectTaskInDesigner(workflowData.infraMigrationTask);
  },
);
