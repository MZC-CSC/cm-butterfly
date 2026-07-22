import { defineConfig, devices } from '@playwright/test';
import { config } from './fixtures/test-data';

/**
 * Config dedicated to the run-status viewer.
 *
 * The default config follows the Korean .feature -> step-generation (BDD) path, so hand-written specs are not picked up.
 * This is meant to check the deployed screen directly, so it points testDir at specs/ only.
 */
export default defineConfig({
  testDir: './specs',
  /*
    Logging in concurrently with the same account makes the server invalidate the earlier session (one session per user).
    Running in parallel would have the workers push each other's sessions out and bounce back to the login screen.
  */
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: config.baseURL,
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
