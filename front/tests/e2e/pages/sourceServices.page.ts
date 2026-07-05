import { Page, expect, Locator } from '@playwright/test';

/**
 * SourceServicesPage — 소스 서비스(소스 컴퓨팅, cm-honeybee) 화면의 "어디서/어떻게".
 *
 * ★ 시나리오(.feature)의 "소스서버를 등록한다"·"인프라를 수집한다"는 *의도*만 담고,
 *   실제 화면 위치(URL)와 요소(셀렉터)·조작 순서는 여기 한 곳에 모읍니다.
 *   → 화면이 바뀌면 이 파일만 고치면 되고, 한국어 시나리오는 그대로 유지됩니다.
 *
 * 대응 화면·operationId (cm-honeybee 경유):
 *  - 소스그룹 목록/조회/삭제 : list-source-group / get-source-group / delete-source-group
 *  - 소스그룹 등록(연결정보 포함) : register-source-group  (연결정보는 create-connection-info 형태로 함께 전송)
 *  - 연결·에이전트 상태 확인   : agent-and-connection-check
 *  - 인프라 수집             : import-infra   → 정제 결과 get-infra-info-refined
 *  - 소프트웨어 수집          : import-software
 *
 * 셀렉터는 data-testid 우선(getByTestId) + 아직 미부여 구간은 실제 .vue의
 * placeholder/label/버튼 텍스트로 fallback. data-testid 부여(BAR-880) 후 fallback 제거.
 */
export class SourceServicesPage {
  /** ★ 화면 위치(URL) — 라우트 /main + source-computing/source-services */
  static readonly path = '/main/source-computing/source-services';

  constructor(private readonly page: Page) {}

  // ───────────────────────── 소스그룹(Source Service) 목록 ─────────────────────────

  /** 화면 헤더 "Source Services" */
  private get pageHeader(): Locator {
    return this.page
      .getByTestId('source-services-header');
  }

  /** 목록 상단 "Add" 버튼 → 소스 서비스(그룹) 등록 모달 열기 */
  private get addGroupButton(): Locator {
    return this.page
      .getByTestId('source-group-add');
  }

  /** 목록 상단 삭제 아이콘(선택 행 삭제) */
  private get deleteGroupIcon(): Locator {
    return this.page
      .getByTestId('source-group-delete');
  }

  /**
   * 이름으로 소스그룹 행 찾기(선택·상세 진입용).
   * 검색창 필터를 켜면 검색어 칩에도 동일 텍스트가 생기므로 getByText fallback은 쓰지 않고
   * 반드시 테이블 행(role=row)만 매칭한다(칩을 잘못 클릭하면 상세가 열리지 않음).
   */
  private groupRow(name: string): Locator {
    return this.page
      .getByTestId(`source-group-row-${name}`)
      .or(this.page.getByRole('row', { name: new RegExp(name) }));
  }

  /** 목록 상단 검색창(PToolboxTable plain search) */
  private get listSearchInput(): Locator {
    return this.page
      .getByRole('textbox', { name: 'Search' })
      .or(this.page.getByPlaceholder('Search'))
      .first();
  }

  /**
   * 소스그룹 목록은 PToolboxTable 클라이언트 페이징(pageSize 15)이라, 누적 데이터가 많으면
   * 대상 그룹 행이 1페이지 밖에 있을 수 있다. 목록 상단 검색창에 고유 이름을 입력해 해당 행만
   * 남도록 필터링하면 목록 크기·페이지와 무관하게 행을 노출시킬 수 있다.
   */
  private async revealGroup(name: string): Promise<void> {
    const search = this.listSearchInput;
    if ((await search.count()) === 0) return; // 검색창이 없으면 그대로 진행(호출부 assert가 처리)
    await search.click();
    await search.fill('');
    await search.fill(name);
    await search.press('Enter');
    // 클라이언트 필터 반영 대기
    await this.page.waitForTimeout(800);
  }

  // ───────────────────────── 소스그룹 등록 모달 (register-source-group) ─────────────────────────

