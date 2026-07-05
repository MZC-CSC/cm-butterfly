import { test as base } from 'playwright-bdd';
import { ApiMock } from './apiMock';
import { registerHoneybeeMocks } from './mocks/honeybee';

/**
 * 공통 테스트 fixture.
 * - playwright-bdd의 test를 확장해 시나리오 전역에서 쓰는 데이터/헬퍼를 주입한다.
 * - Page Object는 각 스텝에서 `page`로 생성한다(중앙 등록 불필요 → 도메인별 독립 유지보수).
 *
 * ★ 테스트 3계층 구분:
 *   - @mock  : `**\/api/**` 를 가로채 연계 프레임워크 없이 화면 흐름을 완결(hermetic). front 단독 회귀·빠른 CI.
 *              연계 프레임워크의 계약 변화는 감지하지 못한다.
 *   - @unit  : mock 미설치 → 실제 라인업으로 호출. 화면 단위로 *연계 프레임워크 계약 변화*를 감지(이번 릴리스 핵심).
 *   - @scenario: 실 라인업 + 클라우드로 end-to-end.
 *   따라서 mock은 @mock 태그에만 설치하고, @unit/@scenario는 실제 백엔드로 나간다.
 */
let currentMock: ApiMock | null = null;

export const test = base.extend<{ mockApi: ApiMock | null }>({
  mockApi: [
    async ({ page }, use, testInfo) => {
      let mock: ApiMock | null = null;
      if (testInfo.tags.includes('@mock')) {
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
