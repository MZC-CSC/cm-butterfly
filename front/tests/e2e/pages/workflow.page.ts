import { Page, expect, Locator } from '@playwright/test';
import { workflowData } from '../fixtures/test-data';

/**
 * WorkflowPage — 워크플로우 관리(cm-cicada) 도메인의 "어디서/어떻게" 계층.
 *
 * ★ 화면 위치(URL)와 요소(셀렉터)를 여기 한 곳에 모은다.
 *   시나리오(.feature)·스텝은 "의도"만 담고, 화면 변경의 충격은 이 파일에 격리한다.
 *
 * 대상 화면 (3개):
 *   - 워크플로우 목록/상세/실행/이력      /main/workflow-management/workflows
 *   - 워크플로우 템플릿 목록              /main/workflow-management/workflow-templates
 *   - Task Component 목록/상세           /main/workflow-management/task-components
 *
 * cm-cicada type/spec 전환: TaskComponent는 { type, spec } 스키마이며 5개 type
 * (http · http_xcom · bash · ssh · trigger_workflow)을 가진다. 워크플로우 생성은
 * SequentialDesigner(디자이너/에디터)에서 template + type/spec task로 구성한다.
 *
 * ⚠️ data-testid 미부여 구간: 현재 워크플로우 도메인 .vue에는 data-testid가 없다.
 *   README 규칙(BAR-880)대로 getByTestId(...)를 우선 두고 role/text fallback을 붙였다.
 *   프론트에 아래 testid를 부여하면 fallback을 제거한다.
 */
export class WorkflowPage {
  /** ★ 화면 위치(URL) */
  static readonly workflowsPath = '/main/workflow-management/workflows';
  static readonly templatesPath = '/main/workflow-management/workflow-templates';
  static readonly taskComponentsPath = '/main/workflow-management/task-components';

  constructor(private readonly page: Page) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 공통 요소
  // ─────────────────────────────────────────────────────────────────────────

  /** 목록 테이블(p-toolbox-table / p-data-table 이 렌더하는 table) */
  private get table(): Locator {
    return this.page
      .getByTestId('workflow-list-table');
  }

  /** 테이블 데이터 행 (헤더 제외) */
  private get rows(): Locator {
    return this.table.locator('tbody tr');
  }

  private rowByText(text: string): Locator {
    return this.rows.filter({ hasText: text }).first();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1) 워크플로우 목록
  // ─────────────────────────────────────────────────────────────────────────

  async gotoWorkflows(): Promise<void> {
    await this.page.goto(WorkflowPage.workflowsPath);
    await this.expectWorkflowsLoaded();
  }

  /** 목록 화면 로드 확인 — 헤더 "Workflows" + 테이블 노출 */
  async expectWorkflowsLoaded(): Promise<void> {
    await expect(this.page.getByTestId('workflow-page-header')).toBeVisible({ timeout: 15_000 });
    // 로딩 스피너가 끝나고 테이블이 나타날 때까지 대기
    await expect(this.table).toBeVisible({ timeout: 15_000 });
  }

  /** 조회된 워크플로우 개수(행 수) */
  async workflowCount(): Promise<number> {
    return this.rows.count();
  }

  async expectWorkflowVisible(name: string): Promise<void> {
    await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
  }

