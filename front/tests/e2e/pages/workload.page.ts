import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';

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
    return this.page.getByTestId('mci-list-table');
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
    return this.page.getByTestId('mci-detail-table');
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
    await expect(
      this.nodeCard(nodeName).or(this.anyNodeCard).first(),
    ).toBeVisible({
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
    return this.page.getByTestId('mci-action-dropdown');
  }
  /**
   * 액션 드롭다운의 Delete 항목.
   *
   * mirinae PSelectDropdown 이 메뉴를 `.p-context-menu-item` 스팬으로 그리는데 **role 속성을 붙이지 않는다.**
   * 그래서 getByRole('menuitem') 으로는 안 잡히고, 페이지 전체에서 'Delete' 텍스트를 찾으면 중첩된 스팬
   * 여러 개가 걸려 strict mode 위반이 난다.
   *
   * 그래서 *testid가 붙어 있는 드롭다운 안으로 범위를 좁혀* 디자인 시스템의 항목 클래스로 집는다.
   * (라벨 'Delete' 는 우리 코드의 actionMenus 배열에서 오는 값이라 화면 문구 변덕과 무관하다.)
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
   * 삭제 모달의 확정(Delete) 버튼.
   *
   * BAR-1444 로 모달이 비동기 3단계(confirm/progress/error)가 되며 footer 를 커스텀 슬롯으로 그린다.
   * 각 버튼에 testid 가 붙어 있으므로 그걸로 잡는다(이전의 `.confirm-button` 기본 버튼은 더 이상 없다).
   */
  private get deleteConfirmButton(): Locator {
    return this.page.getByTestId('wl-delete-confirm');
  }
  /** progress/error 단계의 닫기 버튼. */
  private get deleteCloseButton(): Locator {
    return this.page.getByTestId('wl-delete-close');
  }
  /** error 단계의 재시도 버튼(선택 화면으로 되돌아간다). */
  private get deleteRetryButton(): Locator {
    return this.page.getByTestId('wl-delete-retry');
  }
  /** error 단계의 강제 삭제 버튼. */
  private get deleteForceEnterButton(): Locator {
    return this.page.getByTestId('wl-delete-force-enter');
  }
  /** progress 단계 컨테이너(삭제 처리 중). */
  private get deleteProgress(): Locator {
    return this.page.getByTestId('mci-delete-progress');
  }
  /** error 단계 컨테이너(기존 삭제 실패). */
  private get deleteErrorDialog(): Locator {
    return this.page.getByTestId('mci-delete-error');
  }
  /** 목록 행의 삭제 상태 셀(진행 중/에러). */
  private mciRowDeleteStatus(): Locator {
    return this.page.getByTestId('wl-row-delete-status');
  }

  /**
   * 액션 드롭다운 → Delete 로 삭제 모달 열기.
   *
   * 모달이 열렸는지는 *실제로 보이는 요소*(확인 키워드 입력칸)로 판정한다.
   * `mci-delete-modal` testid는 PButtonModal 래퍼에 달려 있어 가시 요소로 잡히지 않는다
   * (load-config 모달·모델 저장 폼에서 이미 겪은 함정이라 같은 방식으로 처리한다).
   */
  async openDeleteModal(): Promise<void> {
    await this.actionDropdown.click();
    await this.deleteMenuItem.click();
    await expect(this.deleteConfirmInput.first()).toBeVisible({
      timeout: 15_000,
    });
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
      const forceRadio = this.deleteModal.getByTestId(
        'mci-delete-method-force',
      );
      await forceRadio.click();
    }
    await this.deleteConfirmInput.first().fill(infraName);
    await this.deleteConfirmButton.first().click();
  }

  /**
   * 삭제 모달이 스스로 닫히는지 확인한다.
   *
   * ★ 이건 *화면의 동작*을 보는 것이고, 실제로 지워졌는지와는 별개다.
   *   삭제 모달은 확정 버튼을 누른 뒤 요청 하나를 동기로 붙들고 기다린다. 인프라 삭제는 클라우드 자원을
   *   실제로 지우는 일이라 수 분이 걸리고, 그동안 모달은 열린 채다. 실패하면 모달을 닫지도 않는다.
   *
   *   여기서 실패가 나면 **그건 화면의 결함이지, 테스트가 틀린 게 아니다.** 단언을 무르지 않고 그대로 드러낸다.
   *   실제 삭제 여부는 아래 expectInfraGone() 으로 따로 확인한다 — 화면이 안 닫혀도 자원은 지워졌을 수 있다.
   *
   * @returns 닫혔으면 true. 끝내 안 닫혔으면 false(호출부가 결함으로 기록한다).
   */
  async deleteModalClosed(timeoutMs = 3 * 60_000): Promise<boolean> {
    return this.deleteConfirmInput
      .first()
      .isHidden({ timeout: timeoutMs })
      .catch(() => false);
  }

  // ── BAR-1444 비동기 삭제 흐름 ──────────────────────────────────────────────

  /** 삭제를 누른 뒤 모달이 "삭제 처리 중"(progress)으로 바뀌었는지. */
  async expectDeleteInProgress(): Promise<void> {
    await expect(this.deleteProgress).toBeVisible({ timeout: 15_000 });
  }

  /** progress/error 단계에서 [닫기]. 목록으로 돌아가 삭제 상태 컬럼을 본다. */
  async closeDeleteModal(): Promise<void> {
    await this.deleteCloseButton.click();
  }

  /** 목록 행의 삭제 상태 셀에 지정 문구(진행 중/에러)가 보이는지. */
  async expectRowDeleteStatus(text: '진행 중' | '에러'): Promise<void> {
    await expect(
      this.mciRowDeleteStatus().filter({ hasText: text }).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** error 단계(기존 삭제 실패)로 열렸는지. */
  async expectDeleteErrorDialog(): Promise<void> {
    await expect(this.deleteErrorDialog).toBeVisible({ timeout: 15_000 });
  }

  /** error 단계에서 [재시도] — 선택 화면으로 되돌아간다. */
  async retryDelete(): Promise<void> {
    await this.deleteRetryButton.click();
    await expect(this.deleteConfirmInput.first()).toBeVisible({
      timeout: 10_000,
    });
  }

  /** error 단계에서 [강제 삭제]. */
  async forceDeleteFromError(): Promise<void> {
    await this.deleteForceEnterButton.click();
  }

  /**
   * 목록을 다시 방문해 인프라가 *실제로* 사라졌는지 확인한다.
   * 목록은 자동 갱신되지 않으므로 새로고침하며 본다. 이게 삭제의 진짜 결과다.
   *
   * ★ 반드시 *전 페이지*를 훑는다. 목록은 15행씩 끊기므로 1페이지만 보고 "없다"고 하면, 뒤 페이지에
   *   멀쩡히 살아 있는 인프라를 지웠다고 오판한다. 실제로 그렇게 통과한 적이 있고, 그동안 EC2가
   *   계속 떠 있었다. 삭제 확인은 *자원이 정말 없어졌다*는 뜻이어야 한다.
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
        `"${infraName}" 인프라가 끝내 지워지지 않았다(목록에 그대로 남아 있다).`,
      ).toBeTruthy();
      await this.page.waitForTimeout(20_000);
    }
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
    // 노드 상세 기본 탭(Information)의 "Load Config" 버튼(텍스트 버튼) 우선, Evaluate Perf 탭 버튼(testid)도 허용.
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

    // ★ testid만 쓴다 — placeholder fallback 금지.
    //   예전엔 `.or(getByPlaceholder('Time'))` 같은 fallback을 달아 뒀는데, 'Time'이 "Time"과
    //   "Test Run Time" 두 입력칸에 모두 걸려 strict mode 위반으로 죽었다. 화면 문구는 언제든 바뀌므로
    //   문구에 기대지 않는다. 필요한 testid는 이미 화면 소스에 전부 부여돼 있다.
    const field = (testid: string): Locator =>
      m.locator(
        `input[data-testid="${testid}"], textarea[data-testid="${testid}"]`,
      );

    await field('load-config-scenario-name').fill(cfg.scenarioName);

    // 대상 호스트는 선택된 노드의 IP로 자동으로 채워진다. 자동값이 있으면 덮어쓰지 않고,
    // 비어 있을 때만 보조로 채운다.
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
    // 노드 선택 직후 기본 탭(Information)에 Load Config 버튼이 있으므로 탭 전환 없이 바로 연다.
    await this.openLoadConfig();
    await this.fillLoadConfig(cfg);
    await this.submitLoadConfig();
  }

  // ─────────────────────────────────────────────────────────────
  // 부하테스트 결과 — Getlastloadtestresult / Getlastloadtestmetrics
  // ─────────────────────────────────────────────────────────────

  /** 집계 테이블(Aggregation Table) */
  private get aggregationTable(): Locator {
    return this.page.getByTestId('load-test-aggregation-table');
  }
  /** 결과 메트릭(Result metric) 차트 */
  private get resultMetric(): Locator {
    return this.page.getByTestId('load-test-result-metric');
  }
  /** 리소스 메트릭(Resource Metric) 차트 */
  private get resourceMetric(): Locator {
    return this.page.getByTestId('load-test-resource-metric');
  }

  /**
   * 부하테스트 결과(집계 표 · 결과 차트 · 리소스 차트)가 렌더링됐는지 확인한다.
   *
   * 실행을 누른다고 결과가 바로 나오지 않는다 — cm-ant 가 부하를 걸고(설정상 10초), 그 결과를 수집·집계하고,
   * 리소스 메트릭은 대상 노드에 PerfMon 에이전트를 설치한 뒤에야 모인다. 다 합쳐 수 분이 걸린다.
   * 30초로 끊으면 "결과가 없다"가 아니라 "아직 집계 중"인데 실패로 판정하게 된다.
   *
   * 그래서 결과가 뜰 때까지 화면을 새로고침하며 기다린다. 세 가지가 다 나와야 통과다 —
   * 집계 표(성능 수치) · 결과 차트 · 리소스 차트.
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
          '부하테스트 집계 결과가 끝내 표시되지 않았다(cm-ant 실행/집계 상태 확인 필요).',
        ).toBeVisible({ timeout: 30_000 });
        break;
      }

      await this.page.waitForTimeout(15_000);

      // ★ 그냥 새로고침하면 안 된다.
      //   인프라·노드 선택은 화면 상태라서, 새로고침하면 선택이 풀리고 성능 탭 자체가 사라진다.
      //   그러면 집계 표는 영영 안 보이고, "결과가 없다"고 오판하게 된다(실제로 그렇게 실패했다 —
      //   cm-ant 쪽 부하테스트는 successed 였는데도).
      //   결과를 다시 보려면 선택을 처음부터 다시 세워야 한다.
      await this.gotoMci();
      await this.expectMciListLoaded();
      await this.selectMci(infraName);
      await this.openServerTab();
      await this.selectNode(nodeName);
      await this.openEvaluatePerfTab().catch(() => {});
    }

    await expect(this.resultMetric, '부하테스트 결과 차트가 없다').toBeVisible({
      timeout: 60_000,
    });
    await expect(this.resourceMetric, '리소스 메트릭 차트가 없다').toBeVisible({
      timeout: 60_000,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 시나리오 카탈로그 — *LoadTestScenarioCatalog*
  // ─────────────────────────────────────────────────────────────

  private get scenarioTemplateModal(): Locator {
    return this.page.getByTestId('scenario-template-modal');
  }

  /** 시나리오 템플릿(카탈로그) 관리 모달 열기 */
  async openScenarioTemplates(): Promise<void> {
    await this.scenarioTemplatesButton.click();
    await expect(this.scenarioTemplateModal).toBeVisible();
  }

  /** 시나리오 템플릿 저장(CreateLoadTestScenarioCatalog) */
  async saveScenarioTemplate(name: string): Promise<void> {
    const m = this.scenarioTemplateModal;
    // testid 전용 — 화면 문구(placeholder)에 기대지 않는다.
    await m
      .locator(
        'input[data-testid="scenario-template-name"], textarea[data-testid="scenario-template-name"]',
      )
      .fill(name);
    // 예전엔 여기서 locator만 만들고 끝나서(.click() 없음) 저장이 실제로 일어나지 않았다.
    await m.getByTestId('scenario-template-save').click();
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
   * 마이그레이션으로 만들어진 인프라의 노드가 *실제로 떠 있는지* 확인한다.
   *
   * ★ 행이 보이는 것만으로는 부족하다.
   *   cm-beetle은 타깃 인프라 이름을 늘 `infra101`로 만든다. 그래서 앞선 실행이 남긴 인프라가 그대로 있으면,
   *   이번 실행이 아무것도 만들지 못했어도 같은 이름의 행이 보인다. 실제로 노드가 죽어 있는(Terminated)
   *   인프라를 보고 "EC2가 정상 생성됐다"고 통과하던 적이 있다 — 전형적인 거짓 통과다.
   *
   *   그래서 상태 열이 *Running* 인지까지 본다. 목록의 Status는 "Running:1 (R:1/1)" 처럼 표시되고,
   *   죽어 있으면 "Terminated:1 (R:0/1)" 이 된다.
   */
  async expectInstanceCreated(
    infraName: string,
    nodeName?: string,
  ): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    await this.expectMciVisible(infraName);

    // 프로비저닝은 시간이 걸린다 — Running이 될 때까지 새로고침하며 기다린다.
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      const text =
        (await this.mciRow(infraName)
          .innerText()
          .catch(() => '')) || '';
      if (/Running:\s*[1-9]/.test(text)) break;
      expect(
        Date.now() < deadline,
        `"${infraName}" 인프라의 노드가 Running 상태가 되지 않았다. 현재 상태: ${text.replace(/\s+/g, ' ').trim()}`,
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
   * 앞선 실행이 남긴 같은 이름의 인프라를 지운다.
   *
   * cm-beetle이 타깃 이름을 늘 `infra101`로 만들기 때문에, 죽은 인프라가 남아 있으면 이번 실행의 결과와
   * 구분되지 않는다(위의 거짓 통과가 그래서 생겼다). 시나리오 시작 전에 깨끗이 치우고 들어간다.
   */
  async removeStaleInfra(infraName: string): Promise<void> {
    await this.gotoMci();
    await this.expectMciListLoaded();
    // 잔재도 전 페이지를 훑어 찾는다 — 1페이지만 보면 뒤 페이지의 잔재를 못 지우고 지나간다.
    const pager = new TablePagination(this.page, this.mciTable);
    if (await pager.isRowAbsent(this.mciRow(infraName))) {
      return; // 남은 게 없다 — 그대로 진행
    }
    console.log(
      `[scenario] 앞선 실행이 남긴 "${infraName}" 인프라를 정리하고 시작한다.`,
    );
    await this.selectMci(infraName);
    await this.openDeleteModal();
    // Force Delete 는 메타데이터만 지우고 EC2를 남긴다(요금이 계속 나간다). 사전 정리도 Normal 로 한다.
    await this.confirmDelete(infraName, 'normal');

    // 모달이 안 닫히는 건 알려진 화면 결함이다(요청 하나를 동기로 붙들고, 실패해도 닫지 않는다).
    // 여기서는 시나리오를 세우기 위한 *사전 정리*이므로 결함을 기록만 하고 진행한다.
    // 결함 자체는 시나리오 본편의 정리 단계에서 정식으로 판정한다.
    if (!(await this.deleteModalClosed())) {
      console.warn(
        '[scenario] 삭제 모달이 스스로 닫히지 않았다(화면 결함). 실제 삭제 여부는 목록에서 다시 확인한다.',
      );
    }
    await this.expectInfraGone(infraName);
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
