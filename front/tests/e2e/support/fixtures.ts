import { test as base } from 'playwright-bdd';

/**
 * 공통 테스트 fixture.
 * - playwright-bdd의 test를 확장해 시나리오 전역에서 쓰는 데이터/헬퍼를 주입한다.
 * - Page Object는 각 스텝에서 `page`로 생성한다(중앙 등록 불필요 → 도메인별 독립 유지보수).
 */
export const test = base;
export const expect = test.expect;
