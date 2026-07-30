import { Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { JsonEditorPage } from '../pages/jsonEditor.page';
import { ModelsPage } from '../pages/models.page';
import { WorkflowPage } from '../pages/workflow.page';
import { NotificationPage } from '../pages/notification.page';
import { WorkloadPage } from '../pages/workload.page';
import { SourceServicesPage, Connection } from '../pages/sourceServices.page';
import {
  config,
  testNamespace,
  sourceServers,
  targetSpec,
  workflowData,
  workload,
} from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { getSessionToken } from '../support/apiWait';
import { scenarioState } from '../support/world';
import { recall, remember } from '../support/handoff';
import { humanClick } from '../support/humanize';
import { openScreen } from '../support/navigate';

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
  await openScreen(page, 'migrationguide', '/main/migration-guide');
});

Then('마이그레이션 가이드가 보인다', async ({ page }) => {
  await expect(page.getByTestId('migration-guide-page')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId('migration-guide-steps')).toBeVisible();
});

/** Read down the page and come back up - the pause is what makes it readable on the recording. */
Given('가이드를 아래로 훑어보고 다시 위로 올린다', async ({ page }) => {
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, -1_200);
  await page.waitForTimeout(500);
});

/**
 * Enter through the diagram rather than the left menu.
 *
 * The guide numbers the steps and each one is a link to the screen that does it, so following it is
 * how someone arrives the first time. Jumping straight to the menu would skip the part of the
 * product that is meant to show you the order.
 */
const GUIDE_BLOCKS: Record<string, string> = {
  '소스 서비스': 'migration-guide-step-source-service',
  '소스 모델': 'migration-guide-step-source-model',
  '타깃 모델': 'migration-guide-step-target-model',
  '워크플로우 생성': 'migration-guide-step-create-workflow',
  '워크플로우 실행': 'migration-guide-step-run-workflow',
};

When('가이드에서 {string} 블록을 클릭하면', async ({ page }, label: string) => {
  const testId = GUIDE_BLOCKS[label];
  expect(testId, `가이드에 "${label}" 블록이 정의돼 있지 않다`).toBeTruthy();
  await humanClick(page.getByTestId(testId));
});

When('도움말을 열면', async ({ page }) => {
  await humanClick(page.getByTestId('help-toggle'));
  await expect(page.getByTestId('help-panel')).toBeVisible({ timeout: 15_000 });
});

Then('도움말에 현재 화면 설명이 보인다', async ({ page }) => {
  await expect(page.getByTestId('help-title')).toBeVisible({ timeout: 15_000 });
  // The panel used to describe the list behind whatever was open on top of it. An empty body is
  // the shape that failure took, so it is what this checks.
  await expect(page.getByTestId('help-body')).not.toBeEmpty();
});

Given('도움말 패널의 폭을 넓혔다 줄인다', async ({ page }) => {
  const box = await page.getByTestId('help-resizer').first().boundingBox();
  if (!box) return;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x - 220, y, { steps: 20 });
  await page.waitForTimeout(400);
  await page.mouse.move(box.x + 60, y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(400);
});

When('도움말 도킹을 해제하면', async ({ page }) => {
  await humanClick(page.getByTestId('help-detach'));
});

/**
 * Floating is a state, and the only thing that carries it is the class the panel switches to. The
 * panel now also exposes `data-docked`, which says the same thing without depending on how the
 * style is written; either one answering is enough.
 */
Then('도움말이 떠 있는 창으로 바뀐다', async ({ page }) => {
  await expect(page.getByTestId('help-panel')).toHaveAttribute(
    'data-docked',
    'false',
    { timeout: 10_000 },
  );
});

Given('도움말 창을 다른 위치로 옮긴다', async ({ page }) => {
  const box = await page.getByTestId('help-header').first().boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 300, box.y + 180, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(400);
});

Given('도움말 창의 크기를 키운다', async ({ page }) => {
  const box = await page.getByTestId('help-resizer').first().boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 240, box.y + 120, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(400);
});

