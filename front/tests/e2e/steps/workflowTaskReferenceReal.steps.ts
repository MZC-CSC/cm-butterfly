import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkflowPage } from '../pages/workflow.page';
import { ModelsPage } from '../pages/models.page';
import { workflowData } from '../fixtures/test-data';
import { scenarioState } from '../support/world';

const { Given, When, Then } = createBdd(test);

/**
 * 값 참조를 *사용자가 실제로 워크플로우를 만드는 경로*에서 확인한다.
 *
 * 기능 하나하나는 @unit 이 덮는다. 여기서 보는 것은 그 화면이 어떤 상태로 열리는가이고,
 * 그 상태는 어디서 들어왔는지에 따라 갈린다 — 타깃 모델에서 오면 마법사가 값을 넣어 주고,
 * 팔레트에서 끌어다 놓으면 아무것도 없이 놓인다.
 *
 * API 로 만든 워크플로우로는 이 갈림을 지나갈 수 없다. 실제로 결함이 여기서 나왔다.
 */

/** 마이그레이션 태스크의 이름. 타깃 모델에서 만들면 마법사가 이 태스크에 값을 넣는다. */
const MIGRATION_TASK = workflowData.infraMigrationTask;

Given('인프라 타깃 모델을 하나 준비한다', async ({ page }) => {
  // 있는 것을 쓴다 — 추천은 시간도 비용도 드는 일이라 매번 새로 만들지 않는다.
  //
  // ★ 인프라 모델이어야 한다. 목록에는 소프트웨어 타깃 모델도 함께 있고, 그것으로 열면
  //   전혀 다른 워크플로우(migrate_software_workflow)가 나온다. 목록에 종류를 가릴 표시가
  //   없어, *열어서 인프라 마이그레이션 태스크가 있는지*로 판정한다 — 화면이 실제로
  //   보여 주는 것이 그것이다.
  const models = new ModelsPage(page);
  const wf = new WorkflowPage(page);

  await models.gotoTargetModels();
  await page.waitForTimeout(1500);
  const names = await page
    .locator('tbody tr')
    .evaluateAll(rows =>
      rows
        .map(row => row.querySelectorAll('td')[1]?.textContent?.trim() ?? '')
        .filter(Boolean),
    );
  expect(
    names.length,
    '타깃 모델이 하나도 없다 — 추천을 받아 만드는 시나리오(마이그레이션 전체 흐름)를 먼저 돌린다',
  ).toBeGreaterThan(0);

  // 이름으로 종류를 단정하지는 않지만, 열어 보는 순서는 정할 수 있다. 인프라처럼 보이는
  // 것을 먼저 열면 대개 한 번에 끝난다 — 판정 자체는 아래에서 화면을 보고 한다.
  const looksInfra = (n: string) => /infra/i.test(n) && !/^sw[-_]/i.test(n);
  const ordered = [
    ...names.filter(looksInfra),
    ...names.filter(n => !looksInfra(n)),
  ];

  for (const name of ordered) {
    await models.openWorkflowEditorFromTarget(name);
    await wf.expectDesignerOpen();
    await page.waitForTimeout(1000);
    // ★ 노드에 적힌 글자는 *태스크 이름*(infra_migration)이고, MIGRATION_TASK 는
    //   *컴포넌트 이름*(beetle_task_infra_migration)이다. 둘은 다르다 — 글자로 찾으면
    //   인프라 모델까지 "아니다" 로 판정된다. 컴포넌트는 클래스로 붙으므로 그것을 본다.
    const isInfra = await page
      .locator(`.sqd-step-task.sqd-type-${MIGRATION_TASK}`)
      .count();
    if (isInfra) {
      scenarioState.taskReferenceTargetModel = name;
      console.log(`[값참조] 인프라 타깃 모델: ${name}`);
      return;
    }
    console.log(`[값참조] ${name} 은 인프라 모델이 아니다 — 다음 것을 본다`);
    // ★ 편집기를 닫고 나와야 다음 모델을 볼 수 있다. 열어 둔 채 목록으로 가려 하면
    //   화면이 그대로 남아 목록의 행을 누를 수 없고, 그 자리에서 시간만 채우다 죽는다.
    await closeEditor(page);
  }

  throw new Error(
    `인프라 타깃 모델이 없다 (본 것: ${ordered.join(', ')}) — 인프라 추천을 먼저 돌린다`,
  );
});

