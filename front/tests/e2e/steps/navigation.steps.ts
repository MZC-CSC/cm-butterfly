import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { NavigationPage } from '../pages/navigation.page';

const { When, Then } = createBdd(test);

/**
 * Navigation steps — routing smoke test for the 5 top-menu categories.
 * The URLs and category aliases live only in NavigationPage.
 */

/** ★ Reusable — the "navigate to the {menu} menu" step */
When('{string} 메뉴로 이동하면', async ({ page }, category: string) => {
  await new NavigationPage(page).gotoCategory(category);
});

/** ★ Reusable — the "the {screen} screen is visible" step */
Then('{string} 화면이 보인다', async ({ page }, category: string) => {
  await new NavigationPage(page).expectCategoryLoaded(category);
});
