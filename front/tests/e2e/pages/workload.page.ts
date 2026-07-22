import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';

/**
 * WorkloadPage — Page Object for the workload operations screen (infra MCI + node VM + load test).
 *
 * ★ The scenarios (.feature) only carry the *intent*, such as "look up the infra / run a load test",
 *   while the screen location (URL) and elements (selectors) are gathered in this single file.
 *   → When the screen changes, only this file is edited and the Korean scenarios stay as they are.
 *
 * ★ Currency update (feat-bf-deps-001):
 *   - MCI (infra) lookup goes through cm-beetle — list operationId `ListInfra`, detail `cm-beetle/GetInfra`.
 *   - Deletion is `DeleteInfra`. The identifier keys are `infraId`/`nodeId` (not the old mciId/vmId).
 *   - Load testing is cm-ant — `Runloadtest`, `Getlastloadtestexecutionstate`,
 *     `Getlastloadtestresult`, `Getlastloadtestmetrics`, scenario catalog `*LoadTestScenarioCatalog*`.
 *
 * Prefer data-testid, and where it is not yet assigned (BAR-880) fall back to the actual .vue markup (placeholder/role/text).
 */
export class WorkloadPage {
  /** ★ Screen location (URL) — routing: /main → workload-operations → workloads → mci-wls|pmk-wls */
  static readonly mciPath = '/main/workload-operations/workloads/mci-wls';
  static readonly pmkPath = '/main/workload-operations/workloads/pmk-wls';

  constructor(private readonly page: Page) {}

  // ─────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────

  /** Navigate to the infra (MCI) workload screen */
  async gotoMci(): Promise<void> {
    await this.page.goto(WorkloadPage.mciPath);
    await expect(this.mciTable).toBeVisible({ timeout: 15_000 });
  }

  /** Navigate to the PMK (Kubernetes) workload screen */
  async gotoPmk(): Promise<void> {
    await this.page.goto(WorkloadPage.pmkPath);
  }

  // ─────────────────────────────────────────────────────────────
  // MCI (infra) list — ListInfra (via cm-beetle)
  // ─────────────────────────────────────────────────────────────

  /** Infra list table (p-toolbox-table) */
  private get mciTable(): Locator {
    return this.page.getByTestId('mci-list-table');
  }

  /** Target an infra row by name — a single ARIA row (an .or() chain matches the same row with multiple locators, causing duplicates → strict violation). */
  mciRow(infraName: string): Locator {
    return this.page.getByRole('row', { name: infraName });
  }

  /** List loading complete (spinner gone, table shown) */
  async expectMciListLoaded(): Promise<void> {
    await expect(this.mciTable).toBeVisible({ timeout: 20_000 });
  }

  /** Verify a given infra appears in the list. Workflow run → DAG → cm-beetle migration
   *  takes time to create the MCI in tumblebug, and since the list does not auto-refetch,
   *  an MCI created after the list loads will not show up just by waiting. Periodically
   *  refresh the page and keep checking until the row appears (up to ~10 min for provisioning delay). */
  async expectMciVisible(infraName: string): Promise<void> {
    const deadline = Date.now() + 600_000;
    for (;;) {
      if (
        await this.mciRow(infraName)
          .isVisible()
          .catch(() => false)
      )
        return;
      if (Date.now() > deadline) break;
      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.expectMciListLoaded().catch(() => {});
      await this.page.waitForTimeout(10_000);
    }
    await expect(this.mciRow(infraName)).toBeVisible({ timeout: 20_000 });
  }

  /** Select an infra row (checkbox) — selecting it enables the detail/server tabs. Limited to the single checkbox in the row. */
  async selectMci(infraName: string): Promise<void> {
    await this.mciRow(infraName)
      .locator('td.select-checkbox .p-checkbox, input[type="checkbox"]')
      .first()
      .click();
  }

  // ─────────────────────────────────────────────────────────────
  // MCI detail — cm-beetle/GetInfra
  // ─────────────────────────────────────────────────────────────

