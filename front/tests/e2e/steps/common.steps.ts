import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';

const { Given, When, Then } = createBdd(test);

/**
 * Common steps — navigation and assertions reused across multiple domains.
 * As a rule, screen locations (URLs) belong in each Page Object rather than here,
 * but minimal domain-independent common checks live here.
 */

/** Verify the main screen reached after a successful login */
Then('메인 화면이 보인다', async ({ page }) => {
  await expect(page).toHaveURL(/\/main/, { timeout: 15_000 });
});

/** Whether specific text is visible on screen (generic, for temporary checks without a data-testid) */
Then('화면에 {string} 텍스트가 보인다', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
});
