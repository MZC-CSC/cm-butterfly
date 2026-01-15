import { defineConfig, devices } from '@playwright/test';

/**
 * cm-butterfly E2E 테스트 설정
 *
 * 테스트 실행:
 *   npm test              - 전체 테스트 실행
 *   npm run test:headed   - 브라우저 표시하며 실행
 *   npm run test:ui       - UI 모드로 실행
 *   npm run test:debug    - 디버그 모드
 *
 * 환경 변수:
 *   TEST_BASE_URL - 테스트 대상 URL (기본값: http://localhost:5174)
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* 테스트 전체 타임아웃 */
  timeout: 60 * 1000,

  /* 병렬 실행 */
  fullyParallel: true,

  /* CI 환경에서 .only 사용 금지 */
  forbidOnly: !!process.env.CI,

  /* 재시도 횟수 */
  retries: process.env.CI ? 2 : 0,

  /* 워커 수 */
  workers: process.env.CI ? 1 : undefined,

  /* 리포터 설정 */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/reports', open: 'never' }],
  ],

  /* 공통 설정 */
  use: {
    /* 기본 URL */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5174',

    /* 스크린샷: 항상 캡처 */
    screenshot: 'on',

    /* 비디오: 실패 시에만 저장 */
    video: 'retain-on-failure',

    /* 트레이스: 첫 재시도 시 */
    trace: 'on-first-retry',

    /* 액션 타임아웃 */
    actionTimeout: 15000,

    /* 네비게이션 타임아웃 */
    navigationTimeout: 30000,
  },

  /* 스크린샷 및 비디오 저장 경로 */
  outputDir: 'test-results/artifacts',

  /* 브라우저 프로젝트 */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  /* 테스트 서버 자동 실행 (선택적) */
  // webServer: {
  //   command: 'npm run dev -- --port 5174',
  //   url: 'http://localhost:5174',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
