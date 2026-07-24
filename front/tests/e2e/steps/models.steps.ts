import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { ModelsPage, isSpecWithinClass } from '../pages/models.page';
import { sourceServer, targetSpec } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';

const { Given, When, Then } = createBdd(test);

/**
 * Model (source/target/recommendation) domain steps.
 * Handles only the sentence (intent) ↔ action wiring; screen locations and elements live in
 * ModelsPage (the Page Object).
 * Provides both functional (@unit) steps and migration scenario (@migration) reuse steps.
 */

/** Last recommended spec (only used within this file, so a module-local variable is enough) */
let lastRecommendedSpec = '';

// ───────────────────────────────────────────────────────────────────────
// Navigation and lookups (unit)
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
  // Don't assume we're on the source model screen.
  // If a previous step is still on the source service screen (the collection popup), it would
  // search that screen's search box, and if the source group name equals the model name it would
  // *accidentally pass on the wrong screen* (which is exactly what was happening).
  const models = new ModelsPage(page);
  await models.gotoSourceModels();
  await models.expectModelInList(uniqueName(name));
});

Then('타깃 모델 목록에 {string} 이 보인다', async ({ page }, name: string) => {
  const models = new ModelsPage(page);
  await models.gotoTargetModels();
  await models.expectModelInList(uniqueName(name));
});

/** "{string} 소스 모델을 선택한다" — select the given source model row in the list (reveals detail) */
Given('{string} 소스 모델을 선택한다', async ({ page }, name: string) => {
  await new ModelsPage(page).selectModel(uniqueName(name));
  scenarioState.sourceModelName = uniqueName(name);
});

// ───────────────────────────────────────────────────────────────────────
// Save source (on-prem) model (unit + migration reuse)
// ───────────────────────────────────────────────────────────────────────

/**
 * ★ Migration reuse step — "그리고 수집된 정보를 소스 모델로 저장한다"
 * Right after collection, select the newest source in the list and save the on-prem info as a
 * source model. The name is based on test-data.sourceServer.name.
 */
// "수집된 정보를 소스 모델로 저장한다" is a source service screen flow (the collection-result Refine
// popup), so it's defined in source.steps.ts.

/** Unit (parameterized) — "수집된 정보를 {string} 소스 모델로 저장하면" */
When(
  '수집된 정보를 {string} 소스 모델로 저장하면',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    await models.gotoSourceModels();
    await models.selectFirstModel();
    await models.saveAsSourceModel(uniqueName(name));
    scenarioState.sourceModelName = uniqueName(name);
  },
);

// ───────────────────────────────────────────────────────────────────────
// Recommend (low cost) → save target model (unit + migration reuse)
// ───────────────────────────────────────────────────────────────────────

/**
 * "저비용 타깃 인프라를 추천받는다/추천받으면" — open the recommendation modal for the currently
 * selected source model and run the recommendation with CSP/Region (test-data.targetSpec) specified.
 * Forcing low cost happens at the result-selection step.
 */
Given('저비용 타깃 인프라를 추천받는다', async ({ page }) => {
  await recommend(page);
});

When('저비용 타깃 인프라를 추천받으면', async ({ page }) => {
  const spec = await recommend(page);
  lastRecommendedSpec = spec;
});

/** "추천 스펙이 {string} 급 이하이다" — verify the lowest-cost candidate spec is at or below maxClass */
// The first argument is the fixture-object slot. This step doesn't use a fixture, but playwright-bdd
// parses the first argument to decide which fixtures to inject, so an empty destructure must be present.
Then(
  '추천 스펙이 {string} 급 이하이다',
  // eslint-disable-next-line no-empty-pattern
  async ({}, maxClass: string) => {
    expect(
      isSpecWithinClass(lastRecommendedSpec, maxClass),
      `추천 스펙 "${lastRecommendedSpec}" 이(가) "${maxClass}" 급 이하가 아님`,
    ).toBeTruthy();
  },
);

/** Unit — "추천 결과 중 가장 저렴한 스펙을 {string} 타깃 모델로 저장하면" */
When(
  '추천 결과 중 가장 저렴한 스펙을 {string} 타깃 모델로 저장하면',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    const chosen = await models.selectLowestCostCandidate();
    lastRecommendedSpec = chosen.spec;
    await models.saveAsTargetModel(uniqueName(name));
  },
);

