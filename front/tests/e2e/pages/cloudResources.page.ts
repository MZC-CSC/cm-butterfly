import { Page, expect, Locator } from '@playwright/test';

/**
 * CloudResourcesPage — 클라우드 리소스 도메인(자격증명·VPC)의 "어디서/어떻게" 계층.
 *
 * ★ 시나리오(.feature)는 "자격증명을 등록한다"는 *의도*만 담고,
 *   화면 위치(URL)와 요소(셀렉터)는 이 파일 한 곳에 모읍니다.
 *   → 화면이 바뀌면 이 파일만 고치면 되고, 한국어 시나리오는 그대로 유지됩니다.
 *
 * 대상 operationId(백엔드 계약):
 *  - CSP 자격증명: List-Credential / Register-Credential / Unregister-Credential (cb-spider)
 *  - VPC(vNet):    getallvnet / postvnet / delvnet (cb-tumblebug)
 *
 * data-testid 우선. 아직 프론트에 data-testid가 부여되지 않은 구간(BAR-880 예정)은
 * 실제 .vue 구조 기준 fallback(role/text/label)으로 둔다. 부여 후 fallback 제거.
 */
export class CloudResourcesPage {
  /** ★ 화면 위치(URL) */
  static readonly credentialsPath = '/main/cloud-resources/cloud-credentials';
  static readonly apisPath = '/main/cloud-resources/apis';
  /**
   * VPC 관리 화면. 현재 라우터에는 cloud-credentials·apis만 정식 등록돼 있고
   * VPC 목록/삭제 UI는 cloud-resources 영역(WIP)에 속한다. 정식 라우팅이 생기면 여기만 수정.
   */
  static readonly vpcPath = '/main/cloud-resources/apis';

  constructor(private readonly page: Page) {}

  // ────────────────────────────────────────────────────────────────
  // CSP 자격증명 (cb-spider)
  // ────────────────────────────────────────────────────────────────

  /** 자격증명 목록 컨테이너(헤더 "Cloud Credentials" + 목록 테이블) */
  private get credentialListRoot(): Locator {
    return this.page
      .getByTestId('credential-list');
  }

  /** 목록 상단 "Add" 버튼(등록 모달 오픈) */
  private get addCredentialButton(): Locator {
    return this.page
      .getByTestId('credential-add');
  }

  /** 등록 모달(헤더 "Add Credential") */
  private get credentialModal(): Locator {
    return this.page
      .getByTestId('credential-modal');
  }

  /** 모달 내 텍스트 입력(순서: Credential Name / AWS ACCESS KEY / AWS SECRET KEY) */
  private credentialInput(index: number, testid: string): Locator {
    return this.credentialModal
      .getByTestId(testid)
      .or(this.credentialModal.getByRole('textbox').nth(index));
  }

  /** 모달 확정 버튼(i18n ADD) */
  private get credentialConfirmButton(): Locator {
    return this.credentialModal
      .getByTestId('credential-modal-confirm');
  }

  /** 목록 테이블에서 이름으로 행 찾기 */
  private credentialRow(name: string): Locator {
    return this.page
      .getByTestId(`credential-row-${name}`)
      .or(this.page.getByRole('row', { name: new RegExp(name) }))
      .or(this.page.getByText(name, { exact: true }).first());
  }

  /** 자격증명 화면으로 이동 */
  async gotoCredentials(): Promise<void> {
    await this.page.goto(CloudResourcesPage.credentialsPath);
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }

  /** 목록이 보이는지 확인 */
  async expectCredentialListVisible(): Promise<void> {
    await expect(this.credentialListRoot).toBeVisible({ timeout: 15_000 });
  }

  /**
   * 자격증명 등록(Register-Credential). 등록 모달을 열어 AWS access/secret key를 입력하고 확정.
   * 현재 모달은 AWS 전용 스키마.
   */
  async registerCredential(cred: {
    name: string;
    accessKey: string;
    secretKey: string;
  }): Promise<void> {
    await this.addCredentialButton.click();
    await expect(this.credentialModal).toBeVisible({ timeout: 10_000 });
    await this.credentialInput(0, 'credential-name').fill(cred.name);
    await this.credentialInput(1, 'credential-access-key').fill(cred.accessKey);
    await this.credentialInput(2, 'credential-secret-key').fill(cred.secretKey);
    await this.credentialConfirmButton.click();
    await expect(this.credentialModal).toBeHidden({ timeout: 10_000 });
  }

