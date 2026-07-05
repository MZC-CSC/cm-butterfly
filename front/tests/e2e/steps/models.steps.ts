import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { ModelsPage, isSpecWithinClass } from '../pages/models.page';
import { sourceServer, targetSpec } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';

const { Given, When, Then } = createBdd(test);

/**
 * 모델(소스/타깃/추천) 도메인 스텝.
 * 문장(의도) ↔ 액션 연결만 담당하고, 화면 위치·요소는 ModelsPage(Page Object)에 있다.
 * 기능(@unit) 스텝과 마이그레이션 시나리오(@migration) 재사용 스텝을 함께 제공한다.
 */

/** 시나리오 전역 상태 — 방금 저장/선택한 소스 모델 이름, 마지막 추천 스펙 */
let lastSourceModelName = '';
let lastRecommendedSpec = '';

// ───────────────────────────────────────────────────────────────────────
// 화면 이동·조회 (유닛)
// ───────────────────────────────────────────────────────────────────────

Given('소스 모델 화면을 연다', async ({ page }) => {
  await new ModelsPage(page).gotoSourceModels();
});

When('소스 모델 화면을 열면', async ({ page }) => {
  await new ModelsPage(page).gotoSourceModels();
});

Given('타깃 모델 화면을 연다', async ({ page }) => {
  await new ModelsPage(page).gotoTargetModels();
});

Then('소스 모델 목록이 보인다', async ({ page }) => {
  await new ModelsPage(page).expectModelListVisible();
});

Then('소스 모델 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  await new ModelsPage(page).expectModelInList(name);
});

Then('타깃 모델 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  const models = new ModelsPage(page);
  await models.gotoTargetModels();
  await models.expectModelInList(name);
});

/** "{string} 소스 모델을 선택한다" — 목록에서 지정 소스 모델 행 선택(상세 노출) */
Given('{string} 소스 모델을 선택한다', async ({ page }, name: string) => {
  await new ModelsPage(page).selectModel(name);
  lastSourceModelName = name;
});

// ───────────────────────────────────────────────────────────────────────
// 소스(온프렘) 모델 저장 (유닛 + 마이그레이션 재사용)
// ───────────────────────────────────────────────────────────────────────

/**
 * ★ 마이그레이션 재사용 스텝 — "그리고 수집된 정보를 소스 모델로 저장한다"
 * 수집 직후 목록의 최신 소스를 선택해 온프렘 정보를 소스 모델로 저장한다.
 * 이름은 test-data.sourceServer.name 기준.
 */
// "수집된 정보를 소스 모델로 저장한다"는 소스 서비스 화면(수집 결과 Refine 팝업) 흐름이라 source.steps.ts에 정의한다.

/** 유닛(파라미터) — "수집된 정보를 {string} 소스 모델로 저장하면" */
When('수집된 정보를 {string} 소스 모델로 저장하면', async ({ page }, name: string) => {
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  await models.selectFirstModel();
  await models.saveAsSourceModel(name);
  lastSourceModelName = name;
});

// ───────────────────────────────────────────────────────────────────────
// 추천(저비용) → 타깃 모델 저장 (유닛 + 마이그레이션 재사용)
// ───────────────────────────────────────────────────────────────────────

/**
 * "저비용 타깃 인프라를 추천받는다/추천받으면" — 현재 선택된 소스 모델로 추천 모달을 열고
 * CSP/Region(test-data.targetSpec)을 지정해 추천 실행. 저비용 강제는 결과 선택 단계에서.
 */
Given('저비용 타깃 인프라를 추천받는다', async ({ page }) => {
  await recommend(page);
});

When('저비용 타깃 인프라를 추천받으면', async ({ page }) => {
  const spec = await recommend(page);
  lastRecommendedSpec = spec;
});

/** "추천 스펙이 {string} 급 이하이다" — 최저가 후보 스펙이 maxClass 급 이하인지 검증 */
Then('추천 스펙이 {string} 급 이하이다', async ({}, maxClass: string) => {
  expect(
    isSpecWithinClass(lastRecommendedSpec, maxClass),
    `추천 스펙 "${lastRecommendedSpec}" 이(가) "${maxClass}" 급 이하가 아님`,
  ).toBeTruthy();
});

