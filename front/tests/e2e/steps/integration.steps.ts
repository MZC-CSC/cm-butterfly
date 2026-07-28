import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { JsonEditorPage } from '../pages/jsonEditor.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';
import { NotificationPage } from '../pages/notification.page';
import { WorkloadPage } from '../pages/workload.page';
import {
  config,
  testNamespace,
  workflowData,
  workload,
} from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { getSessionToken } from '../support/apiWait';
import { scenarioState } from '../support/world';
import { humanClick } from '../support/humanize';

const { Given, When, Then } = createBdd(test);

/**
 * Steps for the v0.6.0 integration scenario.
 *
 * What separates this from the per-screen steps is that it is *watched*. Each scenario in
 * 통합시나리오-v060.feature is one recording take, so these steps do the things a person would do
 * on screen - open the guide, drag the help panel, duplicate a firewall row - rather than the
 * shortest route to an assertion.
 *
 * Two rules learned in the 2026-07-24 ETRI run are wired in here and must not be softened:
 *   - a workflow reporting `success` proves nothing (the closing notify task runs on all_done, so
 *     a failed migration still ends green), and
 *   - a software workflow finishing proves nothing either - grasshopper installs asynchronously.
 * Both are judged by their real result instead.
 */

// ── 구간1: the migration guide and the help panel ───────────────────────

When('마이그레이션 가이드 화면을 열면', async ({ page }) => {
  await page.goto('/main/guide');
});

Then('마이그레이션 가이드가 보인다', async ({ page }) => {
  await expect(page.getByTestId('migration-guide')).toBeVisible({
    timeout: 20_000,
  });
});

/** Read down the page and come back up - the pause is what makes it readable on the recording. */
Given('가이드를 아래로 훑어보고 다시 위로 올린다', async ({ page }) => {
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1_500);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1_500);
  await page.mouse.wheel(0, -1_200);
  await page.waitForTimeout(1_000);
});

When('가이드에서 {string} 블록을 클릭하면', async ({ page }, label: string) => {
  await humanClick(
    page
      .getByTestId(`guide-block-${label}`)
      .or(page.getByText(label, { exact: false }).first())
      .first(),
  );
});

When('도움말을 열면', async ({ page }) => {
  await humanClick(page.getByTestId('help-panel-open'));
  await expect(page.getByTestId('help-panel')).toBeVisible({ timeout: 15_000 });
});

Then('도움말에 현재 화면 설명이 보인다', async ({ page }) => {
  const title = page.getByTestId('help-panel-title');
  await expect(title).toBeVisible({ timeout: 15_000 });
  // The panel used to show the list behind whatever was open. Anything is better than empty, but
  // an empty body is exactly the failure that was reported, so it is what we check for.
  await expect(page.getByTestId('help-panel-body')).not.toBeEmpty();
});

Given('도움말 패널의 폭을 넓혔다 줄인다', async ({ page }) => {
  const handle = page.getByTestId('help-panel-resize');
  const box = await handle.boundingBox();
  if (!box) return;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x - 220, y, { steps: 20 });
  await page.waitForTimeout(800);
  await page.mouse.move(box.x + 60, y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(800);
});

When('도움말 도킹을 해제하면', async ({ page }) => {
  await humanClick(page.getByTestId('help-panel-undock'));
});

Then('도움말이 떠 있는 창으로 바뀐다', async ({ page }) => {
  await expect(page.getByTestId('help-panel-floating')).toBeVisible({
    timeout: 10_000,
  });
});

Given('도움말 창을 다른 위치로 옮긴다', async ({ page }) => {
  const header = page.getByTestId('help-panel-drag-handle');
  const box = await header.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 300, box.y + 180, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(800);
});

Given('도움말 창의 크기를 키운다', async ({ page }) => {
  const grip = page.getByTestId('help-panel-floating-resize');
  const box = await grip.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 160, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(800);
});

Given('도움말을 닫는다', async ({ page }) => {
  await humanClick(page.getByTestId('help-panel-close'));
  await expect(page.getByTestId('help-panel')).toBeHidden({ timeout: 10_000 });
});

// ── 구간2: registering source connections from a file ───────────────────

/**
 * Register a group from a CSV of connection details.
 *
 * The header is fixed at seven columns and the addresses are *private* IPs, because the collector
 * runs on the platform host and reaches the sources over the internal network. Authentication is by
 * key only; the password column stays empty.
 */
