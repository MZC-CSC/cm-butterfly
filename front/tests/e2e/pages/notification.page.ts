import { Page, expect, Locator } from '@playwright/test';
import { humanClick } from '../support/humanize';

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
    await humanClick(this.badge);
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
    const row = this.items.filter({ hasText: message.slice(0, 24) }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await humanClick(row.getByRole('button').first());
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

  /**
   * Close out a long job the way a person does: read the message, then clear it.
   *
   * The recording used to end when the notification arrived - it flew into the corner and that was
   * that. But arriving is not the end of the job; someone still opens it, reads what it says, and
   * marks it read so the badge goes quiet. That last part is also what keeps the next segment's
   * panel free of this one's leftovers.
   *
   * Matches on the opening of the message because the list truncates long text.
   */
  async readAndClear(message: string): Promise<void> {
    await this.open();

    const row = this.items.filter({ hasText: message.slice(0, 24) }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });

    await humanClick(row.getByRole('button').first());
    await expect(row.getByTestId('notification-detail')).toBeVisible({
      timeout: 10_000,
    });
    // A beat to read it.
    await this.page.waitForTimeout(1_200);

    await humanClick(row.getByTestId('notification-confirm'));
    await expect(row).toBeHidden({ timeout: 15_000 });
  }

  /**
   * Read the newest notice and clear it - whatever it says.
   *
   * Used to close out a long job when the exact wording is not the point. The point is that the job
   * announced itself, someone read it, and the badge went quiet.
   */
  async readAndClearFirst(): Promise<void> {
    await this.open();
    const row = this.items.first();
    if (!(await row.isVisible({ timeout: 60_000 }).catch(() => false))) return;

    // ★ Hold on to *which* notice this is before touching it.
    //   `items.first()` is a position, not a thing. Once the notice is marked read it leaves the
    //   list and `first()` becomes the next one - which is visible, so waiting for "the first row"
    //   to disappear waits for something that will not happen. The id is what identifies it.
    const id = await row.getAttribute('data-notification-id');

    await humanClick(row.getByRole('button').first());
    await expect(row.getByTestId('notification-detail')).toBeVisible({
      timeout: 10_000,
    });
    // A beat to read it.
    await this.page.waitForTimeout(1_200);

    await humanClick(row.getByTestId('notification-confirm'));

    if (id) {
      await expect(
        this.page.locator(`[data-notification-id="${id}"]`),
      ).toBeHidden({ timeout: 15_000 });
    } else {
      // No id to hold on to - fall back to the list getting shorter, which is the same statement
      // made about the whole list rather than about one row.
      const before = await this.items.count();
      await expect
        .poll(() => this.items.count(), { timeout: 15_000 })
        .toBeLessThan(before);
    }

    await this.page.keyboard.press('Escape').catch(() => {});
  }

  /**
   * Empty the box before recording starts.
   *
   * Logging in pops up whatever was left from earlier work, so the first thing on screen is a stack
   * of messages that have nothing to do with what is about to be shown. The panel's own
   * "Mark all read" clears them - which is what it does, despite the name.
   */
  async clearAll(): Promise<void> {
    await this.open();
    const markAll = this.page.getByTestId('notification-mark-all');
    if (await markAll.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await humanClick(markAll);
      await expect(this.page.getByTestId('notification-empty')).toBeVisible({
        timeout: 15_000,
      });
    }
    await this.page.keyboard.press('Escape').catch(() => {});
  }
}
