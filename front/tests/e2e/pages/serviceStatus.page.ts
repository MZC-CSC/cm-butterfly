import { Locator, Page, expect } from '@playwright/test';
import { humanClick } from '../support/humanize';

/**
 * 서비스 상태 화면.
 *
 * 잡는 것은 전부 `data-testid` 다. 문구로 잡으면 상태 라벨을 다듬을 때마다 깨지고,
 * 폴백을 두면 식별자가 사라져도 통과해 버린다(tests/e2e/docs/08-주의사항 §C-1·C-2).
 *
 * 어떤 서비스가 몇 건 뜨는지는 그 환경의 라인업에 달렸으므로 **개수·이름을 단언하지 않는다.**
 * 여기서 확인하는 것은 *서버가 돌려준 것이 그대로 그려지는가* 다.
 */
export class ServiceStatusPage {
  constructor(private readonly page: Page) {}

  private get root(): Locator {
    return this.page.getByTestId('service-status-page');
  }

  private get table(): Locator {
    return this.page.getByTestId('service-status-table');
  }

  private get summary(): Locator {
    return this.page.getByTestId('service-status-summary');
  }

  private get recheckButton(): Locator {
    return this.page.getByTestId('service-status-recheck');
  }

  /** 사이드바를 눌러 들어간다 — 주소를 추측해 goto 하지 않는다. */
  async open(): Promise<void> {
    await humanClick(this.page.getByText('Service Status', { exact: true }).first());
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async expectListed(): Promise<void> {
    await expect(this.table).toBeVisible({ timeout: 30_000 });
  }

  async expectSummary(): Promise<void> {
    await expect(this.summary).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByTestId('service-status-summary-healthy')).toBeVisible();
    await expect(this.page.getByTestId('service-status-summary-unhealthy')).toBeVisible();
    await expect(this.page.getByTestId('service-status-summary-unknown')).toBeVisible();
  }

  private get rows(): Locator {
    return this.page.locator('[data-testid^="service-status-row-"]');
  }

  async expectAtLeastOneService(): Promise<void> {
    await expect(this.rows.first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * 상태는 `data-status` 로 확인한다. 배지 문구는 표시용이라 바뀔 수 있고,
   * 색으로는 판정할 수 없다.
   */
  async expectEveryRowHasStatus(): Promise<void> {
    const count = await this.rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const status = await this.rows.nth(i).getAttribute('data-status');
      expect(['healthy', 'unhealthy', 'unknown']).toContain(status);
    }
  }

  /** 버전·스펙 열이 있는지 — 그 둘이 있어야 장애와 스펙 노후를 가릴 수 있다. */
  async expectVersionAndSpecColumns(): Promise<void> {
    const head = this.table.locator('thead');
    await expect(head).toContainText('Version');
    await expect(head).toContainText('Specification');
  }

  /** 확인 시각이 바뀌는지 본다 — 눌렀는데 아무 일도 없으면 그대로다. */
  async recheckAndExpectFreshTimestamp(): Promise<void> {
    const before = (await this.summary.innerText()).trim();
    await humanClick(this.recheckButton);
    await expect
      .poll(async () => (await this.summary.innerText()).trim(), {
        timeout: 30_000,
      })
      .not.toBe(before);
  }

  async recheck(): Promise<void> {
    await humanClick(this.recheckButton);
  }
}
