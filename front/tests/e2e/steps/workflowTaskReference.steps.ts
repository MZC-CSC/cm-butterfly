import { createBdd, DataTable } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkflowPage } from '../pages/workflow.page';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';
import { getSessionToken } from '../support/apiWait';
import { config } from '../fixtures/test-data';
import {
  seedChainOfTasks,
  seedWorkflowFromTemplate,
  seedWorkflowWithBrokenReference,
  deleteWorkflowById,
} from '../support/seedWorkflow';

const { Given, When, Then, After } = createBdd(test);

/**
 * Remove what each scenario made.
 *
 * Every scenario builds its own workflow so the ones before it cannot colour the result. Left behind
 * they would pile up on the server and make the list unreadable for the next person using it.
 */
After(async ({ page }) => {
  const id = scenarioState.taskReferenceSeededWorkflowId;
  scenarioState.taskReferenceSeededWorkflowId = undefined;
  scenarioState.taskReferenceWorkflowName = undefined;
  if (!id) return;
  await deleteWorkflowById({
    request: page.request,
    token: await getSessionToken(page).catch(() => ''),
    id,
  }).catch(() => undefined);
});

/**
 * Filling a task's request body from a task that runs before it.
 *
 * These run against the designer with a template loaded but *not saved*. The template is what puts a
 * chain of tasks on the canvas, and everything under test — which tasks may be picked, what the value
 * list shows, what a filled field looks like — is decided in the editor before anything is saved. Only
 * the reopen scenario saves, because only that one is about what survives a round trip. Not saving also
 * means the tests leave nothing behind on the server.
 */

Given(
  '{string} 짜임으로 만든 워크플로우를 에디터에서 연다',
  async ({ page }, templateName: string) => {
    const wf = new WorkflowPage(page);
    const name = uniqueName(`ref-${templateName}`);
    scenarioState.taskReferenceWorkflowName = name;

    const id = await seedWorkflowFromTemplate({
      request: page.request,
      token: await getSessionToken(page),
      templateName,
      name,
    });
    scenarioState.taskReferenceSeededWorkflowId = id;

    // The list was already on screen when the workflow was made, and it does not poll — reload so it
    // holds what is actually on the server.
    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    // Nothing here works until the task chain is drawn — that chain is what decides which tasks may
    // be taken from.
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
  },
);

Given(
  '{string} 태스크가 차례로 이어진 워크플로우를 에디터에서 연다',
  async ({ page }, taskNames: string) => {
    const wf = new WorkflowPage(page);
    const name = uniqueName('ref-chain');
    scenarioState.taskReferenceWorkflowName = name;

    scenarioState.taskReferenceSeededWorkflowId = await seedChainOfTasks({
      request: page.request,
      token: await getSessionToken(page),
      name,
      taskNames: taskNames.split(',').map(part => part.trim()),
    });

    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
  },
);

Given(
  '결과 정보를 주지 않는 태스크가 앞에 있는 워크플로우를 에디터에서 연다',
  async ({ page }) => {
    // Not every task describes what it returns — ones assembled by hand, and APIs whose successful
    // response carries no body. The list has to say so rather than look empty.
    const wf = new WorkflowPage(page);
    const name = uniqueName('ref-noschema');
    scenarioState.taskReferenceWorkflowName = name;

    scenarioState.taskReferenceSeededWorkflowId = await seedChainOfTasks({
      request: page.request,
      token: await getSessionToken(page),
      name,
      taskNames: ['first_step', 'second_step'],
      components: ['_v2_bash_notice', undefined],
    });

    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
  },
);

Given(
  '참조가 이미 들어 있는 워크플로우를 에디터에서 연다',
  async ({ page }) => {
    // A workflow that arrives already using references is the case where restoring them fails
    // quietly — the value comes back as text, and if it is not recognised again the user sees
    // `${task.$.path}` sitting in a box.
    //
    // The shipped templates used to supply one and stopped; they belong to cm-cicada and change
    // with the lineup. This builds its own so the scenario does not rest on someone else's data.
    const wf = new WorkflowPage(page);
    const name = uniqueName('ref-existing');
    scenarioState.taskReferenceWorkflowName = name;

    scenarioState.taskReferenceSeededWorkflowId = await seedChainOfTasks({
      request: page.request,
      token: await getSessionToken(page),
      name,
      taskNames: ['first_step', 'second_step'],
      references: [
        undefined,
        {
          infra_id: '${first_step.$.output}',
          node_id: '${first_step.$.error}',
          ns_id: 'mig01',
        },
      ],
    });

    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
  },
);