When(
  '소스 연결정보 CSV로 {string} 그룹을 등록하면',
  async ({ page }, groupName: string) => {
    const name = uniqueName(groupName);
    await page.goto('/main/source-service');
    await humanClick(page.getByTestId('source-import-open'));
    await page
      .getByTestId('source-import-file')
      .setInputFiles(
        process.env.TEST_SOURCE_CSV || 'tests/e2e/fixtures/sources.csv',
      );
    // The preview counts the rows it parsed - confirming it is how a person checks the file was read.
    await expect(page.getByTestId('source-import-preview')).toBeVisible({
      timeout: 15_000,
    });
    await humanClick(page.getByTestId('source-import-confirm'));
    scenarioState.sourceGroupName = name;
  },
);

Then('소스그룹 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  await page.goto('/main/source-service');
  await expect(
    page.getByRole('row', { name: uniqueName(name) }).first(),
  ).toBeVisible({ timeout: 20_000 });
});

// ── 구간3·4: recommending against a named CSP and region ────────────────

/**
 * Recommend for a given CSP and region and save the result.
 *
 * Only candidates with every value filled in are eligible. A candidate missing its spec or image
 * saves without complaint and then fails at workflow run time, which reads as a product fault when
 * it is really the candidate we picked.
 */
When(
  '{string} {string} 로 타깃 인프라를 추천받아 {string} 타깃 모델로 저장하면',
  async ({ page }, csp: string, region: string, modelName: string) => {
    const models = new ModelsPage(page);
    await models.openRecommend();
    await models.selectProvider(csp);
    await models.selectRegion(region);
    await models.runRecommend();
    const picked = await models.selectCompleteCandidate();
    scenarioState.lastRecommendedSpec = picked.spec;
    await models.saveAsTargetModel(uniqueName(modelName));
  },
);

// ── the firewall edits (the point of the whole scenario) ────────────────

/**
 * Open port 5555 by copying the rule that already allows 22.
 *
 * Duplicating is deliberate. The collected rule carries protocol, direction and CIDR that the model
 * expects; typing a rule by hand would test the keyboard rather than the product, and any field
 * left out would surface much later as an infra that comes up unreachable.
 */
When(
  '소스 모델의 방화벽에 22번 규칙을 복제해 5555 포트를 추가하면',
  async ({ page }) => {
    const editor = new JsonEditorPage(page);
    await editor.openFromSourceModel();
    await editor.switchToTable();
    await editor.search('22');
    await editor.enableFilter();
    await editor.duplicateRow('22');
    await editor.setRowValue('22', '5555');
    await editor.closeSearch();
  },
);

When(
  '{string} 타깃 모델의 방화벽에 22번 규칙을 복제해 5555 포트를 추가하면',
  async ({ page }, modelName: string) => {
    const models = new ModelsPage(page);
    await models.gotoTargetModels();
    await models.selectModel(uniqueName(modelName));

    const editor = new JsonEditorPage(page);
    await editor.openFromTargetModel();
    await editor.switchToTable();
    await editor.search('22');
    await editor.enableFilter();
    await editor.duplicateRow('22');
    await editor.setRowValue('22', '5555');
    await editor.closeSearch();
  },
);

When('{string} 커스텀 모델로 저장하면', async ({ page }, name: string) => {
  const saved = uniqueName(name);
  await new JsonEditorPage(page).saveAsCustom(saved);
  scenarioState.sourceModelName = saved;
});

When('{string} 커스텀 타깃 모델로 저장하면', async ({ page }, name: string) => {
  await new JsonEditorPage(page).saveAsCustom(uniqueName(name));
});

// ── checking the rule carried through, in table mode ────────────────────

When(
  '{string} 타깃 모델을 테이블 모드에서 {string} 로 검색하면',
  async ({ page }, modelName: string, query: string) => {
    const models = new ModelsPage(page);
    await models.gotoTargetModels();
    await models.selectModel(uniqueName(modelName));

    const editor = new JsonEditorPage(page);
    await editor.openFromTargetModel();
    await editor.switchToTable();
    await editor.search(query);
    await editor.enableFilter();
  },
);

Then('검색 결과에 5555 방화벽 규칙이 보인다', async ({ page }) => {
  await new JsonEditorPage(page).expectRowVisible('5555');
});

Given('검색을 해제한다', async ({ page }) => {
  await new JsonEditorPage(page).closeSearch();
});