  /** 행 선택 → 상세(Details/History 탭) 노출 */
  async selectWorkflow(name: string): Promise<void> {
    await this.rowByText(name).click();
    await expect(
      this.page.getByText('Workflow Information', { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2) 워크플로우 생성 — 디자이너/에디터 (SequentialDesigner)
  // ─────────────────────────────────────────────────────────────────────────

  /** 디자이너/에디터 모달의 루트 컨테이너 */
  private get designer(): Locator {
    return this.page
      .getByTestId('workflow-designer');
  }

  private get designerNameInput(): Locator {
    return this.page
      .locator('input[data-testid="workflow-name-input"], textarea[data-testid="workflow-name-input"]')
      // 에디터 헤더의 첫 텍스트 인풋(Workflow Name)
      .or(this.page.locator('.workflow-tool-header input').first());
  }

  private get designerTemplateDropdown(): Locator {
    return this.page
      .getByTestId('workflow-template-select');
  }

  private get designerSaveButton(): Locator {
    return this.page
      .getByTestId('workflow-designer-save');
  }

  /**
   * 워크플로우 디자이너(에디터) 열기.
   * 현재 UI에서 생성 진입점은 상세의 "Workflow Tool" 모달 또는 마이그레이션 add-mode다.
   * (목록 툴박스의 Add 버튼은 아직 disabled) → data-testid `workflow-create` 부여 권장.
   */
  async openDesigner(): Promise<void> {
    const createBtn = this.page
      .getByTestId('workflow-create');
    await createBtn.first().click();
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  async expectDesignerOpen(): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  /** 이름 입력 + 템플릿 선택 후 저장 */
  async fillWorkflowName(name: string): Promise<void> {
    await this.designerNameInput.fill(name);
  }

  async selectTemplate(templateName: string): Promise<void> {
    await this.designerTemplateDropdown.click();
    await this.page
      .getByRole('option', { name: templateName })
      .or(this.page.getByText(templateName, { exact: false }).last())
      .click();
  }

  async saveWorkflow(): Promise<void> {
    await this.designerSaveButton.click();
    // 저장 성공 토스트(Success) 또는 모달 닫힘으로 확인
    await expect(this.designer).toBeHidden({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3) 워크플로우 실행(run) + 상태 폴링 (History)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 목록에서 워크플로우 실행. name 주면 해당 행의 Run, 없으면 첫 행 Run.
   * (WorkflowList의 col-run-format 슬롯 = style-type=tertiary "Run" 버튼)
   */
  async runWorkflow(name?: string): Promise<void> {
    const runBtn = name
      ? this.rowByText(name).getByRole('button', { name: /^Run$/ })
      : this.page
          .getByTestId('workflow-run-btn');
    await runBtn.click();
  }

  /** Details/History 탭 전환 — mirinae PTab는 ARIA role(tab)로 단일 선택(text fallback은 span과 중복 매칭) */
  async openHistoryTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /History/i }).click();
    await expect(
      this.page.getByText('Workflow History', { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** History 탭에 최소 1건의 실행 이력이 나타날 때까지 대기 */
  async expectRunHistoryPresent(): Promise<void> {
    // 이력 테이블(p-data-table)의 State 헤더 + 최소 1행
    await expect(this.rows.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * 최신 실행의 상태를 종료 상태(success/failed)까지 폴링해 반환.
   * cm-cicada는 Airflow DAG run을 트리거하므로 상태가 queued→running→success 로 전이한다.
   * get-workflow-runs 응답의 state(=IWorkflowRun.state)가 History 테이블 State 열에 표시된다.
   */
  async pollLatestRunState(
    timeoutMs = workflowData.runPollTimeoutMs,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const terminal = new RegExp(
      `^(${workflowData.terminalStates.join('|')})$`,
      'i',
    );
    let state = '';
    while (Date.now() < deadline) {
      state = (await this.latestRunStateText()).trim().toLowerCase();
      if (terminal.test(state)) return state;
      await this.page.waitForTimeout(3_000);
      await this.page.reload();
      await this.openHistoryTab().catch(() => {});
    }
    return state;
  }

  /** 최신(첫) 실행 행의 State 셀 텍스트 */
  private async latestRunStateText(): Promise<string> {
    const stateCell = this.page
      .getByTestId('workflow-run-state');
    if ((await stateCell.count()) === 0) return '';
    return (await stateCell.first().textContent()) ?? '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4) JSON 뷰어 (Custom & View Workflow)
  // ─────────────────────────────────────────────────────────────────────────

  private get jsonViewer(): Locator {
    return this.page
      .getByTestId('workflow-json-viewer');
  }

  async expectJsonViewerVisible(): Promise<void> {
    await expect(this.jsonViewer).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5) 워크플로우 템플릿 목록
  // ─────────────────────────────────────────────────────────────────────────

  async gotoTemplates(): Promise<void> {
    await this.page.goto(WorkflowPage.templatesPath);
    await expect(this.table).toBeVisible({ timeout: 15_000 });
  }

  async templateCount(): Promise<number> {
    return this.rows.count();
  }

  async expectTemplateVisible(name: string): Promise<void> {
    await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6) Task Component 목록 (type/spec 스키마)
  // ─────────────────────────────────────────────────────────────────────────

  async gotoTaskComponents(): Promise<void> {
    await this.page.goto(WorkflowPage.taskComponentsPath);
    await this.expectTaskComponentsLoaded();
  }

  async expectTaskComponentsLoaded(): Promise<void> {
    await expect(this.page.getByTestId('taskcomponent-page-header')).toBeVisible({ timeout: 15_000 });
    await expect(this.table).toBeVisible({ timeout: 15_000 });
  }

  async taskComponentCount(): Promise<number> {
    return this.rows.count();
  }

  async expectTaskComponentVisible(name: string): Promise<void> {
    await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
  }
}