Given('도움말을 닫는다', async ({ page }) => {
  await humanClick(page.getByTestId('help-close'));
  await expect(page.getByTestId('help-panel')).toBeHidden({ timeout: 10_000 });
});

// ── 구간2: registering source connections from a file ───────────────────

/** The connection details for one of the two source servers, by the group name the scenario uses. */
function connectionFor(
  groupName: string,
  server: 'nano' | 'micro',
): Connection {
  const s = sourceServers[server];
  return {
    name: `${uniqueName(groupName)}-${server}`,
    ip: s.ip,
    sshPort: s.sshPort,
    user: s.sshUser,
    password: s.privateKey ? undefined : s.password || undefined,
    privateKey: s.privateKey || undefined,
  };
}

/**
 * Register a group from a file rather than one connection at a time.
 *
 * Both servers go in together, which is what the file route is for, and the same two are also
 * registered singly in the steps that follow - so the scenario ends with three groups covering both
 * ways of getting connections in.
 */
When(
  '소스 연결정보 CSV로 {string} 그룹을 등록하면',
  async ({ page }, groupName: string) => {
    const name = uniqueName(groupName);
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupImportingConnections(name, [
      connectionFor(groupName, 'nano'),
      connectionFor(groupName, 'micro'),
    ]);
    scenarioState.sourceGroupName = name;
  },
);

/** Register one server on its own - the other way in, and the group the scenario collects from. */
Given(
  '소스 서비스에 {string} 소스서버를 {string} 로 등록한다',
  async ({ page }, groupName: string, server: string) => {
    const kind = server === 'micro' ? 'micro' : 'nano';
    const name = uniqueName(groupName);
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.createSourceGroupWithConnection(
      name,
      connectionFor(groupName, kind),
    );
    scenarioState.sourceGroupName = name;
  },
);

