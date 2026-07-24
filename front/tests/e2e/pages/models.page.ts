import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';
import { humanClick, humanFill } from '../support/humanize';

/**
 * ModelsPage — the Page Object that gathers the "where/how" of the model (source/target/recommend) domain.
 *
 * ★ Scenarios (.feature) hold only the *intent*, like "save as a source model" or "get a low-cost recommendation",
 *   while the actual screen location (URL), elements (selectors), and save/recommend operations live here in one place.
 *   → When the screen changes, only this file needs fixing, and the Korean scenarios stay as they are.
 *
 * Screens covered (cm-damselfly models + cm-beetle recommendation):
 *   - source model list/detail  /main/models/source-models  (GetModels · CreateOnPremModel/UpdateOnPremModel)
 *   - target model list/detail  /main/models/target-models  (GetModels · CreateCloudModel)
 *   - recommend (modal)     RecommendVmInfraCandidates · Updateandgetestimatecost · GetProviderList/GetRegions
 *
 * ★ Cost protection: from the recommendation results, pick the *cheapest candidate* (lowest estimated monthly cost), and if needed verify the spec class (nano/small)
 *   is at or below maxClass. If the source is nano, recommendations also come out at nano/small class, and picking the cheapest candidate enforces low cost.
 */
export class ModelsPage {
  /** ★ Screen locations (URL) */
  static readonly sourceModelsPath = '/main/models/source-models';
  static readonly targetModelsPath = '/main/models/target-models';

  constructor(private readonly page: Page) {}

  // ───────────────────────────────────────────────────────────────────
  // Selectors (prefer data-testid; before it is assigned, fall back to role/text placeholder)
  //  → the fallback will be removed once data-testid is assigned in the front (BAR-880).
  // ───────────────────────────────────────────────────────────────────

  /** Model list table (shared by source/target — the first p-toolbox-table after entering the screen) */
  private get listTable(): Locator {
    return this.page.getByTestId('model-list-table');
  }

  /** A model list row by name */
  private modelRow(name: string): Locator {
    return this.page
      .getByTestId(`model-row-${name}`)
      .or(this.page.getByRole('row', { name }))
      .first();
  }

  /** Pagination of the model list */
  private get listPagination(): TablePagination {
    return new TablePagination(this.page, this.listTable);
  }

  /**
   * Actually reveal a model row in the list.
   *
   * The top search box uses mirinae's query-tag scheme, so no filter is attached to this table (typing does not narrow it).
   * The list is paged at 15 rows, so a just-created model may not be on page 1. Don't rely on search;
   * find it by *paging through*, and record which page it was found on.
   */
  private async revealModel(name: string): Promise<number> {
    return this.listPagination.expectRowSomewhere(this.modelRow(name), name);
  }

  /** Source model detail — "Custom & View Source Model" (entry to edit/save on-prem info) */
  private get customViewSourceLink(): Locator {
    return this.page.getByTestId('source-detail-custom-view');
  }

  /** Source model detail — "View Recommended List" (entry to the recommend modal) */
  private get viewRecommendLink(): Locator {
    return this.page.getByTestId('source-detail-view-recommend');
  }

  /** The SAVE button in the modal (CreateForm) — the save of Custom & View */
  private get createFormSaveButton(): Locator {
    return this.page.getByTestId('create-form-save');
  }

