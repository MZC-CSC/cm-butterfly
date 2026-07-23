import { Locator, Page, expect } from '@playwright/test';

/**
 * Helper for list-table pagination (mirinae PToolboxTable).
 *
 * ★ Why it's needed — there's no guarantee the data you just created is on page 1.
 *   The list is broken into 15 rows per page (text-pagination "1 / 2"), and the top search box uses
 *   query tags, so these tables have no filter attached. As data accumulates, a newly created row gets
 *   pushed back to page 2, and a test that only looks at page 1 dies with "no rows". The source-group
 *   creation test actually failed this way.
 *
 *   So find it by *paging through*, and **also return which page it was found on**. Whether pagination
 *   itself works (advancing, stopping at the last page) is verified along the way too.
 */
export class TablePagination {
  constructor(
    private readonly page: Page,
    /** the target table's root (each table has its own pagination, so scope it) */
    private readonly root: Locator,
  ) {}

  /** pagination nav (single page if absent) */
  private get nav(): Locator {
    return this.root.locator('nav.text-pagination').first();
  }

  /** "1 / 2" → { current: 1, total: 2 }. Treated as 1/1 if there's no nav. */
  async status(): Promise<{ current: number; total: number }> {
    if ((await this.nav.count()) === 0) return { current: 1, total: 1 };
    const text = (await this.nav.innerText().catch(() => '')) || '';
    const m = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { current: 1, total: 1 };
    return { current: Number(m[1]), total: Number(m[2]) };
  }

  /** go to the next page. false if there's nowhere further to go. */
  async next(): Promise<boolean> {
    const { current, total } = await this.status();
    if (current >= total) return false;
    // the right arrow of text-pagination (the last button)
    await this.nav.locator('button').last().click();
    await expect
      .poll(async () => (await this.status()).current, { timeout: 10_000 })
      .toBe(current + 1);
    return true;
  }

  /**
   * Wait until the list is actually populated.
   *
   * Right after entering the screen, only the table shell exists and there are no rows yet. Paging
   * immediately in that state concludes "not on page 1, not on page 2" *before the data even arrives*.
   * (The case where a source model was plainly in the list yet couldn't be found was this race.)
   */
  private async waitForRows(): Promise<void> {
    await expect
      .poll(async () => this.root.locator('tbody tr').count(), {
        timeout: 20_000,
        message: '목록에 행이 하나도 렌더되지 않았다',
      })
      .toBeGreaterThan(0);
  }

  /**
   * Page through until the row is found.
   * @returns the page number where it was found (1-based). null if not found through the end.
   */
  async findRow(row: Locator): Promise<number | null> {
    await this.waitForRows();
    for (;;) {
      // is it on this page? (if not, cut it short and move to the next page — waiting 15s per page would be endlessly slow)
      if (
        await row
          .first()
          .isVisible({ timeout: 2_000 })
          .catch(() => false)
      ) {
        return (await this.status()).current;
      }
      if (!(await this.next())) return null;
    }
  }

  /**
   * Check that the row is absent from *every page*.
   *
   * ★ When checking "it should be gone", like a delete confirmation, don't look at page 1 only. Since the
   *   list breaks into 15 rows per page, a row alive on a later page would pass as "disappeared". This very
   *   misjudgment let infrastructure judged deleted (a live EC2) keep racking up charges. The "absent"
   *   verdict is made only after *scanning every page*.
   */
  async isRowAbsent(row: Locator): Promise<boolean> {
    return (await this.findRow(row)) === null;
  }

  /**
   * The row must exist on *some page*. If found, log the page number.
   * If not found, fail with the total page count (don't conclude it's absent from page 1 alone).
   */
  async expectRowSomewhere(row: Locator, label: string): Promise<number> {
    const found = await this.findRow(row);
    const { total } = await this.status();
    expect(
      found,
      `"${label}" 이(가) 목록 어디에도 없다 (전체 ${total}페이지를 모두 확인했다)`,
    ).not.toBeNull();
    console.log(`[pagination] "${label}" → found on page ${found}/${total}`);
    return found as number;
  }
}
