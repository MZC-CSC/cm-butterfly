import { Page, Locator, expect } from '@playwright/test';
import { humanClick, humanFill } from '../support/humanize';

/**
 * JsonEditorPage — the model JSON editor (Custom & View).
 *
 * The integration scenario opens a firewall port twice: once on the source model and once on the
 * target model. Both edits happen here, so the "where" of it lives in one place and the Korean
 * scenario keeps saying only what it wants.
 *
 * ★ Table mode is *our* property grid, not the library's. Every document these editors handle is an
 *   object at the root, so the library's table mode has no table to draw; the grid flattens the
 *   document to key/value rows and takes its place. That is why the row and search controls below
 *   are our own data-testid values rather than anything from vanilla-jsoneditor.
 *
 * ★ Read DESIGN-MIRINAE before touching selectors here. Half of the traps in this UI fail silently:
 *   isChecked()/isEnabled() answer wrongly on mirinae controls, so judge by *result* - the value in
 *   the document, the row that appears - not by the state of a control.
 */
export class JsonEditorPage {
  constructor(private readonly page: Page) {}

  // ── entry points ───────────────────────────────────────────────────────

  /** Open the editor from a source model detail. */
  async openFromSourceModel(): Promise<void> {
    await humanClick(this.page.getByTestId('source-detail-custom-view'));
    await this.expectOpen();
  }

  /** Open the editor from a target model detail. */
  async openFromTargetModel(): Promise<void> {
    await humanClick(
      this.page
        .getByTestId('target-detail-custom-view')
        .or(
          this.page
            .getByText('Custom & View Target Model', { exact: false })
            .first(),
        )
        .first(),
    );
    await this.expectOpen();
  }

  async expectOpen(): Promise<void> {
    await expect(this.page.locator('.jse-main').first()).toBeVisible({
      timeout: 30_000,
    });
  }

  // ── modes ──────────────────────────────────────────────────────────────

  /**
   * Switch to table mode (the property grid).
   *
   * The mode buttons are the library's own, and their titles carry the shortcut ("Switch to table
   * mode"), so match on the substring rather than the whole title.
   */
  async switchToTable(): Promise<void> {
    await humanClick(
      this.page.locator('.jse-menu button[title*="table" i]').first(),
    );
    await expect(this.searchToggleTarget()).toBeVisible({ timeout: 15_000 });
  }

  async switchToTree(): Promise<void> {
    await humanClick(
      this.page.locator('.jse-menu button[title*="tree" i]').first(),
    );
  }

  /** Something that only exists once the grid is drawn - used to confirm the switch landed. */
  private searchToggleTarget(): Locator {
    return this.page
      .locator('.jse-menu button[title^="Search"]')
      .or(this.page.getByTestId('json-grid-search-input'))
      .first();
  }

  // ── search (table mode) ────────────────────────────────────────────────

  /** Type a query into the grid search. Opens the search bar if it is not showing. */
  async search(query: string): Promise<void> {
    const input = this.page.getByTestId('json-grid-search-input');
    if (!(await input.isVisible().catch(() => false))) {
      await humanClick(
        this.page.locator('.jse-menu button[title^="Search"]').first(),
      );
    }
    await humanFill(input, query);
  }

  /** Narrow the grid to matching rows rather than only highlighting them. */
  async enableFilter(): Promise<void> {
    await humanClick(this.page.getByTestId('json-grid-search-filter'));
  }

  async closeSearch(): Promise<void> {
    await humanClick(this.page.getByTestId('json-grid-search-close'));
  }

  /** Rows currently drawn in the grid. */
  private get gridRows(): Locator {
    return this.page.locator('[data-testid^="json-grid-row-"]').or(
      // the grid renders plain rows when no per-row testid is attached yet
      this.page.locator('.json-grid tbody tr'),
    );
  }

  /** A row whose text contains the given value. */
  row(text: string): Locator {
    return this.gridRows.filter({ hasText: text }).first();
  }

  async expectRowVisible(text: string): Promise<void> {
    await expect(this.row(text)).toBeVisible({ timeout: 15_000 });
  }

  // ── row editing (table mode) ───────────────────────────────────────────

  /**
   * Duplicate the row that holds `text`.
   *
   * This is how the scenario opens a second port: the rule for 22 already exists, so it is copied
   * and the copy's port is changed. Writing a whole rule by hand would test the keyboard, not the
   * product.
   */
  async duplicateRow(text: string): Promise<void> {
    const row = this.row(text);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const inline = row.getByTestId('json-grid-row-duplicate');
    if (await inline.isVisible().catch(() => false)) {
      await humanClick(inline);
      return;
    }
    await humanClick(row.getByTestId('json-grid-row-menu'));
    await humanClick(this.page.getByTestId('json-grid-menu-duplicate'));
  }

  /** Read what a row currently holds - used when a value is edited in part rather than replaced. */
  async readRowValue(rowText: string): Promise<string> {
    const cell = this.row(rowText).locator('input, textarea').last();
    await expect(cell).toBeVisible({ timeout: 15_000 });
    return (await cell.inputValue()).trim();
  }

  /**
   * Set the value of a row.
   *
   * The grid edits in place, so the cell becomes an input once clicked. Confirm with Enter - moving
   * focus away also commits, but Enter is what a person presses.
   */
  async setRowValue(rowText: string, value: string): Promise<void> {
    const cell = this.row(rowText).locator('input, textarea').last();
    await humanFill(cell, value);
    await cell.press('Enter');
  }

  // ── saving ─────────────────────────────────────────────────────────────

  /**
   * Save what is on screen as a custom model.
   *
   * Saving from here never overwrites the original - it creates a new model under the name given.
   * That is the point of the custom pass: the collected model stays as collected.
   */
  async saveAsCustom(name: string): Promise<void> {
    await humanClick(this.page.getByTestId('create-form-save'));
    await humanFill(
      this.page
        .locator(
          'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
        )
        .first(),
      name,
    );
    await humanClick(this.page.getByTestId('model-name-save'));
  }
}