/**
 * ★ Migration reuse step —
 * "만약 타깃 인프라를 {string} 저비용으로 추천받아 타깃 모델로 저장하면"
 * Runs a low-cost recommendation for the currently selected/saved source model and saves the
 * lowest-cost candidate as a target model.
 * The {string} is a human-readable label (e.g. "small급 저비용"); the actual CSP/Region/class come
 * from test-data.targetSpec.
 */
When(
  '타깃 인프라를 {string} 저비용으로 추천받아 타깃 모델로 저장하면',
  async ({ page }, _label: string) => {
    const models = new ModelsPage(page);
    // Select the infra source model (OnPremiseModel) saved from the collection result, then enter the recommendation modal
    await models.gotoSourceModels();
    await models.selectModel(
      scenarioState.sourceModelName ?? uniqueName(sourceServer.name),
    );
    await models.openRecommend();
    await models.selectProvider(targetSpec.csp);
    await models.selectRegion(targetSpec.region);
    // Increase the candidate count to raise the odds cm-beetle returns filled-in candidates (may still be empty if the source spec is low).
    await models.setCandidateLimit(
      Number(process.env.TEST_RECOMMEND_LIMIT || 20),
    );
    await models.runRecommend();
    // Pick the *largest* candidate within the cost cap (maxClass). Picking the cheapest (micro class)
    // makes software migration never finish due to CPU saturation, so you can't see the very thing
    // you meant to check — "does migration work".
    const chosen = await models.selectLargestCandidateWithinClass(
      targetSpec.maxClass,
    );
    lastRecommendedSpec = chosen.spec;
    // Confirm the cost cap (only when the class can be determined)
    expect(
      isSpecWithinClass(chosen.spec, targetSpec.maxClass),
      `추천 스펙 "${chosen.spec}" 이(가) "${targetSpec.maxClass}" 급 이하가 아님`,
    ).toBeTruthy();
    const targetName = uniqueName(
      process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target',
    );
    await models.saveAsTargetModel(targetName);
  },
);

/**
 * ★ Complete-candidate reuse step —
 * "만약 타깃 인프라를 완전한 후보로 추천받아 타깃 모델로 저장하면"
 *
 * Same process as the low-cost recommendation, but from the results it picks only candidates that
 * are *fully filled in*, using the `data-complete="true"` marker the front-end attaches (§4 root
 * cause: saving a candidate with bad image/spec values means the infra can't be created later).
 * If there's not a single complete candidate, selectCompleteCandidate fails with a clear message —
 * which is itself evidence of a defect in cm-beetle's recommendation response.
 */
When(
  '타깃 인프라를 완전한 후보로 추천받아 타깃 모델로 저장하면',
  async ({ page }) => {
    const models = new ModelsPage(page);
    await models.gotoSourceModels();
    await models.selectModel(
      scenarioState.sourceModelName ?? uniqueName(sourceServer.name),
    );
    await models.openRecommend();
    await models.selectProvider(targetSpec.csp);
    await models.selectRegion(targetSpec.region);
    // Request plenty of candidates to raise the odds a complete one is among them.
    await models.setCandidateLimit(
      Number(process.env.TEST_RECOMMEND_LIMIT || 20),
    );
    await models.runRecommend();
    const chosen = await models.selectCompleteCandidate(targetSpec.maxClass);
    lastRecommendedSpec = chosen.spec;
    expect(
      isSpecWithinClass(chosen.spec, targetSpec.maxClass),
      `선택한 완전 후보 스펙 "${chosen.spec}" 이(가) "${targetSpec.maxClass}" 급 이하가 아님`,
    ).toBeTruthy();
    const targetName = uniqueName(
      process.env.TEST_TARGET_MODEL_NAME || 'e2e-lowcost-target',
    );
    await models.saveAsTargetModel(targetName);
  },
);

// ───────────────────────────────────────────────────────────────────────
// Minimum Match Rate (recommendation condition) — BAR-1634
//
// The screen sends `minMatchRate` to cm-beetle. cm-beetle answers a value it cannot parse, or one
// outside 0-100, by quietly using its own default (90) — the result list looks the same either way.
// So these steps assert on the *outgoing request*, not on what the results look like.
// ───────────────────────────────────────────────────────────────────────

/** Query parameters of the last recommendation request (module-local, like lastRecommendedSpec) */
let lastRecommendQuery: Record<string, string> = {};

/** Text of the explanation the '?' badge opened */
let lastMatchRateHelp = '';

