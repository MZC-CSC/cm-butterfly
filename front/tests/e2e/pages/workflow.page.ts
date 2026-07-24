import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';
import { workflowData } from '../fixtures/test-data';
import { humanClick, humanFill } from '../support/humanize';

/**
 * WorkflowPage — the "where/how" layer of the workflow management (cm-cicada) domain.
 *
 * ★ Screen locations (URLs) and elements (selectors) are gathered here in one place.
 *   Scenarios (.feature) and steps carry only "intent", and the impact of screen changes is isolated to this file.
 *
 * Target screens (3):
 *   - Workflow list/detail/run/history    /main/workflow-management/workflows
 *   - Workflow template list               /main/workflow-management/workflow-templates
 *   - Task Component list/detail           /main/workflow-management/task-components
 *
 * cm-cicada type/spec transition: a TaskComponent has a { type, spec } schema with 5 types
 * (http · http_xcom · bash · ssh · trigger_workflow). Workflow creation is composed of a
 * template + type/spec tasks in the SequentialDesigner (designer/editor).
 *
 * ⚠️ Sections without data-testid: the workflow domain .vue files currently have no data-testid.
 *   BAR-880 (selector stabilization) — data-testid has been added at the key points of the workflow domain:
 *     workflow-list-table · taskcomponent-list-table · workflow-template-list-table ·
 *     workflow-json-view (open JSON from detail) · workflow-json-viewer (viewer body).
 *   Even if screen text or DOM structure changes, these testids locate elements precisely. Only sections
 *   that still lack a testid keep a role/text fallback, and the fallback is removed as testids are added.
 */
export class WorkflowPage {
  /** ★ Screen location (URL) */
  static readonly workflowsPath = '/main/workflow-management/workflows';
  static readonly templatesPath =
    '/main/workflow-management/workflow-templates';
  static readonly taskComponentsPath =
    '/main/workflow-management/task-components';

  constructor(private readonly page: Page) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Common elements
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List table — each screen uses its *own* testid.
   * If multiple screens share the same testid, it becomes ambiguous which table is meant,
   * and it grabs the wrong place when the screen changes. (BAR-880 — selector stabilization)
   */
  // The table testid differs per screen. Because a new Page Object is created for each step,
  // we must not hold "the current screen" as instance state — each method points at its own table directly.
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

  /** Table data rows (excluding the header) */
  private rowsOf(table: Locator): Locator {
    return table.locator('tbody tr');
  }

  private rowByTextIn(table: Locator, text: string): Locator {
    return this.rowsOf(table).filter({ hasText: text }).first();
  }

  /**
   * The workflow list's search input (mirinae PQuerySearch, scoped to this table).
   *
   * mirinae renders the search box inside PToolboxTable, so a data-testid cannot be attached to the
   * actual <input> without modifying mirinae. We scope to the table's testid and target mirinae's own
   * structural class (.p-query-search input) — the same "target the framework's stable class, not
   * screen text" approach the rest of these page objects use (e.g. `.p-context-menu-item`).
   */
  private get workflowSearchInput(): Locator {
    return this.workflowTable
      .locator('.p-query-search input, .p-search input')
      .first();
  }

  /** Remove any existing query-tag chips so a new search is not AND-ed with a stale one. */
  private async clearWorkflowSearch(): Promise<void> {
    const deleteAll = this.workflowTable
      .locator('.p-query-search-tags .delete-btn')
      .first();
    if (await deleteAll.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await deleteAll.click().catch(() => {});
    }
  }

  /**
   * Reveal a workflow row via the list's SEARCH box (the scenario path).
   *
   * ★ Why — the workflow list is never pruned, so linear-paging it to find a just-created row grew
   *   into a ~10-minute hang as runs accumulated. The scenario always knows the exact workflow name,
   *   so we filter to the single row instead of paging. The list loads the full set into the store and
   *   filters client-side on the query tag (useToolboxTableModel.applyQueryTags), so a match is found
   *   regardless of which page the row would otherwise land on.
   *
   * @returns 1 (the filtered result is a single-page view). Throws if the row never appears after
   *   filtering, which the paging fallback in revealWorkflow() then handles.
   */
  private async revealWorkflowBySearch(query: string): Promise<number> {
    await expect(this.workflowTable).toBeVisible({ timeout: 15_000 });
    await this.clearWorkflowSearch();
    await this.workflowSearchInput.click();
    await this.workflowSearchInput.fill(query);
    await this.workflowSearchInput.press('Enter');
    await expect(this.rowByText(query)).toBeVisible({ timeout: 15_000 });
    return 1;
  }

