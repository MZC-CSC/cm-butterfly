import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';
import { workflowData } from '../fixtures/test-data';
import { humanClick, humanFill } from '../support/humanize';
import { spotlight } from '../support/spotlight';
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
  async openRunViewer(workflowName: string): Promise<void> {
    // Already looking at it? Then stop.
    //
    // ★ After running a workflow we are on its Run Status, and this went back to the list, found the
    //   row again, clicked it and re-opened the tab - on screen it reads as running the thing a
    //   second time. If the viewer is up and the selected row is this workflow, there is nothing
    //   to open.
    const viewer = this.page.getByTestId('workflow-run-viewer');
    if (await viewer.isVisible({ timeout: 1_000 }).catch(() => false)) {
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
  async selectTaskInDesigner(taskComponentName: string): Promise<void> {
    await expect(this.designer).toBeVisible({ timeout: 20_000 });
    await humanClick(
      this.designer
        .locator(`.sqd-step-task.sqd-type-${taskComponentName}`)
        .first(),
    );
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
        await this.page.waitForTimeout(80);
      }

      // Opening one level reveals the next, so go round again until a pass changes nothing.
      if (clickedThisRound === 0) break;
    }

    await this.page.waitForTimeout(400);
    return opened;
  }

  async setSpecInWorkflow(size: string): Promise<string> {
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
    const fields = this.page.locator(
      '[data-testid^="wf-field-body_params."][data-testid*="nodeGroups"][data-testid$="specId"]',
    );
    const count = await fields.count();

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      const value = await field.inputValue().catch(() => '');
      // `aws+ap-northeast-2+t3a.medium` - three parts, the last one the size.
      if (!/^[a-z0-9-]+\+[a-z0-9-]+\+\S+$/i.test(value)) continue;

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
  async setPortInWorkflow(from: string, to: string): Promise<string> {
    await this.expandAllParams();

    const fields = this.page.locator('[data-testid^="wf-field-body_params."]');
    const count = await fields.count();

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      const path = (await field.getAttribute('data-testid')) ?? '';
      if (!/port/i.test(path)) continue;

      const value = (await field.inputValue().catch(() => '')).trim();
      if (value !== from) continue;

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

    await spotlight(this.page, hit);
    await this.scrollThroughParams(params);
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

    const box = await params.boundingBox().catch(() => null);
    if (!box) return;

    await this.page.mouse.move(
      box.x + box.width / 2,
      box.y + Math.min(box.height / 2, 240),
    );

    // Which element actually scrolls, and how far is left.
    //
    // ★ This used to watch `window.scrollY`. The body does not move - the request body is long but
    //   it scrolls *inside its own box* - so the reading was 0 before and 0 after, the loop decided
    //   nothing had happened and stopped after a single notch. On screen the panel opened, twitched
    //   once and sat there for the rest of the run, with the spec and the ports below the fold the
    //   whole time. Watching the panel's own scrollTop is what makes the wheel measurable.
    const progress = () =>
      params
        .evaluate((el: Element) => {
          const scrollable = (node: Element | null): Element | null => {
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
          const target = scrollable(el);
          if (!target) return null;
          return {
            top: target.scrollTop,
            max: target.scrollHeight - target.clientHeight,
          };
        })
        .catch(() => null);

    const start = await progress();
    if (!start || start.max <= 8) {
      // Nothing to scroll - everything already fits.
      await this.page.waitForTimeout(800);
      return;
    }

    let previous = -1;
    for (let i = 0; i < 40; i++) {
      const at = await progress();
      if (!at) break;
      if (at.top >= at.max - 4) break;
      if (at.top === previous) {
        // The wheel is not reaching it - drive the element itself rather than give up.
        await params
          .evaluate((el: Element) => {
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
            const target = find(el);
            if (target) target.scrollTop += 200;
          })
          .catch(() => {});
      } else {
        await this.page.mouse.wheel(0, 200);
      }
      previous = at.top;
      // Slow enough to read on the way down.
      await this.page.waitForTimeout(500);
    }

    // Rest at the bottom. The spec and the ports are down here, and stopping mid-scroll reads as
    // the screen having got stuck.
    await this.page.waitForTimeout(1_200);
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
    await humanClick(
      this.page.locator(
        `[data-testid="workflow-rerun-scope"][data-scope="${scope}"]`,
      ),
    );

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
    await humanClick(button);

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

    return table
      .locator('tbody tr')
      .count()
      .catch(() => 0);
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