/**
 * Any *infra* source model will do here — these scenarios check how the recommendation
 * *condition input* behaves, not what the recommendation returns, so they don't need the model
 * @seed creates. It has to be an infra one: a software source model's detail opens the software
 * recommendation page instead of the recommend modal.
 */
Given('아무 소스 모델이나 선택한다', async ({ page }) => {
  await new ModelsPage(page).selectFirstInfraModel();
});

/** Open the recommend modal and pick CSP/Region so Search becomes clickable */
Given('타깃 인프라 추천 조건 화면을 연다', async ({ page }) => {
  const models = new ModelsPage(page);
  await models.openRecommend();
  await models.selectProvider(targetSpec.csp);
  await models.selectRegion(targetSpec.region);
});

Given('최소 매치율에 {string} 을 입력한다', async ({ page }, rate: string) => {
  await new ModelsPage(page).setMinimumMatchRate(rate);
});

When('최소 매치율에 {string} 을 입력하면', async ({ page }, rate: string) => {
  await new ModelsPage(page).setMinimumMatchRate(rate);
});

Given(
  '최소 매치율 슬라이더를 {string} 으로 옮긴다',
  async ({ page }, rate: string) => {
    await new ModelsPage(page).slideMinimumMatchRate(Number(rate));
  },
);

When(
  '최소 매치율 슬라이더를 {string} 으로 옮기면',
  async ({ page }, rate: string) => {
    await new ModelsPage(page).slideMinimumMatchRate(Number(rate));
  },
);

When(
  '최소 매치율을 {string} 로 지정하고 추천을 실행하면',
  async ({ page }, rate: string) => {
    const models = new ModelsPage(page);
    await models.setMinimumMatchRate(rate);
    lastRecommendQuery = await models.runRecommendCapturingQuery();
  },
);

When('최소 매치율을 지정하지 않고 추천을 실행하면', async ({ page }) => {
  lastRecommendQuery = await new ModelsPage(page).runRecommendCapturingQuery();
});

When('최소 매치율을 그대로 두고 추천을 실행하면', async ({ page }) => {
  lastRecommendQuery = await new ModelsPage(page).runRecommendCapturingQuery();
});

When('최소 매치율을 비우고 추천을 실행하면', async ({ page }) => {
  const models = new ModelsPage(page);
  await models.clearMinimumMatchRate();
  lastRecommendQuery = await models.runRecommendCapturingQuery();
});

Then(
  '추천 요청의 최소 매치율이 {string} 이다',
  // eslint-disable-next-line no-empty-pattern
  async ({}, expected: string) => {
    expect(
      lastRecommendQuery.minMatchRate,
      `추천 요청 쿼리: ${JSON.stringify(lastRecommendQuery)}`,
    ).toBe(expected);
  },
);

Then(
  '추천 요청에 최소 매치율이 없다',
  // eslint-disable-next-line no-empty-pattern
  async ({}) => {
    expect(
      lastRecommendQuery.minMatchRate,
      `추천 요청 쿼리: ${JSON.stringify(lastRecommendQuery)}`,
    ).toBeUndefined();
  },
);

Then(
  '최소 매치율 입력값이 {string} 이다',
  async ({ page }, expected: string) => {
    expect(await new ModelsPage(page).readMinimumMatchRate()).toBe(expected);
  },
);

Then(
  '최소 매치율 슬라이더 위치가 {string} 이다',
  async ({ page }, expected: string) => {
    expect(await new ModelsPage(page).readMinimumMatchRateSlider()).toBe(
      expected,
    );
  },
);

When('최소 매치율 물음표에 마우스를 올리면', async ({ page }) => {
  lastMatchRateHelp = await new ModelsPage(page).readMatchRateHelpTooltip();
});

Then(
  '최소 매치율 설명에 {string} 가 포함된다',
  // eslint-disable-next-line no-empty-pattern
  async ({}, fragment: string) => {
    expect(lastMatchRateHelp).toContain(fragment);
  },
);

Then(
  '최소 매치율 안내 문구에 {string} 가 포함된다',
  async ({ page }, fragment: string) => {
    expect(await new ModelsPage(page).readMinimumMatchRateHint()).toContain(
      fragment,
    );
  },
);

When('최소 매치율 입력 칸에 포커스를 주면', async ({ page }) => {
  await new ModelsPage(page).focusMinimumMatchRate();
});

When('최소 매치율 슬라이더에 포커스를 주면', async ({ page }) => {
  await new ModelsPage(page).focusMinimumMatchRateSlider();
});

Given('최소 매치율 입력 칸에 포커스를 준다', async ({ page }) => {
  await new ModelsPage(page).focusMinimumMatchRate();
});

