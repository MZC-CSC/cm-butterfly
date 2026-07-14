import { defineConfig, devices } from '@playwright/test';
import { config } from './fixtures/test-data';

/**
 * 실행 상태 뷰어 전용 설정.
 *
 * 기본 설정은 한국어 .feature → 스텝 생성(BDD) 경로라, 직접 쓴 spec은 잡히지 않는다.
 * 배포된 화면을 그대로 확인하기 위한 용도이므로 testDir만 specs/로 돌린다.
 */
export default defineConfig({
  testDir: './specs',
  /*
    같은 계정으로 동시에 로그인하면 서버가 앞 세션을 무효화한다(사용자당 세션 1개).
    병렬로 돌리면 워커들이 서로의 세션을 밀어내 로그인 화면으로 튕긴다.
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
