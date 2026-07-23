import { Page, TestInfo, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Screen-capture support — on the web, what is *shown* can break even when the contract
 * (API) matches, so we keep the post-run screen for a person to compare or for automatic
 * comparison against a baseline.
 *
 * It provides two things.
 *  1) captureScreen()   — save the screen at any point during the scenario + attach to the report.
 *                         (for evidence. does not fail)
 *  2) expectScreenBaseline() — pixel-compare against a baseline image. If there is no baseline, it is created on the first run.
 *                         (for visual regression. fails if the difference exceeds the threshold)
 *
 * Save location: test-results/screens/{scenario}/{name}.png
 * baseline:  tests/e2e/__screens__/{name}.png  (kept in git)
 */

const SCREEN_DIR = 'test-results/screens';

function slug(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Save the current screen and attach it to the report. For evidence — does not cause a failure. */
export async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<string> {
  const dir = path.join(SCREEN_DIR, slug(testInfo.title));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return file;
}

/**
 * Compare against the baseline image. Fails if the screen changes unintentionally.
 *
 * On the first run there is no baseline, so Playwright creates one and passes (review that
 * result, then commit). Flaky areas like animations and time displays are excluded with a mask.
 */
export async function expectScreenBaseline(
  page: Page,
  name: string,
  opts: {
    maxDiffPixelRatio?: number;
    mask?: ReturnType<Page['locator']>[];
  } = {},
): Promise<void> {
  await expect(page).toHaveScreenshot(`${slug(name)}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: opts.maxDiffPixelRatio ?? 0.02,
    mask: opts.mask,
  });
}