  /**
   * Actually bring the workflow row into view in the list.
   *
   * Prefer the search box (scenario path — the created workflow's name is known). If search somehow
   * does not narrow (kept as a safety net, and for functional tests that assert on pre-seeded data),
   * fall back to paging the whole list.
   */
  private async revealWorkflow(name: string): Promise<number> {
    const viaSearch = await this.revealWorkflowBySearch(name).catch(() => null);
    if (viaSearch !== null) return viaSearch;
    // Fallback: page through 15 rows at a time (the old behavior).
    const pager = new TablePagination(this.page, this.workflowTable);
    return pager.expectRowSomewhere(this.rowByText(name), name);
  }

  /** Default (workflow list) table — backward-compatible helper */
  private get rows(): Locator {
    return this.rowsOf(this.workflowTable);
  }

  private rowByText(text: string): Locator {
    return this.rowByTextIn(this.workflowTable, text);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 0) Run status viewer (Run Status tab)
  //
  //   We do not check state by *color*. A node emits its own state via data-state,
  //   so we assert on that directly — the test survives even when the design changes.
  //   (Convention: cm-butterfly/design/07-DESIGN/DESIGN-E2E-SELECTORS.md)
  // ─────────────────────────────────────────────────────────────────────────

  /** For debugging — bring the workflow row into view in the list */
  async revealWorkflowPublic(name: string): Promise<number> {
    return this.revealWorkflow(name);
  }

  /** Pick a workflow and open the Run Status tab */
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

  /** A task node in the graph */
  runNode(taskName: string): Locator {
    return this.page.locator(
      `[data-testid="workflow-run-node"][data-task-name="${taskName}"]`,
    );
  }

  /** Whether the node's run state matches the expectation (asserted by state value, not color) */
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

  /** Open the selected task's log (an attempt number can be specified) */
  async openTaskLog(tryNumber?: number): Promise<Locator> {
    const button = tryNumber
      ? this.page.locator(
          `[data-testid="workflow-run-log-try"][data-try="${tryNumber}"]`,
        )
      : this.page.getByTestId('workflow-run-log-try').first();
    await button.click();
    // The full log is collapsed. It must be expanded to see the content.
    await this.page.getByText('Full log').click();
    const log = this.page.getByTestId('workflow-run-log');
    await expect(log).toBeVisible({ timeout: 20_000 });
    return log;
  }

  /** Progress indicator — whether it is running, and how many of how many have finished */
  get runProgress() {
    return this.page.getByTestId('workflow-run-progress');
  }

  get runProgressCount() {
    return this.page.getByTestId('workflow-run-progress-count');
  }

  /**
   * "Still running" indicators. The progress bar only moves when a task finishes, so during a
   * long task these are the only things that keep moving — which task is being waited on, and
   * how long it has been.
   *
   * Only present while the run is in flight, so assert on them *during* a run, not after.
   */
  get runningIndicator(): Locator {
    return this.page.getByTestId('workflow-run-running');
  }

  /**
   * The layer shown from the moment Run is pressed until the new run can be drawn. It covers
   * the graph, which still shows the *previous* run until then.
   */
  get runStarting(): Locator {
    return this.page.getByTestId('workflow-run-starting');
  }

  /** "Running: <task>" or "Waiting for the next task to start" */
  get runningTasksText(): Locator {
    return this.page.getByTestId('workflow-run-running-tasks');
  }

  /** The elapsed counter. It must actually change — a frozen one proves nothing */
  get runElapsed(): Locator {
    return this.page.getByTestId('workflow-run-elapsed');
  }

  /**
   * Spinners drawn on running task nodes. Count them rather than checking a style —
   * the rotation is CSS, which tells you nothing about which task is running.
   */
  get runNodeSpinners(): Locator {
    return this.page.getByTestId('workflow-run-node-spinner');
  }

  /** Which run is currently being viewed */
  get runMeta() {
    return this.page.getByTestId('workflow-run-meta');
  }

  get failureSummary(): Locator {
    return this.page.getByTestId('workflow-run-failure');
  }