Then('소스그룹 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  const source = new SourceServicesPage(page);
  await source.goto();
  await source.expectGroupListed(uniqueName(name));
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
    // Saving the collected result leaves you on the source *services* screen. The recommendation
    // starts from the source model's own detail, so go there and open the model first.
    await models.gotoSourceModels();
    await models.selectModel(
      scenarioState.sourceModelName ?? uniqueName(modelName),
    );
    await models.openRecommend();
    await models.selectProvider(csp);
    await models.selectRegion(region);
    // Ask for more candidates than the default. A small source narrows what comes back, and the
    // ones with a blank spec or image are unusable - a wider list is what makes a complete one
    // likely to be there at all.
    await models.setCandidateLimit(
      Number(process.env.TEST_RECOMMEND_LIMIT || 20),
    );
    await models.runRecommend();
    const picked = await models.selectCompleteCandidate(targetSpec.maxClass);
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
/**
 * Copy the rule that already allows 22 and change the copy's port to 5555.
 *
 * The rule is an item of an array, and only array items can be duplicated - the port field itself
 * has no copy of its own. So the port row is what we search for, but the item *containing* it is
 * what gets duplicated, and the port on the new item is what gets changed.
 */
async function openPortByDuplicating(page: Page): Promise<void> {
  const editor = new JsonEditorPage(page);
  await editor.switchToTable();
  await editor.search('22');
  await editor.enableFilter();

  const portRow = editor.row('22');
  await expect(
    portRow,
    '방화벽에 22번 규칙이 없다 — 소스 서버에 방화벽이 설정돼 있어야 수집에 잡힌다',
  ).toBeVisible({ timeout: 15_000 });

  const item = await editor.enclosingItem(portRow);
  await editor.duplicateRow(item);

  // The copy is the second row now matching 22; changing it leaves the original alone.
  const copy = editor.rowsMatching('22').nth(1);
  await editor.setRowValue(copy, '5555');
  await editor.closeSearch();
}

When(
  '소스 모델의 방화벽에 22번 규칙을 복제해 5555 포트를 추가하면',
  async ({ page }) => {
    await new JsonEditorPage(page).openFromSourceModel();
    await openPortByDuplicating(page);
  },
);

When(
  '{string} 타깃 모델의 방화벽에 22번 규칙을 복제해 5555 포트를 추가하면',
  async ({ page }, modelName: string) => {
    const models = new ModelsPage(page);
    await models.gotoTargetModels();
    await models.selectModel(uniqueName(modelName));

    await new JsonEditorPage(page).openFromTargetModel();
    await openPortByDuplicating(page);
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
  await editor.search('specId');
  await editor.enableFilter();

  // A spec is written provider+region+size, and only the size changes. Replacing the whole value
  // would take the region with it and the migration would go looking for a machine type in the
  // wrong place.
  const size = process.env.TEST_TARGET_SPEC_SIZE || 't3a.large';
  const current = await editor.readRowValue('specId');
  const parts = current.split('+');
  const next =
    parts.length > 1 ? [...parts.slice(0, -1), size].join('+') : size;
  console.log(`[seg4] 스펙 ${current} → ${next}`);
  await editor.setRowValue(editor.rowByKey('specId'), next);
  await editor.closeSearch();
});

// ── 구간3·5: workflows that do not collide with each other ──────────────

/**
 * Wait until airflow has picked up the workflow's DAG.
 *
 * Saving only writes the DAG to disk; airflow parses it on its own schedule, and a run fired before
 * that is rejected outright. Retrying is not an option - an attempt that does land builds another
 * instance - so this waits for a signal instead of sitting out a fixed two minutes.
 *
 * The signal is the workflow's *run list*: cm-cicada answers it from airflow, so while the DAG is
 * still unknown the call fails, and once it is parsed the call answers (with nothing in it, since
 * it has never run). Falls through at the deadline rather than failing - the run is the real check.
 */
async function waitForDagRegistered(page: Page, name: string): Promise<void> {
  const token = await getSessionToken(page);
  const auth = { Authorization: `Bearer ${token}` };
  const started = Date.now();
  const deadline = started + 3 * 60_000;

  // Ask for the id until it answers. A workflow that was saved a moment ago is not always there on
  // the first call, and a single attempt that missed used to drop into a blind two-minute sleep -
  // which is two minutes of a frozen screen in the recording, every time it happened.
  let wfId = '';
  while (!wfId && Date.now() < deadline) {
    wfId = await page.request
      .post(`${config.baseURL}/api/cm-cicada/Get-Workflow-By-Name`, {
        headers: auth,
        data: { pathParams: { wfName: name } },
      })
      .then(r => r.json())
      .then(b => b?.responseData?.data?.id ?? b?.responseData?.id ?? '')
      .catch(() => '');
    if (!wfId) await page.waitForTimeout(3_000);
  }

  if (!wfId) {
    // Say so rather than sleeping and running anyway. Running before the DAG is parsed is rejected
    // outright, and retrying is not an option - an attempt that does land builds another instance.
    throw new Error(
      `워크플로우 "${name}" 의 id 를 ${Math.round((Date.now() - started) / 1000)}초 동안 찾지 못했다. ` +
        'DAG 가 등록되기 전에 실행하면 거부되므로 여기서 멈춘다.',
    );
  }

  while (Date.now() < deadline) {
    const ready = await page.request
      .post(`${config.baseURL}/api/cm-cicada/Get-Workflow-Runs`, {
        headers: auth,
        data: { pathParams: { wfId } },
      })
      .then(r => r.ok())
      .catch(() => false);
    if (ready) break;
    await page.waitForTimeout(3_000);
  }

  console.log(
    `[workflow] DAG 등록 확인까지 ${Math.round((Date.now() - started) / 1000)}초`,
  );
  // Registration and runnability are not the same instant, so a short grace on top.
  await page.waitForTimeout(15_000);
}

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
  '{string} 타깃 모델로 {string} 번 트랙 이름으로 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, targetModelName: string, track: string) => {
    const seed = trackSeed(track);
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
    // before that is rejected outright. We cannot simply retry - every attempt at a migration
    // workflow that does land builds another instance - so we wait for airflow to report the DAG
    // instead of sitting out a fixed two minutes. It is usually ready well before that.
    await wf.gotoWorkflows();
    await wf.expectWorkflowVisible(name);
    await waitForDagRegistered(page, name);
    await wf.runWorkflow(name);

    scenarioState.softwareWorkflowName = name;

    // Find what was actually created rather than assuming what it will be called. The name comes
    // from the prefix plus whatever the target model carries, so guessing it is a rule that holds
    // only until the naming changes - and it cannot tell this run's infrastructure from one left
    // behind by an earlier one. The id is read back and handed to the segments that follow.
    const infraId = await waitForInfraCreated(page, seed);
    scenarioState.infraName = infraId;
    scenarioState.infraId = infraId;
    remember(`infra:${track}`, infraId);
  },
);