When('최소 매치율에서 포커스를 다른 곳으로 옮기면', async ({ page }) => {
  await new ModelsPage(page).moveAwayFromMinimumMatchRate();
});

/** 안내 문구가 나타나고 사라져도 결과 표가 위아래로 밀리지 않아야 한다. */
Then('추천 결과 표의 위치가 그대로다', async ({ page }) => {
  const models = new ModelsPage(page);
  const before = await models.recommendTableTop();
  await models.focusMinimumMatchRate();
  const focused = await models.recommendTableTop();
  await models.moveAwayFromMinimumMatchRate();
  const after = await models.recommendTableTop();
  expect(
    Math.max(Math.abs(focused - before), Math.abs(after - before)),
    `표 위치: 초기 ${before} / 포커스 ${focused} / 해제 ${after}`,
  ).toBeLessThanOrEqual(1);
});

Then('최소 매치율 안내 문구가 보이지 않는다', async ({ page }) => {
  expect(await new ModelsPage(page).isMinimumMatchRateHintVisible()).toBe(
    false,
  );
});

Then(
  '{string} 라벨과 {string} 라벨의 시작 위치가 같다',
  async ({ page }, upper: string, lower: string) => {
    const models = new ModelsPage(page);
    const upperX = await models.labelLeftEdge(upper);
    const lowerX = await models.labelLeftEdge(lower);
    // 소수점 렌더 차이는 허용하되, 눈에 띄는 어긋남(2px 초과)은 잡는다.
    expect(
      Math.abs(upperX - lowerX),
      `"${upper}" x=${upperX} vs "${lower}" x=${lowerX}`,
    ).toBeLessThanOrEqual(2);
  },
);

// ───────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────

/** Open the recommendation modal for the currently selected source model, set CSP/Region, and run. Returns the lowest-cost candidate spec. */
async function recommend(
  page: import('@playwright/test').Page,
): Promise<string> {
  const models = new ModelsPage(page);
  await models.openRecommend();
  await models.selectProvider(targetSpec.csp);
  await models.selectRegion(targetSpec.region);
  await models.runRecommend();
  const chosen = await models.selectLowestCostCandidate();
  return chosen.spec;
}

// ───────────────────────────────────────────────────────────────────────
// SW (software) model recommendation — same process as infra (source SW model → recommend → save target SW model)
// ───────────────────────────────────────────────────────────────────────

/** "{string} 소프트웨어 소스 모델을 선택한다" */
Given(
  '{string} 소프트웨어 소스 모델을 선택한다',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    await models.gotoSourceModels();
    await models.selectModel(uniqueName(name));
  },
);

/**
 * "소프트웨어 마이그레이션을 추천받아 {string} 타깃 SW 모델로 저장하면"
 * — Same as infra recommendation: run the recommendation from the source SW model detail, then
 * save as a target SW model.
 */
When(
  '소프트웨어 마이그레이션을 추천받아 {string} 타깃 SW 모델로 저장하면',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    await models.openSoftwareRecommend();
    await models.runSoftwareRecommend();
    await models.saveAsTargetSoftwareModel(uniqueName(name));
  },
);

/** "타깃 SW 모델 목록에 {string} 이 보인다" — the target SW model list shows {string} */
Then(
  '타깃 SW 모델 목록에 {string} 이 보인다',
  async ({ page }, name: string) => {
    const models = new ModelsPage(page);
    await models.gotoTargetModels();
    await models.expectModelInList(uniqueName(name));
  },
);

// ───────────────────────────────────────────────────────────────────────
// Custom model — saving a source model with only the title changed makes it a custom model
// ───────────────────────────────────────────────────────────────────────

/**
 * "{string} 소스 모델을 {string} 커스텀 모델로 저장하면"
 *
 * In the source model detail's "Custom & View Source Model", review the collected on-prem info and
 * save it with only the name changed. What's saved this way is a custom model (same procedure for
 * both infra and software).
 * Subsequent recommendations run against this custom model, so record it in global state.
 */
When(
  '{string} 소스 모델을 {string} 커스텀 모델로 저장하면',
  async ({ page }, sourceName: string, customName: string) => {
    const models = new ModelsPage(page);
    await models.gotoSourceModels();
    await models.selectModel(uniqueName(sourceName));
    await models.saveAsSourceModel(uniqueName(customName));
    scenarioState.sourceModelName = uniqueName(customName);
  },
);
