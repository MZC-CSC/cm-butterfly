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

  /** 이름으로 소스그룹 행 찾기(선택·상세 진입용) */
  private groupRow(name: string): Locator {
    return this.page
      .getByTestId(`source-group-row-${name}`)
      .or(this.page.getByRole('row', { name: new RegExp(name) }))
      .or(this.page.getByText(name, { exact: true }));
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
  /** "Collect Infra" 버튼 (import-infra) */
  private get collectInfraButton(): Locator {
    return this.page
      .getByTestId('collect-infra');
  }
  /** "Collect SW" 버튼 (import-software) */
  private get collectSwButton(): Locator {
    return this.page
      .getByTestId('collect-software');
  }
  /** 인프라 수집·정제 결과 진입 링크 "View Infra(Meta) ->" (수집 성공 시 노출) */
  private get viewInfraLink(): Locator {
    return this.page
      .getByTestId('view-infra-meta');
  }
  private get viewSwLink(): Locator {
    return this.page
      .getByTestId('view-software-meta');
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
    await this.groupRow(name).first().click();
  }

  /** 연결 탭 열기 + 특정 연결정보 선택 */
  async openConnection(connName: string): Promise<void> {
    await this.connectionsTab.click();
    await this.connectionRow(connName).first().click();
  }

  /** 인프라 수집 실행 (import-infra) */
  async collectInfra(): Promise<void> {
    await this.infraCollectTab.click();
    await this.collectInfraButton.click();
  }

  /** 소프트웨어 수집 실행 (import-software) */
  async collectSoftware(): Promise<void> {
    await this.softwareCollectTab.click();
    await this.collectSwButton.click();
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
    await expect(this.groupRow(name).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectGroupNotListed(name: string): Promise<void> {
    await expect(this.groupRow(name).first()).toHaveCount(0);
  }

  async expectConnectionListed(name: string): Promise<void> {
    await expect(this.connectionRow(name).first()).toBeVisible({ timeout: 15_000 });
  }

  /** 인프라 수집 결과가 조회 가능한 상태(정제 결과 링크 노출)인지 확인 */
  async expectInfraCollected(): Promise<void> {
    await expect(this.viewInfraLink).toBeVisible({ timeout: 60_000 });
  }

  async expectSoftwareCollected(): Promise<void> {
    await expect(this.viewSwLink).toBeVisible({ timeout: 60_000 });
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
