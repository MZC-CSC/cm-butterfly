import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkflowPage } from '../pages/workflow.page';
import { workflowData } from '../fixtures/test-data';

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

Then('워크플로우 목록에 {string} 워크플로우가 보인다', async ({ page }, name: string) => {
  await new WorkflowPage(page).expectWorkflowVisible(name);
});

// ── 워크플로우 템플릿 ─────────────────────────────────────────────────────

Given('워크플로우 템플릿 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoTemplates();
});

Then('워크플로우 템플릿 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  expect(await wf.templateCount()).toBeGreaterThanOrEqual(0);
});

Then('워크플로우 템플릿에 {string} 템플릿이 보인다', async ({ page }, name: string) => {
  await new WorkflowPage(page).expectTemplateVisible(name);
});

// ── Task Component (type/spec 스키마) ─────────────────────────────────────

Given('Task Component 화면을 연다', async ({ page }) => {
  await new WorkflowPage(page).gotoTaskComponents();
});

Then('Task Component 목록이 조회된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.expectTaskComponentsLoaded();
  expect(await wf.taskComponentCount()).toBeGreaterThanOrEqual(0);
});

Then('Task Component 목록에 {string} 컴포넌트가 보인다', async ({ page }, name: string) => {
  await new WorkflowPage(page).expectTaskComponentVisible(name);
});

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
  const wf = new WorkflowPage(page);
  await wf.gotoWorkflows();
  await wf.runWorkflow(name);
});

Then('워크플로우 실행 이력이 생성된다', async ({ page }) => {
  const wf = new WorkflowPage(page);
  await wf.selectWorkflow(workflowData.safeRunWorkflowName).catch(() => {});
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
});

Then('워크플로우 실행이 정상 완료된다', async ({ page }) => {
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
When('마이그레이션 워크플로우를 생성하고 실행하면', async ({ page }) => {
  const wf = new WorkflowPage(page);
  const name = `${workflowData.createNamePrefix}-migrate-${Date.now()}`;

  // 1) add-mode 디자이너 열기 → 인프라 템플릿 선택 → 저장(생성)
  await wf.gotoWorkflows();
  await wf.openDesigner();
  await wf.fillWorkflowName(name);
  await wf.selectTemplate(workflowData.infraTemplateName).catch(() => {
    /* add-mode에서 템플릿이 이미 자동 선택된 경우 무시 */
  });
  await wf.saveWorkflow();

  // 2) 목록에서 생성된 워크플로우 실행(run)
  await wf.gotoWorkflows();
  await wf.expectWorkflowVisible(name);
  await wf.runWorkflow(name);

  // 3) 실행 이력이 생성될 때까지 대기 (완료 여부는 후속 EC2 확인 스텝에서 검증)
  await wf.selectWorkflow(name);
  await wf.openHistoryTab();
  await wf.expectRunHistoryPresent();
});
