import { Page, expect, Locator } from '@playwright/test';

/**
 * ModelsPage — 모델(소스/타깃/추천) 도메인의 "어디서/어떻게"를 모으는 Page Object.
 *
 * ★ 시나리오(.feature)는 "소스 모델로 저장한다", "저비용으로 추천받는다" 같은 *의도*만 담고,
 *   실제 화면 위치(URL)와 요소(셀렉터)·저장·추천 조작은 여기 한 곳에 둔다.
 *   → 화면이 바뀌면 이 파일만 고치면 되고, 한국어 시나리오는 그대로 유지된다.
 *
 * 다루는 화면(cm-damselfly 모델 + cm-beetle 추천):
 *   - 소스 모델 목록/상세  /main/models/source-models  (GetModels · CreateOnPremModel/UpdateOnPremModel)
 *   - 타깃 모델 목록/상세  /main/models/target-models  (GetModels · CreateCloudModel)
 *   - 추천(모달)           RecommendVmInfraCandidates · Updateandgetestimatecost · GetProviderList/GetRegions
 *
 * ★ 비용 보호: 추천 결과에서 *가장 저렴한 후보*(월 예상비용 최소)를 선택하고, 필요 시 스펙 급(nano/small)을
 *   maxClass 이하로 검증한다. 소스가 nano면 추천도 nano/small급으로 나오며, 최저가 후보 선택으로 저비용을 강제한다.
 */
export class ModelsPage {
  /** ★ 화면 위치(URL) */
  static readonly sourceModelsPath = '/main/models/source-models';
  static readonly targetModelsPath = '/main/models/target-models';

  constructor(private readonly page: Page) {}

  // ───────────────────────────────────────────────────────────────────
  // 셀렉터 (data-testid 우선, 아직 부여 전이면 role/text placeholder fallback)
  //  → 프론트에 data-testid 부여(BAR-880) 후 fallback 제거 예정.
  // ───────────────────────────────────────────────────────────────────

  /** 모델 목록 테이블(소스/타깃 공용 — 화면 진입 후 첫 p-toolbox-table) */
  private get listTable(): Locator {
    return this.page.getByTestId('model-list-table');
  }

  /** 이름으로 모델 목록 행 */
  private modelRow(name: string): Locator {
    return this.page
      .getByTestId(`model-row-${name}`)
      .or(this.page.getByRole('row', { name }))
      .first();
  }

  /** 목록 상단 검색창(PToolboxTable plain search) */
  private get listSearchInput(): Locator {
    return this.page
      .getByRole('textbox', { name: 'Search' })
      .or(this.page.getByPlaceholder('Search'))
      .first();
  }

  /**
   * 모델 목록도 PToolboxTable 클라이언트 페이징이라 누적 모델이 많으면 대상 행이 1페이지 밖에
   * 있을 수 있다. 검색창에 고유 이름을 입력해 해당 행만 남도록 필터링한다.
   */
  private async revealModel(name: string): Promise<void> {
    const search = this.listSearchInput;
    if ((await search.count()) === 0) return;
    await search.click();
    await search.fill('');
    await search.fill(name);
    await search.press('Enter');
    await this.page.waitForTimeout(800);
  }

  /** 소스 모델 상세 — "Custom & View Source Model"(온프렘 정보 편집·저장 진입) */
  private get customViewSourceLink(): Locator {
    return this.page
      .getByTestId('source-detail-custom-view');
  }

  /** 소스 모델 상세 — "View Recommended List"(추천 모달 진입) */
  private get viewRecommendLink(): Locator {
    return this.page
      .getByTestId('source-detail-view-recommend');
  }

  /** 모달(CreateForm) 내 SAVE 버튼 — Custom & View의 저장 */
  private get createFormSaveButton(): Locator {
    return this.page
      .getByTestId('create-form-save');
  }

  /** 이름 입력 모달(SimpleEditForm) — Model Name 인풋 */
  private get modelNameInput(): Locator {
    return this.page
      .locator('input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]')
      .or(this.page.getByPlaceholder(/model name/i));
  }