Given('{string} 태스크를 편집한다', async ({ page }, taskName: string) => {
  await new WorkflowPage(page).selectTaskInDesigner('', taskName);
});

When('{string} 태스크를 편집하면', async ({ page }, taskName: string) => {
  await new WorkflowPage(page).selectTaskInDesigner('', taskName);
});

// ── What may be taken from ───────────────────────────────────────────────────

Then('가져올 앞선 태스크가 없다는 안내가 보인다', async ({ page }) => {
  await expect(new WorkflowPage(page).noEarlierTaskNote).toBeVisible();
});

// 가져올 곳이 없을 때 그 선택지를 숨기지 않고 잠가 둔다. 없애 버리면 "원래 그런
// 화면" 으로 보여, 앞에 태스크를 두면 쓸 수 있다는 것을 알 길이 없다.
Then('{string} 를 고를 수 없다', async ({ page }, label: string) => {
  expect(label).toBe('앞선 태스크에서 가져오기');
  await expect(new WorkflowPage(page).pickOnCanvas).toBeDisabled();
});

Then('{string} 를 고를 수 있다', async ({ page }, label: string) => {
  expect(label).toBe('앞선 태스크에서 가져오기');
  await expect(new WorkflowPage(page).pickOnCanvas).toBeEnabled();
});

// ── Picking on the canvas ────────────────────────────────────────────────────

When('캔버스에서 고르기를 시작하면', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.pickOnCanvas.click();
  await expect(wf.pickableTasks.first()).toBeVisible({ timeout: 10_000 });
});

Then(
  '캔버스에서 고를 수 있는 태스크는 다음과 같다',
  async ({ page }, table: DataTable) => {
    const expected = table.raw().map(row => row[0].trim());
    const actual = await new WorkflowPage(page).pickableTaskNames();
    expect(actual.sort()).toEqual(expected.sort());
  },
);

Then('편집 중인 {string} 는 고를 수 없다', async ({ page }, name: string) => {
  const names = await new WorkflowPage(page).pickableTaskNames();
  expect(
    names,
    '편집 중인 태스크가 자기 자신을 가리키게 둘 수 없다',
  ).not.toContain(name);
});

Then(
  '뒤에 실행되는 {string} 은 고를 수 없다',
  async ({ page }, name: string) => {
    const names = await new WorkflowPage(page).pickableTaskNames();
    expect(
      names,
      '뒤에 실행되는 태스크는 아직 아무것도 내놓지 않았다',
    ).not.toContain(name);
  },
);

When(
  '캔버스에서 {string} 태스크를 고르면',
  async ({ page }, taskName: string) => {
    await new WorkflowPage(page).pickTaskOnCanvas(taskName);
  },
);

Then('값 고르기 창이 열린다', async ({ page }) => {
  await expect(new WorkflowPage(page).referencePicker).toBeVisible();
});

Then(
  '값 고르기 창에 {string} 의 결과가 있다',
  async ({ page }, taskName: string) => {
    await expect(
      new WorkflowPage(page).referenceSource(taskName),
    ).toBeVisible();
  },
);

// ── The value list ───────────────────────────────────────────────────────────

Given('{string} 칸의 값 고르기 창을 연다', async ({ page }, field: string) => {
  const wf = new WorkflowPage(page);
  await wf.referenceAdd(field).click();
  await expect(wf.referencePicker).toBeVisible({ timeout: 10_000 });
});

When('{string} 칸의 값 고르기 창을 열면', async ({ page }, field: string) => {
  const wf = new WorkflowPage(page);
  await wf.referenceAdd(field).click();
  await expect(wf.referencePicker).toBeVisible({ timeout: 10_000 });
});

Then(
  '값 고르기 창에 앞선 태스크가 모두 있다',
  async ({ page }, table: DataTable) => {
    const wf = new WorkflowPage(page);
    for (const [name] of table.raw()) {
      await expect(
        wf.referenceSource(name.trim()),
        '앞선 태스크는 셀렉터 뒤에 숨기지 않고 모두 한 창에 펼친다',
      ).toBeVisible();
    }
  },
);

