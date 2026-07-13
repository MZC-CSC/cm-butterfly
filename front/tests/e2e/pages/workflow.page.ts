import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';
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
 *   BAR-880(셀렉터 안정화) — 워크플로우 도메인의 핵심 지점에 data-testid를 부여했다:
 *     workflow-list-table · taskcomponent-list-table · workflow-template-list-table ·
 *     workflow-json-view(상세의 JSON 열기) · workflow-json-viewer(뷰어 본문).
 *   화면 문구나 DOM 구조가 바뀌어도 이 testid로 정확히 찾아간다. 아직 testid가 없는 구간만
 *   role/text fallback을 남겨 두고, 부여되는 대로 fallback을 걷어낸다.
 */
export class WorkflowPage {
  /** ★ 화면 위치(URL) */
  static readonly workflowsPath = '/main/workflow-management/workflows';
  static readonly templatesPath =
    '/main/workflow-management/workflow-templates';
  static readonly taskComponentsPath =
    '/main/workflow-management/task-components';

  constructor(private readonly page: Page) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 공통 요소
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 목록 테이블 — 화면마다 *고유한* testid를 쓴다.
   * 같은 testid를 여러 화면이 공유하면 어느 테이블을 가리키는지 모호해지고,
   * 화면이 바뀔 때 엉뚱한 곳을 잡는다. (BAR-880 — 셀렉터 안정화)
   */
  // 화면마다 테이블 testid 가 다르다. 스텝마다 Page Object 를 새로 만들기 때문에
  // "현재 화면"을 인스턴스 상태로 들고 있으면 안 된다 — 각 메서드가 자기 테이블을 직접 가리킨다.
  private table(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  private get workflowTable(): Locator {
    return this.table('workflow-list-table');
  }

  private get templateTable(): Locator {
    return this.table('workflow-template-list-table');
  }

  private get taskComponentTable(): Locator {
    return this.table('taskcomponent-list-table');
  }

  /** 테이블 데이터 행 (헤더 제외) */
  private rowsOf(table: Locator): Locator {
    return table.locator('tbody tr');
  }

  private rowByTextIn(table: Locator, text: string): Locator {
    return this.rowsOf(table).filter({ hasText: text }).first();
  }

  /**
   * 목록에서 워크플로우 행을 실제로 노출시킨다.
   *
   * 워크플로우 목록도 15행씩 끊긴다. 시드가 방금 만든 워크플로우는 1페이지에 없을 수 있어서,
   * Run 버튼을 못 찾고 클릭 타임아웃으로 죽었다. 페이지를 넘겨 가며 찾고 몇 페이지인지도 남긴다.
   */
  private async revealWorkflow(name: string): Promise<number> {
    const pager = new TablePagination(this.page, this.workflowTable);
    return pager.expectRowSomewhere(this.rowByText(name), name);
  }

  /** 기본(워크플로우 목록) 테이블 — 하위 호환 헬퍼 */
  private get rows(): Locator {
    return this.rowsOf(this.workflowTable);
  }

  private rowByText(text: string): Locator {
    return this.rowByTextIn(this.workflowTable, text);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 0) 실행 상태 뷰어 (Run Status 탭)
  //
  //   상태를 *색*으로 확인하지 않는다. 노드가 자기 상태를 data-state로 내보내므로
  //   그것을 그대로 단언한다 — 디자인이 바뀌어도 테스트는 살아 있다.
  //   (규약: cm-butterfly/design/07-DESIGN/DESIGN-E2E-SELECTORS.md)
  // ─────────────────────────────────────────────────────────────────────────

  /** 디버그용 — 목록에서 워크플로우 행을 노출시킨다 */
  async revealWorkflowPublic(name: string): Promise<number> {
    return this.revealWorkflow(name);
  }

  /** 워크플로우를 골라 Run Status 탭을 연다 */
  async openRunViewer(workflowName: string): Promise<void> {
    await this.revealWorkflow(workflowName);
    await this.rowByText(workflowName).click();
    await this.page.getByRole('tab', { name: 'Run Status' }).click();
    await expect(this.page.getByTestId('workflow-run-viewer')).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.page.getByTestId('workflow-run-graph')).toBeVisible({
      timeout: 15_000,
    });
  }

