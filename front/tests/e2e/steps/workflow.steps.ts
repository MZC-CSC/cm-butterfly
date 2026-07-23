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
 * Workflow management (cm-cicada) steps.
 * - Unit (@unit): list query / templates / Task Component / creation (designer) / run and state polling.
 * - Reusable (@scenario): "create and run a migration workflow" — assembled by the infra migration scenario.
 *
 * All screen locations and selectors live in WorkflowPage (the Page Object).
 */

// ── Workflow list ─────────────────────────────────────────────────────────

Given('워크플로우 목록 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoWorkflows();
});

Then('워크플로우 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.expectWorkflowsLoaded();
  // Confirm the query itself succeeded (table shown). The count is 0 or more depending on the environment.
  expect(await wf.workflowCount()).toBeGreaterThanOrEqual(0);
});

Then(
  '워크플로우 목록에 {string} 워크플로우가 보인다',
  async ({ page }, name: string) => {
    await new WorkflowPage(page).expectWorkflowVisible(name);
  },
);

// ── Workflow templates ─────────────────────────────────────────────────────

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

// ── Task Component (type/spec schema) ─────────────────────────────────────

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

// ── Workflow creation — designer/editor (type/spec task) ─────────────────────

When('워크플로우 디자이너를 연다', async ({ page }) => {
  await new WorkflowPage(page).openDesigner();
});

Then('워크플로우 디자이너가 표시된다', async ({ page }) => {
  await new WorkflowPage(page).expectDesignerOpen();
});

/**
 * "when creating the \"e2e-wf\" workflow from the {string} template"
 * From entering the name → selecting the template → saving, in the designer. (type/spec tasks are included in the template)
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

// ── Workflow run + state polling ──────────────────────────────────────────
// ⚠️ @unit runs must use only cost-safe workflows (example bash, etc., no infra provisioning).

When('{string} 워크플로우를 실행하면', async ({ page }, name: string) => {
  // Wait through run → DAG run trigger → state transition (queued→running→success). The default 90s is not enough.
  test.setTimeout(10 * 60_000);

  const wf = new WorkflowPage(page);
  await wf.gotoWorkflows();
  // The seed creates the workflow and *confirms DAG registration*, so here we only need to run it once from the list.
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
  // Confirm a terminal state is reached. The example workflow is expected to succeed.
  expect(['success', 'failed']).toContain(state);
  expect(state, `워크플로우 실행 최종 상태=${state}`).toBe('success');
});

// ── Reusable (migration scenario) ────────────────────────────────────────
/**
 * "and when creating and running a migration workflow"
 * A reusable step assembled by the infra-migration .feature (@scenario).
 * Based on the recommended target model saved by the preceding target-model step, the add-mode designer
 * auto-selects the migrate_infra_workflow template → composes the beetle_task_infra_migration (type/spec) task →
 * saves (creates), then runs from the list. Real EC2 provisioning is triggered, so cleanup at scenario end is required.
 */
/**
 * Create and run a migration workflow.
 *
 * @param editInfraName If passed, changes the *name of the infra to be created* to this value in the
 *                      workflow tool and saves. If omitted, it stays at the default (the name the target
 *                      model specifies, usually `infra101`).
 */
async function createAndRunMigrationWorkflow(
  page: import('@playwright/test').Page,
  editInfraName?: string,
): Promise<void> {
  const models = new ModelsPage(page);
  const wf = new WorkflowPage(page);
  const name = `${workflowData.createNamePrefix}-migrate-${Date.now()}`;

  // 1) Target model detail "Make Workflow" → workflow editor → name/template → save (create)
  //    (Add in the Workflows list is disabled — creation starts from the target model)
  await models.openWorkflowEditorFromTarget(
    uniqueName(process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target'),
  );
  await wf.expectDesignerOpen();
  await wf.fillWorkflowName(name);
  // The add-mode editor auto-composes the template and task (beetle_task_infra_migration) from the target
  // model's migrationType, so we do not select the template manually (a manual selection disrupts the
  // auto-composition and fails the save).

  if (editInfraName) {
    // ★ Change the name of the infra to be created in the workflow tool.
    //
    //   cm-beetle names the target infra with the value written in the target model (default `infra101`).
    //   So repeating the same process always creates the same name, indistinguishable from the infra left
    //   by a previous run. The workflow tool lets you change that value, and this path checks that *it
    //   actually works*.
    await wf.selectTaskInDesigner(workflowData.infraMigrationTask);
    await wf.setTaskParam('body', 'targetInfra.name', editInfraName);
    scenarioState.infraName = editInfraName;
  }

  await wf.saveWorkflow();

  // On creation cm-cicada only writes the DAG YAML to disk, and airflow parses and registers it.
  // Firing a run before registration is rejected with "provided dag_id is not exist". Parsing slows as the
  // number of DAGs grows, taking roughly a minute in practice (the old 20s wait was not enough), so we wait
  // generously and then run *only once*.
  //
  // ⚠️ We do not retry here — a migration workflow creates an EC2 instance every time it runs.
  //    If rejected, the run never happened so there is no wasted resource, and it surfaces as a failure in
  //    the history check below.
  await wf.gotoWorkflows();
  await wf.expectWorkflowVisible(name);
  await new Promise(r => setTimeout(r, 120_000));

  // 2) Run the created workflow from the list
  await wf.runWorkflow(name);

  // 3) Wait until a run history entry is created (completion is verified in a later EC2-check step)
  await wf.selectWorkflow(name);
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
}

/** Defaults as-is — created with the infra name the target model specifies */
When('마이그레이션 워크플로우를 생성하고 실행하면', async ({ page }) => {
  await createAndRunMigrationWorkflow(page);
});

/**
 * "when changing the infra name to {string} in the workflow tool and creating and running a migration workflow"
 *
 * This path checks whether the workflow tool actually works. Running with only defaults tells us nothing about whether that screen reflects the value.
 */
When(
  '워크플로우 툴에서 인프라 이름을 {string} 로 바꿔 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, infraName: string) => {
    await createAndRunMigrationWorkflow(page, uniqueName(infraName));
  },
);