When('값 고르기 창에서 {string} 로 찾으면', async ({ page }, term: string) => {
  await new WorkflowPage(page).searchReferenceValue(term);
  await page.waitForTimeout(300);
});

Then(
  '남은 값에는 모두 {string} 가 들어 있다',
  async ({ page }, term: string) => {
    const labels = await new WorkflowPage(page).visibleReferenceValueLabels();
    expect(
      labels.length,
      '찾은 결과가 하나도 없으면 검증이 되지 않는다',
    ).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.toLowerCase()).toContain(term.toLowerCase());
    }
  },
);

When(
  '{string} 의 {string} 값을 고르면',
  async ({ page }, taskName: string, path: string) => {
    await new WorkflowPage(page).chooseReferenceValue(taskName, path);
  },
);

Then('저장될 값이 {string} 로 보인다', async ({ page }, expected: string) => {
  expect(await new WorkflowPage(page).referencePreview()).toBe(expected);
});

Then('형식 대조 결과가 표시된다', async ({ page }) => {
  const verdict = await new WorkflowPage(page).referenceTypeCheck();
  expect(verdict, '고른 값의 형식과 넣을 칸의 형식이 함께 보여야 한다').toMatch(
    /fits|does not fit|cannot tell/,
  );
});

Then(
  '{string} 자리에 결과 정보가 없다는 안내가 보인다',
  async ({ page }, taskName: string) => {
    await expect(
      new WorkflowPage(page).referenceNoSchema(taskName),
    ).toBeVisible();
  },
);

Then('경로를 직접 적을 수 있다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.enterReferenceByHand('first_step', '$.result');
  expect(await wf.referencePreview()).toBe('${first_step.$.result}');
});

// ── A field filled from another task ─────────────────────────────────────────

async function fillFieldFromTask(
  page: import('@playwright/test').Page,
  field: string,
  taskName: string,
  path: string,
): Promise<void> {
  const wf = new WorkflowPage(page);
  await wf.referenceAdd(field).click();
  await expect(wf.referencePicker).toBeVisible({ timeout: 10_000 });
  await wf.chooseReferenceValue(taskName, path);
  await wf.applyReference();
}

Given(
  '{string} 칸을 {string} 의 {string} 로 채운다',
  async ({ page }, field: string, taskName: string, path: string) => {
    await fillFieldFromTask(page, field, taskName, path);
  },
);

When(
  '{string} 칸을 {string} 의 {string} 로 채우면',
  async ({ page }, field: string, taskName: string, path: string) => {
    await fillFieldFromTask(page, field, taskName, path);
  },
);

Then('{string} 칸이 참조 값으로 표시된다', async ({ page }, field: string) => {
  await expect(new WorkflowPage(page).referenceValue(field)).toBeVisible();
});

Then('{string} 칸은 직접 타이핑할 수 없다', async ({ page }, field: string) => {
  const wf = new WorkflowPage(page);
  // A reference is ordinary text underneath. One stray keystroke would break it with nothing on
  // screen to say so, which is why the box is gone and only ✎ / ✕ remain.
  await expect(wf.referenceValue(field).locator('input, textarea')).toHaveCount(
    0,
  );
});

When('{string} 칸의 참조를 끊으면', async ({ page }, field: string) => {
  await new WorkflowPage(page).referenceClear(field).click();
});

Then(
  '{string} 칸이 입력할 수 있는 상태로 돌아온다',
  async ({ page }, field: string) => {
    const wf = new WorkflowPage(page);
    await expect(wf.referenceValue(field)).toBeHidden();
    await expect(wf.bodyParamInput(field)).toBeVisible();
  },
);

Then('{string} 칸은 직접 적은 값 그대로다', async ({ page }, field: string) => {
  // Mixing the two in one body is normal, so a reference on one field must not turn the rest into
  // references too.
  const wf = new WorkflowPage(page);
  await expect(wf.referenceValue(field)).toHaveCount(0);
  await expect(wf.bodyParamInput(field)).not.toHaveValue('');
});

Then('{string} 칸이 비어 있다', async ({ page }, field: string) => {
  await expect(new WorkflowPage(page).bodyParamInput(field)).toHaveValue('');
});

