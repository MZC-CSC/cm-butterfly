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

/** 시나리오 동안 콘솔이 백엔드로 내보낸 요청 기록 (계약 회귀 검증용) */
export interface SentRequest {
  method: string;
  url: string;
  body: string;
}
let sentRequests: SentRequest[] = [];

export const test = base.extend<{ mockApi: ApiMock | null; screens: boolean }>({
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

  /**
   * 화면 캡처 + 요청 기록 fixture.
   *
   * - 콘솔이 프록시(`/api/**`)로 보내는 요청을 모아 둔다. 스텝에서 "구 스키마 payload를 보내지 않는다"
   *   같은 *계약* 검증에 쓴다. 화면이 멀쩡해 보여도 나가는 요청이 구 스키마면 잡아낸다.
   * - 시나리오가 끝나면 마지막 화면을 캡처해 리포트에 첨부한다. 웹은 계약이 맞아도 보이는 것이
   *   깨질 수 있어, 실행 결과 화면을 증거로 남겨 비교·분석에 쓴다.
   */
  screens: [
    async ({ page }, use, testInfo) => {
      sentRequests = [];
      page.on('request', req => {
        if (req.url().includes('/api/') && req.method() !== 'GET') {
          sentRequests.push({ method: req.method(), url: req.url(), body: req.postData() ?? '' });
        }
      });

      const { captureScreen } = await import('./screenshot');

      // ★ 시작 화면 — "테스트 전에는 무엇이 보였나"를 남긴다.
      //   성공/실패와 무관하게 남겨야 사람이 전/후를 비교해 *정말* 정상 동작했는지 판단할 수 있다.
      //   (첫 화면은 보통 about:blank라 실패해도 무시한다.)
      try {
        await captureScreen(page, testInfo, '01-before');
      } catch {
        // 아직 페이지가 열리기 전이면 캡처할 게 없다 — 무시.
      }

      await use(true);

      // ★ 종료 화면 — "테스트가 끝났을 때 화면이 어떤 상태였나".
      try {
        await captureScreen(page, testInfo, '99-after');
      } catch {
        // 캡처 실패가 테스트를 깨뜨리지 않게 한다(증거 보존은 부가 목적).
      }
      sentRequests = [];
    },
    { auto: true },
  ],
});

/** 이번 시나리오에서 콘솔이 백엔드로 보낸 요청들 */
export function getSentRequests(): SentRequest[] {
  return sentRequests;
}

export const expect = test.expect;

/** 현재 시나리오에 설치된 mock(계약 검증용). @unit이 아니면 null. */
export function getMock(): ApiMock | null {
  return currentMock;
}
