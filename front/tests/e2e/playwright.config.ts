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

/**
 * ★ @costly — 실제 클라우드 자원을 만들거나 지우는(요금이 붙는) 테스트.
 *   기본은 제외하고, E2E_INCLUDE_COSTLY=1 일 때만 돌린다.
 *   (지금까지 이 게이트가 config에 아예 없어서, 인프라 삭제 같은 파괴적 테스트가 매번 돌고 있었다.)
 */
const includeCostly = process.env.E2E_INCLUDE_COSTLY === '1';

/**
 * ★ 증거 보존 (기본 켜짐, `E2E_EVIDENCE=0` 으로 끔)
 *
 * "PASS" 한 줄로는 정말 정상 동작한 건지 사람이 확인할 수 없다. 화면이 비어 있어도, 엉뚱한 데이터가
 * 떠 있어도 단언문만 통과하면 PASS로 보인다. 그래서 *성공한 테스트도* 시작 화면·종료 화면·영상을 남겨
 * 사람이 눈으로 판정할 수 있게 한다.
 *
 *  - screenshot 'on'  : 테스트마다 화면 캡처(+ fixtures가 before/after를 따로 첨부)
 *  - video 'on'       : 테스트 전 과정 영상 — 어떤 단계에서 무엇이 보였는지 그대로 남는다
 *  - trace 'on'       : 각 액션 시점의 DOM·네트워크까지 되짚어볼 수 있다
 *
 * 결과는 `playwright-report/`(HTML)와 `test-results/`에 남고, HTML 리포트에서 테스트별로 모아 볼 수 있다.
 * CI에서 용량이 부담되면 E2E_EVIDENCE=0 으로 실패 건만 남기도록 줄인다.
 */
const evidence = process.env.E2E_EVIDENCE !== '0';

export default defineConfig({
  testDir,
  // 실행 시작 시 RUN_ID를 정해 모든 worker 프로세스가 같은 리소스 이름을 쓰게 한다(support/naming.ts).
  globalSetup: './support/globalSetup.ts',
  fullyParallel: false,
  // @unit/@scenario는 실 라인업 상태를 공유하므로 직렬 실행(병렬 시 데이터 충돌).
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: config.baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: evidence ? 'on' : 'only-on-failure',
    trace: evidence ? 'on' : 'retain-on-failure',
    video: evidence ? 'on' : 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  /**
   * ★ 3단 구성 — 기능 테스트의 "데이터가 없어서 실패"를 구조로 없앤다.
   *
   *     seed ─┬─→ functional
   *           └─→ scenario
   *
   * @unit 기능 테스트는 mock 없이 실 라인업을 친다(연계 프레임워크의 계약 변화를 잡는 게 목적이다).
   * 그래서 소스 모델·타깃 모델·워크플로우가 *실제로 있어야* 한다. 그런데 그 데이터를 만드는 주체가
   * 아무도 없어서, e2e-nano-source 같은 이름을 기다리다 타임아웃으로 죽고 있었다.
   *
   * seed 프로젝트가 먼저 돌아 그 데이터를 만들고(실 소스 서버 수집 → 소스/커스텀/타깃 모델 →
   * 요금 안전 워크플로우), functional·scenario가 그 위에서 돈다. 순서는 Playwright의 project
   * dependencies로 *명시*한다 — 파일 이름 정렬 같은 암묵적 순서에 기대지 않는다.
   */
  projects: [
    {
      name: 'seed',
      use: { ...devices['Desktop Chrome'] },
      grep: /@seed/,
      // 실 소스 서버 수집·추천이 들어가 90초로는 모자라다.
      timeout: 15 * 60_000,
    },
    {
      name: 'functional',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed'],
      grep: /@unit/,
      grepInvert: includeCostly ? undefined : /@costly/,
    },
    {
      name: 'scenario',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed'],
      grep: /@scenario/,
      // 시나리오는 실제로 EC2를 만든다(@costly). 기본 실행에서는 빼고, E2E_INCLUDE_COSTLY=1 일 때만 돈다.
      grepInvert: includeCostly ? undefined : /@costly/,
      // 워크플로우 실행 → cm-beetle 마이그레이션 → EC2 생성 → nginx 설치 → 부하테스트까지 한 시나리오다.
      // 클라우드가 실제로 자원을 만드는 시간이라 넉넉히 잡는다.
      timeout: 60 * 60_000,
    },
  ],
});