/**
 * Raise the spec of the recommended target.
 *
 * The recommendation follows the source, and the source here is deliberately small. A 512MB target
 * could not finish the software migration in the ETRI run - CPU saturation left it part-installed -
 * while the same run on 4GB completed every package. The install lands on this infra, so the spec
 * goes up before it is built rather than after it stalls.
 */
When('타깃 모델의 스펙을 4GB 급으로 변경하면', async ({ page }) => {
  const editor = new JsonEditorPage(page);
  await editor.openFromTargetModel();
  await editor.switchToTable();
  await editor.search('spec');
  await editor.enableFilter();
  const target = process.env.TEST_TARGET_SPEC_4GB || 'e2-standard-1';
  await editor.setRowValue('spec', target);
  await editor.closeSearch();
});

// ── 구간3·5: workflows that do not collide with each other ──────────────

/**
 * Create and run a migration workflow with a naming prefix.
 *
 * Without it the second track fails. What the recommendation produces is named the same whatever the
 * CSP - `vnet-01`, `sg-01`, `sshkey-01` - and cm-beetle reuses an existing name in the namespace
 * without checking which connection it belongs to, so the second migration ends up handed the first
 * CSP's subnet. `nameSeed` prefixes every resource, references included; up to 20 characters,
 * alphanumerics and hyphens.
 */
When(
  '{string} 타깃 모델로 nameSeed {string} 를 주고 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, targetModelName: string, seed: string) => {
    const models = new ModelsPage(page);
    const wf = new WorkflowPage(page);
    const name = `${workflowData.createNamePrefix}-${seed}-${Date.now()}`;

    await models.openWorkflowEditorFromTarget(uniqueName(targetModelName));
    await wf.expectDesignerOpen();
    await wf.fillWorkflowName(name);
    await wf.selectTaskInDesigner(workflowData.infraMigrationTask);
    await wf.setTaskParam('query', 'nameSeed', seed);
    await wf.saveWorkflow();

    // cm-cicada only writes the DAG on save; airflow picks it up on its own schedule, and running
    // before that is rejected outright. Waiting once is cheaper than a retry loop here - every retry
    // of a migration workflow would build another instance.
    await wf.gotoWorkflows();
    await wf.expectWorkflowVisible(name);
    await page.waitForTimeout(120_000);
    await wf.runWorkflow(name);

    scenarioState.infraName = `${seed}-infra101`;
    scenarioState.softwareWorkflowName = name;
  },
);

/**
 * Check the tasks, not the run.
 *
 * The closing notify task carries `trigger_rule: all_done`, so it runs whatever happened before it
 * and its success finishes the DAG green. In the ETRI run NCP's `infra_migration` failed while the
 * workflow reported success; reading only the run state would have recorded that as a pass.
 */
Then('워크플로우의 작업별 상태가 모두 정상이다', async ({ page }) => {
  const name = scenarioState.softwareWorkflowName;
  expect(
    name,
    '먼저 워크플로우를 생성·실행하는 단계가 있어야 한다',
  ).toBeTruthy();

  const wf = new WorkflowPage(page);
  await wf.openRunViewer(name as string);
  const failed = page
    .getByTestId('workflow-run-graph')
    .locator('[data-state="failed"], [data-state="upstream_failed"]');
  expect(
    await failed.count(),
    '워크플로우 전체 상태가 success 여도 개별 작업이 실패했을 수 있다 — Run Status 의 작업별 상태로 판정한다',
  ).toBe(0);
});

// ── 구간5: the completion notice ────────────────────────────────────────

Given('워크플로우 완료 알림이 도착한다', async ({ page }) => {
  const notifications = new NotificationPage(page);
  await notifications.waitForAnyItem(20 * 60_000);
});

When('알림을 열어 확인하면', async ({ page }) => {
  const notifications = new NotificationPage(page);
  await notifications.open();
  await humanClick(page.getByTestId('notification-item').first());
});

Then('알림이 읽음으로 처리된다', async ({ page }) => {
  await humanClick(page.getByTestId('notification-confirm'));
  await expect(page.getByTestId('notification-badge')).toBeHidden({
    timeout: 15_000,
  });
});

// ── 구간6: what actually got built ──────────────────────────────────────

/**
 * The security group is the only place that proves the port edit survived the whole chain - model,
 * recommendation, workflow, provisioning. The scenario opens 5555 twice by two different routes, so
 * this is what tells the two apart from a pair of infras that merely came up.
 */