  /**
   * Open the re-run confirmation.
   *
   * What gets re-run is decided by *the engine looking at the actual execution graph*, not the diagram
   * on screen. So instead of running, it first fetches the target list for confirmation, and this method
   * returns that list.
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
   * Re-run all failures of the run — independent of the selected task, so it sits alongside the
   * run-level actions (not the task detail panel).
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

  /** New run — not re-running the selected run, but running the workflow from scratch */
  async openNewRunConfirm(): Promise<Locator> {
    await this.page.getByTestId('workflow-viewer-run-btn').click();
    const modal = this.page.getByTestId('workflow-run-confirm');
    await expect(modal).toBeVisible();
    return modal;
  }

  /** Cloning creates another workflow, so it goes through a confirmation */
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
  // 1) Workflow list
  // ─────────────────────────────────────────────────────────────────────────

  async gotoWorkflows(): Promise<void> {
    await this.page.goto(WorkflowPage.workflowsPath);
    await this.expectWorkflowsLoaded();
  }

  /** Confirm the list screen loaded — header "Workflows" + table shown */
  async expectWorkflowsLoaded(): Promise<void> {
    await expect(this.page.getByTestId('workflow-page-header')).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.workflowTable).toBeVisible({ timeout: 15_000 });
  }

  /** Number of workflows returned (row count) */
  async workflowCount(): Promise<number> {
    return this.rows.count();
  }

  async expectWorkflowVisible(name: string): Promise<void> {
    await this.revealWorkflow(name);
    await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
  }

  /** Select a row → show the detail panel */
  async selectWorkflow(name: string): Promise<void> {
    await this.revealWorkflow(name);
    await this.rowByText(name).click();
    // ★ Tab-independent anchor. The detail panel now defaults to the Run Status tab
    //   (WorkflowsPage.vue mainTabState.activeTab='runViewer', commits 3d38731/29ba0f5), so waiting
    //   for "Workflow Information" (the Details tab body) no longer fires. Wait for the run viewer
    //   body — present when the default tab is active — or, failing that, the PTab tab strip, either
    //   of which proves the row's detail actually opened.
    await expect(
      this.page
        .getByTestId('workflow-run-viewer')
        .or(this.page.getByRole('tab', { name: 'Run Status' }))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2) Workflow creation — designer/editor (SequentialDesigner)
  // ─────────────────────────────────────────────────────────────────────────

  /** Root container of the designer/editor modal */
  private get designer(): Locator {
    return this.page.getByTestId('workflow-designer');
  }

  private get designerNameInput(): Locator {
    return (
      this.page
        .locator(
          'input[data-testid="workflow-name-input"], textarea[data-testid="workflow-name-input"]',
        )
        // The first text input in the editor header (Workflow Name)
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
   * Open the workflow designer (editor).
   * In the current UI the creation entry point is the "Workflow Tool" modal in the detail, or migration add-mode.
   * (The Add button in the list toolbox is still disabled) → recommend adding data-testid `workflow-create`.
   */
  async openDesigner(): Promise<void> {
    const createBtn = this.page.getByTestId('workflow-create');
    await createBtn.first().click();
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  async expectDesignerOpen(): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  /** Enter a name + select a template, then save */
  async fillWorkflowName(name: string): Promise<void> {
    await humanFill(this.designerNameInput, name);
  }

  async selectTemplate(templateName: string): Promise<void> {
    await this.designerTemplateDropdown.click();
    await this.page
      .getByRole('option', { name: templateName })
      .or(this.page.getByText(templateName, { exact: false }).last())
      .click();
  }

  async saveWorkflow(): Promise<void> {
    await humanClick(this.designerSaveButton);
    // Confirm via the save-success toast (Success) or the modal closing
    await expect(this.designer).toBeHidden({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2-1) Workflow tool — editing task parameters
  //
  // Selecting a task in the designer opens an edit panel on the right, where you can modify the
  // path/query parameters and body of the API that task calls. For a migration task, values like the
  // *name of the infra to be created*, the namespace, and CSP/region live here.
  //
  // Running with only defaults tells us nothing about whether this screen actually works. Only by
  // changing a value, saving, and checking that it is created as changed have we verified the workflow tool.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Select a task on the designer canvas to open the edit panel.
   *
   * The canvas is drawn as SVG by sequential-workflow-designer. Since the elements are created by the
   * library we cannot attach a testid, but each step gets a `sqd-type-{task component name}` class. That
   * name is *our data* (task_component), not screen text, so it does not wobble when the screen changes.
   * We target it with that.
   */
  async selectTaskInDesigner(taskComponentName: string): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 20_000 });
    await this.designer
      .locator(`.sqd-step-task.sqd-type-${taskComponentName}`)
      .first()
      .click();
    await expect(this.taskEditor).toBeVisible({ timeout: 15_000 });
  }

  /** Task edit panel */
  private get taskEditor(): Locator {
    return this.page.getByTestId('wf-task-editor');
  }

  /** path parameter input (e.g. nsId) */
  private pathParam(key: string): Locator {
    return this.page.getByTestId(`wf-path-param-${key}`);
  }

  /** query parameter input (e.g. nameSeed) */
  private queryParam(key: string): Locator {
    return this.page.getByTestId(`wf-query-param-${key}`);
  }

  /**
   * body parameter input. Targeted by schema path — e.g. `targetInfra.name`, `targetCloud.csp`.
   * (The testid is assigned in the form `wf-field-body_params.{path}`.)
   */
  private bodyField(path: string): Locator {
    return this.page.getByTestId(`wf-field-body_params.${path}`);
  }

  /** Read the current value in the edit panel — used to confirm "what the default is" in the default-value scenario */
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

  /** Change a value in the edit panel */
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
    await humanFill(field, value);
    // Give the input time to reflect into the model (input event → parent state update).
    await this.page.waitForTimeout(500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3) Workflow run + state polling (History)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run a workflow from the list. If a name is given, Run that row; otherwise Run the first row.
   * (WorkflowList's col-run-format slot = style-type=tertiary "Run" button)
   */
  async runWorkflow(name?: string): Promise<void> {
    if (!name) {
      await humanClick(this.page.getByTestId('workflow-run-btn'));
      return;
    }
    await this.revealWorkflow(name);
    // Grab the Run button inside the row by testid (so it does not break when the text changes).
    await humanClick(this.rowByText(name).getByTestId('workflow-run-btn'));
  }

  /**
   * Run a cost-safe workflow, retrying until a run history entry actually appears.
   *
   * When cm-cicada creates a workflow it writes the DAG YAML to disk, and airflow periodically parses and
   * registers it. Firing a run before registration (within roughly a minute) is rejected with "provided
   * dag_id is not exist" — running a just-created workflow immediately lands exactly in that window. So we
   * press a few more times until a history entry appears.
   *
   * ⚠️ For cost-safe workflows only. Using it on a migration workflow adds an EC2 instance with every press.
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

      // The DAG is not registered yet — wait a bit and try again.
      await this.page.waitForTimeout(30_000);
    }
    throw new Error(
      `"${name}" 워크플로우를 ${attempts}번 실행했지만 실행 이력이 잡히지 않았다. ` +
        'airflow가 DAG를 등록하지 못했을 수 있다(dag_id is not exist / DagBag import 오류 확인).',
    );
  }

  /** Switch Details/History tabs — mirinae PTab selected uniquely by ARIA role(tab) (a text fallback double-matches spans) */
  async openHistoryTab(): Promise<void> {
    await this.page.getByRole('tab', { name: /History/i }).click();
    await expect(
      this.page.getByText('Workflow History', { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Wait until at least one run history entry appears on the History tab */
  async expectRunHistoryPresent(): Promise<void> {
    // Confirm via the State cell of the run history.
    // Previously it looked at this.rows (= rows of the *workflow list* table), but that table is always
    // present regardless of history, so it always passed even with no runs at all (a meaningless check).
    await expect(
      this.page.getByTestId('workflow-run-state').first(),
    ).toBeVisible({
      timeout: 60_000,
    });
  }

  /**
   * Poll the latest run's state until a terminal state (success/failed) and return it.
   * cm-cicada triggers an Airflow DAG run, so the state transitions queued→running→success.
   * The state (=IWorkflowRun.state) in the get-workflow-runs response is shown in the History table's State column.
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

  /** State cell text of the latest (first) run row */
  private async latestRunStateText(): Promise<string> {
    const stateCell = this.page.getByTestId('workflow-run-state');
    if ((await stateCell.count()) === 0) return '';
    return (await stateCell.first().textContent()) ?? '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3-1) Software migration result screen (History → View SW)
  //
  // The "View SW" button on a run history row appears only when that run has a software migration task.
  // Pressing it shows per-software results (name·version·install type·status·error) in a table — this is
  // exactly *the screen where the user confirms* whether the migration happened.
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

  /**
   * Whether the "View SW" button is shown in the run history (= whether the console recognized an SW migration task).
   * A single, non-throwing visibility check — no reload loop. Callers that want a best-effort, time-bounded probe
   * pass a short timeout; the button being absent within that window is a valid answer (returns false).
   */
  async hasSoftwareMigrationResult(timeoutMs = 30_000): Promise<boolean> {
    return this.viewSwButton
      .isVisible({ timeout: timeoutMs })
      .catch(() => false);
  }

  /**
   * Poll the run history until the "View SW" button appears, reloading between tries.
   *
   * ★ Why not a single wait: the front (WorkflowHistory.vue) detects SW-migration runs *client-side* — after the run
   *   table loads it fetches each run's task instances sequentially (Get-Task-Instances, with a 100ms gap per run) and
   *   only then flips runHasSwTask[runId], which is what gates the button (`v-if="runHasSwTask[...]"`). A plain 30s wait
   *   can elapse before that per-run fetch finishes, so we reload the History tab periodically to restart the detection
   *   and give it more chances. Non-throwing — returns whether the button ultimately showed.
   */
  async waitSoftwareMigrationButton(timeoutMs = 120_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (
        await this.viewSwButton.isVisible({ timeout: 8_000 }).catch(() => false)
      ) {
        return true;
      }
      if (Date.now() > deadline) return false;
      await this.page.waitForTimeout(3_000);
      await this.page.reload().catch(() => {});
      await this.openHistoryTab().catch(() => {});
    }
  }

  /**
   * Open the software migration result screen from the run history.
   * Timeouts are parametrized so a best-effort (report-only) caller can keep the whole observation short.
   */
  async openSoftwareMigrationResult(
    overlayTimeoutMs = 20_000,
    contentTimeoutMs = 60_000,
  ): Promise<void> {
    await this.viewSwButton.click();
    await expect(this.swOverlay).toBeVisible({ timeout: overlayTimeoutMs });
    // Either the table is drawn, or if it could not be fetched an error appears — one of the two must show.
    await expect(this.swTable.or(this.swError).first()).toBeVisible({
      timeout: contentTimeoutMs,
    });
  }

  /** The error text if the result screen showed an error (empty string if none) */
  async softwareMigrationErrorText(): Promise<string> {
    if (!(await this.swError.isVisible().catch(() => false))) return '';
    return ((await this.swError.textContent()) ?? '').trim();
  }

  /**
   * Read the rows of the result table — column order: No · Software · Version · Install Type · Status · NS · Infra · Node · Error
   * Take what the screen shows as-is and compare it against the API response (if they differ, the screen is lying).
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
  // 4) JSON viewer (Custom & View Workflow)
  // ─────────────────────────────────────────────────────────────────────────

  private get jsonViewer(): Locator {
    return this.page.getByTestId('workflow-json-viewer');
  }

  async expectJsonViewerVisible(): Promise<void> {
    await expect(this.jsonViewer).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5) Workflow template list
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
  // 6) Task Component list (type/spec schema)
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
  // 7) Workflow JSON viewer (cm-cicada type/spec — run_script base64 decode)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // The console stores the script of a task whose task_component is `cicada_task_run_script` as base64,
  // and the JSON viewer decodes it into a human-readable form. As cm-cicada moved to the type/spec schema,
  // the location of that value shifted from `task.request_body` → `task.spec.request_body`.
  // If the viewer fails to read the new location, a base64 blob is exposed on screen as-is.

  /** Select a workflow and press "View Workflow JSON" in the detail to open the viewer */
  async openJsonViewer(name: string): Promise<void> {
    await this.revealWorkflow(name);
    await this.rowByText(name).evaluate((el: HTMLElement) => el.click());
    const link = this.page.getByTestId('workflow-json-view').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    // The detail panel may be outside the viewport, so open it with a DOM click
    await link.evaluate((el: HTMLElement) => el.click());
    await expect(this.page.getByTestId('workflow-json-viewer')).toBeVisible({
      timeout: 15_000,
    });
  }

  /** The JSON text shown in the viewer */
  async jsonViewerText(): Promise<string> {
    return this.page.locator('body').innerText();
  }

  /**
   * Verify the script is shown decoded.
   * @param marker text contained in the original script (appears on screen once decoded)
   * @param base64Prefix the leading part of the encoded original (must not appear on screen if decoded)
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
