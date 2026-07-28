import { test, expect, Page, Locator } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { installCursor } from '../support/cursor';
import { humanClick } from '../support/humanize';

/**
 * A recorded walk-through: sign in, take an infrastructure source model, ask for a
 * recommendation on AWS Seoul, and look at what comes back.
 *
 * Meant to be watched, not asserted on. The pointer travels to each target, waits, and
 * clicks; text is typed. Nothing is created - the run stops at the save dialog without
 * confirming it, then goes to an existing target model to show the JSON editor.
 *
 * Run:
 *   E2E_DEMO_PACE=1 BASE_URL=http://cmig.dev.cscmzc.com \
 *   npx playwright test tests/e2e/demos/recommend-target-model.demo.ts \
 *     --config=tests/e2e/playwright.demo.config.ts
 */

const BEAT = 1_500;

test('recommend a target model from a source model', async ({ page }) => {
  test.setTimeout(600_000);
  await installCursor(page);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);

  // ── sign in ────────────────────────────────────────────────────────────
  await login.goto();
  await page.waitForTimeout(BEAT);
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  await page.waitForTimeout(BEAT);

  // ── walk to the source model list through the menu, as a person would ──
  await openMenu(page, 'Models');
  await openMenu(page, 'Source Models');
  await page.waitForURL(/\/models\/source-models/, { timeout: 20_000 });
  await page.waitForTimeout(BEAT);

  // an infrastructure model - software models take a different route
  const infraRow = page
    .locator('tbody tr')
    .filter({ hasText: 'OnPremiseModel' })
    .first();
  await expect(infraRow).toBeVisible({ timeout: 20_000 });
  await humanClick(infraRow);
  await page.waitForTimeout(BEAT);

  // ── ask for a recommendation ───────────────────────────────────────────
  await humanClick(page.getByTestId('source-detail-view-recommend'));
  const modal = page.getByTestId('recommend-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(BEAT);

  await humanClick(page.getByTestId('recommend-provider-select'));
  await humanClick(optionNamed(page, 'aws'));
  await page.waitForTimeout(BEAT);

  await humanClick(page.getByTestId('recommend-region-select'));
  await humanClick(optionNamed(page, 'ap-northeast-2'));
  await page.waitForTimeout(BEAT);

  await humanClick(page.getByTestId('recommend-search'));

  const rows = page.getByTestId('recommend-result-table').locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(BEAT * 2); // read the results

  // ── pick one of the candidates ─────────────────────────────────────────
  const complete = rows.filter({
    has: page.locator(
      '[data-testid="recommend-candidate"][data-complete="true"]',
    ),
  });
  const chosen = (await complete.count()) ? complete.first() : rows.first();
  await humanClick(chosen);
  await page.waitForTimeout(BEAT);

  // ── the save dialog, opened but not confirmed ──────────────────────────
  await humanClick(page.getByTestId('recommend-save-target'));
  const nameInput = page
    .locator(
      'input[data-testid="model-name-input"], textarea[data-testid="model-name-input"]',
    )
    .first();
  await expect(nameInput).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(BEAT * 2);

  // nothing is saved by this demo - back out of the dialog and the modal
  await pressAny(page, [/^cancel$/i, /^close$/i]);
  await page.waitForTimeout(BEAT);
  await pressAny(page, [/^cancel$/i]);
  await page.waitForTimeout(BEAT);

  // ── a target model in the JSON editor ──────────────────────────────────
  await openMenu(page, 'Target Models');
  await page.waitForURL(/\/models\/target-models/, { timeout: 20_000 });
  await page.waitForTimeout(BEAT);

  await humanClick(page.locator('tbody tr').first());
  await page.waitForTimeout(BEAT);
  await humanClick(page.getByText('Custom & View Target Model').first());
  await expect(page.locator('.jse-main').first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(BEAT * 3); // hold on the editor to close the demo
});

/** Click a left-menu entry by its label. */
async function openMenu(page: Page, label: string): Promise<void> {
  const item = page
    .getByRole('link', { name: label, exact: true })
    .or(page.getByText(label, { exact: true }))
    .first();
  await humanClick(item);
}

/** A dropdown option, however the list happens to be rendered. */
function optionNamed(page: Page, name: string): Locator {
  return page
    .getByRole('menuitem', { name, exact: false })
    .or(page.getByRole('option', { name, exact: false }))
    .or(page.getByText(name, { exact: false }))
    .first();
}

/** Press the first button matching any of the given names, if one is on screen. */
async function pressAny(page: Page, names: RegExp[]): Promise<void> {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first();
    if (await button.count().catch(() => 0)) {
      await humanClick(button).catch(() => {});
      return;
    }
  }
}