Then(
  '{string} 인프라의 보안그룹에 5555 포트가 열려 있다',
  async ({ page, request }, infraName: string) => {
    const token = await getSessionToken(page);
    const nsId = testNamespace.id;

    const infraRes = await request.post(
      `${config.baseURL}/api/cm-beetle/GetInfra`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { pathParams: { nsId, infraId: infraName } },
      },
    );
    const infraBody = await infraRes.json().catch(() => ({}));
    const infra =
      infraBody?.responseData?.data ?? infraBody?.responseData ?? {};
    const sgIds: string[] = (infra.node ?? [])[0]?.securityGroupIds ?? [];
    expect(
      sgIds.length,
      `${infraName} 의 노드에서 보안그룹을 찾지 못했다 — 인프라가 아직 만들어지지 않았을 수 있다`,
    ).toBeGreaterThan(0);

    const ports: string[] = [];
    for (const sgId of sgIds) {
      const res = await request.post(
        `${config.baseURL}/api/cb-tumblebug/GetSecurityGroup`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { pathParams: { nsId, securityGroupId: sgId } },
        },
      );
      const body = await res.json().catch(() => ({}));
      const sg = body?.responseData?.data ?? body?.responseData ?? {};
      for (const rule of sg.firewallRules ?? []) {
        if (rule?.ports) ports.push(String(rule.ports));
      }
    }

    expect(
      ports.join(','),
      `${infraName} 의 보안그룹에 5555 가 없다 — 모델 단계에서 넣은 방화벽 규칙이 인프라까지 오지 않았다`,
    ).toContain('5555');
  },
);

// ── 구간7·8: software, judged by the install rather than the run ────────

When(
  '{string} 타깃 SW 모델로 {string} 에 소프트웨어 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, swModelName: string, infraName: string) => {
    scenarioState.infraName = infraName;
    scenarioState.infraId = infraName;
    scenarioState.swRunStartedAt = Date.now();
    const models = new ModelsPage(page);
    const wf = new WorkflowPage(page);
    const name = `${workflowData.createNamePrefix}-sw-${Date.now()}`;

    await models.openWorkflowEditorFromTarget(uniqueName(swModelName));
    await wf.expectDesignerOpen();
    await wf.fillWorkflowName(name);
    await wf.selectTaskInDesigner(workflowData.softwareMigrationTask);
    await wf.setTaskParam('query', 'infraId', infraName);
    await wf.saveWorkflow();

    await wf.gotoWorkflows();
    await wf.expectWorkflowVisible(name);
    await page.waitForTimeout(120_000);
    await wf.runWorkflow(name);
    scenarioState.softwareWorkflowName = name;
  },
);

/**
 * Wait for the install, not for the workflow.
 *
 * grasshopper takes the request and installs asynchronously, so the workflow is done as soon as it
 * has handed the job over - 4.4 seconds in the ETRI run, with the install barely started. This is
 * the long stretch that is deliberately left out of the recording.
 */
Then('소프트웨어 설치가 끝날 때까지 기다린다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.waitSoftwareMigrationButton();
  await wf.openSoftwareMigrationResult();

  const deadline = Date.now() + 60 * 60_000;
  while (Date.now() < deadline) {
    const rows = await wf.readSoftwareMigrationRows();
    const pending = rows.filter(r => /install|progress|중/i.test(r.status));
    if (rows.length && !pending.length) return;
    await page.waitForTimeout(60_000);
    await page.reload();
    await wf.openSoftwareMigrationResult();
  }
  throw new Error('소프트웨어 설치가 한 시간 안에 끝나지 않았다');
});

Then(
  '소프트웨어 마이그레이션 결과에 {string} 가 설치 성공으로 보인다',
  async ({ page }, software: string) => {
    const row = page
      .getByTestId('sw-result-row')
      .filter({ hasText: software })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(/success|완료/i);
  },
);

Given(
  '{string} 인프라에 부하 테스트를 실행한다',
  async ({ page }, infraName: string) => {
    scenarioState.infraName = infraName;
    scenarioState.infraId = infraName;

    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.selectMci(infraName);
    await wl.runLoadTest({
      ...workload.loadTest,
      targetHost: scenarioState.nodePublicIp || workload.loadTest.targetHost,
    });
  },
);
