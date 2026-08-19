import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';
import { workflowData } from '../fixtures/test-data';
import { humanClick, humanFill } from '../support/humanize';
import { spotlight, spotlightText } from '../support/spotlight';
import { describe as writeDescription } from '../support/describe';
import { openScreen } from '../support/navigate';

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
      await humanClick(deleteAll).catch(() => {});
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
    await humanClick(this.workflowSearchInput);
    await humanFill(this.workflowSearchInput, query);
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
    await expect(this.workflowTable).toBeVisible({ timeout: 15_000 });
    const pager = new TablePagination(this.page, this.workflowTable);
    const { total } = await pager.status();

    // One page? Then the row is already on screen and a person clicks it.
    //
    // ★ Searching is for finding what you cannot see. With three rows in front of you, typing a
    //   name you just chose into the search box is not what anyone does - and the recording was
    //   doing it two and three times per workflow. Search earns its place once the list pages.
    if (total <= 1) {
      await expect(this.rowByText(name)).toBeVisible({ timeout: 15_000 });
      return 1;
    }

    const viaSearch = await this.revealWorkflowBySearch(name).catch(() => null);
    if (viaSearch !== null) return viaSearch;
    // Search did not narrow it - page through 15 rows at a time.
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
  async openRunViewer(workflowName: string, force = false): Promise<void> {
    // Already looking at it? Then stop.
    //
    // ★ `force` skips that shortcut. After saving a cloned workflow the list selects the copy while
    //   the viewer below is still showing the workflow it was copied from, so "the row is already
    //   selected" is true without the viewer having caught up - the run started was the copy's, but
    //   the parameters on screen belonged to the original. Opening it the way a person does, by
    //   pressing the row, loads the whole thing. (2026-07-31)
    //
    // ★ After running a workflow we are on its Run Status, and this went back to the list, found the
    //   row again, clicked it and re-opened the tab - on screen it reads as running the thing a
    //   second time. If the viewer is up and the selected row is this workflow, there is nothing
    //   to open.
    const viewer = this.page.getByTestId('workflow-run-viewer');
    if (
      !force &&
      (await viewer.isVisible({ timeout: 1_000 }).catch(() => false))
    ) {
      const selected = this.rowByText(workflowName).first();
      const cls = (await selected.getAttribute('class').catch(() => '')) ?? '';
      if (cls.includes('selected')) {
        await expect(this.page.getByTestId('workflow-run-graph')).toBeVisible({
          timeout: 15_000,
        });
        return;
      }
    }

    await this.revealWorkflow(workflowName);
    await humanClick(this.rowByText(workflowName));
    await humanClick(this.page.getByRole('tab', { name: 'Run Status' }));
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
    await humanClick(this.runNode(taskName));
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
    await humanClick(button);
    // The full log is collapsed. It must be expanded to see the content.
    await humanClick(this.page.getByText('Full log'));
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
    await humanClick(
      this.page.locator(
        `[data-testid="workflow-rerun-scope"][data-scope="${scope}"]`,
      ),
    );
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
    await humanClick(this.page.getByTestId('workflow-rerun-failed-btn'));
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeVisible({
      timeout: 20_000,
    });
    return this.page.getByTestId('workflow-rerun-target');
  }

  async confirmRerun(): Promise<void> {
    await humanClick(this.page.getByTestId('workflow-rerun-ok'));
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeHidden();
  }

  async cancelRerun(): Promise<void> {
    await humanClick(this.page.getByTestId('workflow-rerun-cancel'));
    await expect(this.page.getByTestId('workflow-rerun-confirm')).toBeHidden();
  }

  /** New run — not re-running the selected run, but running the workflow from scratch */
  async openNewRunConfirm(): Promise<Locator> {
    await humanClick(this.page.getByTestId('workflow-viewer-run-btn'));
    const modal = this.page.getByTestId('workflow-run-confirm');
    await expect(modal).toBeVisible();
    return modal;
  }

  /** Cloning creates another workflow, so it goes through a confirmation */
  async openCloneConfirm(): Promise<Locator> {
    await humanClick(this.page.getByTestId('workflow-clone-edit-btn'));
    const modal = this.page.getByTestId('workflow-clone-confirm');
    await expect(modal).toBeVisible();
    return modal;
  }

  /**
   * Copy the workflow on screen and open the copy for editing.
   *
   * The console has no "save as", and a workflow that has already run cannot be edited in place -
   * so this is the only way to keep the original and vary it. The button appears once there is
   * run history. The backend names the copy `{original}_copy`; the caller renames it.
   */
  async cloneAndEdit(): Promise<void> {
    const button = this.page.getByTestId('workflow-clone-edit-btn');
    await expect(
      button,
      'Clone & Edit 버튼이 없다 — 실행 이력이 있는 워크플로우에서만 나타난다',
    ).toBeVisible({ timeout: 30_000 });
    await humanClick(button);

    const confirm = this.page.getByTestId('workflow-clone-confirm');
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await humanClick(this.page.getByTestId('workflow-clone-confirm-ok'));

    await this.expectDesignerOpen();
  }

  /**
   * Open everything the panel folded away.
   *
   * The editor collapses arrays and objects deeper than two levels so the form stays readable, so a
   * test that reads the rendered fields cannot see the values that decide the outcome. A person
   * clicks to open them; so do we.
   *
   * The toggles carry no test identifier, so they are found by the component's own class names.
   */
  async expandAllParams(maxRounds = 6): Promise<number> {
    let opened = 0;
    for (let round = 0; round < maxRounds; round++) {
      const closed = this.page.locator(
        '[data-testid="wf-task-editor"] button.btn-collapse, [data-testid="wf-task-editor"] button.btn-item-collapse',
      );
      const count = await closed.count().catch(() => 0);
      let clickedThisRound = 0;
      for (let i = 0; i < count; i++) {
        const button = closed.nth(i);
        const label = (await button.innerText().catch(() => '')).trim();
        if (!label.includes('\u25b6')) continue;
        await button.click({ timeout: 5_000 }).catch(() => {});
        clickedThisRound++;
        opened++;
        await this.page.waitForTimeout(12);
      }
      if (clickedThisRound === 0) break;
    }
    await this.page.waitForTimeout(400);
    return opened;
  }

  /**
   * 고칠 칸이 있는 자리까지 **경로를 따라** 연다.
   *
   * ★ 전부 펼치지 않는다. 접힌 것이 이백 개 가까워, 화면에는 *줄을 하나씩 눌러 내려가는* 장면만
   *   몇 분 남고 정작 고치는 장면은 짧아서 정지 제거에 함께 잘려 나간다 — 보는 쪽에서는
   *   "펼치기만 계속하다 끝났다"가 된다(2026-08-19 사용자 지적).
   *
   *   토글에 그 자리의 경로가 이름으로 붙어 있으므로(`wf-toggle-{경로}`), 목표 경로의 조상만
   *   골라 누르면 된다. 세 번이면 닿는다. 이미 펼쳐져 있으면 누르지 않는다.
   *
   * @param path 목표 칸의 경로 (예: `body_params.targetSecurityGroupList[0].firewallRules`)
   */
  async openPathTo(path: string): Promise<number> {
    // body_params.targetSecurityGroupList[0].firewallRules
    //   → body_params / …targetSecurityGroupList / …[0] / …firewallRules
    const steps: string[] = [];
    let acc = '';
    for (const part of path.split('.')) {
      acc = acc ? `${acc}.${part}` : part;
      const m = part.match(/^(.*?)(\[\d+\])$/);
      if (m) {
        steps.push(acc.slice(0, acc.length - m[2].length));
        steps.push(acc);
      } else {
        steps.push(acc);
      }
    }

    let opened = 0;
    for (const step of steps) {
      const toggle = this.page.getByTestId(`wf-toggle-${step}`).first();
      if (!(await toggle.count())) continue; // 접히지 않는 자리는 토글이 없다
      const label = (await toggle.innerText().catch(() => '')).trim();
      if (!label.includes('\u25b6')) continue; // ▶ 만 접힌 것
      await toggle.scrollIntoViewIfNeeded().catch(() => {});
      await humanClick(toggle);
      opened++;
      await this.page.waitForTimeout(250);
    }
    return opened;
  }

  /** Rename the task whose edit panel is open. */
  async renameSelectedTask(name: string): Promise<void> {
    const field = this.page.getByTestId('wf-task-name');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await humanFill(field, name);
    await this.page.waitForTimeout(400);
  }

  /** Set a value on the open edit panel, addressed by the spec key it belongs to. */
  async setTaskSpec(key: string, value: string): Promise<void> {
    const field = this.page.getByTestId(`wf-task-spec-${key}`);
    await expect(field).toBeVisible({ timeout: 15_000 });
    await humanFill(field, value);
    await this.page.waitForTimeout(400);
  }

  /** A task node in the run graph, by its name. */
  taskNode(name: string): Locator {
    return this.page
      .getByTestId('workflow-run-node')
      .filter({ hasText: name })
      .first();
  }

  /** Select a task in the run graph so its detail and parameters open. */
  async pickTask(name: string): Promise<void> {
    const node = this.taskNode(name);
    await node.scrollIntoViewIfNeeded().catch(() => {});
    await humanClick(node);
    await expect(this.page.getByTestId('workflow-run-task-detail')).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  }

  async cancelClone(): Promise<void> {
    await humanClick(this.page.getByTestId('workflow-clone-confirm-cancel'));
    await expect(this.page.getByTestId('workflow-clone-confirm')).toBeHidden();
  }

  async cancelNewRun(): Promise<void> {
    await humanClick(this.page.getByTestId('workflow-run-confirm-cancel'));
    await expect(this.page.getByTestId('workflow-run-confirm')).toBeHidden();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1) Workflow list
  // ─────────────────────────────────────────────────────────────────────────

  async gotoWorkflows(): Promise<void> {
    await openScreen(
      this.page,
      'workflows',
      WorkflowPage.workflowsPath,
      'workflow-list-table',
    );
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
    await humanClick(this.rowByText(name));
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
    await humanClick(createBtn.first());
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  async expectDesignerOpen(): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 15_000 });
  }

  /** Enter a name + select a template, then save */
  async fillWorkflowName(name: string, description?: string): Promise<void> {
    await humanFill(this.designerNameInput, name);

    // What this workflow is for. The editor has a description box beside the name and it was going
    // in empty, so the list afterwards shows a row of names and nothing else.
    if (description) {
      await writeDescription(
        this.page,
        // mirinae 의 PTextInput 은 겉을 한 겹 감싼다. data-testid 는 그 껍데기에 붙으므로 값을
        // 넣을 수 있는 것은 안쪽 input 이다. 폴백으로 껍데기를 함께 두면 문서 순서상 껍데기가
        // 먼저 잡혀 계속 같은 오류가 난다.
        this.page
          .getByTestId('workflow-description-input')
          .locator('input')
          .first(),
        description,
      );
    }
  }

  async selectTemplate(templateName: string): Promise<void> {
    await humanClick(this.designerTemplateDropdown);
    await humanClick(
      this.page
        .getByRole('option', { name: templateName })
        .or(this.page.getByText(templateName, { exact: false }).last()),
    );
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
  async selectTaskInDesigner(
    taskComponentName: string,
    taskName?: string,
  ): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 20_000 });
    // 같은 컴포넌트를 쓰는 작업이 여럿이면 첫 번째가 원하는 그것이 아니다 — 이름으로 좁힌다.
    //
    // 이름으로 고를 때는 컴포넌트 클래스를 함께 걸지 않는다. 클래스는 컴포넌트 이름을 그대로
    // 붙인 것이라 `_` 로 시작하는 예제 컴포넌트에서는 잡히지 않는 경우가 있었다 — 노드에 적힌
    // 이름이 우리가 아는 값이므로 그것으로 충분하다.
    // 이름으로 거르면 그 이름을 *품고 있는* 바깥 상자(TaskGroup·Parallel)까지 함께 걸린다.
    // 바깥을 누르면 아무 일도 일어나지 않으므로 가장 안쪽 것을 잡는다.
    const step = taskName
      ? this.designer
          .locator('.sqd-step-task')
          .filter({ hasText: taskName })
          .last()
      : this.designer
          .locator(`.sqd-step-task.sqd-type-${taskComponentName}`)
          .first();
    await humanClick(step);
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

  /**
   * Change the instance spec here, in the workflow, rather than in the model.
   *
   * ★ The point is to show the third link in the chain: a value set in the workflow overrides what
   *   the model carried, and the machine comes out the way the workflow said. The model's own spec
   *   stays as it was.
   *
   * The spec lives inside an array in the request body (`targetInfra.nodeGroups[].specId`), and the
   * field identifiers follow that path, so rather than guess the index we look for the field whose
   * value looks like a spec - `provider+region+size`. Only the size at the end is retyped, the same
   * way it is done in the model editor.
   */
  /**
   * Read every body field's path and value in **one** round trip.
   *
   * ★ Asking each field separately is what made the recording crawl. After expanding there are
   *   nearly eight hundred of them, and reading a path and a value from each is sixteen hundred
   *   journeys to the browser and back - minutes of a screen doing nothing while the test hunts.
   *   The browser can hand the whole lot over at once; the search then happens here, instantly, and
   *   only the field that matters is touched. (2026-07-31)
   */
  /**
   * The input carrying this identifier.
   *
   * ★ 앞머리(`wf-field-`)를 떼면 안 된다. 화면이 붙이는 식별자는 그것까지 포함한 전체이고
   *   (`RecursiveFormField.vue`), 떼어 낸 이름을 가진 요소는 어디에도 없다. 그런데 클릭에는
   *   시한이 없어서 *없는 것을 기다리다* 15초를 채우고 죽는다 — "못 찾았다"가 아니라 "눌리지
   *   않는다"로 보이니 원인이 엉뚱한 곳(접힘·가려짐)으로 짚인다. 실제로 그렇게 두 번 헤맸다.
   *   여기를 지나는 길은 트랙3(복제 후 편집)뿐이라 그동안 드러나지 않았다. (2026-08-01)
   */
  private bodyField(path: string): Locator {
    return this.page.locator(`[data-testid="${path}"]`);
  }

  private async readBodyFields(): Promise<{ path: string; value: string }[]> {
    return this.page
      .locator('[data-testid^="wf-field-body_params."]')
      .evaluateAll(els =>
        els.map(el => ({
          path: el.getAttribute('data-testid') ?? '',
          value: (el as HTMLInputElement | HTMLTextAreaElement).value ?? '',
        })),
      )
      .catch(() => []);
  }

  /**
   * Open everything the panel folded away.
   *
   * The editor collapses arrays and objects deeper than two levels so the form stays readable. For
   * a migration that hides the two values that decide the outcome - the node's spec and the
   * firewall ports - behind ▶ toggles, so a test that reads the rendered fields finds neither. That
   * is the panel doing its job, not a defect: a person clicks to open them.
   *
   * So we click too. Keep pressing whatever still shows ▶ until nothing does, then the fields are
   * in the DOM and can be read and edited like any other.
   *
   * The toggles carry no test identifier, so they are found by the component's own class names
   * (`btn-collapse` for an array or object, `btn-item-collapse` for one item of an array).
   */
  async expandAllParams(maxRounds = 6): Promise<number> {
    let opened = 0;

    for (let round = 0; round < maxRounds; round++) {
      const closed = this.taskEditor.locator(
        'button.btn-collapse, button.btn-item-collapse',
      );
      const count = await closed.count().catch(() => 0);

      let clickedThisRound = 0;
      for (let i = 0; i < count; i++) {
        const button = closed.nth(i);
        const label = (await button.innerText().catch(() => '')).trim();
        // ▶ is closed, ▼ is open.
        if (!label.includes('\u25b6')) continue;
        await button.click({ timeout: 5_000 }).catch(() => {});
        clickedThisRound++;
        opened++;
        // ★ 여기서는 사람 흉내를 내지 않는다.
        //
        //   접힌 것이 이백 개 가까이라, 한 칸씩 사람처럼 열면 화면에는 *줄이 하나씩 색을 바꾸며
        //   내려가는* 몇 분짜리 장면이 남는다. 사람이 휠을 굴릴 때 그런 그림은 나오지 않으므로
        //   보는 쪽에서는 무슨 일인지 알 수 없다. 여는 것은 준비 과정이니 빨리 지나가고, 실제로
        //   보여줄 것은 그 다음의 편집이다. (2026-07-31)
        await this.page.waitForTimeout(12);
      }

      // Opening one level reveals the next, so go round again until a pass changes nothing.
      if (clickedThisRound === 0) break;
    }

    await this.page.waitForTimeout(400);
    return opened;
  }

  async setSpecInWorkflow(size: string): Promise<string> {
    // 스펙은 노드 그룹 아래에 있다.
    await this.openPathTo('body_params.targetInfra.nodeGroups[0]');
    await this.expandAllParams();

    // ★ Only the node's own spec counts, and it is found by its *path*.
    //
    //   This used to take the first field whose value looked like `provider+region+size`. What it
    //   found was `targetSpecList[0].id` - an entry in the candidate catalogue, which decides
    //   nothing. The machine's spec is `targetInfra.nodeGroups[].specId`, and that stayed as it
    //   was. The check then passed because it only asked whether the string appeared *somewhere*
    //   in the parameters, and it did: in the box this method had just typed it into.
    //
    //   So the search is by path now, and a miss is an error rather than a silent fallback onto
    //   something else that happens to match. (2026-07-31)
    const all = await this.readBodyFields();
    const found = all.find(
      f =>
        /nodeGroups/.test(f.path) &&
        /specId$/.test(f.path) &&
        // `aws+ap-northeast-2+t3a.medium` - three parts, the last one the size.
        /^[a-z0-9-]+\+[a-z0-9-]+\+\S+$/i.test(f.value),
    );

    if (found) {
      const field = this.bodyField(found.path);
      const value = found.value;
      {
        const parts = value.split('+');
        const oldSize = parts[parts.length - 1];
        if (oldSize === size) return value;

        await field.click();
        await field.press('End');
        for (let n = 0; n < oldSize.length; n++) {
          await field.press('Backspace');
          await this.page.waitForTimeout(26);
        }
        await field.pressSequentially(size, { delay: 55 });
        await this.page.waitForTimeout(500);

        const next = [...parts.slice(0, -1), size].join('+');
        await spotlight(this.page, field);
        return next;
      }
    }

    throw new Error(
      '워크플로우 편집기에 노드 스펙 칸(targetInfra.nodeGroups[].specId)이 없다.\n' +
        '편집기는 객체 배열 안의 객체 배열을 펼치지 않아 이 값을 그리지 않는다 — ' +
        '카탈로그(targetSpecList)의 비슷한 값을 대신 고치면 아무 일도 일어나지 않는다.',
    );
  }

  /**
   * Change a firewall port here, in the workflow.
   *
   * Same idea as the spec: the model decided one thing and the workflow says another, and what
   * comes out follows the workflow. The port sits in the request body under the security group's
   * rules, and the field identifiers follow that path.
   *
   * ★ The field is found by its *path*, not by its value. A bare `22` matches a dozen things in a
   *   migration body - counts, sizes, minutes - and retyping the wrong one changes something nobody
   *   is watching. The port fields are the ones whose path ends in a port, and the layers spell it
   *   differently (`dstPorts`, `Ports`, `Port`), so the path is matched loosely and the value
   *   exactly.
   *
   * @returns the port that was replaced
   */
  /**
   * Open a port by adding a firewall rule, rather than by rewriting one that is already there.
   *
   * ★ Adding is what the other two routes do - the target model and the source model each gain a
   *   rule - so this one adds too, and all three can be compared. Rewriting an existing rule was
   *   what this used to do, and it meant the workflow track was demonstrating something the others
   *   were not.
   *
   * The rule is copied field for field from the one that allows 22, because a rule needs protocol,
   * direction and CIDR as well as a port, and a blank field turns into an infrastructure that comes
   * up unreachable. Only the port differs.
   *
   * @returns the index the new rule was given
   */
  async addPortRuleInWorkflow(port: string): Promise<number> {
    // 규칙 배열이 있는 자리까지 경로를 따라 연다 — 전부 펼치면 화면이 클릭만 반복한다.
    await this.openPathTo(
      'body_params.targetSecurityGroupList[0].firewallRules',
    );

    /*
      The array cb-tumblebug actually builds the security group from.

      ★ Several arrays in this body have names that read the same. `targetK8sCluster.securityGroupIds`
        is not built here at all, and `targetSpecList[0].details` / `targetOsImageList[0].details`
        are the recommendation's own notes. A rule added to any of those changes nothing on the
        machine, and the run still succeeds - the take would show a port being typed and a machine
        without it.

        Confirmed against a machine that was built: a rule added here at `Ports` came back on the
        created security group. Note the name changes on the way - the model says `Ports`, the
        created resource says `Port`, so a check that reads the built group has to ask for both.
    */
    const rules = 'body_params.targetSecurityGroupList[0].firewallRules';
    const before = await this.page
      .locator(`[data-testid^="wf-field-${rules}["]`)
      .evaluateAll(els =>
        els
          .map(e => e.getAttribute('data-testid') ?? '')
          .map(id => Number(id.match(/firewallRules\[(\d+)\]/)?.[1] ?? -1)),
      );
    const nextIndex = before.length ? Math.max(...before) + 1 : 0;

    await humanClick(this.page.getByTestId(`wf-array-add-${rules}`));
    await this.expandAllParams();

    const field = (name: string) =>
      this.page.getByTestId(`wf-field-${rules}[${nextIndex}].${name}`);
    await expect(
      field('Ports'),
      `방화벽 규칙을 더했는데 ${nextIndex} 번 항목의 칸이 나타나지 않았다`,
    ).toBeVisible({ timeout: 15_000 });

    // Everything except the port matches the rule that already allows SSH.
    for (const [name, value] of [
      ['CIDR', '0.0.0.0/0'],
      ['Direction', 'inbound'],
      ['Protocol', 'tcp'],
      ['Ports', port],
    ] as const) {
      const input = field(name);
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click();
      await input.fill('');
      await input.pressSequentially(value, { delay: 40 });
      await this.page.waitForTimeout(200);
    }

    await spotlight(this.page, field('Ports'));
    return nextIndex;
  }

  async setPortInWorkflow(from: string, to: string): Promise<string> {
    await this.expandAllParams();

    // 여기서는 굴리지 않는다 — 편집 화면에 들어갈 때 한 번 굴린 것으로 충분하다.
    // 접힌 것을 편 뒤 곧바로 그 칸을 잡고, spotlight 가 그 자리로 화면을 옮겨 준다. (2026-08-19)

    const all = await this.readBodyFields();
    const found = all.find(
      f => /port/i.test(f.path) && f.value.trim() === from,
    );

    if (found) {
      const field = this.bodyField(found.path);
      const value = found.value.trim();

      await field.scrollIntoViewIfNeeded().catch(() => {});
      await field.click();
      await field.press('End');
      for (let n = 0; n < value.length; n++) {
        await field.press('Backspace');
        await this.page.waitForTimeout(26);
      }
      await field.pressSequentially(to, { delay: 60 });
      await this.page.waitForTimeout(500);

      await spotlight(this.page, field);
      return value;
    }

    throw new Error(
      `워크플로우 본문에서 ${from} 번 포트 필드를 찾지 못했다 — 방화벽 규칙이 본문에 실렸는지 확인한다`,
    );
  }

  /**
   * Say which availability zone the subnet should sit in.
   *
   * The recommendation leaves this blank, so the connection's default zone is used - and if that
   * zone has no capacity for the chosen machine type, every VM fails to create. The error names a
   * zone that does have capacity, and this is where that answer goes.
   *
   * The field is `targetVNet.subnetInfoList[].zone`; it is folded away by default like everything
   * else that deep, so the panel is opened first.
   *
   * @returns how many subnets were given the zone
   */
  async setSubnetZone(zone: string): Promise<number> {
    await this.expandAllParams();

    const fields = this.page.locator(
      '[data-testid^="wf-field-body_params."][data-testid*="subnetInfoList"][data-testid$="zone"]',
    );
    const count = await fields.count();
    if (count === 0) {
      throw new Error(
        '워크플로우 본문에 서브넷 존 칸(targetVNet.subnetInfoList[].zone)이 없다',
      );
    }

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      await field.scrollIntoViewIfNeeded().catch(() => {});
      await field.click();
      await field.pressSequentially(zone, { delay: 55 });
      await this.page.waitForTimeout(400);
      await spotlight(this.page, field);
    }
    return count;
  }

  /**
   * Copy the workflow on screen and open the copy for editing.
   *
   * ★ The console has no "save as". Editing a workflow that has already run is blocked outright -
   *   the editor shows a notice telling you to do exactly this - so the only way to keep the
   *   original and vary it is Clone & Edit, and the button only appears once there is run history.
   *
   * The backend names the copy `{original}_copy`; the caller renames it in the editor.
   */
  async cloneAndEdit(): Promise<void> {
    const button = this.page.getByTestId('workflow-clone-edit-btn');
    await expect(
      button,
      'Clone & Edit 버튼이 없다 — 실행 이력이 있는 워크플로우에서만 나타난다',
    ).toBeVisible({ timeout: 30_000 });
    await humanClick(button);

    const confirm = this.page.getByTestId('workflow-clone-confirm');
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    // Hold on the question for a beat - it says what is about to happen, and it is the answer to
    // "why is there suddenly a second workflow with almost the same name".
    await this.page.waitForTimeout(1_000);
    await humanClick(this.page.getByTestId('workflow-clone-confirm-ok'));

    await this.expectDesignerOpen();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3) Workflow run + state polling (History)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run the workflow already open in Run Status.
   *
   * ★ Saving a workflow leaves you *here*. `WorkflowsPage.handleSavedWorkflow` selects the new
   *   workflow and switches to the Run Status tab, so the thing to press is on screen the moment
   *   the editor closes. The recording used to leave for the list, search for the name, pick the
   *   row and come back - four steps to reach the screen it was already looking at.
   *
   * Waits for the viewer to report the workflow runnable rather than sitting out a fixed grace.
   */
  async runHere(): Promise<void> {
    await expect(this.page.getByTestId('workflow-run-viewer')).toBeVisible({
      timeout: 30_000,
    });

    const runButton = this.page
      .getByTestId('workflow-viewer-run-first-btn')
      .or(this.page.getByTestId('workflow-viewer-run-btn'))
      .first();
    await expect(runButton).toBeVisible({ timeout: 5 * 60_000 });
    await expect(runButton).toBeEnabled({ timeout: 5 * 60_000 });
    await humanClick(runButton);

    await expect(this.page.getByTestId('workflow-run-confirm')).toBeVisible({
      timeout: 15_000,
    });
    await humanClick(this.page.getByTestId('workflow-run-confirm-ok'));
    await expect(this.page.getByTestId('workflow-run-confirm')).toBeHidden({
      timeout: 15_000,
    });

    await this.revealWholeRunGraph();
  }

  /**
   * Run a workflow from Run Status - open the row, press Run there, confirm.
   *
   * ★ Not the list's Run button. Both start the same run, but they leave you in different places:
   *   the list button fires and leaves you looking at the list, so the run is already under way by
   *   the time anyone opens the detail. Pressing Run inside Run Status means the graph is already
   *   on screen when the tasks start turning, which is both what a person would do and the only way
   *   the progress is actually watchable.
   *
   * The button's testid depends on whether the workflow has run before: a first run offers only
   * "Run", a workflow with history offers "Start new run" beside re-run and clone. Either is taken.
   */
  async runWorkflow(name?: string): Promise<void> {
    if (!name) {
      await humanClick(this.page.getByTestId('workflow-run-btn'));
      return;
    }

    await this.selectWorkflow(name);

    // The buttons only render once the viewer knows the workflow is runnable ('ready').
    const runButton = this.page
      .getByTestId('workflow-viewer-run-first-btn')
      .or(this.page.getByTestId('workflow-viewer-run-btn'))
      .first();
    await expect(runButton).toBeVisible({ timeout: 60_000 });
    await expect(runButton).toBeEnabled({ timeout: 60_000 });
    await humanClick(runButton);

    await expect(this.page.getByTestId('workflow-run-confirm')).toBeVisible({
      timeout: 15_000,
    });
    await humanClick(this.page.getByTestId('workflow-run-confirm-ok'));
    await expect(this.page.getByTestId('workflow-run-confirm')).toBeHidden({
      timeout: 15_000,
    });

    await this.revealWholeRunGraph();
  }

  /**
   * Show that a value we set earlier is what this task will run with.
   *
   * ★ This is the point of the whole walkthrough: a port opened on the source model reaches the
   *   target model, the target model reaches the workflow, and the workflow is what builds the
   *   machine. Saying so is not the same as showing it - so we select the task, open its parameters
   *   and point at the value itself.
   *
   * The panel prints the task's saved parameters as key/value, so the value is searched for as text
   * within it rather than by a path into the JSON, which changes shape between task types.
   */
  async showParamValue(taskName: string, value: string): Promise<void> {
    await this.pickTask(taskName, false);

    const params = this.page.getByTestId('workflow-run-params');
    await expect(params).toBeVisible({ timeout: 15_000 });

    const hit = params
      .locator('.run-viewer__param-value', {
        hasText: value,
      })
      .first();
    await expect(
      hit,
      `워크플로우 파라미터에 "${value}" 가 없다 — 앞 단계에서 바꾼 값이 여기까지 오지 않았다`,
    ).toBeVisible({ timeout: 15_000 });

    // ★ 덩어리가 아니라 *그 값이 있는 줄*을 짚는다.
    //
    //   파라미터는 path·query·body 세 덩어리이고 각 덩어리가 JSON 통째로 한 <pre> 에 들어 있다.
    //   "값이 들어 있는 요소"를 두르면 요청 본문 전체를 두르게 되고, 화면에서는 아무것도 가리키지
    //   않은 채 스크롤만 하는 것으로 보인다. (2026-07-31)
    const pointed = await spotlightText(this.page, hit, value);
    if (!pointed) await spotlight(this.page, hit);

    /*
      여기서 다시 훑지 않는다.

      ★ 짚은 다음에도 패널을 끝까지 굴리고 있었다. 보는 쪽에서는 값을 찾은 뒤에도 화면이 계속
        내려가는 것으로 보여, 무엇을 확인한 것인지 흐려진다. 스크롤은 *편집 화면에 처음 들어갈 때
        한 번*만 하고(사람도 그렇게 한다), 그 뒤에는 고칠 자리·볼 자리로 곧장 간다. (2026-08-19)
    */
    await this.page.waitForTimeout(700);
  }

  /**
   * Scroll down through the parameter panel so the rest of the values are seen.
   *
   * Pointing at one value and stopping there leaves a viewer wondering what else is in the list.
   * The panel is what the workflow will run with, so it is worth reading to the end.
   */
  async scrollThroughParams(panel?: Locator): Promise<void> {
    const params = panel ?? this.page.getByTestId('workflow-run-params');
    if (!(await params.isVisible({ timeout: 5_000 }).catch(() => false)))
      return;

    // Which element actually scrolls.
    //
    // ★ This used to watch `window.scrollY`. The body does not move - the request body is long but
    //   it scrolls *inside its own box* - so the reading was 0 before and 0 after, the loop decided
    //   nothing had happened and stopped after a single notch.
    const scrollable = await params
      .evaluateHandle((el: Element) => {
        const find = (node: Element | null): Element | null => {
          while (node) {
            if (node.scrollHeight - node.clientHeight > 8) return node;
            const inner = Array.from(node.querySelectorAll('*')).find(
              c => c.scrollHeight - c.clientHeight > 8,
            );
            if (inner) return inner;
            node = node.parentElement;
          }
          return null;
        };
        return find(el);
      })
      .catch(() => null);

    const target = scrollable?.asElement() ?? null;
    if (!target) {
      // Everything already fits.
      await this.page.waitForTimeout(600);
      return;
    }

    // ★ Put the pointer *on the thing that moves*.
    //
    //   The pointer used to be parked over the middle of the panel while the list underneath
    //   scrolled - on the recording the content slides on its own with the cursor sitting
    //   somewhere else entirely, which reads as the screen moving by itself rather than as
    //   someone scrolling it. The wheel also only turns what is under the pointer, so aiming at
    //   the scrolling element is what makes the wheel work at all. (2026-07-31)
    const box = await target.boundingBox().catch(() => null);
    if (box) {
      await this.page.mouse.move(
        box.x + box.width / 2,
        box.y + Math.min(box.height / 2, 260),
      );
      await this.page.waitForTimeout(250);
    }

    const progress = () =>
      target
        .evaluate((el: Element) => ({
          top: el.scrollTop,
          max: el.scrollHeight - el.clientHeight,
        }))
        .catch(() => null);

    const start = await progress();
    if (!start || start.max <= 8) {
      await this.page.waitForTimeout(600);
      return;
    }

    // ★ 끝까지 내려가지 않는다.
    //
    //   화면이 움직인다는 것만 보이면 된다. 끝까지 훑으면 찾는 시간이 그대로 영상에 남는데, 사람이
    //   실제로 하는 일은 한두 번 굴려 보고 필요한 자리로 바로 가는 것이다. 나머지는 편집으로 잘린
    //   것처럼 보이면 되므로, 몇 칸만 굴리고 멈춘다. (2026-07-31)
    const notches = Number(process.env.E2E_PARAM_SCROLL_NOTCHES || 6);

    let previous = -1;
    for (let i = 0; i < notches; i++) {
      const at = await progress();
      if (!at) break;
      if (at.top >= at.max - 4) break;
      if (at.top === previous) {
        // The wheel is not reaching it - drive the element itself. The pointer is already on it,
        // so what moves and what is being pointed at still agree.
        await target
          .evaluate((el: Element) => {
            el.scrollTop += 200;
          })
          .catch(() => {});
      } else {
        await this.page.mouse.wheel(0, 200);
      }
      previous = at.top;
      await this.page.waitForTimeout(180);
    }

    await this.page.waitForTimeout(500);
  }

  /** A task node in the run graph, by its name. */
  taskNode(name: string): Locator {
    return this.page
      .getByTestId('workflow-run-node')
      .filter({ hasText: name })
      .first();
  }

  /**
   * Select a task in the run graph and point at it.
   *
   * The graph is what the re-run controls act on - which task is selected decides what they will
   * do - so the selection is worth showing rather than just performing.
   */
  async pickTask(name: string, highlight = true): Promise<void> {
    const node = this.taskNode(name);
    await node.scrollIntoViewIfNeeded().catch(() => {});
    if (highlight) await spotlight(this.page, node);
    await humanClick(node);
    await expect(this.page.getByTestId('workflow-run-task-detail')).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  }

  /**
   * Re-run from the selected task, at the given scope, and confirm.
   *
   * `only` runs that task again on its own; `after` runs it and everything that depends on it. The
   * screen shows which tasks it would run before doing anything, which is the part worth seeing -
   * so the list is left up for a moment before confirming.
   */
  async rerunFromSelected(scope: 'only' | 'after'): Promise<void> {
    const button = this.page.locator(
      `[data-testid="workflow-rerun-scope"][data-scope="${scope}"]`,
    );

    // ★ 누르기 전에 그 버튼 위에서 잠깐 멈춘다.
    //
    //   작업을 고르자마자 확인 창이 떠 버리면, 보는 사람은 *무엇을 눌러서* 그 창이 떴는지 알 수
    //   없다. 커서가 버튼에 닿고 한 박자 쉬었다 눌러야 누른 것이 보인다. (2026-07-31)
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await humanClick(button, { pauseBeforeMs: 700 });

    const confirm = this.page.getByTestId('workflow-rerun-confirm');
    await expect(confirm).toBeVisible({ timeout: 20_000 });
    await spotlight(
      this.page,
      this.page.getByTestId('workflow-rerun-target').first(),
    );
    await humanClick(this.page.getByTestId('workflow-rerun-ok'));
    await expect(confirm).toBeHidden({ timeout: 20_000 });
  }

  /** The "Re-run failed tasks" button above the graph - everything that failed in this run. */
  async rerunAllFailed(): Promise<void> {
    const button = this.page.getByTestId('workflow-rerun-failed-btn');
    await expect(button).toBeVisible({ timeout: 20_000 });
    await expect(button).toBeEnabled({ timeout: 20_000 });
    await spotlight(this.page, button);
    // 같은 이유로 한 박자 두고 누른다 — 확인 창이 곧바로 뜨므로.
    await humanClick(button, { pauseBeforeMs: 700 });

    const confirm = this.page.getByTestId('workflow-rerun-confirm');
    if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await humanClick(this.page.getByTestId('workflow-rerun-ok'));
      await expect(confirm).toBeHidden({ timeout: 20_000 });
    }
  }

  /** Wait until the run is not running any more, and answer with what it ended as. */
  async waitForRunSettled(timeoutMs = 8 * 60_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let state = '';
    while (Date.now() < deadline) {
      state = (await this.latestRunStateText()).trim().toLowerCase();
      if (/success|failed/.test(state)) return state;
      await this.revealWholeRunGraph().catch(() => {});
      await this.page.waitForTimeout(3_000);
    }
    return state;
  }

  /**
   * Spend the wait looking at the run instead of staring at it.
   *
   * A migration takes minutes, and the recording used to hold still for all of them. But the run is
   * doing something the whole time - tasks turn green one after another - and the viewer will show
   * what each one produced: its state, its result, its log. So while we wait, we walk the tasks
   * that have finished, open the newest one, and open its log if there is one.
   *
   * Nothing here decides anything. It reads, and if a piece is not there it moves on - the point is
   * to show the screen working, not to assert on it. Judgement happens in the steps.
   */
  async browseRunWhileWaiting(withLog = false): Promise<void> {
    const nodes = this.page.getByTestId('workflow-run-node');
    const count = await nodes.count().catch(() => 0);
    if (count === 0) return;

    // The most recently finished task - the one a person would look at.
    let target = -1;
    for (let i = count - 1; i >= 0; i--) {
      const text =
        (await nodes
          .nth(i)
          .innerText()
          .catch(() => '')) || '';
      if (/success|running|failed/i.test(text)) {
        target = i;
        break;
      }
    }
    if (target < 0) return;

    await humanClick(nodes.nth(target)).catch(() => {});

    const detail = this.page.getByTestId('workflow-run-task-detail');
    if (!(await detail.isVisible({ timeout: 5_000 }).catch(() => false)))
      return;
    await this.page.waitForTimeout(1_200);

    if (withLog) await this.openTaskLog();
  }

  /**
   * Open what the software migration task produced, from the task itself.
   *
   * ★ The run viewer puts a Result section on the task detail, and for a software migration that is
   *   a button onto the installed list. Judging the install by an API call is what keeps the test
   *   honest, but it happens where nobody can see it - on the recording the migration simply ends
   *   and the next thing starts. This is the screen a person would open to answer the same question.
   *
   * @param taskName the task in the run graph that did the installing
   */
  async showInstalledSoftware(taskName: string): Promise<number> {
    await this.pickTask(taskName, false);

    const button = this.page.getByTestId('workflow-run-result-sw-btn');
    await expect(
      button,
      '설치 결과 버튼이 없다 — 소프트웨어 마이그레이션 작업에 실행 ID가 붙지 않았다',
    ).toBeVisible({ timeout: 30_000 });
    await spotlight(this.page, button);
    await humanClick(button);

    const overlay = this.page.getByTestId('sw-migration-overlay');
    await expect(overlay).toBeVisible({ timeout: 30_000 });

    const table = this.page.getByTestId('sw-migration-table');
    await expect(table).toBeVisible({ timeout: 30_000 });

    // Read down the list. This is the answer to "did it actually install", and one screenful of it
    // is not the whole answer.
    await this.page.waitForTimeout(1_200);
    await this.scrollThroughParams(table);

    const rows = await table
      .locator('tbody tr')
      .count()
      .catch(() => 0);

    // ★ Close it before leaving.
    //
    //   This is a full-screen overlay. Left open it covers the top bar, and the next step - reading
    //   the notice that says the job finished - waits fifteen seconds for a bell it can see but
    //   cannot reach. Nothing reports "an overlay is in the way"; the click simply never becomes
    //   possible, and the timeout names the bell rather than what is covering it. Same shape as the
    //   model editor. (2026-07-31)
    const back = overlay.locator('.page-top button').first();
    if (await back.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await humanClick(back);
      await expect(overlay).toBeHidden({ timeout: 15_000 });
    }

    return rows;
  }

  /**
   * Open the selected task's log and expand it.
   *
   * ★ Shown once, not on every run. It is the same three clicks whichever workflow you are looking
   *   at, and repeating it in all four tracks is four minutes of a viewer watching something they
   *   have already understood. The caller decides which run gets it.
   */
  async openTaskLog(): Promise<void> {
    // `Try 1` is the first attempt; a task that never ran has no log to open.
    const tryButton = this.page.getByTestId('workflow-run-log-try').first();
    if (!(await tryButton.isVisible({ timeout: 5_000 }).catch(() => false)))
      return;

    await spotlight(this.page, tryButton).catch(() => {});
    await humanClick(tryButton).catch(() => {});
    await this.page.waitForTimeout(1_500);

    // "Full log" is a details element - open it so the log is actually on screen.
    const full = this.page.locator('.run-viewer__log-details summary').first();
    if (await full.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await humanClick(full).catch(() => {});
      await this.page.waitForTimeout(1_200);
    }

    // Read down it. The log is why the panel was opened, and one screenful is where the
    // interesting part usually is not.
    const log = this.page.getByTestId('workflow-run-log').first();
    if (await log.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.scrollThroughParams(log);
    }
  }

  /**
   * Scroll down until the whole run graph is on screen.
   *
   * The graph sits below the run header, so at the top of the page only its first tasks show and
   * the tasks that run later are off the bottom - the part worth watching is the part you cannot
   * see. Scrolled with the wheel, a notch at a time, because that is how it is done by hand and
   * because the graph is still laying itself out while the run starts.
   */
  async revealWholeRunGraph(): Promise<void> {
    const graph = this.page.getByTestId('workflow-run-graph');
    if (!(await graph.isVisible({ timeout: 30_000 }).catch(() => false)))
      return;

    // The wheel turns whatever is under the pointer, and the pointer was last on the confirmation
    // button. Put it on the graph first, or the notches go to something that does not scroll.
    const box = await graph.boundingBox();
    if (box) {
      await this.page.mouse.move(
        box.x + box.width / 2,
        box.y + Math.min(box.height / 2, 200),
      );
    }

    const lastNode = this.page.getByTestId('workflow-run-node').last();
    const bottomOf = () =>
      lastNode
        .evaluate((el: Element) => el.getBoundingClientRect().bottom)
        .catch(() => 0);

    let previous = await bottomOf();
    for (let i = 0; i < 12; i++) {
      const visible = await lastNode
        .evaluate((el: Element) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.bottom <= window.innerHeight;
        })
        .catch(() => false);
      if (visible) return;

      await this.page.mouse.wheel(0, 260);
      await this.page.waitForTimeout(200);

      const now = await bottomOf();
      // Nothing moved twice running - the view is as far down as it goes, and turning the wheel
      // at a wall for another ten notches only makes the recording sit still.
      if (Math.abs(now - previous) < 2 && i > 0) return;
      previous = now;
    }
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
    await humanClick(this.page.getByRole('tab', { name: /History/i }));
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
    // Just watch. Run Status refreshes itself every three seconds ("Auto-refreshing · 3s",
    // workflowRunViewerModel's useIntervalFn), so reloading the page to see the state change is
    // both unnecessary and destructive: each reload throws the screen away and redraws it, which is
    // the white flash that runs through the recording, and it lands back on the default tab.
    let state = '';
    while (Date.now() < deadline) {
      state = (await this.latestRunStateText()).trim().toLowerCase();
      if (terminal.test(state)) return state;
      // Each redraw returns the page to the top; put the graph back where it can be seen.
      await this.revealWholeRunGraph().catch(() => {});
      await this.page.waitForTimeout(3_000);
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
      // Same reason as pollLatestRunState - the viewer keeps itself current.
      await this.page.waitForTimeout(3_000);
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
    await humanClick(this.viewSwButton);
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
    await openScreen(
      this.page,
      'workflowtemplates',
      WorkflowPage.templatesPath,
    );
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
    await openScreen(
      this.page,
      'taskcomponents',
      WorkflowPage.taskComponentsPath,
    );
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
    await humanClick(this.rowByText(name));
    const link = this.page.getByTestId('workflow-json-view').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    // Scroll it into view and press it. It used to be opened with a DOM-level click because the
    // detail panel can sit outside the viewport - but that skips the pointer entirely, and a
    // recording then shows the screen operating itself. Bringing it into view is what a person does.
    await link.scrollIntoViewIfNeeded();
    await humanClick(link);
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