  /** 이름 입력 모달(SimpleEditForm) — 확정(Save) 버튼 */
  private get modelNameConfirmButton(): Locator {
    return this.page
      .getByTestId('model-name-save');
  }

  /** 저장 성공 아이콘 모달의 Confirm 버튼 */
  private get successConfirmButton(): Locator {
    return this.page
      .getByTestId('model-save-confirm')
      .or(this.page.getByRole('button', { name: /^confirm$/i }));
  }

  // ── 추천 모달(RecommendedInfraModel) ──────────────────────────────

  /** 추천 모달 컨테이너(CreateForm) */
  private get recommendModal(): Locator {
    return this.page.getByTestId('recommend-modal');
  }

  /** CSP(Provider) 선택 드롭다운 */
  private get providerDropdown(): Locator {
    return this.page
      .getByTestId('recommend-provider-select');
  }

  /** Region 선택 드롭다운 */
  private get regionDropdown(): Locator {
    return this.page
      .getByTestId('recommend-region-select');
  }

  /** 추천 실행(Search) 버튼 */
  private get searchButton(): Locator {
    return this.page
      .getByTestId('recommend-search');
  }

  /** 후보 개수(Candidate Limit) 인풋 */
  private get candidateLimitInput(): Locator {
    return this.page
      .locator('input[data-testid="recommend-candidate-limit"], textarea[data-testid="recommend-candidate-limit"]')
      .or(this.recommendModal.getByPlaceholder('3'));
  }

  /** 추천 결과 테이블 행 */
  private get recommendRows(): Locator {
    return this.page
      .getByTestId('recommend-result-table')
      .locator('tbody tr');
  }

  /** "Save as a Target Model" 버튼 */
  private get saveAsTargetButton(): Locator {
    return this.page
      .getByTestId('recommend-save-target');
  }

  // ───────────────────────────────────────────────────────────────────
  // 화면 이동
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

  /** 목록에서 모델 행을 선택(상세 탭 노출) */
  async selectModel(name: string): Promise<void> {
    await this.revealModel(name);
    await this.modelRow(name).click();
  }

  /** 목록의 첫 번째 모델(수집 직후 최신 소스 등)을 선택 */
  async selectFirstModel(): Promise<string> {
    const first = this.listTable.locator('tbody tr').first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    const name = (await first.innerText()).trim().split(/\s+/)[0] ?? '';
    await first.click();
    return name;
  }

  // ───────────────────────────────────────────────────────────────────
  // 소스(온프렘) 모델 저장 — CustomViewSourceModel(CreateOnPremModel)
  // ───────────────────────────────────────────────────────────────────

  /**
   * 이미 선택된 소스 모델의 상세에서 "Custom & View Source Model"을 열고,
   * 수집된 온프렘 정보를 지정한 이름의 소스 모델로 저장한다.
   */
  async saveAsSourceModel(name: string): Promise<void> {
    await this.customViewSourceLink.click();
    await this.createFormSaveButton.click();
    await this.modelNameInput.fill(name);
    await this.modelNameConfirmButton.click();
  }

  // ───────────────────────────────────────────────────────────────────
  // 추천 → 타깃 모델 저장 (RecommendVmInfraCandidates + CreateCloudModel)
  // ───────────────────────────────────────────────────────────────────

  /** 선택된 소스 모델의 상세에서 추천 모달을 연다 */
  async openRecommend(): Promise<void> {
    await this.viewRecommendLink.click();
    await expect(this.recommendModal).toBeVisible({ timeout: 15_000 });
  }

  /** CSP(Provider) 선택 — mirinae PSelectDropdown */
  async selectProvider(csp: string): Promise<void> {
    await this.providerDropdown.click();
    await this.page
      .getByRole('menuitem', { name: csp, exact: false })
      .or(this.page.getByRole('option', { name: csp, exact: false }))
      .or(this.page.getByText(csp, { exact: true }))
      .first()
      .click();
  }