/** 유닛 — "추천 결과 중 가장 저렴한 스펙을 {string} 타깃 모델로 저장하면" */
When(
  '추천 결과 중 가장 저렴한 스펙을 {string} 타깃 모델로 저장하면',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    const chosen = await models.selectLowestCostCandidate();
    lastRecommendedSpec = chosen.spec;
    await models.saveAsTargetModel(name);
  },
);

/**
 * ★ 마이그레이션 재사용 스텝 —
 * "만약 타깃 인프라를 {string} 저비용으로 추천받아 타깃 모델로 저장하면"
 * 현재 선택/저장된 소스 모델로 저비용 추천을 실행하고, 최저가 후보를 타깃 모델로 저장한다.
 * {string}은 사람이 읽는 라벨(예: "small급 저비용")이며 실제 CSP/Region/급은 test-data.targetSpec.
 */
When(
  '타깃 인프라를 {string} 저비용으로 추천받아 타깃 모델로 저장하면',
  async ({ page }, _label: string) => {
    const models = new ModelsPage(page);
    // 수집 결과로 저장한 인프라 소스모델(OnPremiseModel)을 선택한 뒤 추천 모달 진입
    await models.gotoSourceModels();
    await models.selectModel(lastSourceModelName || uniqueName(sourceServer.name));
    await models.openRecommend();
    await models.selectProvider(targetSpec.csp);
    await models.selectRegion(targetSpec.region);
    await models.runRecommend();
    const chosen = await models.selectLowestCostCandidate();
    lastRecommendedSpec = chosen.spec;
    // 저비용 강제 확인(급 판별 가능할 때만)
    expect(
      isSpecWithinClass(chosen.spec, targetSpec.maxClass),
      `추천 최저가 스펙 "${chosen.spec}" 이(가) "${targetSpec.maxClass}" 급 이하가 아님`,
    ).toBeTruthy();
    const targetName = uniqueName(process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target');
    await models.saveAsTargetModel(targetName);
  },
);

// ───────────────────────────────────────────────────────────────────────
// 내부 헬퍼
// ───────────────────────────────────────────────────────────────────────

/** 현재 선택된 소스 모델로 추천 모달을 열고 CSP/Region 지정 후 실행. 최저가 후보 스펙 반환. */
async function recommend(page: import('@playwright/test').Page): Promise<string> {
  const models = new ModelsPage(page);
  await models.openRecommend();
  await models.selectProvider(targetSpec.csp);
  await models.selectRegion(targetSpec.region);
  await models.runRecommend();
  const chosen = await models.selectLowestCostCandidate();
  return chosen.spec;
}

// ───────────────────────────────────────────────────────────────────────
// SW(소프트웨어) 모델 추천 — 인프라와 동일 과정(소스 SW 모델 → 추천 → 타깃 SW 모델 저장)
// ───────────────────────────────────────────────────────────────────────

/** "{string} 소프트웨어 소스 모델을 선택한다" */
Given('{string} 소프트웨어 소스 모델을 선택한다', async ({ page }, name: string) => {
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  await models.selectModel(name);
});

/**
 * "소프트웨어 마이그레이션을 추천받아 {string} 타깃 SW 모델로 저장하면"
 * — 인프라 추천과 동일: 소스 SW 모델 상세에서 추천 실행 후 타깃 SW 모델로 저장.
 */
When(
  '소프트웨어 마이그레이션을 추천받아 {string} 타깃 SW 모델로 저장하면',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    await models.openSoftwareRecommend();
    await models.runSoftwareRecommend();
    await models.saveAsTargetSoftwareModel(name);
  },
);

/** "타깃 SW 모델 목록에 {string} 이 보인다" */
Then('타깃 SW 모델 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  const models = new ModelsPage(page);
  await models.gotoTargetModels();
  await models.expectModelInList(name);
});
