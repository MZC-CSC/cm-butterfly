import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { config } from './fixtures/test-data';

/**
 * 한국어 .feature(features/) → 스텝(steps/) 매핑으로 Playwright 테스트를 생성한다.
 * 실행: `npm run test:e2e` (= bddgen && playwright test)
 */
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  // 생성 spec이 커스텀 test(support/fixtures.ts의 auto mock fixture)를 쓰도록 지정.
  // 이게 없으면 spec이 base playwright-bdd test를 import해 @unit mock이 설치되지 않는다.
  importTestFrom: 'support/fixtures.ts',
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: config.baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