  /** 그래프의 태스크 노드 */
  runNode(taskName: string): Locator {
    return this.page.locator(
      `[data-testid="workflow-run-node"][data-task-name="${taskName}"]`,
    );
  }

  /** 노드의 실행 상태가 기대와 같은가 (색이 아니라 상태 값으로 단언) */
  async expectTaskState(taskName: string, state: string): Promise<void> {
    await expect(this.runNode(taskName)).toHaveAttribute('data-state', state, {
      timeout: 20_000,
    });
  }

  async selectTask(taskName: string): Promise<void> {
    await this.runNode(taskName).click();
    await expect(
      this.page.getByTestId('workflow-run-task-detail'),
    ).toBeVisible();
  }

  /** 선택한 태스크의 로그를 연다 (시도 번호 지정 가능) */
  async openTaskLog(tryNumber?: number): Promise<Locator> {
    const button = tryNumber
      ? this.page.locator(
          `[data-testid="workflow-run-log-try"][data-try="${tryNumber}"]`,
        )
      : this.page.getByTestId('workflow-run-log-try').first();
    await button.click();
    // 전체 로그는 접혀 있다. 펼쳐야 내용이 보인다.
    await this.page.getByText('Full log').click();
    const log = this.page.getByTestId('workflow-run-log');
    await expect(log).toBeVisible({ timeout: 20_000 });
    return log;
  }

  /** 진행 표시 — 실행 중인지, 몇 개 중 몇 개가 끝났는지 */
  get runProgress() {
    return this.page.getByTestId('workflow-run-progress');
  }

  get runProgressCount() {
    return this.page.getByTestId('workflow-run-progress-count');
  }

  /** 지금 보고 있는 실행이 어느 실행인지 */
  get runMeta() {
    return this.page.getByTestId('workflow-run-meta');
  }

  get failureSummary(): Locator {
    return this.page.getByTestId('workflow-run-failure');
  }

  /**
   * 재실행 사전 확인을 연다.
   *
   * 무엇이 다시 도는지는 화면의 그림이 아니라 *엔진이 실제 실행 그래프를 보고* 정한다.
   * 그래서 실행하지 않고 대상 목록을 먼저 받아 확인시키며, 이 메서드는 그 목록을 돌려준다.
   */
  async previewRerun(scope: 'only' | 'after'): Promise<Locator> {
    await this.page
      .locator(`[data-testid="workflow-rerun-scope"][data-scope="${scope}"]`)
      .click();
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeVisible({
      timeout: 20_000,
    });
    return this.page.getByTestId('workflow-rerun-target');
  }

  /**
   * 실행 전체의 실패분 재실행 — 선택한 태스크와 무관하므로 실행 단위 동작들과
   * 같은 자리에 있다(태스크 상세 패널이 아니다).
   */
  async previewRerunFailed(): Promise<Locator> {
    await this.page.getByTestId('workflow-rerun-failed-btn').click();
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeVisible({
      timeout: 20_000,
    });
    return this.page.getByTestId('workflow-rerun-target');
  }

  async confirmRerun(): Promise<void> {
    await this.page.getByTestId('workflow-rerun-ok').click();
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeHidden();
  }

  async cancelRerun(): Promise<void> {
    await this.page.getByTestId('workflow-rerun-cancel').click();
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeHidden();
  }

  /** 새 실행 — 선택된 실행을 다시 도는 것이 아니라 워크플로우를 처음부터 실행한다 */
  async openNewRunConfirm(): Promise<Locator> {
    await this.page.getByTestId('workflow-viewer-run-btn').click();
    const modal = this.page.getByTestId('workflow-run-confirm');
    await expect(modal).toBeVisible();
    return modal;
  }