  private get detailTab(): Locator {
    return this.page
      .getByTestId('mci-tab-detail')
      .or(this.page.getByRole('tab', { name: /detail/i }));
  }
  private get serverTab(): Locator {
    return this.page
      .getByTestId('mci-tab-server')
      .or(this.page.getByRole('tab', { name: /server/i }));
  }
  private get mciDetailTable(): Locator {
    return this.page.getByTestId('mci-detail-table');
  }

  /** Open the detail tab and verify the detail info table */
  async openDetailTab(): Promise<void> {
    await this.detailTab.click();
    await expect(this.mciDetailTable).toBeVisible({ timeout: 15_000 });
  }

  /** Open the server (node) tab */
  async openServerTab(): Promise<void> {
    await this.serverTab.click();
  }

  // ─────────────────────────────────────────────────────────────
  // Node (VM) list — keyed by nodeId from the MCI detail response
  // ─────────────────────────────────────────────────────────────

  /** Node (VM) card (p-select-card, card text = node name) */
  nodeCard(nodeName: string): Locator {
    return this.page
      .getByTestId(`vm-card-${nodeName}`)
      .or(this.page.locator('.vmList-card', { hasText: nodeName }));
  }

  /** A node card in the server list (any name) — nodes created by migration have generated names (vm-...), so the name is unknown. */
  private get anyNodeCard(): Locator {
    return this.page.locator('.vmList-card');
  }

  /**
   * Verify a node appears in the server list. Since cm-beetle/tumblebug generates the
   * migration-created node name (vm-...), it cannot be known in advance, so if the card
   * with the given name is not present we verify by "a node card exists".
   */
  async expectNodeVisible(nodeName: string): Promise<void> {
    await expect(
      this.nodeCard(nodeName).or(this.anyNodeCard).first(),
    ).toBeVisible({
      timeout: 20_000,
    });
  }

  /** Select a node (click the card). If the card with the given name is absent, select the first node card. */
  async selectNode(nodeName: string): Promise<void> {
    await this.nodeCard(nodeName).or(this.anyNodeCard).first().click();
  }

  // ─────────────────────────────────────────────────────────────
  // Deletion — DeleteInfra (@costly / destructive)
  // ─────────────────────────────────────────────────────────────

  private get actionDropdown(): Locator {
    return this.page.getByTestId('mci-action-dropdown');
  }
  /**
   * The Delete item in the action dropdown.
   *
   * mirinae PSelectDropdown renders the menu as `.p-context-menu-item` spans but **does not add a role attribute.**
   * So getByRole('menuitem') does not match it, and searching the whole page for the 'Delete' text catches
   * several nested spans, causing a strict-mode violation.
   *
   * So we *narrow the scope to the dropdown that has the testid* and grab it by the design system's item class.
   * (The 'Delete' label comes from our own actionMenus array, so it is independent of on-screen wording changes.)
   */
  private get deleteMenuItem(): Locator {
    return this.actionDropdown
      .locator('.p-context-menu-item')
      .filter({ hasText: 'Delete' })
      .first();
  }
  private get deleteModal(): Locator {
    return this.page.getByTestId('mci-delete-modal');
  }
  private get deleteConfirmInput(): Locator {
    return this.deleteModal
      .locator(
        'input[data-testid="mci-delete-confirm-keyword"], textarea[data-testid="mci-delete-confirm-keyword"]',
      )
      .or(this.deleteModal.getByRole('textbox'))
      .or(this.deleteModal.locator('input').last());
  }
  /**
   * The confirm (Delete) button of the delete modal.
   *
   * With BAR-1444 the modal became a 3-stage async flow (confirm/progress/error) and renders its footer as a custom slot.
   * Each button carries a testid, so we grab it by that (the previous default `.confirm-button` button no longer exists).
   */
  private get deleteConfirmButton(): Locator {
    return this.page.getByTestId('wl-delete-confirm');
  }
  /** The close button of the progress/error stages. */
  private get deleteCloseButton(): Locator {
    return this.page.getByTestId('wl-delete-close');
  }
  /** The retry button of the error stage (returns to the selection screen). */
  private get deleteRetryButton(): Locator {
    return this.page.getByTestId('wl-delete-retry');
  }
  /** The force-delete button of the error stage. */
  private get deleteForceEnterButton(): Locator {
    return this.page.getByTestId('wl-delete-force-enter');
  }
  /** The progress-stage container (deletion in progress). */
  private get deleteProgress(): Locator {
    return this.page.getByTestId('mci-delete-progress');
  }
  /** The error-stage container (a prior deletion failed). */
  private get deleteErrorDialog(): Locator {
    return this.page.getByTestId('mci-delete-error');
  }
  /** The delete-status cell of a list row (in progress/error). */
  private mciRowDeleteStatus(): Locator {
    return this.page.getByTestId('wl-row-delete-status');
  }

