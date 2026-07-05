/** Generated from: features/models/추천-타깃모델.feature */
import { test } from "playwright-bdd";

test.describe("추천·타깃 모델", () => {

  test("저비용 타깃 인프라 추천", { tag: ["@models", "@migration", "@unit"] }, async ({ Given, page, And, When, Then }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await And("소스 모델 화면을 연다", null, { page });
    await And("\"e2e-nano-source\" 소스 모델을 선택한다", null, { page });
    await When("저비용 타깃 인프라를 추천받으면", null, { page });
    await Then("추천 스펙이 \"small\" 급 이하이다");
  });

  test("추천 결과를 저비용 타깃 모델로 저장", { tag: ["@models", "@migration", "@unit"] }, async ({ Given, page, And, When, Then }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await And("소스 모델 화면을 연다", null, { page });
    await And("\"e2e-nano-source\" 소스 모델을 선택한다", null, { page });
    await And("저비용 타깃 인프라를 추천받는다", null, { page });
    await When("추천 결과 중 가장 저렴한 스펙을 \"e2e-lowcost-target\" 타깃 모델로 저장하면", null, { page });
    await Then("타깃 모델 목록에 \"e2e-lowcost-target\" 이 보인다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/models/추천-타깃모델.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "저비용 타깃 인프라 추천": {"pickleLocation":"9:3","tags":["@models","@migration","@unit"],"ownTags":["@unit"]},
  "추천 결과를 저비용 타깃 모델로 저장": {"pickleLocation":"17:3","tags":["@models","@migration","@unit"],"ownTags":["@unit"]},
};