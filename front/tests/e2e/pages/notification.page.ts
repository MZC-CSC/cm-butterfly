import { Page, expect, Locator } from '@playwright/test';
import { humanClick } from '../support/humanize';

/**
 * NotificationPage — the top-bar notification badge (stage 1~3).
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
  async readAndClearFirst(waitForArrival = 10 * 60_000): Promise<void> {
    // Wait for it to arrive *before* opening the panel.
    //
    // ★ Opening first and then waiting means the panel sits open and empty for as long as it takes,
    //   which on screen reads as checking the corner over and over for a message that has not been
    //   sent. `notification-count` is drawn only when there is something to count, so that is what
    //   says it has arrived. If it never does, we leave without touching anything.
    const count = this.page.getByTestId('notification-count');
    if (
      !(await count.isVisible({ timeout: waitForArrival }).catch(() => false))
    ) {
      return;
    }

    await this.open();
    const row = this.items.first();
    if (!(await row.isVisible({ timeout: 15_000 }).catch(() => false))) return;

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
   * Find the notice this run produced, read it, and clear it.
   *
   * ★ `readAndClearFirst` takes whatever is on top, and on a busy environment that is often not the
   *   one this segment was waiting for - system notices arrive on their own schedule. The workflow's
   *   name is in its message, so that is what picks it out.
   *
   * The wait is generous but not fatal: if the notice never arrives the segment carries on without
   * it. A missing announcement is not worth failing a take over, and the job itself was already
   * judged by its real result.
   *
   * @returns whether a matching notice was found and cleared
   */
  async readAndClearFor(
    keyword: string,
    waitForArrival = 10 * 60_000,
  ): Promise<boolean> {
    const deadline = Date.now() + waitForArrival;
    const count = this.page.getByTestId('notification-count');

    // Wait for the badge before touching anything.
    //
    // ★ The panel is opened **once**. An earlier version re-opened it on every turn of the loop -
    //   open, find nothing, close, wait, open again - which on screen looked like someone tapping
    //   the corner over and over for a message that had not been sent. Worse, it did that even
    //   when no badge was showing at all, so the recording had the box being searched for a notice
    //   that was never announced. (2026-08-14, from watching the take)
    if (
      !(await count.isVisible({ timeout: waitForArrival }).catch(() => false))
    ) {
      return false;
    }

    await this.open();
    // Wait for our notice *inside* the open panel - it fills in live, so there is nothing to
    // gain by closing and looking again.
    const row = this.items.filter({ hasText: keyword }).first();
    const left = Math.max(5_000, deadline - Date.now());
    if (await row.isVisible({ timeout: left }).catch(() => false)) {
      const id = await row.getAttribute('data-notification-id');

      await humanClick(row.getByRole('button').first());
      await expect(row.getByTestId('notification-detail')).toBeVisible({
        timeout: 10_000,
      });
      // A beat to read it.
      await this.page.waitForTimeout(1_500);

      await humanClick(row.getByTestId('notification-confirm'));
      if (id) {
        await expect(
          this.page.locator(`[data-notification-id="${id}"]`),
        ).toBeHidden({ timeout: 15_000 });
      }
      await this.page.keyboard.press('Escape').catch(() => {});
      return true;
    }

    // Never turned up - close the panel and say so.
    await this.page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  /**
   * Open the box and clear the notices one at a time.
   *
   * ★ Its own segment, deliberately. Working through a stack of messages is a thing the console
   *   does and nothing else in the walkthrough shows it - "Mark all read" empties the box in one
   *   press, which proves the box can be emptied but not that each message can be read.
   *
   * @returns how many were cleared
   */
  async readAndClearEachOne(limit = 2): Promise<number> {
    await this.open();

    // ★ Two, not the whole stack.
    //
    //   Reading one notice and closing it is the thing being shown; doing it thirty times shows
    //   nothing further and the cursor spends the whole time travelling to a row and back. What is
    //   left goes in one press of "Mark all read", which is also what a person does once they have
    //   seen what the messages are. (2026-08-14, from watching the take)
    let cleared = 0;
    for (let i = 0; i < limit; i++) {
      const row = this.items.first();
      if (!(await row.isVisible({ timeout: 5_000 }).catch(() => false))) break;

      const id = await row.getAttribute('data-notification-id');
      await humanClick(row.getByRole('button').first());
      await expect(row.getByTestId('notification-detail')).toBeVisible({
        timeout: 10_000,
      });
      await this.page.waitForTimeout(1_200);

      await humanClick(row.getByTestId('notification-confirm'));
      if (id) {
        await expect(
          this.page.locator(`[data-notification-id="${id}"]`),
        ).toBeHidden({ timeout: 15_000 });
      }
      cleared++;
      await this.page.waitForTimeout(500);
    }

    await this.page.keyboard.press('Escape').catch(() => {});
    return cleared;
  }

  /** The box has nothing left in it. */
  async expectEmpty(): Promise<void> {
    await this.open();
    await expect(this.page.getByTestId('notification-empty')).toBeVisible({
      timeout: 15_000,
    });
    await this.page.waitForTimeout(1_000);
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