  /** 복제는 워크플로우를 하나 더 만드는 일이라 확인을 거친다 */
  async openCloneConfirm(): Promise<Locator> {
    await this.page.getByTestId('workflow-clone-edit-btn').click();
    const modal = this.page.getByTestId('workflow-clone-confirm');
    await expect(modal).toBeVisible();
    return modal;
  }

  async cancelClone(): Promise<void> {
    await this.page.getByTestId('workflow-clone-confirm-cancel').click();
    await expect(this.page.getByTestId('workflow-clone-confirm')).toBeHidden();
  }

  async cancelNewRun(): Promise<void> {
    await this.page.getByTestId('workflow-run-confirm-cancel').click();
    await expect(this.page.getByTestId('workflow-run-confirm')).toBeHidden();
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
    await expect(this.page.getByTestId('workflow-page-header')).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.workflowTable).toBeVisible({ timeout: 15_000 });
  }

  /** 조회된 워크플로우 개수(행 수) */
  async workflowCount(): Promise<number> {
    return this.rows.count();
  }

  async expectWorkflowVisible(name: string): Promise<void> {
    await this.revealWorkflow(name);
    await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
  }

  /** 행 선택 → 상세(Details/History 탭) 노출 */
  async selectWorkflow(name: string): Promise<void> {
    await this.revealWorkflow(name);
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
    return this.page.getByTestId('workflow-designer');
  }

  private get designerNameInput(): Locator {
    return (
      this.page
        .locator(
          'input[data-testid="workflow-name-input"], textarea[data-testid="workflow-name-input"]',
        )
        // 에디터 헤더의 첫 텍스트 인풋(Workflow Name)
        .or(this.page.locator('.workflow-tool-header input').first())
    );
  }

  private get designerTemplateDropdown(): Locator {
    return this.page.getByTestId('workflow-template-select');
  }

  private get designerSaveButton(): Locator {
    return this.page.getByTestId('workflow-designer-save');
  }

  /**
   * 워크플로우 디자이너(에디터) 열기.
   * 현재 UI에서 생성 진입점은 상세의 "Workflow Tool" 모달 또는 마이그레이션 add-mode다.
   * (목록 툴박스의 Add 버튼은 아직 disabled) → data-testid `workflow-create` 부여 권장.
   */
  async openDesigner(): Promise<void> {
    const createBtn = this.page.getByTestId('workflow-create');
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
  // 2-1) 워크플로우 툴 — 태스크 파라미터 편집
  //
  // 디자이너에서 태스크를 고르면 오른쪽에 편집 패널이 열리고, 거기서 그 태스크가 호출할 API의
  // path/query 파라미터와 body를 수정할 수 있다. 마이그레이션 태스크라면 *생성될 인프라 이름*,
  // 네임스페이스, CSP·리전 같은 값이 여기 있다.
  //
  // 기본값으로만 돌리면 이 화면이 실제로 동작하는지 알 수 없다. 값을 바꿔 저장하고, 바꾼 대로
  // 만들어지는지까지 봐야 워크플로우 툴을 검증한 것이다.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 디자이너 캔버스에서 태스크를 선택해 편집 패널을 연다.
   *
   * 캔버스는 sequential-workflow-designer 가 SVG 로 그린다. 라이브러리가 만든 요소라 우리가 testid 를
   * 붙일 수 없지만, 스텝마다 `sqd-type-{태스크 컴포넌트 이름}` 클래스를 달아 준다. 그 이름은 화면 문구가
   * 아니라 *우리 데이터*(task_component)라서 화면이 바뀌어도 흔들리지 않는다. 그걸로 지목한다.
   */
  async selectTaskInDesigner(taskComponentName: string): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 20_000 });
    await this.designer
      .locator(`.sqd-step-task.sqd-type-${taskComponentName}`)
      .first()
      .click();
    await expect(this.taskEditor).toBeVisible({ timeout: 15_000 });
  }

  /** 태스크 편집 패널 */
  private get taskEditor(): Locator {
    return this.page.getByTestId('wf-task-editor');
  }

  /** path 파라미터 입력칸 (예: nsId) */
  private pathParam(key: string): Locator {
    return this.page.getByTestId(`wf-path-param-${key}`);
  }

  /** query 파라미터 입력칸 (예: nameSeed) */
  private queryParam(key: string): Locator {
    return this.page.getByTestId(`wf-query-param-${key}`);
  }

  /**
   * body 파라미터 입력칸. 스키마 경로로 지목한다 — 예: `targetInfra.name`, `targetCloud.csp`.
   * (testid 는 `wf-field-body_params.{경로}` 형태로 부여돼 있다.)
   */
  private bodyField(path: string): Locator {
    return this.page.getByTestId(`wf-field-body_params.${path}`);
  }

  /** 편집 패널의 현재 값을 읽는다 — 기본값 시나리오에서 "무엇이 기본값인지" 확인용 */
  async readTaskParam(
    kind: 'path' | 'query' | 'body',
    key: string,
  ): Promise<string> {
    const field =
      kind === 'path'
        ? this.pathParam(key)
        : kind === 'query'
          ? this.queryParam(key)
          : this.bodyField(key);
    await expect(field).toBeVisible({ timeout: 15_000 });
    return field.inputValue();
  }

  /** 편집 패널의 값을 바꾼다 */
  async setTaskParam(
    kind: 'path' | 'query' | 'body',
    key: string,
    value: string,
  ): Promise<void> {
    const field =
      kind === 'path'
        ? this.pathParam(key)
        : kind === 'query'
          ? this.queryParam(key)
          : this.bodyField(key);
    await expect(field).toBeVisible({ timeout: 15_000 });
    await field.fill(value);
    // 입력이 모델에 반영될 시간을 준다(입력 이벤트 → 상위 상태 갱신).
    await this.page.waitForTimeout(500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3) 워크플로우 실행(run) + 상태 폴링 (History)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 목록에서 워크플로우 실행. name 주면 해당 행의 Run, 없으면 첫 행 Run.
   * (WorkflowList의 col-run-format 슬롯 = style-type=tertiary "Run" 버튼)
   */
  async runWorkflow(name?: string): Promise<void> {
    if (!name) {
      await this.page.getByTestId('workflow-run-btn').click();
      return;
    }
    await this.revealWorkflow(name);
    // 행 안의 Run 버튼은 testid로 잡는다(문구가 바뀌어도 안 깨지도록).
    await this.rowByText(name).getByTestId('workflow-run-btn').click();
  }

  /**
   * 요금 안전 워크플로우를 실행하고, 실행 이력이 실제로 잡힐 때까지 재시도한다.
   *
   * cm-cicada는 워크플로우를 만들 때 DAG YAML을 디스크에 쓰고, airflow가 그걸 주기적으로 파싱해 등록한다.
   * 등록 전(대략 1분 안쪽)에 run을 쏘면 "provided dag_id is not exist"로 거부된다 — 방금 만든 워크플로우를
   * 곧바로 실행하는 흐름이라 정확히 그 창에 걸린다. 그래서 이력이 잡힐 때까지 몇 번 더 눌러 본다.
   *
   * ⚠️ 요금 안전 워크플로우 전용이다. 마이그레이션 워크플로우에 쓰면 누를 때마다 EC2가 늘어난다.
   */
  async runWorkflowUntilHistoryAppears(
    name: string,
    attempts = 6,
  ): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
      await this.gotoWorkflows();
      await this.runWorkflow(name);

      await this.selectWorkflow(name);
      await this.openHistoryTab();
      const started = await this.page
        .getByTestId('workflow-run-state')
        .first()
        .isVisible({ timeout: 30_000 })
        .catch(() => false);
      if (started) return;

      // 아직 DAG가 등록되지 않았다 — 조금 기다렸다 다시 시도한다.
      await this.page.waitForTimeout(30_000);
    }
    throw new Error(
      `"${name}" 워크플로우를 ${attempts}번 실행했지만 실행 이력이 잡히지 않았다. ` +
        'airflow가 DAG를 등록하지 못했을 수 있다(dag_id is not exist / DagBag import 오류 확인).',
    );
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
    // 실행 이력의 State 셀로 확인한다.
    // 예전엔 this.rows(= *워크플로우 목록* 테이블의 행)를 봤는데, 그 테이블은 이력과 무관하게 늘 떠 있어서
    // 실행이 하나도 없어도 항상 통과했다(무의미한 검증).
    await expect(
      this.page.getByTestId('workflow-run-state').first(),
    ).toBeVisible({
      timeout: 60_000,
    });
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
    const stateCell = this.page.getByTestId('workflow-run-state');
    if ((await stateCell.count()) === 0) return '';
    return (await stateCell.first().textContent()) ?? '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3-1) 소프트웨어 마이그레이션 결과 화면 (History → View SW)
  //
  // 실행 이력 행의 "View SW" 버튼은 그 실행에 소프트웨어 마이그레이션 태스크가 있을 때만 뜬다.
  // 누르면 소프트웨어별 결과(이름·버전·설치방식·상태·에러)가 표로 나온다 — 마이그레이션이 됐는지
  // *사용자가 확인하는 화면*이 바로 여기다.
  // ─────────────────────────────────────────────────────────────────────────

  private get viewSwButton(): Locator {
    return this.page.getByTestId('workflow-view-sw').first();
  }
  private get swOverlay(): Locator {
    return this.page.getByTestId('sw-migration-overlay');
  }
  private get swTable(): Locator {
    return this.page.getByTestId('sw-migration-table');
  }
  private get swError(): Locator {
    return this.page.getByTestId('sw-migration-error');
  }

  /** "View SW" 버튼이 실행 이력에 떠 있는지 (= 콘솔이 SW 마이그레이션 태스크를 인식했는지) */
  async hasSoftwareMigrationResult(): Promise<boolean> {
    return this.viewSwButton.isVisible({ timeout: 30_000 }).catch(() => false);
  }

  /** 실행 이력에서 소프트웨어 마이그레이션 결과 화면을 연다 */
  async openSoftwareMigrationResult(): Promise<void> {
    await this.viewSwButton.click();
    await expect(this.swOverlay).toBeVisible({ timeout: 20_000 });
    // 표가 그려지거나, 못 가져왔으면 오류가 뜨거나 — 둘 중 하나는 나와야 한다.
    await expect(this.swTable.or(this.swError).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  /** 결과 화면이 오류를 띄웠으면 그 문구 (없으면 빈 문자열) */
  async softwareMigrationErrorText(): Promise<string> {
    if (!(await this.swError.isVisible().catch(() => false))) return '';
    return ((await this.swError.textContent()) ?? '').trim();
  }

  /**
   * 결과 표의 행을 읽는다 — 컬럼 순서: No · Software · Version · Install Type · Status · NS · Infra · Node · Error
   * 화면이 보여주는 것을 그대로 가져와 API 응답과 대조한다(둘이 다르면 화면이 거짓말을 하고 있는 것).
   */
  async readSoftwareMigrationRows(): Promise<
    { name: string; status: string; error: string }[]
  > {
    const rows = this.swTable.locator('tbody tr');
    const out: { name: string; status: string; error: string }[] = [];
    for (let i = 0; i < (await rows.count()); i++) {
      const cells = (await rows.nth(i).locator('td').allInnerTexts()).map(t =>
        t.trim(),
      );
      if (cells.length < 5) continue;
      out.push({ name: cells[1], status: cells[4], error: cells[8] ?? '' });
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4) JSON 뷰어 (Custom & View Workflow)
  // ─────────────────────────────────────────────────────────────────────────

  private get jsonViewer(): Locator {
    return this.page.getByTestId('workflow-json-viewer');
  }

  async expectJsonViewerVisible(): Promise<void> {
    await expect(this.jsonViewer).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5) 워크플로우 템플릿 목록
  // ─────────────────────────────────────────────────────────────────────────

  async gotoTemplates(): Promise<void> {
    await this.page.goto(WorkflowPage.templatesPath);
    await expect(this.templateTable).toBeVisible({ timeout: 15_000 });
  }

  async templateCount(): Promise<number> {
    return this.rowsOf(this.templateTable).count();
  }

  async expectTemplateVisible(name: string): Promise<void> {
    await expect(this.rowByTextIn(this.templateTable, name)).toBeVisible({
      timeout: 15_000,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6) Task Component 목록 (type/spec 스키마)
  // ─────────────────────────────────────────────────────────────────────────

  async gotoTaskComponents(): Promise<void> {
    await this.page.goto(WorkflowPage.taskComponentsPath);
    await this.expectTaskComponentsLoaded();
  }

  async expectTaskComponentsLoaded(): Promise<void> {
    await expect(
      this.page.getByTestId('taskcomponent-page-header'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.taskComponentTable).toBeVisible({ timeout: 15_000 });
  }

  async taskComponentCount(): Promise<number> {
    return this.rowsOf(this.taskComponentTable).count();
  }

  async expectTaskComponentVisible(name: string): Promise<void> {
    await expect(this.rowByTextIn(this.taskComponentTable, name)).toBeVisible({
      timeout: 15_000,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7) 워크플로우 JSON 뷰어 (cm-cicada type/spec — run_script base64 디코드)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // 콘솔은 task_component가 `cicada_task_run_script`인 task의 스크립트를 base64로 저장하고,
  // JSON 뷰어에서 사람이 읽을 수 있게 디코드해 보여준다. cm-cicada가 type/spec 스키마로
  // 바뀌면서 그 값의 위치가 `task.request_body` → `task.spec.request_body`로 옮겨갔다.
  // 뷰어가 신 위치를 읽지 못하면 화면에 base64 덩어리가 그대로 노출된다.

  /** 워크플로우를 선택하고 상세의 "View Workflow JSON"을 눌러 뷰어를 연다 */
  async openJsonViewer(name: string): Promise<void> {
    await this.revealWorkflow(name);
    await this.rowByText(name).evaluate((el: HTMLElement) => el.click());
    const link = this.page.getByTestId('workflow-json-view').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    // 상세 패널이 뷰포트 밖에 있을 수 있어 DOM 클릭으로 연다
    await link.evaluate((el: HTMLElement) => el.click());
    await expect(this.page.getByTestId('workflow-json-viewer')).toBeVisible({
      timeout: 15_000,
    });
  }

  /** 뷰어에 표시된 JSON 텍스트 */
  async jsonViewerText(): Promise<string> {
    return this.page.locator('body').innerText();
  }

  /**
   * 스크립트가 디코드되어 보이는지 확인한다.
   * @param marker 스크립트 원문에 들어 있는 문구 (디코드되면 화면에 나타난다)
   * @param base64Prefix 인코딩된 원본의 앞부분 (디코드되면 화면에 나타나면 안 된다)
   */
  async expectScriptDecoded(
    marker: string,
    base64Prefix: string,
  ): Promise<void> {
    const text = await this.jsonViewerText();
    expect(
      text,
      'run_script 내용이 디코드되어 보여야 한다(spec.request_body 경로)',
    ).toContain(marker);
    expect(text, 'base64 원본이 그대로 노출되면 안 된다').not.toContain(
      base64Prefix,
    );
  }
}
