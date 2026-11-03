import { test, expect } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { NotificationPage } from '../pages/notification.page';

/**
 * Does reading a notice actually take it off the list?
 *
 * The walkthrough closes each long job by opening its notice, reading it and marking it read. That
 * broke in a way nothing could have asserted: the row was held by *position*, so once the notice
 * left the list the same locator pointed at the next one - which is visible - and waiting for it to
 * disappear waited for something that would not happen.
 *
 * Needs at least one notice on the account; the scenario leaves plenty.
 *
 *   BASE_URL=http://localhost npx playwright test \
 *     --config=tests/e2e/playwright.specs.config.ts notification-clear
 */
test('reading a notice removes it @integration', async ({ page }) => {
  test.setTimeout(3 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const notifications = new NotificationPage(page);
  await notifications.open();

  const before = await notifications.count();
  expect(before, '알림이 하나도 없어 확인할 수 없다').toBeGreaterThan(1);

  await notifications.readAndClearFirst();

  await notifications.open();
  const after = await notifications.count();
  console.log(`[noti] ${before} → ${after}`);
  expect(after, '읽은 알림이 목록에서 빠지지 않았다').toBe(before - 1);
});
