import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';

const { Given, When, Then } = createBdd(test);

/**
 * 공통 스텝 — 여러 도메인이 재사용하는 네비게이션·검증.
 * 화면 위치(URL)는 여기가 아니라 각 Page Object에 두는 것이 원칙이나,
 * 도메인 종속이 없는 최소 공통 확인만 여기에 둔다.
 */

/** 로그인 성공 후 진입하는 메인 화면 확인 */
Then('메인 화면이 보인다', async ({ page }) => {
  await expect(page).toHaveURL(/\/main/, { timeout: 15_000 });
});

/** 특정 텍스트가 화면에 보이는지 (범용, data-testid 없는 임시 확인용) */
Then('화면에 {string} 텍스트가 보인다', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
});