  /** Region 선택 — 라벨은 "display / regionName" 형식이라 부분일치로 매칭 */
  async selectRegion(region: string): Promise<void> {
    await this.regionDropdown.click();
    await this.page
      .getByRole('menuitem', { name: region, exact: false })
      .or(this.page.getByRole('option', { name: region, exact: false }))
      .or(this.page.getByText(region, { exact: false }))
      .first()
      .click();
  }

  /** 후보 개수 설정(선택) */
  async setCandidateLimit(limit: number): Promise<void> {
    await this.candidateLimitInput.fill(String(limit));
  }

  /** 추천 실행 — 결과 행이 나올 때까지 대기 */
  async runRecommend(): Promise<void> {
    await this.searchButton.click();
    await expect(this.recommendRows.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * ★ 저비용 강제 + 값 완전성 보장 — 추천 결과 중
   *   ① 필수 값(spec·이미지·비용)이 *모두 채워진* 후보 중에서
   *   ② *월 예상비용이 가장 낮은* 후보를 선택한다.
   *
   *   이유: 추천 응답에서 일부 후보는 필드가 비어 오는데, 그 후보를 타깃 모델로 저장하면
   *   워크플로우 실행 시 빈 값/설명문이 그대로 넘어가 실패한다([[ISSUE-workflow-form-desc-as-value]] / BAR-1393).
   *   그래서 *값이 모두 채워진 후보*만 후보군으로 삼는다.
   *
   *   모든 후보가 불완전하면 예외를 던진다 → 그 경우 cm-beetle 추천 응답(필드 범위)을
   *   소스레벨로 병행 검증해야 한다(추천 API가 왜 빈 값을 주는지).
   *
   *   비용 셀 형식: "<monthly>/mon (<hourly>/hour)<currency>".
   *   반환: 선택한 후보의 spec 표기(급 검증용).
   */
  async selectLowestCostCandidate(): Promise<{ spec: string; monthlyPrice: number }> {
    const rows = this.recommendRows;
    const count = await rows.count();
    let minIndex = -1;
    let minPrice = Number.POSITIVE_INFINITY;
    let minSpec = '';
    let completeCount = 0;

    for (let i = 0; i < count; i++) {
      const cellTexts = (await rows.nth(i).locator('td, [role="cell"]').allInnerTexts())
        .map(t => t.trim());
      const text = cellTexts.join(' ');
      const priceMatch = text.match(/([\d.]+)\s*\/\s*mon/i);
      const price = priceMatch ? parseFloat(priceMatch[1]) : Number.POSITIVE_INFINITY;
      const spec = this.parseSpecToken(text);

      // 값 완전성 판정 — cm-beetle 실측(2026-07-05)상 specId/imageId는 nano에서도 채워지고,
      // 프론트는 *specId/imageId가 빈* 후보에만 리터럴 "empty"(빨간 글씨)를 렌더한다
      // (RecommendedInfraModel.getRecommendModelList → formatEmptyValue). 따라서 "모든 셀 비었나"가
      // 아니라 *spec 토큰 존재 + "empty" 미포함*으로 판정한다(정상적으로 비는 다른 컬럼에 오판 방지).
      const hasEmptyPlaceholder = /\bempty\b/i.test(text);
      const complete = !!spec && !hasEmptyPlaceholder;
      if (!complete) continue;

      completeCount++;
      // 완전한 후보 중 최저가. 월비용이 없으면(급 정보만) 첫 완전 후보를 채택.
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

    // 단일 선택 테이블 — (완전한 후보 중) 최저가 행 클릭
    await rows.nth(minIndex).click();
    return { spec: minSpec, monthlyPrice: Number.isFinite(minPrice) ? minPrice : 0 };
  }

  /** 추천 결과를 지정 이름의 타깃 모델(클라우드 모델)로 저장 */
  async saveAsTargetModel(name: string): Promise<void> {
    await this.saveAsTargetButton.click(); // → SimpleEditForm(Save Target Model)
    await this.modelNameInput.fill(name);
    await this.modelNameConfirmButton.click();
    await expect(this.successConfirmButton).toBeVisible({ timeout: 15_000 });
    await this.successConfirmButton.click();
  }

  /** 타깃 모델 상세의 "Make Workflow"로 워크플로우 에디터를 연다(워크플로우 생성 진입점).
   *  Workflows 목록의 Add는 disabled이며, 생성은 타깃 모델에서 시작한다. */
  async openWorkflowEditorFromTarget(targetName: string): Promise<void> {
    await this.gotoTargetModels();
    await this.selectModel(targetName);
    await this.page.getByTestId('target-make-workflow').click();
  }

  // ── SW(소프트웨어) 모델 추천 (인프라와 동일 과정: 소스 SW 모델 → 추천 → 타깃 SW 모델 저장) ──

  private get swRecommendModal(): Locator {
    return this.page
      .getByTestId('sw-recommend-modal');
  }
  private get swGetRecommendButton(): Locator {
    return this.page
      .getByTestId('sw-recommend-get');
  }
  private get swSaveTargetButton(): Locator {
    return this.page
      .getByTestId('sw-recommend-save-target');
  }

  /** 소스 SW 모델 상세에서 SW 추천 모달을 연다 (인프라 openRecommend에 대응) */
  async openSoftwareRecommend(): Promise<void> {
    await this.viewRecommendLink.click();
    await expect(this.swRecommendModal).toBeVisible({ timeout: 15_000 });
  }

  /** SW 마이그레이션 추천 실행 (Get Migration Recommendations) */
  async runSoftwareRecommend(): Promise<void> {
    await this.swGetRecommendButton.click();
    // 추천 결과 영역이 채워질 시간을 관대하게 대기
    await this.page.waitForTimeout(2_000);
  }

  /** 추천 결과를 지정 이름의 타깃 SW 모델로 저장 (CreateTargetSoftwareModel) */
  async saveAsTargetSoftwareModel(name: string): Promise<void> {
    await this.swSaveTargetButton.click(); // → SimpleEditForm(Save Software Migration as Target Model)
    await this.modelNameInput.fill(name);
    await this.modelNameConfirmButton.click();
    await expect(this.successConfirmButton).toBeVisible({ timeout: 15_000 });
    await this.successConfirmButton.click();
  }

  // ── 유틸 ──────────────────────────────────────────────────────────

  /** 행 텍스트에서 spec 표기(예: "t3.nano", "e2-small")를 대략 추출 */
  private parseSpecToken(rowText: string): string {
    // spec 셀은 "csp+region+spec" 중 마지막 조각을 표시. 공백 분해 후 spec처럼 보이는 토큰 우선.
    const tokens = rowText.split(/\s+/).filter(Boolean);
    const specLike = tokens.find(t => /nano|micro|small|medium|large|\.|-/.test(t));
    return specLike ?? tokens[1] ?? tokens[0] ?? '';
  }
}

/** 스펙 급 순위 — 낮을수록 저비용. maxClass 이하 검증에 사용. */
export const SPEC_CLASS_RANK: Record<string, number> = {
  nano: 1,
  micro: 2,
  small: 3,
  medium: 4,
  large: 5,
  xlarge: 6,
};

/**
 * spec 표기가 maxClass 급 이하인지 판단.
 * 표기에서 급 토큰(nano/micro/small/…)을 찾아 순위를 비교한다.
 * 급 토큰을 찾지 못하면 판단 불가로 true(검증 스킵)를 반환한다.
 */
export function isSpecWithinClass(spec: string, maxClass: string): boolean {
  const maxRank = SPEC_CLASS_RANK[maxClass.toLowerCase()];
  if (maxRank === undefined) return true;
  const found = Object.keys(SPEC_CLASS_RANK).find(k => spec.toLowerCase().includes(k));
  if (!found) return true;
  return SPEC_CLASS_RANK[found] <= maxRank;
}
