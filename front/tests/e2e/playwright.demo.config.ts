import { defineConfig, devices } from '@playwright/test';
import { config } from './fixtures/test-data';

/**
 * Config for recorded demonstrations.
 *
 * A demo is watched rather than checked, so this differs from the test configs in what it
 * keeps: video always, at a size worth looking at, with a single worker and no retries so
 * the recording is one clean take.
 *
 * Run with E2E_DEMO_PACE=1 - the pointer then travels to each target, waits, and clicks,
 * and text is typed rather than pasted (see support/humanize.ts).
 */
export default defineConfig({
  testDir: './demos',
  testMatch: '**/*.demo.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: config.baseURL,
    video: { mode: 'on', size: { width: 1600, height: 900 } },
    viewport: { width: 1600, height: 900 },
    screenshot: 'off',
    trace: 'off',
    ignoreHTTPSErrors: true,
  },
  /* The device preset carries its own viewport, so the size is restated after it -
     otherwise the page renders at 1280x720 inside a 1600x900 video and the recording
     comes out with a grey border around it. */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
      },
    },
  ],
});
