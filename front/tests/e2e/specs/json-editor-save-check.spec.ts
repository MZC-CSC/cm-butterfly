import { test } from '@playwright/test';
import * as fs from 'fs';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { ModelsPage } from '../pages/models.page';

/**
 * JSON editor — does what the user edits actually get saved?
 *
 * Three screens listened for the editor's change notification under a name the editor
 * never emits, so every edit made in them was dropped on the way to the parent. The
 * library tree/text views kept their own state, which made the edits look applied right
 * up until save wrote the original document back. Nothing caught it because no test
 * followed an edit through save and back.
 *
 * This spec closes that gap on the target model custom view:
 *   1. duplicate a list entry and change a value in the property grid
 *   2. save as a new model, reopen it, and confirm both survived
 *   3. export, confirm the file matches what the screen showed
 *   4. change the file, import it, save, reopen, and confirm that survived too
 *
 * Run:
 *   BASE_URL=http://cmig.dev.cscmzc.com:5174 \
 *   npx playwright test tests/e2e/specs/json-editor-save-check.spec.ts \
 *     --config=tests/e2e/playwright.runviewer.config.ts
 */

const STAMP = process.env.STAMP ?? String(Date.now()).slice(-6);
const EXPORT_DIR = process.env.E2E_TMP_DIR ?? '/tmp';

test.describe('JSON 에디터 — 편집·가져오기 결과가 저장되는지', () => {
  test('편집·복제 후 저장하면 다시 열었을 때 남아 있고, 내보낸 파일을 고쳐 가져와 저장해도 남는다', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const user = getUser('cmiguser');
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.id, user.password);
    await login.expectLoggedIn();

    /** open a target model's "Custom & View" modal by a text found in its row */
    const openCustomView = async (rowText: string) => {
      await page.goto(ModelsPage.targetModelsPath);
      await page.waitForTimeout(2_500);
      await page.locator('tbody tr', { hasText: rowText }).first().click();
      await page.waitForTimeout(2_500);
      await page.getByText('Custom & View Target Model').first().click();
      await page.waitForTimeout(3_500);
    };

    /** the menu's "table" button opens the property grid */
    const openGrid = async () => {
      await page.locator('.jse-menu button[title*="table" i]').first().click();
      await page.waitForTimeout(1_500);
      // The library menu is on screen too and has a button by the same name.
      await page.locator('.property-grid').getByTitle('Expand all').click();
      await page.waitForTimeout(1_500);
    };

    const rowOf = (key: string) =>
      page
        .locator('.property-grid .pg-row')
        .filter({ has: page.getByText(key, { exact: true }) })
        .first();

    const valueOf = async (key: string) =>
      (await rowOf(key).locator('.pg-cell-value').textContent())?.trim();

    const editValue = async (key: string, text: string) => {
      await rowOf(key).locator('.pg-cell-value').dblclick();
      const input = page.locator('.property-grid .pg-edit-input');
      await input.fill(text);
      await input.press('Enter');
      await page.waitForTimeout(800);
    };

    const listCount = async (key: string) => {
      const text = await rowOf(key).locator('.pg-count').textContent();
      return Number((text ?? '').replace(/[()]/g, '').trim());
    };

    const saveAs = async (name: string) => {
      await page
        .getByRole('button', { name: /^Save$/ })
        .first()
        .click();
      await page.waitForTimeout(1_500);
      await page
        .locator(
          'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
        )
        .first()
        .fill(name);
      await page.getByTestId('model-name-save').click();
      await page.waitForTimeout(4_000);
    };

    // --- edit, save, reopen -------------------------------------------------
    await openCustomView('CloudModel');
    await openGrid();

    const edited = `e2e-save-${STAMP}`;
    // Duplicate an entry of the list, not the list row - the button only sits on entries.
    await rowOf('[0]')
      .locator('[data-testid="json-grid-row-duplicate"]')
      .click({ force: true });
    await page.waitForTimeout(1_200);
    const duplicated = await listCount('nodeGroups');
    await editValue('description', edited);

    const savedName = `e2e-json-${STAMP}`;
    await saveAs(savedName);

    await openCustomView(savedName);
    await openGrid();
    test
      .expect(await valueOf('description'), 'the edited value survives save')
      .toBe(edited);
    test
      .expect(await listCount('nodeGroups'), 'the duplicated entry survives save')
      .toBe(duplicated);

    // --- export, change the file, import, save, reopen -----------------------
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('button', { name: /Export/ })
        .first()
        .click(),
    ]);
    const exportPath = `${EXPORT_DIR}/e2e-json-export-${STAMP}.json`;
    await download.saveAs(exportPath);

    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    test
      .expect(exported.description, 'the exported file matches the screen')
      .toBe(edited);

    const imported = `e2e-import-${STAMP}`;
    exported.description = imported;
    const importPath = `${EXPORT_DIR}/e2e-json-import-${STAMP}.json`;
    fs.writeFileSync(importPath, JSON.stringify(exported, null, 2));

    await page.locator('input[type="file"]').first().setInputFiles(importPath);
    await page.waitForTimeout(2_500);
    if (!(await page.locator('.property-grid').count())) await openGrid();
    test
      .expect(await valueOf('description'), 'the imported file reaches the screen')
      .toBe(imported);

    const importedName = `e2e-json-imp-${STAMP}`;
    await saveAs(importedName);

    await openCustomView(importedName);
    await openGrid();
    test
      .expect(await valueOf('description'), 'the imported value survives save')
      .toBe(imported);
  });
});