/**
 * Wait until the migration has produced an infrastructure, and return its id.
 *
 * The prefix is what tells this run's infrastructure apart from the others in the namespace - it is
 * given to the workflow precisely so that the names do not collide - so it is what we match on,
 * and the id that comes back is what everything downstream uses.
 */
async function waitForInfraCreated(page: Page, seed: string): Promise<string> {
  const token = await getSessionToken(page);
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    const infras = await page.request
      .post(`${config.baseURL}/api/cm-beetle/ListInfra`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { pathParams: { nsId: testNamespace.id } },
      })
      .then(r => r.json())
      .then(b => b?.responseData?.data?.infra ?? [])
      .catch(() => []);
    const mine = (infras as any[]).find((i: any) =>
      String(i?.id ?? '').startsWith(`${seed}-`),
    );
    if (mine?.id) return mine.id;
    await page.waitForTimeout(20_000);
  }
  throw new Error(`"${seed}" 접두어로 만들어진 인프라를 찾지 못했다`);
}

/** The infra a given track created, by the prefix its workflow was given. */
function infraFor(track: string): string {
  const id = recall(`infra:${track}`);
  expect(
    id,
    `${track} 번 트랙이 만든 인프라를 알 수 없다 — 그 인프라를 만드는 구간이 먼저 실행돼야 한다`,
  ).toBeTruthy();
  return id as string;
}

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

  // Reads what has happened so far rather than waiting for the run to end. Provisioning carries on
  // in the background; holding here would spend minutes watching a progress bar when the next piece
  // of work could be under way. A task that has already failed shows up now, and the rest is judged
  // later from what was actually built.
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

/**
 * The badge is what says a notification arrived - the list only exists once the panel is opened.
 * Waiting on the list without opening it waits for something that cannot appear.
 */
Given('워크플로우 완료 알림이 도착한다', async ({ page }) => {
  await expect(page.getByTestId('notification-badge')).toBeVisible({
    timeout: 10 * 60_000,
  });
});

When('알림을 열어 확인하면', async ({ page }) => {
  const notifications = new NotificationPage(page);
  await notifications.open();
  await notifications.waitForAnyItem(60_000);

  const item = page.getByTestId('notification-item').first();
  // Remember which notice this is. Confirming marks that one read, and that is what the next step
  // has to check - not the badge, which stays lit while any other notice is still unread.
  scenarioState.notificationId =
    (await item.getAttribute('data-notification-id')) ?? '';
  await humanClick(item);
});

/**
 * Read the notices until none are left unread, and the badge goes.
 *
 * One confirmation is not enough. Each segment is its own run against the same account, so by the
 * time this one gets here the earlier workflow has left a notice of its own - confirming a single
 * item still leaves the badge showing, which read as the product failing to mark anything read.
 * It was doing exactly what it should.
 */