// ── Software migration ──────────────────────────────────────────────────
/**
 * Create and run a software migration workflow.
 *
 * The decisive difference from infra migration — **which infra to install onto must be specified in the workflow tool.**
 * grasshopper_task_software_migration takes `nsId` and `infraId` as *required query parameters*, but the target SW
 * model only knows "what to install", not "where to install it". So we fill in the id of the infra created by the
 * preceding infra migration here. Left empty, grasshopper cannot find the target.
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

  // Target SW model detail "Make Workflow" → the designer auto-composes the migrate_software_workflow template
  // and the grasshopper_task_software_migration task according to the model type (software).
  await models.openWorkflowEditorFromTarget(targetModelName);
  await wf.expectDesignerOpen();
  await wf.fillWorkflowName(name);

  await wf.selectTaskInDesigner(workflowData.softwareMigrationTask);
  await wf.setTaskParam('query', 'nsId', testNamespace.id);
  await wf.setTaskParam('query', 'infraId', infraId!);

  await wf.saveWorkflow();
  scenarioState.softwareWorkflowName = name;

  // Wait for DAG registration for the same reason as infra migration (cm-cicada only writes YAML and airflow parses it).
  await wf.gotoWorkflows();
  await wf.expectWorkflowVisible(name);
  await new Promise(r => setTimeout(r, 120_000));

  // ★ Record the timestamp right before running. It is the only key to pick out the grasshopper run record
  //   as ours — because cb-tumblebug reuses the same values for both the infra name and the node id, the
  //   record is indistinguishable from what a previous run left (a past run's record was actually picked up as this one).
  scenarioState.swRunStartedAt = Date.now();
  await wf.runWorkflow(name);

  await wf.selectWorkflow(name);
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
}

/**
 * "when creating and running a software migration workflow with the {string} target SW model"
 *
 * The install-target infra (infraId) uses the one created by the preceding infra migration — filled in via the workflow tool.
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

/** "then the workflow tool's default infra name is {string}" — explicitly confirm what the default is */
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

// ── cm-cicada type/spec schema regression (BAR-1389) ──────────────────────
//
// As cm-cicada changed TaskComponent to the type/spec schema, two console screens were left out of the
// upstream patch and we supplemented them ourselves.
//   - Task Components  : if the save payload uses the old {data:{options}} wrapping, cicada rejects it
//   - Workflow JSON viewer: if run_script moved to spec.request_body and cannot be decoded, base64 is exposed
// Even when the screen looks fine, the outgoing request may use the old schema, so we also inspect the request log.

/** Test script original and its base64 — the reference point for judging whether decoding happened */
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
 * Prepare a workflow containing a run_script script.
 * Call the same proxy the console uses (operationId `create-workflow`) directly, so the login session and
 * path go through exactly as in real usage.
 */
Given(
  'run_script 스크립트가 담긴 {string} 워크플로우가 있다',
  async ({ page }, name: string) => {
    // cm-cicada has a UNIQUE constraint on the workflow name. Using a fixed name makes the prepare step
    // always break from the second run on with "UNIQUE constraint failed: workflows.name".
    // Append a per-run suffix to create a fresh one each time (within the same run uniqueName returns the
    // same value, so the following viewer-open step finds it by the same name).
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

    // The console attaches a Bearer token to proxy calls. Use the token the login session keeps in localStorage as-is.
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
    // The prepare step created it with uniqueName, so find it by the same name.
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
 * "when opening the workflow tool and selecting the migration task"
 *
 * Opens only the edit panel without saving. This path exists to check *what the workflow tool shows as
 * defaults*, so it creates no cloud resources.
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
