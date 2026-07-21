import { Page, expect, Locator } from '@playwright/test';

/**
 * NotificationPage — the top-bar notification badge (BAR-1536 stage 1~3).
 *
 * The badge is where a long job's outcome surfaces after the user has left the screen that
 * started it. Selectors live here so scenarios only speak of intent.
 *
 * testids (TopBarNotifications.vue / TopBarNotificationContextMenu.vue):
 *   notification-badge · notification-count · notification-menu · notification-item ·
 *   notification-detail · notification-mark-all · notification-empty
 */
export class NotificationPage {
  constructor(private readonly page: Page) {}

  private get badge(): Locator {
    return this.page.getByTestId('notification-badge');
  }

  private get menu(): Locator {
    return this.page.getByTestId('notification-menu');
  }

  private get items(): Locator {
    return this.page.getByTestId('notification-item');
  }

  /** Opens the badge panel (idempotent — leaves it open whether or not it already was). */
  async open(): Promise<void> {
    await expect(this.badge).toBeVisible({ timeout: 15_000 });
    if (await this.menu.isVisible()) return;
    await this.badge.click();
    await expect(this.menu).toBeVisible({ timeout: 10_000 });
  }

  /** Waits until at least one notification is present, then returns how many. */
  async waitForAnyItem(timeout = 20_000): Promise<number> {
    await expect(this.items.first()).toBeVisible({ timeout });
    return this.items.count();
  }

  async count(): Promise<number> {
    return this.items.count();
  }

  /** The item whose full (expanded) message equals `message`. */
  private itemByMessage(message: string): Locator {
    return this.items.filter({ hasText: message }).first();
  }

  /**
   * Asserts an item is present whose **full** message is `message`, and that its level matches.
   * The list may shorten the message, so the row is expanded and the detail text is asserted.
   */
  async expectNotification(
    message: string,
    level: 'Info' | 'Error',
  ): Promise<void> {
    // The list truncates long text; match on the row, then open its detail for the full string.
    const row = this.items
      .filter({ hasText: message.slice(0, 24) })
      .first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button').first().click();
    const detail = row.getByTestId('notification-detail');
    await expect(detail).toContainText(message, { timeout: 10_000 });

    // Level is carried as the `error` class on the item (Error) or its absence (Info).
    const cls = (await row.getAttribute('class')) ?? '';
    if (level === 'Error') {
      expect(cls).toContain('error');
    } else {
      expect(cls).not.toContain('error');
    }
  }
}
