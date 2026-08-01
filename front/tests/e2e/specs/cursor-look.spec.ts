import { test, expect } from '@playwright/test';
import { installCursor } from '../support/cursor';

/**
 * What does the drawn cursor look like?
 *
 * It cannot be told apart from text in a video frame, so it gets put somewhere blank on its own
 * and photographed. The shape has to read as the ordinary system arrow - a viewer compares it with
 * the one on their own screen, and it also has to match the real cursor in recordings of the
 * browser window.
 *
 *   npx playwright test --config=tests/e2e/playwright.specs.config.ts cursor-look
 */
test('the drawn cursor looks like the system one @integration', async ({
  page,
}) => {
  await page.setContent(
    '<body style="margin:0;background:#f8fafc;height:100vh"></body>',
  );
  await installCursor(page);

  await page.mouse.move(200, 150);
  await page.waitForTimeout(400);
  await page
    .locator('body')
    .screenshot({ path: '/tmp/claude-1000/cursor-idle.png' });

  await page.mouse.down();
  await page.waitForTimeout(200);
  await page
    .locator('body')
    .screenshot({ path: '/tmp/claude-1000/cursor-down.png' });
  await page.mouse.up();

  expect(await page.locator('#e2e-cursor').count()).toBe(1);
});
