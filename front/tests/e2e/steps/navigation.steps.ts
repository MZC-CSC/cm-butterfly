import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures';
import { NavigationPage } from '../pages/navigation.page';

const { When, Then } = createBdd(test);

/**
 * 네비게이션 스텝 — 상단 5개 메뉴 카테고리 라우팅 스모크.
 * 화면 위치(URL)와 카테고리 별칭은 NavigationPage에만 둔다.
 */

/** ★ 재사용 — "\"Cloud Resources\" 메뉴로 이동하면" */
When('{string} 메뉴로 이동하면', async ({ page }, category: string) => {
  await new NavigationPage(page).gotoCategory(category);
});

/** ★ 재사용 — "\"Cloud Resources\" 화면이 보인다" */
Then('{string} 화면이 보인다', async ({ page }, category: string) => {
  await new NavigationPage(page).expectCategoryLoaded(category);
});
