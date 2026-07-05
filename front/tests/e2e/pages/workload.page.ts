import { Page, expect, Locator } from '@playwright/test';

/**
 * WorkloadPage — 워크로드 운영(인프라 MCI + 노드 VM + 부하테스트) 화면의 Page Object.
 *
 * ★ 시나리오(.feature)는 "인프라를 조회한다 / 부하테스트를 실행한다" 같은 *의도*만 담고,
 *   화면 위치(URL)와 요소(셀렉터)는 이 파일 한 곳에 모읍니다.
 *   → 화면이 바뀌면 이 파일만 고치고, 한국어 시나리오는 그대로 유지됩니다.
 *
 * ★ 현행화(feat-bf-deps-001):
 *   - MCI(인프라) 조회는 cm-beetle 경유 — 목록 operationId `ListInfra`, 상세 `cm-beetle/GetInfra`.
 *   - 삭제는 `DeleteInfra`. 식별자 키는 `infraId`/`nodeId`(구 mciId/vmId 아님).
 *   - 부하테스트는 cm-ant — `Runloadtest`, `Getlastloadtestexecutionstate`,
 *     `Getlastloadtestresult`, `Getlastloadtestmetrics`, 시나리오 카탈로그 `*LoadTestScenarioCatalog*`.
 *
 * data-testid를 우선 사용하고, 아직 부여 전(BAR-880)이면 실제 .vue 마크업(placeholder/role/text)으로 fallback.
 */
export class WorkloadPage {
  /** ★ 화면 위치(URL) — 라우팅: /main → workload-operations → workloads → mci-wls|pmk-wls */
  static readonly mciPath = '/main/workload-operations/workloads/mci-wls';
  static readonly pmkPath = '/main/workload-operations/workloads/pmk-wls';

  constructor(private readonly page: Page) {}

  // ─────────────────────────────────────────────────────────────
  // 이동
  // ─────────────────────────────────────────────────────────────

  /** 인프라(MCI) 워크로드 화면으로 이동 */
  async gotoMci(): Promise<void> {
    await this.page.goto(WorkloadPage.mciPath);
    await expect(this.mciTable).toBeVisible({ timeout: 15_000 });
  }

  /** PMK(쿠버네티스) 워크로드 화면으로 이동 */
  async gotoPmk(): Promise<void> {
    await this.page.goto(WorkloadPage.pmkPath);
  }

  // ─────────────────────────────────────────────────────────────
  // MCI(인프라) 목록 — ListInfra (cm-beetle 경유)
  // ─────────────────────────────────────────────────────────────

  /** 인프라 목록 테이블 (p-toolbox-table) */
  private get mciTable(): Locator {
    return this.page
      .getByTestId('mci-list-table');
  }

  /** 이름으로 인프라 행 지정 — 단일 ARIA row(.or() 체인은 같은 행을 여러 locator로 매칭해 중복→strict 위반). */
  mciRow(infraName: string): Locator {
    return this.page.getByRole('row', { name: infraName });
  }

  /** 목록 로딩 완료(스피너 사라지고 테이블 노출) */
  async expectMciListLoaded(): Promise<void> {
    await expect(this.mciTable).toBeVisible({ timeout: 20_000 });
  }

  /** 특정 인프라가 목록에 보이는지 확인. 워크플로우 실행→DAG→cm-beetle 마이그레이션이
   *  tumblebug에 MCI를 만들기까지 시간이 걸리는데, 목록은 자동 재조회하지 않으므로 MCI가
   *  목록 로드 이후에 생기면 그냥 기다려도 나타나지 않는다. 페이지를 주기적으로 새로고침하며
   *  행이 나타날 때까지 확인한다(프로비저닝 지연 대비 최대 ~10분). */
  async expectMciVisible(infraName: string): Promise<void> {
    const deadline = Date.now() + 600_000;
    for (;;) {
      if (await this.mciRow(infraName).isVisible().catch(() => false)) return;
      if (Date.now() > deadline) break;
      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.expectMciListLoaded().catch(() => {});
      await this.page.waitForTimeout(10_000);
    }
    await expect(this.mciRow(infraName)).toBeVisible({ timeout: 20_000 });
  }