  /** Name input modal (SimpleEditForm) — the Model Name input */
  private get modelNameInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
      )
      .or(this.page.getByPlaceholder(/model name/i));
  }

  /** Name input modal (SimpleEditForm) — the confirm (Save) button */
  private get modelNameConfirmButton(): Locator {
    return this.page.getByTestId('model-name-save');
  }

  /** The Confirm button of the save-success icon modal */
  private get successConfirmButton(): Locator {
    return this.page
      .getByTestId('model-save-confirm')
      .or(this.page.getByRole('button', { name: /^confirm$/i }));
  }

  // ── Recommend modal (RecommendedInfraModel) ──────────────────────────────

  /** Recommend modal container (CreateForm) */
  private get recommendModal(): Locator {
    return this.page.getByTestId('recommend-modal');
  }

  /** CSP (Provider) select dropdown */
  private get providerDropdown(): Locator {
    return this.page.getByTestId('recommend-provider-select');
  }

  /** Region select dropdown */
  private get regionDropdown(): Locator {
    return this.page.getByTestId('recommend-region-select');
  }

  /** Run recommendation (Search) button */
  private get searchButton(): Locator {
    return this.page.getByTestId('recommend-search');
  }

  /** Candidate count (Candidate Limit) input */
  private get candidateLimitInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="recommend-candidate-limit"], textarea[data-testid="recommend-candidate-limit"]',
      )
      .or(this.recommendModal.getByPlaceholder('3'));
  }

  /** Minimum Match Rate — number input (§1.3: narrow to the real input, the testid is on the wrapper too) */
  private get matchRateInput(): Locator {
    return this.page.locator('input[data-testid="recommend-match-rate"]');
  }

  /** Minimum Match Rate — slider */
  private get matchRateSlider(): Locator {
    return this.page.locator(
      'input[data-testid="recommend-match-rate-slider"]',
    );
  }

  /** Minimum Match Rate — the '?' badge that opens the explanation */
  private get matchRateHelpBadge(): Locator {
    return this.page.getByTestId('recommend-match-rate-help');
  }

  /** Minimum Match Rate — hint line, shown only while a rate is set */
  private get matchRateHint(): Locator {
    return this.page.getByTestId('recommend-match-rate-hint');
  }

  /** Recommendation result table rows */
  private get recommendRows(): Locator {
    return this.page.getByTestId('recommend-result-table').locator('tbody tr');
  }

  /** "Save as a Target Model" button */
  private get saveAsTargetButton(): Locator {
    return this.page.getByTestId('recommend-save-target');
  }

  // ───────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────

  async gotoSourceModels(): Promise<void> {
    await this.page.goto(ModelsPage.sourceModelsPath);
    await this.page.waitForURL(/\/models\/source-models/, { timeout: 15_000 });
  }

  async gotoTargetModels(): Promise<void> {
    await this.page.goto(ModelsPage.targetModelsPath);
    await this.page.waitForURL(/\/models\/target-models/, { timeout: 15_000 });
  }

  async expectModelListVisible(): Promise<void> {
    await expect(this.listTable).toBeVisible({ timeout: 15_000 });
  }

  async expectModelInList(name: string): Promise<void> {
    await this.revealModel(name);
    await expect(this.modelRow(name)).toBeVisible({ timeout: 15_000 });
  }

  /** Select a model row from the list (reveals the detail tab) */
  async selectModel(name: string): Promise<void> {
    await this.revealModel(name);
    await this.modelRow(name).click();
  }

  /** Select the first model in the list (e.g. the latest source right after collection) */
  async selectFirstModel(): Promise<string> {
    const first = this.listTable.locator('tbody tr').first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    const name = (await first.innerText()).trim().split(/\s+/)[0] ?? '';
    await first.click();
    return name;
  }

  /**
   * Select the first *infrastructure* source model (Migration Type `OnPremiseModel`).
   *
   * The list mixes infra and software sources, and their details offer different entries —
   * infra has "View Recommended List" (the recommend modal), software has "Get Migration List"
   * (a full-page software recommendation). Taking whatever row is first lands on the software
   * screen when a software source happens to sort first, and the modal never appears.
   */
  async selectFirstInfraModel(): Promise<string> {
    const row = this.listTable
      .locator('tbody tr')
      .filter({ hasText: 'OnPremiseModel' })
      .first();
    await expect(
      row,
      '인프라 소스 모델(OnPremiseModel) 행이 목록에 없다',
    ).toBeVisible({
      timeout: 15_000,
    });
    const name = (await row.innerText()).trim().split(/\s+/)[0] ?? '';
    await row.click();
    return name;
  }

  // ───────────────────────────────────────────────────────────────────
  // Save source (on-prem) model — CustomViewSourceModel (CreateOnPremModel)
  // ───────────────────────────────────────────────────────────────────

  /**
   * From the detail of an already-selected source model, open "Custom & View Source Model" and
   * save the collected on-prem info as a source model with the given name.
   */
  async saveAsSourceModel(name: string): Promise<void> {
    await humanClick(this.customViewSourceLink);
    await humanClick(this.createFormSaveButton);
    await humanFill(this.modelNameInput, name);
    await humanClick(this.modelNameConfirmButton);
  }

  // ───────────────────────────────────────────────────────────────────
  // Recommend → save target model (RecommendVmInfraCandidates + CreateCloudModel)
  // ───────────────────────────────────────────────────────────────────

  /** Open the recommend modal from the selected source model's detail */
  async openRecommend(): Promise<void> {
    await humanClick(this.viewRecommendLink);
    await expect(this.recommendModal).toBeVisible({ timeout: 15_000 });
  }

  /** Select CSP (Provider) — mirinae PSelectDropdown */
  async selectProvider(csp: string): Promise<void> {
    await this.providerDropdown.click();
    await this.page
      .getByRole('menuitem', { name: csp, exact: false })
      .or(this.page.getByRole('option', { name: csp, exact: false }))
      .or(this.page.getByText(csp, { exact: true }))
      .first()
      .click();
  }

  /** Select Region — the label is in "display / regionName" form, so match by partial match */
  async selectRegion(region: string): Promise<void> {
    await this.regionDropdown.click();
    await this.page
      .getByRole('menuitem', { name: region, exact: false })
      .or(this.page.getByRole('option', { name: region, exact: false }))
      .or(this.page.getByText(region, { exact: false }))
      .first()
      .click();
  }

  /** Set the candidate count (optional) */
  async setCandidateLimit(limit: number): Promise<void> {
    await this.candidateLimitInput.fill(String(limit));
  }

  /** Put focus on the Minimum Match Rate number field (without changing the value) */
  async focusMinimumMatchRate(): Promise<void> {
    await this.matchRateInput.focus();
  }

  /** Put focus on the Minimum Match Rate slider (without changing the value) */
  async focusMinimumMatchRateSlider(): Promise<void> {
    await this.matchRateSlider.focus();
  }

  /** Type a Minimum Match Rate (the screen clamps it to 0-100) */
  async setMinimumMatchRate(rate: number | string): Promise<void> {
    await this.matchRateInput.fill(String(rate));
  }

  /** Drag the Minimum Match Rate slider to a value */
  async slideMinimumMatchRate(rate: number): Promise<void> {
    await this.matchRateSlider.fill(String(rate));
  }

  /** Clear the Minimum Match Rate so the server default applies again */
  async clearMinimumMatchRate(): Promise<void> {
    await this.matchRateInput.fill('');
  }

  /** Is the hint line under the field showing? (only while a rate is set and the control is active) */
  async isMinimumMatchRateHintVisible(): Promise<boolean> {
    return this.matchRateHint.isVisible();
  }

  /** Move focus off the Minimum Match Rate controls (onto another field on the same row) */
  async moveAwayFromMinimumMatchRate(): Promise<void> {
    await this.candidateLimitInput.first().focus();
    await this.page.waitForTimeout(200);
  }

  /**
   * Vertical position of the results table — used to prove the hint does not shove the table
   * around as focus comes and goes. The hint keeps its line while hidden precisely so this
   * stays put.
   */
  async recommendTableTop(): Promise<number> {
    const table = this.page.getByTestId('recommend-result-table');
    const box = await table.boundingBox();
    if (!box) throw new Error('추천 결과 표의 위치를 읽지 못했다');
    return box.y;
  }

  /**
   * Left edge of a recommendation-condition label, for column alignment checks.
   *
   * The two condition rows read as a table, so their second labels ("Region" above,
   * "Minimum Match Rate (%)" below) must start at the same x. That alignment depends on a fixed
   * cell width in the front, which nothing else would catch if it drifted.
   */
  async labelLeftEdge(text: string): Promise<number> {
    const label = this.recommendModal.getByText(text, { exact: true }).first();
    await expect(label).toBeVisible({ timeout: 15_000 });
    const box = await label.boundingBox();
    if (!box) throw new Error(`"${text}" 라벨의 위치를 읽지 못했다`);
    return box.x;
  }

  /** What the number field currently holds ('' when not set) */
  async readMinimumMatchRate(): Promise<string> {
    return this.matchRateInput.inputValue();
  }

  /** Where the slider currently sits */
  async readMinimumMatchRateSlider(): Promise<string> {
    return this.matchRateSlider.inputValue();
  }

  /** The always-visible hint under the field */
  async readMinimumMatchRateHint(): Promise<string> {
    return (await this.matchRateHint.textContent())?.trim() ?? '';
  }

  /**
   * Hover the '?' badge and read the explanation it opens.
   * The tooltip is rendered outside the modal (v-tooltip appends to body), so it is looked up
   * globally rather than inside the recommend modal.
   */
  async readMatchRateHelpTooltip(): Promise<string> {
    await this.matchRateHelpBadge.hover();
    const tooltip = this.page.locator('.match-rate-tooltip .tooltip-inner');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });
    return (await tooltip.textContent())?.trim() ?? '';
  }

  /**
   * Run the recommendation and hand back the query parameters the front actually sent.
   *
   * ★ Why the request and not the screen: the whole point of BAR-1634 is that a wrong value
   *   reached the server and the server quietly fell back to its default — the results looked
   *   fine either way. Only the outgoing request tells the two apart.
   */
  async runRecommendCapturingQuery(): Promise<Record<string, string>> {
    const requestPromise = this.page.waitForRequest(
      req =>
        req.url().includes('cm-beetle/RecommendVmInfraCandidates') &&
        req.method() === 'POST',
      { timeout: 30_000 },
    );
    await humanClick(this.searchButton);
    const request = await requestPromise;
    return request.postDataJSON()?.queryParams ?? {};
  }

  /** Run recommendation — wait until result rows appear */
  async runRecommend(): Promise<void> {
    await humanClick(this.searchButton);
    await expect(this.recommendRows.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * ★ Enforce low cost + ensure value completeness — among the recommendation results,
   *   ① from candidates whose required values (spec, image, cost) are *all filled in*,
   *   ② pick the candidate with the *lowest estimated monthly cost*.
   *
   *   Reason: in the recommendation response some candidates come with empty fields, and saving such a candidate as a target model
   *   makes the empty values / description text carry over on workflow execution and fail ([[ISSUE-workflow-form-desc-as-value]] / BAR-1393).
   *   So only candidates *with all values filled in* are considered.
   *
   *   If all candidates are incomplete, throw an exception → in that case the cm-beetle recommendation response (field coverage)
   *   must be verified in parallel at the source level (why the recommend API returns empty values).
   *
   *   Cost cell format: "<monthly>/mon (<hourly>/hour)<currency>".
   *   Returns: the selected candidate's spec label (for class verification).
   */
  async selectLowestCostCandidate(): Promise<{
    spec: string;
    monthlyPrice: number;
  }> {
    const rows = this.recommendRows;
    const count = await rows.count();
    let minIndex = -1;
    let minPrice = Number.POSITIVE_INFINITY;
    let minSpec = '';
    let completeCount = 0;

    for (let i = 0; i < count; i++) {
      const cellTexts = (
        await rows.nth(i).locator('td, [role="cell"]').allInnerTexts()
      ).map(t => t.trim());
      const text = cellTexts.join(' ');
      const priceMatch = text.match(/([\d.]+)\s*\/\s*mon/i);
      const price = priceMatch
        ? parseFloat(priceMatch[1])
        : Number.POSITIVE_INFINITY;
      const spec = this.parseSpecToken(text);

      // Value-completeness check — per cm-beetle measurements (2026-07-05), specId/imageId are filled even for nano, and
      // the front renders the literal "empty" (red text) only for candidates with *empty specId/imageId*
      // (RecommendedInfraModel.getRecommendModelList → formatEmptyValue). So we decide not by "are all cells empty"
      // but by *spec token present + no "empty"* (to avoid misjudging other columns that are legitimately empty).
      const hasEmptyPlaceholder = /\bempty\b/i.test(text);
      const complete = !!spec && !hasEmptyPlaceholder;
      if (!complete) continue;

      completeCount++;
      // Cheapest among complete candidates. If there is no monthly cost (only class info), take the first complete candidate.
      if (minIndex < 0 || (Number.isFinite(price) && price < minPrice)) {
        minPrice = price;
        minIndex = i;
        minSpec = spec;
      }
    }

    if (minIndex < 0) {
      throw new Error(
        `추천 결과에 값이 모두 채워진 후보가 없음(후보 ${count}개 전부 불완전). ` +
          `cm-beetle 추천 응답의 필드 범위를 소스레벨로 병행 검증 필요 — RecommendVmInfraCandidates가 빈 값을 반환하는 원인 확인.`,
      );
    }

    // Single-select table — click the cheapest row (among complete candidates)
    await rows.nth(minIndex).click();
    return {
      spec: minSpec,
      monthlyPrice: Number.isFinite(minPrice) ? minPrice : 0,
    };
  }

  /**
   * Pick the *largest* candidate *within* the allowed class (maxClass).
   *
   * ★ Why not the cheapest — software migration installs packages one by one on the target. But the recommendation list
   *   also pulls in whole OS-level packages, so on a micro-class target the CPU saturates and it practically never finishes (measured: in 40 min,
   *   11 of 39). Then we cannot verify "does the migration work".
   *
   *   So *keeping the cost cap (maxClass)*, we pick the largest within it so the migration can actually finish.
   *   The cap is still enforced, so cost protection is unchanged.
   */
  async selectLargestCandidateWithinClass(
    maxClass: string,
  ): Promise<{ spec: string; monthlyPrice: number }> {
    const rows = this.recommendRows;
    const count = await rows.count();
    let bestIndex = -1;
    let bestRank = -1;
    let bestSpec = '';
    let bestPrice = 0;

    for (let i = 0; i < count; i++) {
      const text = (
        await rows.nth(i).locator('td, [role="cell"]').allInnerTexts()
      )
        .map(t => t.trim())
        .join(' ');
      const spec = this.parseSpecToken(text);
      if (!spec || /\bempty\b/i.test(text)) continue; // a candidate with under-filled values is unusable
      if (!isSpecWithinClass(spec, maxClass)) continue; // keep the cost cap as is

      const token = Object.keys(SPEC_CLASS_RANK).find(k =>
        spec.toLowerCase().includes(k),
      );
      const rank = token ? SPEC_CLASS_RANK[token] : 0;
      const priceMatch = text.match(/([\d.]+)\s*\/\s*mon/i);
      if (rank > bestRank) {
        bestRank = rank;
        bestIndex = i;
        bestSpec = spec;
        bestPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
      }
    }

    if (bestIndex < 0) {
      throw new Error(
        `추천 결과에 "${maxClass}" 급 이하의 쓸 만한 후보가 없다(후보 ${count}개).`,
      );
    }

    await rows.nth(bestIndex).click();
    console.log(
      `[recommend] selected the largest spec at or below "${maxClass}" class: ${bestSpec}`,
    );
    return { spec: bestSpec, monthlyPrice: bestPrice };
  }

  /**
   * ★ Select a complete candidate — chosen by the `data-complete="true"` marker the front attaches.
   *
   *   Why this path is needed — in the recommendation response, some candidates have bad spec/image values (empty, or fake types
   *   like `string`·`npt`·`undefined`). Saving such a candidate as a target model does save, but later
   *   during migration (MCI creation) cm-beetle cannot resolve the image and fails silently (0 infra). In fact, in the last
   *   verification, infra was not created for this reason.
   *
   *   The existing `selectLargestCandidateWithinClass` filtered only by the literal "empty" text rendered on screen,
   *   but *fake values* like `string` are not "empty" and slipped through. So we decide by the
   *   `data-complete` marker the front attaches by inspecting the model values themselves (based on useRecommendedInfraModel.hasMissingRequiredFields).
   *
   *   Selection policy — among complete candidates, pick the *largest* spec that is at or below the cost cap (maxClass) (the cap is
   *   still kept for cost protection). If there is no complete candidate at all, throw an exception — in that case the problem is not the front but
   *   that the cm-beetle recommendation response fails to fill the values, so it must be verified in parallel at the source level.
   */
  async selectCompleteCandidate(
    maxClass: string,
  ): Promise<{ spec: string; monthlyPrice: number }> {
    const rows = this.recommendRows;
    const count = await rows.count();
    let bestIndex = -1;
    let bestRank = -1;
    let bestSpec = '';
    let bestPrice = 0;
    let completeCount = 0;
    let incompleteCount = 0;

    for (let i = 0; i < count; i++) {
      const marker = rows
        .nth(i)
        .locator('[data-testid="recommend-candidate"]')
        .first();
      const dataComplete =
        (await marker.getAttribute('data-complete').catch(() => null)) ?? '';
      const isComplete = dataComplete === 'true';

      const text = (
        await rows.nth(i).locator('td, [role="cell"]').allInnerTexts()
      )
        .map(t => t.trim())
        .join(' ');
      const spec = this.parseSpecToken(text);

      if (!isComplete) {
        incompleteCount++;
        continue;
      }
      completeCount++;

      // Keep the cost cap as is (only when the class can be determined). If it cannot, let it pass.
      if (spec && !isSpecWithinClass(spec, maxClass)) continue;

      const token = Object.keys(SPEC_CLASS_RANK).find(k =>
        spec.toLowerCase().includes(k),
      );
      const rank = token ? SPEC_CLASS_RANK[token] : 0;
      const priceMatch = text.match(/([\d.]+)\s*\/\s*mon/i);
      if (rank > bestRank) {
        bestRank = rank;
        bestIndex = i;
        bestSpec = spec;
        bestPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
      }
    }

    if (bestIndex < 0) {
      throw new Error(
        `추천 결과에 완전한(data-complete=true) 후보가 "${maxClass}" 급 이하로 없다 — ` +
          `후보 ${count}개 중 완전 ${completeCount}·불완전 ${incompleteCount}. ` +
          `완전 후보가 0개이면 문제는 프론트가 아니라 cm-beetle 추천 응답이 spec/image를 ` +
          `채우지 못하는 것이므로 RecommendVmInfraCandidates 응답을 소스레벨로 병행 검증해야 한다.`,
      );
    }

    await rows.nth(bestIndex).click();
    console.log(
      `[recommend] selected a complete candidate (by marker): ${bestSpec} — complete ${completeCount}/${count}, incomplete ${incompleteCount}`,
    );
    return { spec: bestSpec, monthlyPrice: bestPrice };
  }

  /** Save the recommendation result as a target model (cloud model) with the given name */
  async saveAsTargetModel(name: string): Promise<void> {
    await humanClick(this.saveAsTargetButton); // → SimpleEditForm(Save Target Model)
    await humanFill(this.modelNameInput, name);
    await humanClick(this.modelNameConfirmButton);
    await expect(this.successConfirmButton).toBeVisible({ timeout: 15_000 });
    await humanClick(this.successConfirmButton);
  }

  /** Open the workflow editor via "Make Workflow" on the target model detail (the workflow creation entry point).
   *  Add on the Workflows list is disabled, and creation starts from a target model. */
  async openWorkflowEditorFromTarget(targetName: string): Promise<void> {
    await this.gotoTargetModels();
    await this.selectModel(targetName);
    await humanClick(this.page.getByTestId('target-make-workflow'));
  }

  // ── SW (software) model recommendation (same process as infra: source SW model → recommend → save target SW model) ──

  private get swRecommendModal(): Locator {
    return this.page.getByTestId('sw-recommend-modal');
  }
  private get swGetRecommendButton(): Locator {
    return this.page.getByTestId('sw-recommend-get');
  }
  private get swSaveTargetButton(): Locator {
    return this.page.getByTestId('sw-recommend-save-target');
  }

  /** Open the SW recommend modal from the source SW model detail (corresponds to infra openRecommend) */
  async openSoftwareRecommend(): Promise<void> {
    await this.viewRecommendLink.click();
    await expect(this.swRecommendModal).toBeVisible({ timeout: 15_000 });
  }

  /** Run the SW migration recommendation (Get Migration Recommendations) */
  async runSoftwareRecommend(): Promise<void> {
    await this.swGetRecommendButton.click();
    // Wait generously for the recommendation result area to fill
    await this.page.waitForTimeout(2_000);
  }

  /**
   * Save the recommendation result as a target SW model with the given name (CreateTargetSoftwareModel).
   *
   * SW save has a different success UX from infra save — on success only a toast appears and the save form closes (no confirm modal).
   * Previously it waited for a "Confirm" button just like infra, but SW has no such button, so it waited 15 seconds
   * for something that doesn't exist and died.
   *
   * Whether the form is open/closed is decided by the name input, an *actually visible element*. Attaching a testid to
   * PButtonModal, the root of SimpleEditForm, doesn't help since it is a wrapper and isn't caught as a visible element (a trap already hit in the load-config modal).
   */
  async saveAsTargetSoftwareModel(name: string): Promise<void> {
    await humanClick(this.swSaveTargetButton); // → SimpleEditForm(Save Software Migration as Target Model)
    await expect(this.modelNameInput).toBeVisible({ timeout: 15_000 });
    await humanFill(this.modelNameInput, name);
    await humanClick(this.modelNameConfirmButton);
    // Save success = the form closes (the name input disappears). On failure the form stays open and is caught here.
    await expect(this.modelNameInput).toBeHidden({ timeout: 20_000 });
  }

  // ── Utils ──────────────────────────────────────────────────────────

  /** Roughly extract the spec label (e.g. "t3.nano", "e2-small") from the row text */
  private parseSpecToken(rowText: string): string {
    // The spec cell shows the last piece of "csp+region+spec". After splitting on whitespace, prefer the token that looks like a spec.
    const tokens = rowText.split(/\s+/).filter(Boolean);
    const specLike = tokens.find(t =>
      /nano|micro|small|medium|large|\.|-/.test(t),
    );
    return specLike ?? tokens[1] ?? tokens[0] ?? '';
  }
}

/** Spec class ranking — lower is cheaper. Used to verify at or below maxClass. */
export const SPEC_CLASS_RANK: Record<string, number> = {
  nano: 1,
  micro: 2,
  small: 3,
  medium: 4,
  large: 5,
  xlarge: 6,
};

/**
 * Decide whether the spec label is at or below the maxClass class.
 * Find the class token (nano/micro/small/…) in the label and compare the ranking.
 * If no class token is found, return true (skip verification) as undecidable.
 */
export function isSpecWithinClass(spec: string, maxClass: string): boolean {
  const maxRank = SPEC_CLASS_RANK[maxClass.toLowerCase()];
  if (maxRank === undefined) return true;
  const found = Object.keys(SPEC_CLASS_RANK).find(k =>
    spec.toLowerCase().includes(k),
  );
  if (!found) return true;
  return SPEC_CLASS_RANK[found] <= maxRank;
}
