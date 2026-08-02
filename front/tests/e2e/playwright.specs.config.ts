import { defineConfig, devices } from '@playwright/test';

/**
 * 손으로 쓴 spec 을 돌리기 위한 설정.
 *
 * 기본 설정의 `testDir` 은 bddgen 이 만든 폴더라 `specs/` 아래 파일은 어느 프로젝트에도 잡히지
 * 않는다. 정리·점검처럼 시나리오 밖에서 일부러 돌리는 것들이 여기에 있다.
 *
 *   BASE_URL=http://localhost:5173 npx playwright test \
 *     --config=tests/e2e/playwright.specs.config.ts description-field
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60 * 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.BASE_URL,
    viewport: { width: 1920, height: 1080 },
    // 통과했을 때도 남긴다 — 이 설정으로 도는 것 중에는 *영상을 보려고* 도는 것이 있다
    // (강조가 값 위에 그려지는지 같은 것은 통과 여부로는 알 수 없다).
    video:
      process.env.E2E_VIDEO === 'off'
        ? 'off'
        : { mode: 'on', size: { width: 1920, height: 1080 } },
  },
  reporter: [['list']],
});