/** 편집기를 닫고 나온다. 저장하지 않으므로 만들던 것은 버려진다. */
async function closeEditor(page: import('@playwright/test').Page) {
  const cancel = page.getByRole('button', { name: /^Cancel$/ }).last();
  if (await cancel.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cancel.click();
  } else {
    await page.goBack();
  }
  await page.waitForTimeout(1200);
}

async function openFromTarget(page: import('@playwright/test').Page) {
  const models = new ModelsPage(page);
  const wf = new WorkflowPage(page);
  const name = scenarioState.taskReferenceTargetModel!;
  await models.openWorkflowEditorFromTarget(name);
  await wf.expectDesignerOpen();
  await page.waitForTimeout(1200);
}

Given('그 타깃 모델에서 워크플로우 편집기를 연다', async ({ page }) => {
  await openFromTarget(page);
});

When('그 타깃 모델에서 워크플로우 편집기를 열면', async ({ page }) => {
  await openFromTarget(page);
});

Then(
  '마이그레이션 태스크가 "칸마다 채우기" 상태로 열린다',
  async ({ page }) => {
    const wf = new WorkflowPage(page);
    await wf.selectTaskInDesigner(MIGRATION_TASK);
    // 마법사가 값을 넣었으면 칸을 채우는 상태여야 한다. 참조 모드로 열리면 그 값이
    // 화면에서 사라지고, 저장하면 참조가 그것을 덮어쓴다.
    await expect(
      page.getByTestId('wf-body-source-fields'),
      '타깃 모델에서 왔으면 칸마다 채우기여야 한다',
    ).toBeChecked();
    await expect(page.getByTestId('wf-ref-whole')).toHaveCount(0);
  },
);

Then(
  '마이그레이션 태스크의 칸에 타깃 모델 값이 채워져 있다',
  async ({ page }) => {
    // 어느 칸에 무엇이 들어가는지는 추천 결과에 따라 달라진다. 그래서 특정 칸을 집지 않고
    // *값이 든 칸이 하나라도 있는가*로 본다 — 마법사가 넣은 것이 보이는지가 핵심이다.
    const filled = await page
      .locator('[data-testid^="wf-field-body_params."]')
      .evaluateAll(
        els =>
          els.filter(el => ((el as HTMLInputElement).value ?? '').trim() !== '')
            .length,
      );
    expect(
      filled,
      '타깃 모델에서 넘어온 값이 칸에 보여야 한다',
    ).toBeGreaterThan(0);
    console.log(`[값참조] 값이 채워진 칸: ${filled}개`);
  },
);

When('마이그레이션 태스크에서 값 고르기를 열면', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.selectTaskInDesigner(MIGRATION_TASK);
  await wf.pickOnCanvas.click();
  await expect(wf.pickableTasks.first()).toBeVisible({ timeout: 15_000 });
  await wf.pickableTasks.first().click();
  await expect(wf.referencePicker).toBeVisible({ timeout: 15_000 });
});

Then('앞선 태스크의 값이 목록에 있다', async ({ page }) => {
  const count = await page.locator('[data-testid^="wf-ref-node-"]').count();
  expect(count, '앞선 태스크가 무엇을 돌려주는지 보여야 한다').toBeGreaterThan(
    0,
  );
});

// ── 팔레트에서 끌어다 놓기 ───────────────────────────────────────────────────

When(
  '팔레트에서 {string} 를 캔버스에 끌어다 놓으면',
  async ({ page }, component: string) => {
    const wf = new WorkflowPage(page);
    const before = await page.locator('.sqd-step-task').count();
    await wf.dragFromPalette(component);
    await expect(
      page.locator('.sqd-step-task'),
      '끌어다 놓았는데 태스크가 늘지 않았다',
    ).toHaveCount(before + 1, { timeout: 15_000 });
    scenarioState.taskReferenceDroppedComponent = component;
  },
);

When('방금 놓은 태스크를 선택하면', async ({ page }) => {
  // 놓인 것은 마지막에 붙는다. 이름은 라이브러리가 붙이므로 위치로 잡는다.
  await page.locator('.sqd-step-task').last().click();
  await expect(page.getByTestId('wf-task-editor')).toBeVisible({
    timeout: 15_000,
  });
});

Then('캔버스에 고를 수 있는 태스크가 있다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  const names = await wf.pickableTaskNames();
  expect(
    names.length,
    '끌어다 놓은 태스크 앞에 있는 것들이 후보로 잡혀야 한다',
  ).toBeGreaterThan(0);
  console.log(`[값참조] 고를 수 있는 태스크: ${names.join(', ')}`);
});