  private get serviceNameInput(): Locator {
    return this.page
      .locator('input[data-testid="source-service-name"], textarea[data-testid="source-service-name"]')
      .or(this.page.getByPlaceholder('Source Service Name'));
  }
  private get serviceDescriptionInput(): Locator {
    return this.page
      .locator('input[data-testid="source-service-description"], textarea[data-testid="source-service-description"]')
      .or(this.page.locator('.source-service-button-modal .layout').first().locator('textarea'));
  }
  /** "With Source Connection" 토글 — 연결정보 등록 흐름을 켠다 */
  private get withConnectionToggle(): Locator {
    return this.page
      .getByTestId('source-service-with-connection');
  }
  /** 연결정보 입력 화면으로 진입 "Go add Source Connection" */
  private get goAddConnectionButton(): Locator {
    return this.page
      .getByTestId('source-service-go-add-connection');
  }
  /** 소스그룹 등록 모달 확정(footer의 "Add").
   *  mirinae PButtonModal의 #confirm-button 슬롯은 `<span data-testid=...>`로 라벨만 담고
   *  실제 클릭 대상은 이를 감싸는 <button>이다. testid를 앵커로 그 버튼을 지정한다(활성화 대기 포함). */
  private get groupConfirmButton(): Locator {
    return this.page.locator('button', {
      has: this.page.getByTestId('source-service-confirm'),
    });
  }

  // ───────────────────────── 연결정보 폼 (create-connection-info 형태) ─────────────────────────