Then(
  '{string} 칸은 {string} 을 가리킨다',
  async ({ page }, field: string, taskName: string) => {
    await expect(new WorkflowPage(page).referenceValue(field)).toContainText(
      taskName,
    );
  },
);

// ── Surviving a save ─────────────────────────────────────────────────────────

When(
  '워크플로우를 저장하고 다시 열어 {string} 태스크를 편집하면',
  async ({ page }, taskName: string) => {
    const wf = new WorkflowPage(page);
    const name = scenarioState.taskReferenceWorkflowName!;
    await wf.saveWorkflow();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await wf.selectTaskInDesigner('', taskName);
  },
);

Then(
  '{string} 칸에 참조 문법이 글자로 노출되지 않는다',
  async ({ page }, field: string) => {
    const wf = new WorkflowPage(page);
    // Restoring on load is the part that is easy to get wrong: the value comes back as text, and if it
    // is not recognised again the user sees `${task.$.path}` sitting in a box, editable and breakable.
    await expect(wf.bodyParamInput(field)).toHaveCount(0);
  },
);

// ── The whole body from one task ─────────────────────────────────────────────

When(
  '본문 전체를 {string} 결과로 넘기면',
  async ({ page }, taskName: string) => {
    const wf = new WorkflowPage(page);
    await wf.bodySourceWhole.click();
    await expect(wf.referencePicker).toBeVisible({ timeout: 10_000 });
    await wf.chooseReferenceValue(taskName, '$');
    await wf.applyReference();
  },
);

Then('칸 목록 대신 넘어가는 값 목록이 보인다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await expect(wf.wholeBodyReference).toBeVisible();
  expect(
    await wf.wholeBodyRows.count(),
    '본문을 통째로 넘길 때는 무엇이 넘어가는지 보여야 한다',
  ).toBeGreaterThan(0);
});

Then('넘어가는 값에 형식이 함께 표시된다', async ({ page }) => {
  const first = new WorkflowPage(page).wholeBodyRows.first();
  await expect(first.locator('.ref-whole-type')).not.toBeEmpty();
});

// ── A reference that will not work ───────────────────────────────────────────

Given(
  '앞서 실행되지 않는 태스크를 가리키는 워크플로우를 만들어 둔다',
  async ({ page }) => {
    // The editor cannot make one of these, so the API does — the same way an import or another tool
    // would. Then the load-time check has something real to catch.
    const name = uniqueName('ref-broken');
    scenarioState.taskReferenceWorkflowName = name;
    const token = await getSessionToken(page);
    const id = await seedWorkflowWithBrokenReference({
      request: page.request,
      token,
      name,
    });
    scenarioState.taskReferenceSeededWorkflowId = id;
  },
);

When('그 워크플로우를 에디터에서 열면', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await page.reload();
  await wf.gotoWorkflows();
  await wf.selectWorkflow(scenarioState.taskReferenceWorkflowName!);
  await wf.openEditorFromDetail();
});

Then('잘못된 참조 안내 창이 뜬다', async ({ page }) => {
  await expect(
    new WorkflowPage(page).brokenReferenceNotice,
    '실행하면 죽을 워크플로우라는 것을 열 때 알려야 한다',
  ).toBeVisible({ timeout: 20_000 });
});

Then('문제가 된 태스크와 칸이 안내 창에 나온다', async ({ page }) => {
  await expect(
    new WorkflowPage(page).brokenReferenceRow('reads_a_later_task', 'infra_id'),
  ).toBeVisible();
});

Then('그 칸이 문제 있는 칸으로 표시된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.dismissBrokenReferenceNotice();
  await wf.selectTaskInDesigner('', 'reads_a_later_task');
  await expect(wf.invalidReferenceField('infra_id')).toBeVisible();
  await expect(wf.invalidReferenceSummary).toBeVisible();
});

// ── 저장했다 다시 열기 ───────────────────────────────────────────────────────