  /** 이름으로 자격증명이 목록에 있는지 확인 */
  async expectCredentialListed(name: string): Promise<void> {
    await expect(this.credentialRow(name)).toBeVisible({ timeout: 10_000 });
  }

  /**
   * 자격증명 해제(Unregister-Credential). 행을 선택 → 삭제 아이콘 → 확인 모달 confirm.
   * 삭제 아이콘은 목록 우측 tool-group에 동적 삽입(ic_delete).
   */
  async unregisterCredential(name: string): Promise<void> {
    const row = this.credentialRow(name);
    // 행 선택(체크박스). data-testid 부여 전이면 행 내 checkbox로 fallback.
    await this.page
      .getByTestId(`credential-select-${name}`)
      .or(row.getByRole('checkbox'))
      .first()
      .check();

    await this.page
      .getByTestId('credential-delete')
      .or(this.page.locator('.right-tool-group [name="ic_delete"], [data-icon="ic_delete"]').first())
      .click();

    // 확인 모달("Are you sure you want to delete it?") confirm
    const confirmModal = this.page
      .locator('[role="dialog"], .p-button-modal')
      .filter({ hasText: /delete/i });
    await confirmModal
      .getByTestId('credential-delete-confirm')
      .or(confirmModal.getByRole('button', { name: /confirm|delete|확인|삭제/i }).last())
      .click();
  }

  /** 이름으로 자격증명이 목록에서 사라졌는지 확인 */
  async expectCredentialNotListed(name: string): Promise<void> {
    await expect(this.credentialRow(name)).toBeHidden({ timeout: 10_000 });
  }

  // ────────────────────────────────────────────────────────────────
  // VPC / vNet (cb-tumblebug)
  // ────────────────────────────────────────────────────────────────

  /** VPC 목록 컨테이너 */
  private get vpcListRoot(): Locator {
    return this.page
      .getByTestId('vpc-list')
      .or(this.page.getByText(/VPC|vNet/i).first());
  }

  /** VPC 행(이름으로) */
  private vpcRow(name: string): Locator {
    return this.page
      .getByTestId(`vpc-row-${name}`)
      .or(this.page.getByRole('row', { name: new RegExp(name) }))
      .or(this.page.getByText(name, { exact: true }).first());
  }

  /** VPC 삭제 버튼(행 내 ic_delete 아이콘 버튼 — DeleteVPC feature) */
  private vpcDeleteButton(name: string): Locator {
    return this.page
      .getByTestId(`vpc-delete-${name}`)
      .or(this.vpcRow(name).locator('[name="ic_delete"], [data-icon="ic_delete"]').first());
  }

  /** VPC 화면으로 이동 */
  async gotoVpc(): Promise<void> {
    await this.page.goto(CloudResourcesPage.vpcPath);
  }

  /** VPC 목록이 보이는지 확인 */
  async expectVpcListVisible(): Promise<void> {
    await expect(this.vpcListRoot).toBeVisible({ timeout: 15_000 });
  }

  /** 이름으로 VPC가 목록에 있는지 확인 */
  async expectVpcListed(name: string): Promise<void> {
    await expect(this.vpcRow(name)).toBeVisible({ timeout: 10_000 });
  }

  /** VPC 삭제(delvnet). 행의 삭제 아이콘 클릭 후 (있으면) 확인 모달 confirm */
  async deleteVpc(name: string): Promise<void> {
    await this.vpcDeleteButton(name).click();
    const confirmModal = this.page
      .locator('[role="dialog"], .p-button-modal')
      .filter({ hasText: /delete/i });
    if (await confirmModal.isVisible().catch(() => false)) {
      await confirmModal
        .getByRole('button', { name: /confirm|delete|확인|삭제/i })
        .last()
        .click();
    }
  }

  /** 이름으로 VPC가 목록에서 사라졌는지 확인 */
  async expectVpcNotListed(name: string): Promise<void> {
    await expect(this.vpcRow(name)).toBeHidden({ timeout: 10_000 });
  }
}
