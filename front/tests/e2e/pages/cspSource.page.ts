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
    // Cloud Sources 의 등록 창은 처음부터 클라우드 유형이다(유형 선택 없음).
    await humanClick(this.page.getByTestId('source-group-add'));
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

  /** 연결 추가 창에서 탐색할 자원 유형을 고른다(예: 'Object Storage'). */
  async chooseResourceType(label: string): Promise<void> {
    const dropdown = this.page.getByTestId('csp-connection-resource-type');
    await humanClick(dropdown);
    await humanClick(
      dropdown.locator('.p-context-menu-item', { hasText: label }).first(),
    );
  }

  /**
   * 계정의 자원을 읽어 와 *지정한 시험용 자원* 만 고른다(VM 은 인스턴스 ID, 버킷은 이름).
   * 첫 행을 고르면 계정에 있던 남의 작업 VM 이 등록된다 — 목록 순서는 우리가 정하지 않는다.
   * 시험용 VM 이 목록에 없으면 다른 VM 으로 대신하지 않고 실패한다.
   */
  async discoverAndPick(resourceId: string): Promise<string> {
    await humanClick(this.page.getByTestId('csp-connection-discover'));
    await expect(this.resourceList).toBeVisible({ timeout: 120_000 });
    const target = this.resourceList.getByTestId(
      `csp-connection-resource-${resourceId}`,
    );
    await expect(target).toHaveCount(1, { timeout: 30_000 });
    // 행이 아니라 체크박스를 누른다 — 체크박스가 클릭을 삼켜 선택이 안 되던 결함이 있었다(11-04).
    await humanClick(
      this.page.getByTestId(`csp-connection-pick-${resourceId}`),
    );
    await expect(target).toHaveAttribute('data-selected', 'true');
    return resourceId;
  }

  /** 이미 연결로 등록된 자원은 Registered 로 보이고 체크박스가 잠겨 있다. */
  async expectRegistered(resourceId: string): Promise<void> {
    await humanClick(this.page.getByTestId('csp-connection-discover'));
    const row = this.resourceList.getByTestId(
      `csp-connection-resource-${resourceId}`,
    );
    await expect(row).toHaveAttribute('data-registered', 'true', {
      timeout: 120_000,
    });
    await expect(
      this.page.getByTestId(`csp-connection-pick-${resourceId}`),
    ).toBeDisabled();
  }

  async closeConnectionModal(): Promise<void> {
    // 미리내 모달은 Escape 로 닫히지 않는다 — Cancel 을 누른다.
    await humanClick(
      this.page.locator('button', {
        has: this.page.getByTestId('csp-connection-cancel'),
      }),
    );
    await expect(this.page.getByTestId('csp-connection-modal-body')).toBeHidden(
      { timeout: 15_000 },
    );
  }

  /** 연결을 고른 뒤 Add / Edit — 클라우드 연결은 수정 창이 열린다. 설명을 바꿔 저장한다. */
  async editConnectionDescription(
    connectionName: RegExp,
    description: string,
  ): Promise<void> {
    await humanClick(
      this.page
        .getByTestId('source-connection-list-table')
        .getByRole('row', { name: connectionName })
        .first(),
    );
    await humanClick(
      this.page.getByTestId('source-connection-add-edit').first(),
    );
    await expect(this.page.getByTestId('csp-connection-edit-body')).toBeVisible(
      { timeout: 15_000 },
    );
    await humanFill(
      this.page
        .locator('textarea[data-testid="csp-connection-edit-description"]')
        .first(),
      description,
    );
    await humanClick(
      this.page.locator('button', {
        has: this.page.getByTestId('csp-connection-edit-save'),
      }),
    );
    await expect(this.page.getByTestId('csp-connection-edit-body')).toBeHidden({
      timeout: 30_000,
    });
    await expect(
      this.page.getByTestId('source-connection-list-table'),
    ).toContainText(description, { timeout: 30_000 });
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

  /**
   * 잠긴 수집 버튼에 마우스를 올려 사유 툴팁이 뜨는지 본다.
   * 미리내 버튼의 disabled 는 클래스뿐이라 isEnabled() 로 판정하지 않는다(DESIGN-MIRINAE §1.6) —
   * 래퍼가 내보내는 사유와, 실제 마우스로 띄운 툴팁 문구로 확인한다.
   */
  async expectCollectReasonOnHover(
    triggerTestId: string,
    buttonTestId: string,
    reason: RegExp,
  ): Promise<void> {
    await expect(this.page.getByTestId(triggerTestId)).toHaveAttribute(
      'data-disabled-reason',
      reason,
      { timeout: 60_000 },
    );
    const button = this.page.getByTestId(buttonTestId);
    await button.scrollIntoViewIfNeeded();
    await this.page.mouse.move(0, 0);
    await button.hover();
    await expect(
      // 먼저 띄운 툴팁은 숨겨진 채 DOM 에 남는다 — 지금 보이는 것만 본다.
      this.page.locator(
        '.p-tooltip.disabled-reason-tooltip[aria-hidden="false"]',
      ),
    ).toContainText(reason, { timeout: 10_000 });
    await this.page.mouse.move(0, 0);
  }

  /** 그룹 상세(Detail 탭)로 돌아간다. 연결을 추가한 뒤에는 Connections 탭에 있다. */
  async openGroupDetailTab(): Promise<void> {
    await humanClick(this.page.getByRole('tab', { name: /Detail/i }).first());
    await expect(
      this.page.getByTestId('source-group-collect-infra'),
    ).toBeVisible({ timeout: 30_000 });
  }

  /** 잠긴 버튼을 강제로 눌러도 import-infra·import-software 요청이 나가지 않아야 한다. */
  async expectGroupCollectSendsNothing(): Promise<void> {
    const calls: string[] = [];
    const listener = (r: { url(): string; postData(): string | null }) => {
      if (
        /import-infra|import-software/i.test(`${r.url()} ${r.postData() ?? ''}`)
      )
        calls.push(r.url());
    };
    this.page.on('request', listener);
    await this.page
      .getByTestId('source-group-collect-infra')
      .click({ force: true });
    await this.page
      .getByTestId('source-group-collect-sw')
      .click({ force: true });
    await this.page.waitForTimeout(2_000);
    this.page.off('request', listener);
    expect(calls).toEqual([]);
  }

  /** 연결을 골라 Infra Collect 탭을 연다. */
  async openConnectionInfraCollect(connectionName: RegExp): Promise<void> {
    await humanClick(this.page.getByRole('tab', { name: /Connections/i }));
    await humanClick(
      this.page
        .getByTestId('source-connection-list-table')
        .getByRole('row', { name: connectionName })
        .first(),
    );
    await humanClick(
      this.page
        .getByTestId('source-connection-detail')
        .getByText('Infra Collect', { exact: true }),
    );
    await expect(this.page.getByTestId('collect-infra')).toBeVisible({
      timeout: 30_000,
    });
  }
}