Then('알림이 읽음으로 처리된다', async ({ page }) => {
  await humanClick(page.getByTestId('notification-confirm'));

  // The notice we confirmed leaves the list - that is what being read looks like here.
  //
  // Waiting for the badge to go out instead was wrong: each segment is its own run against the
  // same account, so an earlier workflow has already left a notice of its own, and the badge
  // rightly stays lit for it. The product was marking things read all along.
  const confirmed = page.locator(
    `[data-testid="notification-item"][data-notification-id="${scenarioState.notificationId}"]`,
  );
  await expect(confirmed).toHaveCount(0, { timeout: 15_000 });
});

// ── 구간6: what actually got built ──────────────────────────────────────

/**
 * The security group is the only place that proves the port edit survived the whole chain - model,
 * recommendation, workflow, provisioning. The scenario opens 5555 twice by two different routes, so
 * this is what tells the two apart from a pair of infras that merely came up.
 */
Then(
  '{string} 번 트랙이 만든 인프라의 보안그룹에 5555 포트가 열려 있다',
  async ({ page, request }, track: string) => {
    const infraName = infraFor(track);
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
        // The port field is named differently at each layer, and reading the wrong one yields
        // undefined for every rule - which reads as "the port is not open" and is a convincing
        // way to report a working product as broken.
        //   source model  firewallTable[].dstPorts
        //   target model  firewallRules[].Ports
        //   security group (cb-tumblebug)  firewallRules[].Port
        const port = rule?.Port ?? rule?.Ports ?? rule?.ports;
        if (port !== undefined && port !== null) ports.push(String(port));
      }
    }

    expect(
      ports.join(','),
      `${infraName} 의 보안그룹에 5555 가 없다 — 모델 단계에서 넣은 방화벽 규칙이 인프라까지 오지 않았다`,
    ).toContain('5555');
  },
);

/**
 * The naming prefix a track's infrastructure is built with.
 *
 * Date, run and track number, so that no two runs produce the same names - and so that a glance at
 * a resource says roughly when it was made. A fixed prefix collides with itself the second time it
 * is used, and cm-beetle reuses an existing resource when it finds one under the name it wants, so
 * the second run quietly attaches to the first run's network instead of failing outright.
 *
 * The stamp is the date and the time, so the name says when it was made down to the second and two
 * runs on the same day cannot land on the same one. Prefixes take at most 20 characters of
 * alphanumerics and hyphens, which this stays inside: `t1-260729-184430`.
 */
function trackSeed(track: string): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const day = `${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
  const time = `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `t${track}-${day}-${time}`;
}

// ── 구간6: what a track actually built ──────────────────────────────────

/**
 * These name the *track* rather than the infrastructure, and look up what that track created.
 *
 * The scenario used to write the name out - `awsb-infra101` - which is the prefix plus whatever the
 * target model happens to carry. That only holds while the naming rule holds, and it cannot tell
 * this run's infrastructure from a leftover with the same name. The id is recorded when the
 * migration finishes and read back here.
 */
Then(
  '{string} 번 트랙이 만든 인프라가 목록에 보인다',
  async ({ page }, track: string) => {
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.expectMciVisible(infraFor(track));
  },
);

Given(
  '{string} 번 트랙이 만든 인프라를 선택한다',
  async ({ page }, track: string) => {
    const infraId = infraFor(track);
    scenarioState.infraName = infraId;
    scenarioState.infraId = infraId;
    await new WorkloadPage(page).selectMci(infraId);
  },
);

Given(
  '{string} 번 트랙이 만든 인프라를 삭제한다',
  async ({ page }, track: string) => {
    const infraId = infraFor(track);
    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.selectMci(infraId);
    await wl.openDeleteModal();
    await wl.confirmDelete(infraId, 'normal');
  },
);

// ── 구간7·8: software, judged by the install rather than the run ────────