  private get connNameInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-name"], textarea[data-testid="source-connection-name"]')
      .or(this.page.getByPlaceholder('Source Connection Name'));
  }
  private get connIpInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-ip"], textarea[data-testid="source-connection-ip"]')
      .or(this.page.getByPlaceholder('###.###.###.###'));
  }
  private get connPortInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-ssh-port"], textarea[data-testid="source-connection-ssh-port"]')
      .or(this.page.getByPlaceholder('1~65535'));
  }
  private get connUserInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-user"], textarea[data-testid="source-connection-user"]')
      .or(this.page.getByPlaceholder('User ID'));
  }
  private get connPasswordInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-password"], textarea[data-testid="source-connection-password"]')
      .or(this.page.getByPlaceholder('Password'));
  }
  private get connPrivateKeyInput(): Locator {
    return this.page
      .locator('input[data-testid="source-connection-private-key"], textarea[data-testid="source-connection-private-key"]')
      .or(this.page.locator('.private-key textarea'));
  }
  /** 연결정보 폼 적용 "Apply" → 소스그룹 등록 모달로 복귀 */
  private get connApplyButton(): Locator {
    return this.page
      .getByTestId('source-connection-apply');
  }

  // ───────────────────────── 상세 / 연결 목록 / 수집 탭 ─────────────────────────

  /** mirinae PTab 탭 선택 — 탭은 testid 전파가 어려워 ARIA role(tab)+접근명으로 안정 선택한다.
   *  프레임워크 렌더 탭의 표준 셀렉터 컨벤션(단일 매칭, 텍스트/nth 취약성 회피). */
  private tab(name: RegExp): Locator {
    return this.page.getByRole('tab', { name });
  }

  private get connectionsTab(): Locator {
    return this.tab(/Connections/i);
  }
  /** 연결 목록의 "Add / Edit" 버튼(연결정보 추가·수정 모달) */
  private get addEditConnectionButton(): Locator {
    return this.page.getByTestId('source-connection-add-edit');
  }
  private connectionRow(name: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(name) });
  }
  private get infoTab(): Locator {
    return this.tab(/Information/i);
  }
  private get infraCollectTab(): Locator {
    return this.tab(/Infra Collect/i);
  }
  private get softwareCollectTab(): Locator {
    return this.tab(/Software Collect/i);
  }
  // 그룹(서비스) 상세 하단 — Refresh(연결 상태 확인) 후 Collect Infra/SW 활성화 (SourceServiceDetail)
  /** 상세 하단 "Refresh" — 연결 상태 점검(정상이면 Collect 버튼 활성화) */
  private get groupRefreshButton(): Locator {
    return this.page.getByTestId('source-group-refresh');
  }
  /** 상세 하단 "Collect Infra" (그룹단위 import-infra — honeybee가 실제 SSH 수집) */
  private get collectInfraButton(): Locator {
    return this.page.getByTestId('source-group-collect-infra');
  }
  /** 상세 하단 "Collect SW" (그룹단위 import-software) */
  private get collectSwButton(): Locator {
    return this.page.getByTestId('source-group-collect-sw');
  }
  /** 수집 성공 시 노출되는 "View Infra(Meta) ->" 링크 */
  private get viewInfraLink(): Locator {
    return this.page.getByTestId('source-group-view-infra-meta');
  }
  private get viewSwLink(): Locator {
    return this.page.getByTestId('source-group-view-sw-meta');
  }

  // ── 수집 결과 팝업(refine) → damselfly 소스모델 저장 ─────────────────
  /** 팝업 중앙 "Convert" 버튼(좌측 수집정보 → 우측 정제정보) */
  private get refineConvertButton(): Locator {
    return this.page.getByTestId('source-refine-convert');
  }
  /** 팝업 "Save" 버튼(Convert 후 활성화) */
  private get refineSaveButton(): Locator {
    return this.page.getByTestId('source-refine-save');
  }
  /** 저장 모달(SimpleEditForm) 모델명 입력 */
  private get refineModelNameInput(): Locator {
    return this.page.locator(
      'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
    );
  }
  /** 저장 모달 확정(model-name-save span을 감싸는 버튼) */
  private get refineModelNameConfirm(): Locator {
    return this.page.locator('button', {
      has: this.page.getByTestId('model-name-save'),
    });
  }

  /** 삭제 확인 모달의 확정 버튼 */
  private get deleteConfirmButton(): Locator {
    return this.page
      .getByTestId('delete-confirm')
      .or(this.page.getByRole('button', { name: /^(Confirm|OK|Delete|확인|삭제)$/ }).last());
  }

  // ───────────────────────── 액션 ─────────────────────────

  /** 소스 서비스 화면으로 이동 */
  async goto(): Promise<void> {
    await this.page.goto(SourceServicesPage.path);
    await expect(this.addGroupButton).toBeVisible({ timeout: 15_000 });
  }

  /** 소스그룹만 생성(연결정보 없이) — register-source-group */
  async createSourceGroup(name: string, description = ''): Promise<void> {
    await this.addGroupButton.click();
    await this.serviceNameInput.fill(name);
    if (description) await this.serviceDescriptionInput.fill(description);
    await this.groupConfirmButton.click();
  }

  /** 연결정보 폼 채우기(현재 열린 폼 기준) */
  async fillConnection(conn: Connection): Promise<void> {
    await this.connNameInput.fill(conn.name);
    await this.connIpInput.fill(conn.ip);
    await this.connPortInput.fill(String(conn.sshPort ?? '22'));
    await this.connUserInput.fill(conn.user);
    if (conn.password) await this.connPasswordInput.fill(conn.password);
    if (conn.privateKey) await this.connPrivateKeyInput.fill(conn.privateKey);
  }

  /**
   * 소스그룹 + 연결정보를 한 번에 등록(마이그레이션 기본 경로).
   * 흐름: Add → 그룹명 입력 → With Source Connection 토글 → Go add Source Connection
   *      → 연결정보 폼 입력 → Apply → 그룹 모달 Add 확정.
   */
  async createSourceGroupWithConnection(name: string, conn: Connection): Promise<void> {
    await this.addGroupButton.click();
    await this.serviceNameInput.fill(name);
    await this.withConnectionToggle.click();
    await this.goAddConnectionButton.click();
    await this.fillConnection(conn);
    await this.connApplyButton.click();
    await this.groupConfirmButton.click();
    await this.expectGroupListed(name);
  }

  /** 이름으로 소스그룹 선택(상세 진입) */
  async selectGroup(name: string): Promise<void> {
    await this.revealGroup(name);
    await this.groupRow(name).first().click();
  }

  /** 연결 탭 열기 + 특정 연결정보 선택 */
  async openConnection(connName: string): Promise<void> {
    await this.connectionsTab.click();
    await this.connectionRow(connName).first().click();
  }

  /** 연결 상태 점검(Refresh) — 정상이어야 Collect 버튼 활성화. 상세가 열린 상태에서 호출. */
  async refreshGroupStatus(): Promise<void> {
    await this.groupRefreshButton.click();
    // 상태 반영(로딩 종료) 대기 후 Collect가 활성화됨
    await expect(this.collectInfraButton).toBeEnabled({ timeout: 30_000 });
  }

  /** 인프라 수집 실행 (그룹단위 import-infra) — 선택된 그룹 상세에서 Refresh 후 Collect Infra */
  async collectInfra(): Promise<void> {
    await this.refreshGroupStatus();
    await this.collectInfraButton.click();
  }

  /** 소프트웨어 수집 실행 (그룹단위 import-software) — Refresh 후 Collect SW */
  async collectSoftware(): Promise<void> {
    await this.refreshGroupStatus();
    await this.collectSwButton.click();
  }

  /**
   * 수집된 인프라를 damselfly 소스모델(OnPremiseModel, "Basic")로 저장.
   * ★ Collect Infra 버튼이 수집 후 Refine 팝업을 *자동으로* 연다(SourceServiceDetail getSourceGroupInfras).
   *   따라서 팝업이 열린 상태에서 Convert(좌 수집→우 정제) → Save(활성화) → 모델명 입력 → 확인.
   */
  async saveCollectedInfraAsSourceModel(name: string): Promise<void> {
    await this.refineConvertButton.click();
    await this.refineSaveButton.click(); // Convert 후 활성화(자동 대기)
    await this.refineModelNameInput.fill(name);
    await this.refineModelNameConfirm.click();
  }

  /** 수집된 소프트웨어를 damselfly 소스모델(SoftwareModel, "Basic")로 저장(인프라와 동일 팝업 흐름). */
  async saveCollectedSwAsSourceModel(name: string): Promise<void> {
    await this.refineConvertButton.click();
    await this.refineSaveButton.click();
    await this.refineModelNameInput.fill(name);
    await this.refineModelNameConfirm.click();
  }

  /** 선택된 소스그룹 삭제 (delete-source-group) */
  async deleteSelectedGroup(): Promise<void> {
    await this.deleteGroupIcon.click();
    await this.deleteConfirmButton.click();
  }

  // ───────────────────────── 검증 ─────────────────────────

  async expectOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/source-services/);
    await expect(this.pageHeader).toBeVisible();
  }

  async expectGroupListed(name: string): Promise<void> {
    await this.revealGroup(name);
    await expect(this.groupRow(name).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectGroupNotListed(name: string): Promise<void> {
    await expect(this.groupRow(name).first()).toHaveCount(0);
  }

  async expectConnectionListed(name: string): Promise<void> {
    await expect(this.connectionRow(name).first()).toBeVisible({ timeout: 15_000 });
  }

  /** 인프라 수집 결과 조회 확인 — Collect Infra가 수집 후 Refine 팝업을 자동으로 열어
   *  Convert 버튼이 노출되면 수집 결과가 조회 가능한 상태다. 실 honeybee SSH 수집이라 최대 120s. */
  async expectInfraCollected(): Promise<void> {
    await expect(this.refineConvertButton).toBeVisible({ timeout: 120_000 });
  }

  async expectSoftwareCollected(): Promise<void> {
    await expect(this.refineConvertButton).toBeVisible({ timeout: 120_000 });
  }
}

/** 연결정보 데이터 형태(스텝에서 fixtures로 조립) */
export type Connection = {
  name: string;
  ip: string;
  sshPort?: string | number;
  user: string;
  password?: string;
  privateKey?: string;
  description?: string;
};
