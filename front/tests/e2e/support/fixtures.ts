import { test as base } from 'playwright-bdd';
import { ApiMock } from './apiMock';
import { registerHoneybeeMocks } from './mocks/honeybee';

/**
 * 공통 테스트 fixture.
 * - playwright-bdd의 test를 확장해 시나리오 전역에서 쓰는 데이터/헬퍼를 주입한다.
 * - Page Object는 각 스텝에서 `page`로 생성한다(중앙 등록 불필요 → 도메인별 독립 유지보수).
 *
 * ★ @unit mock 설치: @unit 태그가 붙은 시나리오에 한해 `**\/api/**` 를 가로채 연계 프레임워크 없이
 *   화면 흐름을 완결시킨다(hermetic). @scenario(실 통합환경)에는 설치되지 않아 실제 백엔드로 나간다.
 *   Playwright 네이티브 auto fixture + testInfo.tags 로 설치해 훅 fixture 주입 불안정성을 피한다.
 */
let currentMock: ApiMock | null = null;

export const test = base.extend<{ mockApi: ApiMock | null }>({
  mockApi: [
    async ({ page }, use, testInfo) => {
      let mock: ApiMock | null = null;
      if (testInfo.tags.includes('@unit')) {
        mock = new ApiMock();
        registerHoneybeeMocks(mock);
        await mock.install(page);
      }
      currentMock = mock;
      await use(mock);
      currentMock = null;
    },
    { auto: true },
  ],
});

export const expect = test.expect;

/** 현재 시나리오에 설치된 mock(계약 검증용). @unit이 아니면 null. */
export function getMock(): ApiMock | null {
  return currentMock;
}