When('워크플로우를 저장하고 다시 열면', async ({ page }) => {
  const wf = new WorkflowPage(page);
  const name = scenarioState.taskReferenceWorkflowName!;

  await page.getByTestId('workflow-designer-save').click();
  await page.waitForTimeout(4_000);

  // 저장 뒤에도 편집기가 남아 있을 수 있다. 목록으로 확실히 나갔다가 다시 들어간다 —
  // 여기서 보려는 것은 *다시 읽을 때* 본문이 어떻게 복원되는가다.
  await wf.gotoWorkflows();
  await page.reload();
  await wf.selectWorkflow(name);
  await wf.openEditorFromDetail();
  await expect(page.locator('.sqd-step-task').first()).toBeVisible({
    timeout: 20_000,
  });
});

Then(
  '{string} 태스크의 칸이 그대로 있다',
  async ({ page }, taskName: string) => {
    const wf = new WorkflowPage(page);
    await wf.selectTaskInDesigner('', taskName);
    await expect(
      page.getByTestId('wf-task-editor'),
      '태스크 편집 화면이 열리지 않았다',
    ).toBeVisible({ timeout: 15_000 });

    // 칸이 살아 있어야 한다. 본문을 "전체가 참조" 로 오판하면 칸이 하나도 그려지지 않고
    // 결과 전체 모드로 열린다 — 저장된 값은 그대로인데 화면에서 사라진 상태다.
    await expect(
      page.getByTestId('wf-body-source-fields'),
      '칸마다 채우기가 아니라 결과 전체 모드로 열렸다 — 본문을 참조로 오판했다',
    ).toBeChecked();
    const fields = await page
      .locator('[data-testid^="wf-field-body_params."]')
      .count();
    const references = await page
      .locator('[data-testid^="wf-field-ref-body_params."]')
      .count();
    expect(fields + references, '칸이 하나도 남지 않았다').toBeGreaterThan(0);
  },
);

Given(
  '{string} 태스크가 차례로 이어지고 마지막이 {string} 인 워크플로우를 에디터에서 연다',
  async ({ page }, taskNames: string, lastComponent: string) => {
    // 마지막 태스크만 컴포넌트를 지정한다. 기본으로 쓰는 스크립트 태스크는 본문이 전부
    // 문자열 칸이라, 따옴표를 벗겨야 하는 칸이 하나도 없다 — 그 본문으로는 이 시나리오가
    // 고치기 전 코드에서도 통과해 버린다.
    const wf = new WorkflowPage(page);
    const names = taskNames.split(',').map(part => part.trim());
    const name = uniqueName('ref-typed');
    scenarioState.taskReferenceWorkflowName = name;

    scenarioState.taskReferenceSeededWorkflowId = await seedChainOfTasks({
      request: page.request,
      token: await getSessionToken(page),
      name,
      taskNames: names,
      components: names.map((_one, index) =>
        index === names.length - 1 ? lastComponent : undefined,
      ),
    });

    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
    // 캔버스가 자리를 잡을 때까지 기다린다. 본문이 큰 컴포넌트는 스키마를 받아 오면서 노드
    // 크기가 한 번 더 바뀌어, 곧바로 누르면 "element is not stable" 로 걸린다.
    await page.waitForTimeout(2_500);
  },
);

/** 저장된 본문을 서버에서 그대로 읽는다 — 화면이 아니라 저장물을 봐야 하는 단언이다. */
async function storedBodies(page: import('@playwright/test').Page) {
  const response = await page.request.post(
    `${config.baseURL}/api/cm-cicada/get-workflow`,
    {
      headers: { Authorization: `Bearer ${await getSessionToken(page)}` },
      data: {
        pathParams: { wfId: scenarioState.taskReferenceSeededWorkflowId },
      },
    },
  );
  expect(response.ok(), '저장된 워크플로우를 읽지 못했다').toBeTruthy();
  const document = await response.json();
  const groups =
    document?.responseData?.data?.task_groups ??
    document?.data?.task_groups ??
    [];
  return groups.flatMap((group: any) =>
    (group.tasks ?? []).map((task: any) =>
      String(task.spec?.request_body ?? ''),
    ),
  );
}

Then(
  '저장된 본문에서 {string} 는 따옴표 안의 참조다',
  async ({ page }, field: string) => {
    const bodies = await storedBodies(page);
    const key = field.split(/[.[]/).pop()!.replace(/\]$/, '');
    const quoted = bodies.some((body: string) =>
      new RegExp(`"${key}"\\s*:\\s*"\\$\\{`).test(body),
    );
    expect(
      quoted,
      `문자열 칸이라 따옴표 안에 있어야 한다\n${bodies.join('\n').slice(0, 400)}`,
    ).toBeTruthy();
  },
);

