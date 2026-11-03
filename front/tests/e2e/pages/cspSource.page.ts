import { Locator, Page, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';
import type { CspAccess } from '../support/cspAccess';

/**
 * CSP 유형 소스 서비스 — 고객 클라우드 계정을 소스로 등록하고, 그 계정에 실제로 있는
 * 자원을 골라 커넥션으로 만든다. 목록 이동·선택·삭제는 SourceServicesPage 를 쓴다.
 *
 * 미리내 함정(DESIGN-MIRINAE)
 *  - 드롭다운 항목은 role 이 없어 `.p-context-menu-item` 으로, 그 드롭다운 안에서 찾는다.
 *  - 버튼 비활성은 클래스뿐이라 `isEnabled()` 를 쓰지 않고 클래스로 판정한다(§1.6).
 *  - 자원 목록의 선택 여부는 체크박스가 아니라 행의 `data-selected` 로 본다(§1.5).
 */
export class CspSourcePage {
  constructor(private readonly page: Page) {}

  private get providerDropdown(): Locator {
    return this.page.getByTestId('csp-source-provider');
  }

  private get specStatus(): Locator {
    return this.page.getByTestId('csp-source-spec-status');
  }

  private get credentialInputs(): Locator {
    return this.page.locator('input[data-testid^="csp-source-credential-"]');
  }

  private get addButton(): Locator {
    return this.page.locator('button', {
      has: this.page.getByTestId('source-service-confirm'),
    });
  }

  private get resourceList(): Locator {
    return this.page.getByTestId('csp-connection-resource-list');
  }

  /** 등록 모달을 열고 유형을 클라우드로 바꾼다. */
  async openCspRegistration(): Promise<void> {
    await humanClick(this.page.getByTestId('source-group-add'));
    await humanClick(this.page.getByTestId('source-service-type-csp'));
    await expect(this.providerDropdown).toBeVisible({ timeout: 15_000 });
  }

  async expectProviderOffered(provider: string): Promise<void> {
    await humanClick(this.providerDropdown);
    await expect(this.providerItem(provider)).toBeAttached({ timeout: 15_000 });
    await this.page.keyboard.press('Escape');
  }

  private providerItem(provider: string): Locator {
    return this.providerDropdown
      .locator('.p-context-menu-item', {
        hasText: new RegExp(`^\\s*${provider}\\s*$`),
      })
      .first();
  }

  /** CSP 를 고르면 그 CSP 의 인증 항목이 서버(cm-honeybee)가 준 대로 그려진다. */
  async selectProvider(provider: string): Promise<void> {
    await humanClick(this.providerDropdown);
    await humanClick(this.providerItem(provider));
    await expect(this.specStatus).toContainText('field(s) required', {
      timeout: 20_000,
    });
  }

  async credentialFieldCount(): Promise<number> {
    return this.credentialInputs.count();
  }

  async isAddEnabled(): Promise<boolean> {
    const cls = (await this.addButton.getAttribute('class')) ?? '';
    return !cls.split(/\s+/).includes('disabled');
  }

  /**
   * 키 2개(access/secret)로 인증하는 CSP 만 다룬다. 항목이 다르면 여기서 멈춘다 —
   * 엉뚱한 칸에 값을 넣고 진행하지 않는다.
   */
  async fill(name: string, access: CspAccess): Promise<void> {
    await humanFill(
      this.page.locator('input[data-testid="csp-source-service-name"]').first(),
      name,
    );
    const count = await this.credentialInputs.count();
    if (count !== 2) {
      throw new Error(
        `${access.provider} 의 인증 항목이 ${count}개다 — 이 테스트는 access/secret 2개인 CSP 만 다룬다`,
      );
    }
    await humanFill(this.credentialInputs.nth(0), access.accessKey);
    await humanFill(this.credentialInputs.nth(1), access.secretKey);
    await humanFill(
      this.page.locator('input[data-testid="csp-source-region"]').first(),
      access.region,
    );
  }

  async register(): Promise<void> {
    await humanClick(this.addButton);
  }

  async expectGroupShownAsCloud(
    name: string,
    access: CspAccess,
  ): Promise<void> {
    const row = this.page
      .getByTestId('source-group-list-table')
      .getByRole('row', { name: new RegExp(name) })
      .first();
    await expect(row).toContainText(
      `Cloud (${access.provider} / ${access.region})`,
      { timeout: 30_000 },
    );
  }

  async openCspConnectionModal(): Promise<void> {
    await humanClick(
      this.page.getByTestId('source-connection-add-edit').first(),
    );
    await expect(
      this.page.getByTestId('csp-connection-modal-body'),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** 계정에 실제로 있는 VM 을 읽어 와 첫 행을 고른다. 고른 자원의 CSP ID 를 돌려준다. */
  async discoverAndPickFirstVm(): Promise<string> {
    await humanClick(this.page.getByTestId('csp-connection-discover'));
    await expect(this.resourceList).toBeVisible({ timeout: 120_000 });
    const first = this.resourceList.locator('li').first();
    const testid = (await first.getAttribute('data-testid')) ?? '';
    await humanClick(first);
    await expect(first).toHaveAttribute('data-selected', 'true');
    return testid.replace('csp-connection-resource-', '');
  }

  async addPickedResources(): Promise<void> {
    await humanClick(
      this.page.locator('button', {
        has: this.page.getByTestId('csp-connection-confirm'),
      }),
    );
    await expect(this.page.getByTestId('csp-connection-modal-body')).toBeHidden(
      { timeout: 60_000 },
    );
  }
}