  /** 인프라 행 선택(체크박스) — 선택 시 상세/서버 탭이 활성화됨. 행 내 단일 체크박스로 한정. */
  async selectMci(infraName: string): Promise<void> {
    await this.mciRow(infraName)
      .locator('td.select-checkbox .p-checkbox, input[type="checkbox"]')
      .first()
      .click();
  }

  // ─────────────────────────────────────────────────────────────
  // MCI 상세 — cm-beetle/GetInfra
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
    return this.page
      .getByTestId('mci-detail-table');
  }

  /** 상세 탭을 열고 상세 정보 테이블 확인 */
  async openDetailTab(): Promise<void> {
    await this.detailTab.click();
    await expect(this.mciDetailTable).toBeVisible({ timeout: 15_000 });
  }

  /** 서버(노드) 탭 열기 */
  async openServerTab(): Promise<void> {
    await this.serverTab.click();
  }

  // ─────────────────────────────────────────────────────────────
  // 노드(VM) 목록 — MCI 상세 응답의 nodeId 기준
  // ─────────────────────────────────────────────────────────────

  /** 노드(VM) 카드 (p-select-card, 카드 텍스트 = 노드 이름) */
  nodeCard(nodeName: string): Locator {
    return this.page
      .getByTestId(`vm-card-${nodeName}`)
      .or(this.page.locator('.vmList-card', { hasText: nodeName }));
  }

  /** 서버 목록의 노드 카드(이름 무관) — 마이그레이션이 만든 노드는 생성 이름(vm-...)이라 이름을 모른다. */
  private get anyNodeCard(): Locator {
    return this.page.locator('.vmList-card');
  }

  /**
   * 노드가 서버 목록에 보이는지 확인. 마이그레이션이 만드는 노드 이름은 cm-beetle/tumblebug이
   * 생성(vm-...)해 사전에 알 수 없으므로, 지정 이름 카드가 없으면 "노드 카드가 존재"로 확인한다.
   */
  async expectNodeVisible(nodeName: string): Promise<void> {
    await expect(this.nodeCard(nodeName).or(this.anyNodeCard).first()).toBeVisible({
      timeout: 20_000,
    });
  }

  /** 노드 선택(카드 클릭). 지정 이름 카드가 없으면 첫 노드 카드를 선택. */
  async selectNode(nodeName: string): Promise<void> {
    await this.nodeCard(nodeName).or(this.anyNodeCard).first().click();
  }

  // ─────────────────────────────────────────────────────────────
  // 삭제 — DeleteInfra (@costly / 파괴적)
  // ─────────────────────────────────────────────────────────────

  private get actionDropdown(): Locator {
    return this.page
      .getByTestId('mci-action-dropdown');
  }
  private get deleteMenuItem(): Locator {
    return this.page
      .getByTestId('mci-action-delete')
      .or(this.page.getByRole('menuitem', { name: /delete/i }))
      .or(this.page.getByText('Delete', { exact: true }));
  }
  private get deleteModal(): Locator {
    return this.page
      .getByTestId('mci-delete-modal');
  }
  private get deleteConfirmInput(): Locator {
    return this.deleteModal
      .locator('input[data-testid="mci-delete-confirm-keyword"], textarea[data-testid="mci-delete-confirm-keyword"]')
      .or(this.deleteModal.getByRole('textbox'))
      .or(this.deleteModal.locator('input').last());
  }
  private get deleteConfirmButton(): Locator {
    return this.deleteModal
      .getByTestId('mci-delete-confirm')
      .or(this.deleteModal.getByRole('button', { name: /confirm|delete|삭제/i }));
  }

  /** 액션 드롭다운 → Delete 로 삭제 모달 열기 */
  async openDeleteModal(): Promise<void> {
    await this.actionDropdown.click();
    await this.deleteMenuItem.click();
    await expect(this.deleteModal).toBeVisible();
  }

  /**
   * 삭제 확정 — 삭제 방식(normal/force) 선택 후, 인프라 이름을 확인 키워드로 입력하고 confirm.
   * (단건 선택 시 확인 키워드 = 인프라 이름)
   */
  async confirmDelete(
    infraName: string,
    method: 'normal' | 'force' = 'normal',
  ): Promise<void> {
    if (method === 'force') {
      const forceRadio = this.deleteModal
        .getByTestId('mci-delete-method-force');
      await forceRadio.click();
    }
    await this.deleteConfirmInput.fill(infraName);
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden({ timeout: 30_000 });
  }

  // ─────────────────────────────────────────────────────────────
  // 부하테스트 — 노드 상세의 Evaluate Perf 탭 + Load Config 모달 (@costly)
  // ─────────────────────────────────────────────────────────────

  private get evaluatePerfTab(): Locator {
    return this.page
      .getByTestId('vm-tab-evaluatePerf')
      .or(this.page.getByRole('button', { name: /evaluate perf/i }));
  }
  private get loadConfigButton(): Locator {
    return this.page
      .getByTestId('vm-load-config-open');
  }
  private get loadConfigModal(): Locator {
    return this.page
      .getByTestId('load-config-modal');
  }
  private get scenarioTemplatesButton(): Locator {
    return this.page
      .getByTestId('vm-scenario-templates-open');
  }

  /** 노드 상세에서 Evaluate Perf(부하테스트) 탭 열기 */
  async openEvaluatePerfTab(): Promise<void> {
    await this.evaluatePerfTab.click();
  }

  /** 부하설정 모달의 확인(Confirm/Run) 버튼 — PButtonModal 기본 confirm 버튼(.confirm-button) */
  private get loadConfigConfirmButton(): Locator {
    return this.page.locator('.p-button-modal .confirm-button');
  }

  /** Load Config 모달 열기. PButtonModal 래퍼 testid는 가시 요소로 안 잡히므로 첫 입력 필드로 확인. */
  async openLoadConfig(): Promise<void> {
    await this.loadConfigButton.click();
    await expect(
      this.page.locator(
        'input[data-testid="load-config-scenario-name"], textarea[data-testid="load-config-scenario-name"]',
      ),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** 부하 설정 입력 — 비용 보호를 위해 가벼운 값(vu/duration 등)만 채운다 */
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
    await m
      .locator('input[data-testid="load-config-scenario-name"], textarea[data-testid="load-config-scenario-name"]')
      .or(m.getByPlaceholder('Test Scenario Name'))
      .fill(cfg.scenarioName);
    // 대상 호스트(target-host)는 tumblebug이 선택된 VM(노드)의 IP를 자동으로 채워주므로 덮어쓰지 않는다.
    // 자동값이 비어 있는 예외 상황에서만 보조로 채운다.
    const targetHostInput = m
      .locator('input[data-testid="load-config-target-host"], textarea[data-testid="load-config-target-host"]')
      .or(m.getByPlaceholder('Host Name'))
      .first();
    const autoHost = await targetHostInput.inputValue().catch(() => '');
    if (!autoHost && cfg.targetHost) {
      await targetHostInput.fill(cfg.targetHost);
    }
    await m
      .locator('input[data-testid="load-config-port"], textarea[data-testid="load-config-port"]')
      .or(m.getByPlaceholder('1~65535'))
      .fill(cfg.port);
    await m
      .locator('input[data-testid="load-config-path"], textarea[data-testid="load-config-path"]')
      .or(m.getByPlaceholder('Path'))
      .fill(cfg.path);
    await m
      .locator('input[data-testid="load-config-virtual-users"], textarea[data-testid="load-config-virtual-users"]')
      .or(m.getByPlaceholder('Number of virtual users'))
      .fill(cfg.virtualUsers);
    await m
      .locator('input[data-testid="load-config-duration"], textarea[data-testid="load-config-duration"]')
      .or(m.getByPlaceholder('Test Run Time'))
      .fill(cfg.duration);
    await m
      .locator('input[data-testid="load-config-rampup-time"], textarea[data-testid="load-config-rampup-time"]')
      .or(m.getByPlaceholder('Time'))
      .fill(cfg.rampUpTime);
    await m
      .locator('input[data-testid="load-config-rampup-steps"], textarea[data-testid="load-config-rampup-steps"]')
      .or(m.getByPlaceholder('Number of steps'))
      .fill(cfg.rampUpSteps);
  }

  /** 부하테스트 실행(Runloadtest) — PButtonModal 기본 confirm 버튼 클릭 */
  async submitLoadConfig(): Promise<void> {
    await this.loadConfigConfirmButton.last().click();
  }

  /**
   * 노드 상세에서 부하테스트 한 번에 실행: Evaluate Perf 탭 → Load Config 모달 → 설정 입력 → 실행.
   * (perf.steps의 시나리오 스텝이 호출) 노드는 호출 전에 selectNode로 선택돼 있어야 한다.
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
    await this.openEvaluatePerfTab();
    await this.openLoadConfig();
    await this.fillLoadConfig(cfg);
    await this.submitLoadConfig();
  }

  // ─────────────────────────────────────────────────────────────
  // 부하테스트 결과 — Getlastloadtestresult / Getlastloadtestmetrics
  // ─────────────────────────────────────────────────────────────

  /** 집계 테이블(Aggregation Table) */
  private get aggregationTable(): Locator {
    return this.page
      .getByTestId('load-test-aggregation-table');
  }
  /** 결과 메트릭(Result metric) 차트 */
  private get resultMetric(): Locator {
    return this.page
      .getByTestId('load-test-result-metric');
  }
  /** 리소스 메트릭(Resource Metric) 차트 */
  private get resourceMetric(): Locator {
    return this.page
      .getByTestId('load-test-resource-metric');
  }

  /** 부하테스트 결과(집계·결과·리소스 메트릭)가 렌더링됐는지 확인 */
  async expectLoadTestResult(): Promise<void> {
    await expect(this.aggregationTable).toBeVisible({ timeout: 30_000 });
    await expect(this.resultMetric).toBeVisible();
    await expect(this.resourceMetric).toBeVisible();
  }

  // ─────────────────────────────────────────────────────────────
  // 시나리오 카탈로그 — *LoadTestScenarioCatalog*
  // ─────────────────────────────────────────────────────────────

  private get scenarioTemplateModal(): Locator {
    return this.page
      .getByTestId('scenario-template-modal');
  }

  /** 시나리오 템플릿(카탈로그) 관리 모달 열기 */
  async openScenarioTemplates(): Promise<void> {
    await this.scenarioTemplatesButton.click();
    await expect(this.scenarioTemplateModal).toBeVisible();
  }

  /** 시나리오 템플릿 저장(CreateLoadTestScenarioCatalog) */
  async saveScenarioTemplate(name: string): Promise<void> {
    const m = this.scenarioTemplateModal;
    await m
      .locator('input[data-testid="scenario-template-name"], textarea[data-testid="scenario-template-name"]')
      .or(m.getByPlaceholder(/template name|name/i).first())
      .fill(name);
    await m
      .getByTestId('scenario-template-save');
  }

  /** 목록 탭에서 특정 템플릿이 보이는지 확인 */
  async expectScenarioTemplate(name: string): Promise<void> {
    await expect(
      this.scenarioTemplateModal.getByText(name, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
  }

  // ─────────────────────────────────────────────────────────────
  // ★ 마이그레이션 시나리오 재사용 — 인스턴스 생성 확인 / 중지
  // ─────────────────────────────────────────────────────────────

  /**
   * 워크로드 목록에서 마이그레이션으로 생성된 인프라(및 노드)가 실재하는지 확인.
   * 목록에서 인프라를 찾고, 선택 → 서버 탭에서 노드까지 확인한다.
   */
  async expectInstanceCreated(
    infraName: string,
    nodeName?: string,
  ): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    await this.expectMciVisible(infraName);
    if (nodeName) {
      await this.selectMci(infraName);
      await this.openServerTab();
      await this.expectNodeVisible(nodeName);
    }
  }

  /**
   * 생성된 인프라를 중지(suspend/stop)한다 — terminate 금지, 요금 보호.
   * 현행 UI에 중지 액션 data-testid 부여 전이면 액션 메뉴의 Suspend/Stop 항목으로 fallback.
   * (control 미노출 시 Page Object 한 곳만 수정하면 됨)
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