Then(
  '저장된 본문에서 {string} 는 따옴표 없는 참조다',
  async ({ page }, field: string) => {
    // ★ 여기가 이 변경의 핵심이다. 따옴표에 갇히면 엔진이 그 값을 문자열로 만들어 보낸다 —
    //   숫자를 요구하는 API 에 "5" 가 나간다. 화면으로는 보이지 않는 어긋남이다.
    const bodies = await storedBodies(page);
    const key = field.split(/[.[]/).pop()!.replace(/\]$/, '');
    const bare = bodies.some((body: string) =>
      new RegExp(`"${key}"\\s*:\\s*\\$\\{`).test(body),
    );
    expect(
      bare,
      `숫자 칸이라 따옴표 없이 저장돼야 한다\n${bodies.join('\n').slice(0, 400)}`,
    ).toBeTruthy();
  },
);

// ── 배열·객체 통째로 ─────────────────────────────────────────────────────────

Then(
  '{string} 의 항목 목록이 보이지 않는다',
  async ({ page }, field: string) => {
    // 참조가 걸리면 목록 대신 참조 하나가 자리를 차지한다. 둘 다 보이면 사용자는 어느
    // 쪽이 실제로 나가는지 알 수 없다.
    await expect(
      page.getByTestId(`wf-array-toggle-body_params.${field}`),
      '참조가 걸렸는데 배열을 펼치는 버튼이 남아 있다',
    ).toHaveCount(0);
    await expect(
      page.getByTestId(`wf-array-add-body_params.${field}`),
      '참조가 걸렸는데 항목을 더하는 버튼이 남아 있다',
    ).toHaveCount(0);
  },
);

Then('{string} 의 하위 칸이 보이지 않는다', async ({ page }, field: string) => {
  await expect(
    page.getByTestId(`wf-object-toggle-body_params.${field}`),
    '참조가 걸렸는데 객체를 펼치는 버튼이 남아 있다',
  ).toHaveCount(0);
  await expect(
    page.locator(`[data-testid^="wf-field-body_params.${field}."]`),
    '참조가 걸렸는데 하위 칸이 남아 있다',
  ).toHaveCount(0);
});

Given(
  '{string} 태스크가 차례로 이어지고 처음이 {string} 마지막이 {string} 인 워크플로우를 에디터에서 연다',
  async (
    { page },
    taskNames: string,
    firstComponent: string,
    lastComponent: string,
  ) => {
    // 앞선 태스크가 무엇을 돌려주느냐가 고를 수 있는 값을 정한다. 배열·객체를 고르려면
    // 그런 것을 돌려주는 태스크가 앞에 있어야 한다.
    const wf = new WorkflowPage(page);
    const names = taskNames.split(',').map(part => part.trim());
    const name = uniqueName('ref-shapes');
    scenarioState.taskReferenceWorkflowName = name;

    scenarioState.taskReferenceSeededWorkflowId = await seedChainOfTasks({
      request: page.request,
      token: await getSessionToken(page),
      name,
      taskNames: names,
      components: names.map((_one, index) => {
        if (index === 0) return firstComponent;
        if (index === names.length - 1) return lastComponent;
        return undefined;
      }),
    });

    await page.reload();
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(2_500);
  },
);

When(
  '{string} 칸의 값 고르기 창을 열고 {string} 의 {string} 를 고르면',
  async ({ page }, field: string, taskName: string, path: string) => {
    const wf = new WorkflowPage(page);
    await wf.referenceAdd(field).click();
    await expect(wf.referencePicker).toBeVisible({ timeout: 10_000 });
    await wf.chooseReferenceValue(taskName, path);
  },
);

Then('맞지 않는 타입이라는 안내가 보인다', async ({ page }) => {
  await expect(page.getByTestId('wf-ref-type-blocked')).toBeVisible();
});

Then('그 값을 적용할 수 없다', async ({ page }) => {
  // 경고만 하고 통과시키면 저장은 되고 실행할 때 죽는다.
  await expect(page.getByTestId('wf-ref-apply')).toBeDisabled();
});
