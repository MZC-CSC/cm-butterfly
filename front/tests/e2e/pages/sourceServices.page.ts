import { Page, expect, Locator } from '@playwright/test';
import { TablePagination } from '../support/pagination';

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
    return this.page.getByTestId('source-services-header');
  }

  /** 목록 상단 "Add" 버튼 → 소스 서비스(그룹) 등록 모달 열기 */
  private get addGroupButton(): Locator {
    return this.page.getByTestId('source-group-add');
  }

  /** 목록 상단 삭제 아이콘(선택 행 삭제) */
  private get deleteGroupIcon(): Locator {
    return this.page.getByTestId('source-group-delete');
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

  /** 소스그룹 목록 테이블 */
  private get groupTable(): Locator {
    return this.page.getByTestId('source-group-list-table');
  }

  /** 소스그룹 목록의 페이지네이션 */
  private get groupPagination(): TablePagination {
    return new TablePagination(this.page, this.groupTable);
  }

  /**
   * 목록에서 소스그룹 행을 실제로 노출시킨다.
   *
   * 이 테이블의 상단 검색창은 mirinae query 태그 방식이라 필터가 붙어 있지 않다(입력해도 목록이 안 줄어든다).
   * 목록은 15행씩 끊기므로, 방금 만든 그룹이 1페이지에 없을 수 있다 — 실제로 그렇게 실패했다.
   * 그래서 검색에 기대지 않고 *페이지를 넘겨 가며* 찾고, 몇 페이지에서 찾았는지도 남긴다.
   */
  private async revealGroup(name: string): Promise<number> {
    // 목록을 서버에서 새로 받아온다.
    // 등록 직후 목록이 자동 갱신되지 않아, 방금 만든 그룹이 화면에 없는 채로 남아 있는 경우가 있다
    // (honeybee에는 들어갔는데 목록에는 안 보이는 상태). 그 상태로 페이지를 넘겨봐야 없는 건 없다.
    // 새로고침하면 1페이지부터 다시 세므로 페이지 번호 계산도 안정된다.
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(this.groupTable).toBeVisible({ timeout: 20_000 });
    return this.groupPagination.expectRowSomewhere(this.groupRow(name), name);
  }

  // ───────────────────────── 소스그룹 등록 모달 (register-source-group) ─────────────────────────

  private get serviceNameInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-service-name"], textarea[data-testid="source-service-name"]',
      )
      .or(this.page.getByPlaceholder('Source Service Name'));
  }
  private get serviceDescriptionInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-service-description"], textarea[data-testid="source-service-description"]',
      )
      .or(
        this.page
          .locator('.source-service-button-modal .layout')
          .first()
          .locator('textarea'),
      );
  }
  /** "With Source Connection" 토글 — 연결정보 등록 흐름을 켠다 */
  private get withConnectionToggle(): Locator {
    return this.page.getByTestId('source-service-with-connection');
  }
  /** 연결정보 입력 화면으로 진입 "Go add Source Connection" */
  private get goAddConnectionButton(): Locator {
    return this.page.getByTestId('source-service-go-add-connection');
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
      .locator(
        'input[data-testid="source-connection-name"], textarea[data-testid="source-connection-name"]',
      )
      .or(this.page.getByPlaceholder('Source Connection Name'));
  }
  private get connIpInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-connection-ip"], textarea[data-testid="source-connection-ip"]',
      )
      .or(this.page.getByPlaceholder('###.###.###.###'));
  }
  private get connPortInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-connection-ssh-port"], textarea[data-testid="source-connection-ssh-port"]',
      )
      .or(this.page.getByPlaceholder('1~65535'));
  }
  private get connUserInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-connection-user"], textarea[data-testid="source-connection-user"]',
      )
      .or(this.page.getByPlaceholder('User ID'));
  }
  private get connPasswordInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-connection-password"], textarea[data-testid="source-connection-password"]',
      )
      .or(this.page.getByPlaceholder('Password'));
  }
  private get connPrivateKeyInput(): Locator {
    return this.page
      .locator(
        'input[data-testid="source-connection-private-key"], textarea[data-testid="source-connection-private-key"]',
      )
      .or(this.page.locator('.private-key textarea'));
  }
  /** 연결정보 폼 적용 "Apply" → 소스그룹 등록 모달로 복귀 */
  private get connApplyButton(): Locator {
    return this.page.getByTestId('source-connection-apply');
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
  /** 연결 목록의 "Export" 버튼 — 선택한 연결이 없으면 비활성 */
  private get exportConnectionButton(): Locator {
    return this.page.getByTestId('source-connection-export');
  }
  /** 익스포트 확인 모달의 안내 문구.
   *  ★ 모달 래퍼의 testid는 가시 요소로 잡히지 않으므로(mirinae PButtonModal)
   *    모달이 열렸는지는 이 *내용물*로 판정한다. */
  private get exportNotice(): Locator {
    return this.page.getByTestId('source-connection-export-notice');
  }
  private get exportConfirmButton(): Locator {
    return this.page.getByTestId('source-connection-export-confirm');
  }
  private get exportCancelButton(): Locator {
    return this.page.getByTestId('source-connection-export-cancel');
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
      .or(
        this.page
          .getByRole('button', { name: /^(Confirm|OK|Delete|확인|삭제)$/ })
          .last(),
      );
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
  async createSourceGroupWithConnection(
    name: string,
    conn: Connection,
  ): Promise<void> {
    await this.addGroupButton.click();
    await this.serviceNameInput.fill(name);
    await this.withConnectionToggle.click();
    await this.goAddConnectionButton.click();
    await this.fillConnection(conn);
    await this.connApplyButton.click();
    await this.groupConfirmButton.click();
    await this.expectGroupListed(name);
  }

  /** 소스그룹을 만들되 연결정보 여러 건을 CSV 대량 임포트로 한 번에 넣는다.
   *  익스포트가 *여러 건 선택*을 제대로 담는지 확인하려면 한 그룹에 연결이 둘 이상 있어야 한다. */
  async createSourceGroupWithBulkImport(
    name: string,
    connNames: string[],
  ): Promise<void> {
    const header = 'name,description,ip_address,ssh_port,user,password,private_key';
    const rows = connNames.map(n => `${n},,10.0.0.1,22,ubuntu,,`);
    const csv = '﻿' + [header, ...rows].join('\n') + '\n';

    await this.addGroupButton.click();
    await this.serviceNameInput.fill(name);
    await this.withConnectionToggle.click();

    await this.page.getByTestId('source-import-input').setInputFiles({
      name: 'bulk.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });

    // 서버 파싱 후 미리보기에 건수가 뜬 뒤 등록한다.
    await expect(this.page.getByTestId('source-import-count')).toContainText(
      String(connNames.length),
      { timeout: 15_000 },
    );
    await this.groupConfirmButton.click();
    await this.expectGroupListed(name);
  }

  /** 목록에서 헤더 체크박스로 모든 행을 한 번에 고른다(여러 건 선택). */
  async checkAllConnections(): Promise<void> {
    await this.connectionsTab.click();
    await this.page
      .locator('thead th.select-checkbox .p-checkbox, thead input[type="checkbox"]')
      .first()
      .click();
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

  // ───────────────────────── 연결정보 익스포트 ─────────────────────────

  /** 연결 목록에서 체크박스로 연결을 고른다.
   *  ★ mirinae 선택 체크박스는 실제 <input>이 아니라 커스텀 요소라
   *    isChecked()가 항상 false를 돌려준다. 선택이 됐는지는 뒤따르는 동작
   *    (Export 버튼 활성화)으로 판정한다. */
  async checkConnection(connName: string): Promise<void> {
    await this.connectionsTab.click();
    await this.connectionRow(connName)
      .first()
      .locator('td.select-checkbox .p-checkbox, input[type="checkbox"]')
      .first()
      .click();
  }

  /** ★ mirinae PButton은 비활성을 class로만 표현한다(표준 disabled 속성이 붙지 않는다).
   *  toBeDisabled()·isEnabled()는 항상 "활성"으로 답하므로 클래스로 판정한다. */
  private async isMirinaeButtonDisabled(locator: Locator): Promise<boolean> {
    return locator.evaluate(el => {
      const button = (el.closest('button') ?? el) as HTMLElement;
      return button.className.split(/\s+/).includes('disabled');
    });
  }

  /** 그룹을 고른 직후에는 Detail 탭이 열려 있어 연결 목록이 아직 없다.
   *  버튼 상태를 보려면 Connections 탭을 먼저 열어야 한다. 이미 열려 있으면 무해하다. */
  private async openConnectionsTab(): Promise<void> {
    await this.connectionsTab.click();
    await expect(this.exportConnectionButton).toBeVisible({ timeout: 15_000 });
  }

  async expectExportDisabled(): Promise<void> {
    await this.openConnectionsTab();
    expect(
      await this.isMirinaeButtonDisabled(this.exportConnectionButton),
    ).toBe(true);
  }

  async expectExportEnabled(): Promise<void> {
    await this.openConnectionsTab();
    expect(
      await this.isMirinaeButtonDisabled(this.exportConnectionButton),
    ).toBe(false);
  }

  /** Export 클릭 → 확인 모달이 열린다(안내 문구로 판정). */
  async openExportConfirm(): Promise<void> {
    await this.exportConnectionButton.click();
    await expect(this.exportNotice).toBeVisible({ timeout: 10_000 });
  }

  /** 확인 모달에서 파일 형식을 고른다(기본은 CSV). */
  async selectExportFormat(format: 'csv' | 'xlsx'): Promise<void> {
    await this.page
      .getByTestId(`source-connection-export-format-${format}`)
      .click();
  }

  /** 암호화 컬럼이 빠진다는 안내가 실제로 보이는지. */
  async expectExportNoticeVisible(): Promise<void> {
    await expect(this.exportNotice).toBeVisible({ timeout: 10_000 });
  }

  /** 확인을 눌러 실제 다운로드까지 받고, 파일명과 내용을 함께 돌려준다.
   *  내용까지 읽는 이유는 암호화 컬럼이 정말 비어 있는지가 이 기능의 핵심 약속이라서다. */
  async confirmExportAndDownload(): Promise<{
    fileName: string;
    content: string;
  }> {
    const downloadEvent = this.page.waitForEvent('download', {
      timeout: 30_000,
    });
    await this.exportConfirmButton.click();
    const download = await downloadEvent;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    return {
      fileName: download.suggestedFilename(),
      // utf-8 BOM은 벗겨서 헤더 비교가 첫 컬럼에서 어긋나지 않게 한다.
      content: Buffer.concat(chunks).toString('utf-8').replace(/^﻿/, ''),
    };
  }

  /** 취소를 누르면 아무 일도 일어나지 않는다(안내 문구가 사라진다). */
  async cancelExport(): Promise<void> {
    await this.exportCancelButton.click();
    await expect(this.exportNotice).toBeHidden({ timeout: 10_000 });
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
    await expect(this.connectionRow(name).first()).toBeVisible({
      timeout: 15_000,
    });
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
