import { test, expect, Page } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { installCursor } from '../support/cursor';
import { humanClick } from '../support/humanize';

/**
 * A short take for checking the pointer itself: is it on screen, does it travel rather
 * than jump, and is the typing readable without holding the camera.
 *
 * Sign in, walk to the source model list, open a model, and open the recommend dialog -
 * enough pointer travel and typing to judge all three. Nothing is created.
 *
 * Run:
 *   E2E_DEMO_PACE=1 E2E_DEMO_BEAT_MS=800 BASE_URL=http://localhost \
 *   npx playwright test tests/e2e/demos/pointer-check.demo.ts \
 *     --config=tests/e2e/playwright.demo.config.ts
 */

const BEAT = Number(process.env.E2E_DEMO_BEAT_MS ?? 1_000);

test('pointer and typing, from login to the recommend dialog', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await installCursor(page);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);

  await login.goto();
  await page.waitForTimeout(BEAT);
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  await page.waitForTimeout(BEAT);

  // straight to the menu you want - a person does not click the section heading first
  await openMenu(page, 'Source Models');
  await page.waitForURL(/\/models\/source-models/, { timeout: 20_000 });
  await page.waitForTimeout(BEAT);

  const infraRow = page
    .locator('tbody tr')
    .filter({ hasText: 'OnPremiseModel' })
    .first();
  await expect(infraRow).toBeVisible({ timeout: 20_000 });
  // click the name, not the empty space beside it - that is where a hand would go
  await humanClick(infraRow.locator('td').nth(1));
  await page.waitForTimeout(BEAT);

  await humanClick(page.getByTestId('source-detail-view-recommend'));
  await expect(page.getByTestId('recommend-modal')).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(BEAT * 2);
});

/** Click a left-menu entry by its label. */
async function openMenu(page: Page, label: string): Promise<void> {
  const item = page
    .getByRole('link', { name: label, exact: true })
    .or(page.getByText(label, { exact: true }))
    .first();
  await humanClick(item);
}