When(
  '{string} 타깃 SW 모델로 {string} 번 트랙이 만든 인프라에 소프트웨어 마이그레이션 워크플로우를 생성하고 실행하면',
  async ({ page }, swModelName: string, track: string) => {
    const infraName = infraFor(track);
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
    // Same wait as the infra workflow, for the same reason - running before the DAG is parsed is
    // rejected. Waiting for the signal rather than sitting out a fixed two minutes.
    await waitForDagRegistered(page, name);
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
/**
 * Wait for the install, not for the screen.
 *
 * grasshopper takes the request and installs asynchronously, so the workflow is finished as soon as
 * it has handed the job over - 4.4 seconds in the ETRI run, with the install barely started. The
 * results button does not exist yet at that point either, so watching for it waits on the wrong
 * thing; the install list is what actually moves.
 *
 * This is the long stretch deliberately left out of the recording.
 */
/**
 * Confirm the install has been taken on, and leave it running.
 *
 * grasshopper installs asynchronously and takes several minutes over it. Sitting here would spend
 * that time watching, when the only thing that matters at this point is that the work was accepted -
 * the outcome is read in the next segment, from the install list. That is also what a person does:
 * start it, go and do something else, come back to the result.
 */
Then('소프트웨어 설치가 시작된다', async ({ page }) => {
  const token = await getSessionToken(page);
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const list = await readSoftwareStatuses(
      page,
      token,
      undefined,
      scenarioState.infraName,
    );
    if (list.length) {
      console.log(`[seg7] 설치 착수 확인 — 대상 ${list.length}개`);
      return;
    }
    await page.waitForTimeout(15_000);
  }
  throw new Error(
    '소프트웨어 설치가 시작되지 않았다 — grasshopper 에 실행 기록이 없다',
  );
});

/**
 * Wait for the install to settle, then report what happened.
 *
 * Called at the start of the segment that reads the result, so the waiting happens where the answer
 * is needed rather than where the work was started.
 */
Given(
  '{string} 번 트랙이 만든 인프라의 소프트웨어 설치가 끝나기를 기다린다',
  async ({ page }, track: string) => {
    const infraName = infraFor(track);
    scenarioState.infraName = infraName;
    scenarioState.infraId = infraName;

    const token = await getSessionToken(page);
    const deadline = Date.now() + 60 * 60_000;
    let last = '';
    while (Date.now() < deadline) {
      const list = await readSoftwareStatuses(
        page,
        token,
        undefined,
        infraName,
      );
      if (list.length) {
        const done = list.filter(s => s.status === 'finished').length;
        const failed = list.filter(s => s.status === 'failed');
        const pending = list.filter(
          s => s.status !== 'finished' && s.status !== 'failed',
        );
        const line = `${done}/${list.length} 완료, ${failed.length} 실패, ${pending.length} 남음`;
        if (line !== last) {
          console.log(`[seg8] ${line}`);
          last = line;
        }
        if (!pending.length) {
          scenarioState.swMigrationRows = list;
          return;
        }
      }
      await page.waitForTimeout(30_000);
    }
    throw new Error('소프트웨어 설치가 한 시간 안에 끝나지 않았다');
  },
);

/**
 * The per-software rows grasshopper reports for a run.
 *
 * Two calls, because the two endpoints answer different questions. The list gives one entry per
 * run with its target and overall state but *no* per-software detail; the detail only comes from
 * asking for a specific execution. So when we do not already hold an id - each segment runs on its
 * own and remembers nothing - the run is found by the infra it installed onto, newest first.
 */
async function readSoftwareStatuses(
  page: Page,
  token: string,
  executionId?: string,
  infraName?: string,
): Promise<
  Array<{ software_name: string; status: string; error_message?: string }>
> {
  const auth = { Authorization: `Bearer ${token}` };
  const post = (op: string, data: unknown) =>
    page.request
      .post(`${config.baseURL}/api/cm-grasshopper/${op}`, {
        headers: auth,
        data,
      })
      .then(r => r.json())
      .then(b => b?.responseData)
      .catch(() => null);

  let id = executionId;
  if (!id) {
    const runs = (await post('List-Software-Migration-Status', {})) ?? [];
    const forInfra = (Array.isArray(runs) ? runs : []).filter((run: any) =>
      (run?.target_mappings ?? []).some(
        (m: any) => !infraName || m?.target?.infra_id === infraName,
      ),
    );
    // Newest last in the list, so take it from the end.
    id = forInfra[forInfra.length - 1]?.execution_id;
  }
  if (!id) return [];

  const detail = await post('Get-Software-Migration-Status', {
    pathParams: { executionId: id },
  });
  return ((detail as any)?.target_mappings ?? []).flatMap(
    (m: any) => m?.software_migration_status_list ?? [],
  );
}

/**
 * Read the install list for an infra, from grasshopper.
 *
 * The scenario says the install is judged by what was installed, not by the workflow or the screen
 * - so this asks the service that did the installing. It also names the infra for the steps after
 * it, which matters because each segment is run on its own and starts with nothing remembered.
 */
Given(
  '{string} 번 트랙이 만든 인프라의 소프트웨어 설치 결과를 조회한다',
  async ({ page }, track: string) => {
    const infraName = infraFor(track);
    scenarioState.infraName = infraName;
    scenarioState.infraId = infraName;

    const token = await getSessionToken(page);
    const rows = await readSoftwareStatuses(
      page,
      token,
      scenarioState.swExecutionIds?.[0],
      infraName,
    );
    expect(
      rows.length,
      `${infraName} 에 대한 소프트웨어 설치 기록이 없다 — 마이그레이션이 실행되지 않았다`,
    ).toBeGreaterThan(0);
    scenarioState.swMigrationRows = rows;

    const done = rows.filter(r => r.status === 'finished').length;
    const failed = rows.filter(r => r.status === 'failed');
    console.log(
      `[seg8] 설치 ${done}/${rows.length} 완료, 실패 ${failed.length}건`,
    );
  },
);

Then(
  '소프트웨어 마이그레이션 결과에 {string} 가 설치 성공으로 보인다',
  async ({ page: _page }, software: string) => {
    const rows = scenarioState.swMigrationRows ?? [];
    const row = rows.find((r: any) => r.software_name === software);
    expect(
      row,
      `설치 목록에 ${software} 가 없다 — 소스에서 수집되지 않았을 수 있다`,
    ).toBeTruthy();
    expect(
      row.status,
      `${software} 설치가 끝나지 않았거나 실패했다: ${row.status} ${row.error_message ?? ''}`,
    ).toBe('finished');
  },
);

/**
 * Run a load test against the migrated infra.
 *
 * The load settings live on the *node*, not on the infra - ticking the infra row leaves the button
 * out of reach. And the target address has to be looked up: each segment runs on its own, so
 * nothing is remembered from the run that created the machine.
 */
Given(
  '{string} 번 트랙이 만든 인프라에 부하 테스트를 실행한다',
  async ({ page }, track: string) => {
    const infraName = infraFor(track);
    scenarioState.infraName = infraName;
    scenarioState.infraId = infraName;

    const token = await getSessionToken(page);
    const infra = await page.request
      .post(`${config.baseURL}/api/cm-beetle/GetInfra`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { pathParams: { nsId: testNamespace.id, infraId: infraName } },
      })
      .then(r => r.json())
      .then(b => b?.responseData?.data ?? b?.responseData ?? {})
      .catch(() => ({}));
    const node = (infra.node ?? [])[0] ?? {};
    const host = node.publicIP ?? '';
    expect(host, `${infraName} 의 노드 주소를 찾지 못했다`).toBeTruthy();
    scenarioState.nodeId = node.id;
    scenarioState.nodePublicIp = host;
    console.log(
      `[seg8] 부하 대상 ${node.id} (${host}:${workload.loadTest.port})`,
    );

    const wl = new WorkloadPage(page);
    await wl.gotoMci();
    await wl.selectMci(infraName);
    await wl.openServerTab();
    await wl.selectNode(node.id ?? '');
    await wl.runLoadTest({ ...workload.loadTest, targetHost: host });
  },
);