  /**
   * Open the delete modal via action dropdown → Delete.
   *
   * Whether the modal opened is judged by an *actually visible element* (the confirm-keyword input).
   * The `mci-delete-modal` testid is on the PButtonModal wrapper, so it is not caught as a visible element
   * (this is the same trap already hit with the load-config modal and the model save form, so we handle it the same way).
   */
  async openDeleteModal(): Promise<void> {
    await this.actionDropdown.click();
    await this.deleteMenuItem.click();
    await expect(this.deleteConfirmInput.first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * Confirm deletion — after choosing the deletion method (normal/force), type the infra name as the confirm keyword and confirm.
   * (For a single selection, the confirm keyword = the infra name.)
   */
  async confirmDelete(
    infraName: string,
    method: 'normal' | 'force' = 'normal',
  ): Promise<void> {
    if (method === 'force') {
      const forceRadio = this.deleteModal.getByTestId(
        'mci-delete-method-force',
      );
      await forceRadio.click();
    }
    await this.deleteConfirmInput.first().fill(infraName);
    await this.deleteConfirmButton.first().click();
  }

  /**
   * Verify that the delete modal closes on its own.
   *
   * ★ This observes the *screen behavior*, which is separate from whether the resource was actually deleted.
   *   After the confirm button is pressed, the delete modal holds one request synchronously and waits. Deleting
   *   an infra actually removes cloud resources, which takes several minutes, and the modal stays open the whole time.
   *   On failure it does not close the modal either.
   *
   *   A failure here **is a screen defect, not a wrong test.** We do not soften the assertion; we surface it as is.
   *   Whether the resource was actually deleted is checked separately by expectInfraGone() below — even if the screen
   *   does not close, the resource may have been removed.
   *
   * @returns true if it closed. false if it never closed (the caller records it as a defect).
   */
  async deleteModalClosed(timeoutMs = 3 * 60_000): Promise<boolean> {
    return this.deleteConfirmInput
      .first()
      .isHidden({ timeout: timeoutMs })
      .catch(() => false);
  }

  // ── BAR-1444 async delete flow ──────────────────────────────────────────────

  /** After pressing delete, whether the modal switched to "deletion in progress" (progress). */
  async expectDeleteInProgress(): Promise<void> {
    await expect(this.deleteProgress).toBeVisible({ timeout: 15_000 });
  }

  /** [Close] on the progress/error stage. Return to the list and look at the delete-status column. */
  async closeDeleteModal(): Promise<void> {
    await this.deleteCloseButton.click();
  }

  /** Whether the given text (in progress/error) is shown in the delete-status cell of a list row. */
  async expectRowDeleteStatus(text: '진행 중' | '에러'): Promise<void> {
    await expect(
      this.mciRowDeleteStatus().filter({ hasText: text }).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Whether it opened at the error stage (a prior deletion failed). */
  async expectDeleteErrorDialog(): Promise<void> {
    await expect(this.deleteErrorDialog).toBeVisible({ timeout: 15_000 });
  }

  /** [Retry] on the error stage — returns to the selection screen. */
  async retryDelete(): Promise<void> {
    await this.deleteRetryButton.click();
    await expect(this.deleteConfirmInput.first()).toBeVisible({
      timeout: 10_000,
    });
  }

  /** [Force delete] on the error stage. */
  async forceDeleteFromError(): Promise<void> {
    await this.deleteForceEnterButton.click();
  }

  /**
   * Whether the modal is blocking the background — judged by *whether it can actually be clicked*.
   *
   * You cannot tell from element visibility alone. Even when a modal overlay is covering it, the background
   * element remains in the DOM and is "visible". You have to attempt a click and see whether it is blocked.
   */
  async expectBackgroundBlocked(): Promise<void> {
    const menuItem = this.page
      .getByRole('link', { name: /source services/i })
      .or(this.page.getByText('Source Services', { exact: true }))
      .first();
    const clickable = await menuItem
      .click({ trial: true, timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    expect(
      clickable,
      'The modal is open but the background menu is clickable — the modal is failing to block the background.',
    ).toBeFalsy();
  }

  /**
   * Whether the screen is operable — i.e. no leftover overlay is swallowing clicks.
   *
   * ★ The real risk is when the modal is gone but only the overlay remains. The screen looks fine but nothing
   *   is clickable, so the user perceives it as frozen. This is caught neither by eye nor by element existence,
   *   so we actually click an operable element in the list.
   */
  async expectScreenInteractive(): Promise<void> {
    await expect(this.mciTable).toBeVisible({ timeout: 15_000 });
    const clickable = await this.actionDropdown
      .click({ trial: true, timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    expect(
      clickable,
      'The list is visible but interaction is blocked — a leftover overlay has locked the screen.',
    ).toBeTruthy();
  }

  /**
   * Open the modal via action dropdown → Delete, but do not wait for the confirm input.
   * That is because if the target is already being deleted, the modal opens straight into the progress stage rather than confirm.
   */
  async triggerDeleteMenu(): Promise<void> {
    await this.actionDropdown.click();
    // ★ If the selection has been cleared, Delete is disabled, so pressing it does not open the modal.
    //   Proceeding as-is would misdiagnose "the modal does not appear" as a product defect, so we cut it off here.
    //   (mirinae expresses disabled only via class, so it is not caught by isEnabled() — DESIGN-MIRINAE §1.6)
    const disabled = await this.deleteMenuItem
      .first()
      .evaluate(
        el =>
          !!el.closest(
            '[class*="disabled"], [disabled], [aria-disabled="true"]',
          ),
      )
      .catch(() => false);
    expect(
      disabled,
      'Action > Delete is disabled — the row selection has been cleared (you must select again first).',
    ).toBeFalsy();
    await this.deleteMenuItem.click();
  }

  /**
   * Select the row again and open the delete menu.
   *
   * Closing the modal re-renders the list and **clears the selection.** So when attempting deletion a second time —
   * such as "try to delete an in-progress target again" — you must select again first.
   */
  async reselectAndTriggerDelete(infraName: string): Promise<void> {
    await this.selectMci(infraName);
    await this.page.waitForTimeout(500);
    await this.triggerDeleteMenu();
  }

  /**
   * "Already in progress" — trying to delete a target whose deletion is in progress does not start a new modal;
   * it opens at the progress stage and shows an informational banner.
   */
  async expectDeleteAlreadyInProgress(): Promise<void> {
    await expect(this.deleteProgress).toBeVisible({ timeout: 15_000 });
    await expect(
      this.page.getByText('이미 처리 중인 삭제가 있습니다').first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Revisit the list to verify the infra *actually* disappeared.
   * The list does not auto-refresh, so we refresh and look. This is the real result of the deletion.
   *
   * ★ Always scan *every page*. The list is chunked at 15 rows, so judging "it's gone" from page 1 alone
   *   misjudges an infra that is alive on a later page as deleted. That has actually passed before, and EC2
   *   instances kept running the whole time. A delete confirmation must mean *the resource is truly gone*.
   */
  async expectInfraGone(
    infraName: string,
    timeoutMs = 12 * 60_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      await this.gotoMci().catch(() => {});
      await this.expectMciListLoaded().catch(() => {});
      const pager = new TablePagination(this.page, this.mciTable);
      if (await pager.isRowAbsent(this.mciRow(infraName))) return;
      expect(
        Date.now() < deadline,
        `The "${infraName}" infra was never deleted (it is still in the list).`,
      ).toBeTruthy();
      await this.page.waitForTimeout(20_000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Load test — Evaluate Perf tab of the node detail + Load Config modal (@costly)
  // ─────────────────────────────────────────────────────────────

  private get evaluatePerfTab(): Locator {
    return this.page
      .getByTestId('vm-tab-evaluatePerf')
      .or(this.page.getByRole('button', { name: /evaluate perf/i }));
  }
  private get loadConfigButton(): Locator {
    // Prefer the "Load Config" button (text button) on the node detail's default tab (Information); the Evaluate Perf tab button (testid) is also allowed.
    return this.page
      .getByRole('button', { name: /load config/i })
      .or(this.page.getByTestId('vm-load-config-open'))
      .first();
  }
  private get loadConfigModal(): Locator {
    return this.page.getByTestId('load-config-modal');
  }
  private get scenarioTemplatesButton(): Locator {
    return this.page.getByTestId('vm-scenario-templates-open');
  }

  /** Open the Evaluate Perf (load test) tab from the node detail */
  async openEvaluatePerfTab(): Promise<void> {
    await this.evaluatePerfTab.click();
  }

  /** The confirm (Confirm/Run) button of the load-config modal — PButtonModal's default confirm button (.confirm-button) */
  private get loadConfigConfirmButton(): Locator {
    return this.page.locator('.p-button-modal .confirm-button');
  }

  /** Open the Load Config modal. The PButtonModal wrapper testid is not caught as a visible element, so verify via the first input field. */
  async openLoadConfig(): Promise<void> {
    await this.loadConfigButton.click();
    await expect(
      this.page.locator(
        'input[data-testid="load-config-scenario-name"], textarea[data-testid="load-config-scenario-name"]',
      ),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Enter the load settings — to protect against cost, only fill light values (vu/duration, etc.) */
  async fillLoadConfig(cfg: {
    scenarioName: string;
    targetHost: string;
    port: string;
    path: string;
    virtualUsers: string;
    duration: string;
    rampUpTime: string;
    rampUpSteps: string;
  }): Promise<void> {
    const m = this.loadConfigModal;

    // ★ Use only testid — no placeholder fallback.
    //   We used to add a fallback like `.or(getByPlaceholder('Time'))`, but 'Time' matched both the "Time" and
    //   "Test Run Time" inputs, dying with a strict-mode violation. On-screen wording can change at any time, so
    //   we do not rely on it. All the needed testids are already assigned in the screen source.
    const field = (testid: string): Locator =>
      m.locator(
        `input[data-testid="${testid}"], textarea[data-testid="${testid}"]`,
      );

    await field('load-config-scenario-name').fill(cfg.scenarioName);

    // The target host is auto-filled with the selected node's IP. If an auto value is present we do not overwrite it,
    // and only fill it as a fallback when it is empty.
    const targetHost = field('load-config-target-host');
    const autoHost = await targetHost.inputValue().catch(() => '');
    if (!autoHost && cfg.targetHost) {
      await targetHost.fill(cfg.targetHost);
    }

    await field('load-config-port').fill(cfg.port);
    await field('load-config-path').fill(cfg.path);
    await field('load-config-virtual-users').fill(cfg.virtualUsers);
    await field('load-config-duration').fill(cfg.duration);
    await field('load-config-rampup-time').fill(cfg.rampUpTime);
    await field('load-config-rampup-steps').fill(cfg.rampUpSteps);
  }

  /** Run the load test (Runloadtest) — click PButtonModal's default confirm button */
  async submitLoadConfig(): Promise<void> {
    await this.loadConfigConfirmButton.last().click();
  }

  /**
   * Run a load test from the node detail in one go: Evaluate Perf tab → Load Config modal → enter settings → run.
   * (Called by the scenario step in perf.steps.) The node must have been selected with selectNode before this call.
   */
  async runLoadTest(cfg: {
    scenarioName: string;
    targetHost: string;
    port: string;
    path: string;
    virtualUsers: string;
    duration: string;
    rampUpTime: string;
    rampUpSteps: string;
  }): Promise<void> {
    // Right after selecting a node, the default tab (Information) has the Load Config button, so open it directly without switching tabs.
    await this.openLoadConfig();
    await this.fillLoadConfig(cfg);
    await this.submitLoadConfig();
  }

  // ─────────────────────────────────────────────────────────────
  // Load test results — Getlastloadtestresult / Getlastloadtestmetrics
  // ─────────────────────────────────────────────────────────────

  /** Aggregation Table */
  private get aggregationTable(): Locator {
    return this.page.getByTestId('load-test-aggregation-table');
  }
  /** Result metric chart */
  private get resultMetric(): Locator {
    return this.page.getByTestId('load-test-result-metric');
  }
  /** Resource Metric chart */
  private get resourceMetric(): Locator {
    return this.page.getByTestId('load-test-resource-metric');
  }

  /**
   * Verify that the load-test results (aggregation table · result chart · resource chart) have rendered.
   *
   * Results do not appear the moment you press run — cm-ant applies the load (10s per the settings), then collects
   * and aggregates the results, and resource metrics are only gathered after a PerfMon agent is installed on the
   * target node. Altogether it takes several minutes. Cutting it off at 30s would judge "still aggregating" as a
   * failure rather than "no results".
   *
   * So we refresh the screen and wait until the results appear. All three must show to pass —
   * the aggregation table (performance numbers) · result chart · resource chart.
   */
  async expectLoadTestResult(
    infraName: string,
    nodeName: string,
    timeoutMs = 10 * 60_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const ok = await this.aggregationTable
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (ok) break;

      if (Date.now() > deadline) {
        await expect(
          this.aggregationTable,
          'The load-test aggregation results never appeared (check the cm-ant run/aggregation status).',
        ).toBeVisible({ timeout: 30_000 });
        break;
      }

      await this.page.waitForTimeout(15_000);

      // ★ Do not just refresh.
      //   Infra/node selection is screen state, so refreshing clears the selection and the performance tab itself disappears.
      //   Then the aggregation table is never shown, and we misjudge "no results" (it actually failed that way —
      //   even though the cm-ant load test had succeeded).
      //   To see the results again, the selection must be rebuilt from scratch.
      await this.gotoMci();
      await this.expectMciListLoaded();
      await this.selectMci(infraName);
      await this.openServerTab();
      await this.selectNode(nodeName);
      await this.openEvaluatePerfTab().catch(() => {});
    }

    await expect(this.resultMetric, 'The load-test result chart is missing').toBeVisible({
      timeout: 60_000,
    });
    await expect(this.resourceMetric, 'The resource metric chart is missing').toBeVisible({
      timeout: 60_000,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Scenario catalog — *LoadTestScenarioCatalog*
  // ─────────────────────────────────────────────────────────────

  private get scenarioTemplateModal(): Locator {
    return this.page.getByTestId('scenario-template-modal');
  }

  /** Open the scenario template (catalog) management modal */
  async openScenarioTemplates(): Promise<void> {
    await this.scenarioTemplatesButton.click();
    await expect(this.scenarioTemplateModal).toBeVisible();
  }

  /** Save a scenario template (CreateLoadTestScenarioCatalog) */
  async saveScenarioTemplate(name: string): Promise<void> {
    const m = this.scenarioTemplateModal;
    // testid only — do not rely on on-screen wording (placeholder).
    await m
      .locator(
        'input[data-testid="scenario-template-name"], textarea[data-testid="scenario-template-name"]',
      )
      .fill(name);
    // We used to only build the locator here and stop (no .click()), so the save never actually happened.
    await m.getByTestId('scenario-template-save').click();
  }

  /** Verify a given template is shown in the list tab */
  async expectScenarioTemplate(name: string): Promise<void> {
    await expect(
      this.scenarioTemplateModal.getByText(name, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────
  // ★ Migration scenario reuse — verify instance creation / stop
  // ─────────────────────────────────────────────────────────────

  /**
   * Verify that the nodes of the migration-created infra are *actually up*.
   *
   * ★ The row being visible is not enough.
   *   cm-beetle always names the target infra `infra101`. So if an infra left over from a prior run is still there,
   *   a row with the same name appears even if this run created nothing. There have been cases of passing on a
   *   Terminated-node infra as "EC2 created successfully" — a classic false pass.
   *
   *   So we go as far as checking the status column is *Running*. The list's Status shows like "Running:1 (R:1/1)",
   *   and when dead it becomes "Terminated:1 (R:0/1)".
   */
  async expectInstanceCreated(
    infraName: string,
    nodeName?: string,
  ): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    await this.expectMciVisible(infraName);

    // Provisioning takes time — refresh and wait until it becomes Running.
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      const text =
        (await this.mciRow(infraName)
          .innerText()
          .catch(() => '')) || '';
      if (/Running:\s*[1-9]/.test(text)) break;
      expect(
        Date.now() < deadline,
        `The nodes of the "${infraName}" infra never reached Running. Current status: ${text.replace(/\s+/g, ' ').trim()}`,
      ).toBeTruthy();
      await this.page.waitForTimeout(15_000);
      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.expectMciListLoaded().catch(() => {});
    }

    if (nodeName) {
      await this.selectMci(infraName);
      await this.openServerTab();
      await this.expectNodeVisible(nodeName);
    }
  }

  /**
   * Delete an infra of the same name left over from a prior run.
   *
   * Because cm-beetle always names the target `infra101`, a leftover dead infra cannot be distinguished from this
   * run's result (that is what caused the false pass above). Clean it up before starting the scenario.
   */
  async removeStaleInfra(infraName: string): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    // Scan every page for leftovers too — looking at page 1 only misses leftovers on later pages.
    const pager = new TablePagination(this.page, this.mciTable);
    if (await pager.isRowAbsent(this.mciRow(infraName))) {
      return; // Nothing left — proceed as-is
    }
    console.log(
      `[scenario] Cleaning up the "${infraName}" infra left over from a prior run before starting.`,
    );
    await this.selectMci(infraName);
    await this.openDeleteModal();
    // Force Delete removes only the metadata and leaves the EC2 (charges keep accruing). Do the pre-cleanup with Normal too.
    await this.confirmDelete(infraName, 'normal');

    // The modal not closing is a known screen defect (it holds one request synchronously and does not close even on failure).
    // Here this is a *pre-cleanup* to set up the scenario, so we only record the defect and proceed.
    // The defect itself is judged properly in the cleanup step of the main scenario.
    if (!(await this.deleteModalClosed())) {
      console.warn(
        '[scenario] The delete modal did not close on its own (screen defect). Whether it was actually deleted is re-checked in the list.',
      );
    }
    await this.expectInfraGone(infraName);
  }

  /**
   * Stop (suspend/stop) the created infra — no terminate, to protect against charges.
   * If the current UI has no data-testid on the stop action yet, fall back to the action menu's Suspend/Stop item.
   * (When the control is not exposed, only this one place in the Page Object needs changing.)
   */
  async stopInstance(infraName: string): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    await this.selectMci(infraName);
    await this.actionDropdown.click();
    await this.page
      .getByTestId('mci-action-suspend')
      .or(this.page.getByRole('menuitem', { name: /suspend|stop|중지/i }))
      .or(this.page.getByText(/suspend|stop/i).first())
      .click();
  }
}
