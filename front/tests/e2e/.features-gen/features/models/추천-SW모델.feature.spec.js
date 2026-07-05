/** Generated from: features/models/추천-SW모델.feature */
import { test } from "playwright-bdd";

test.describe("소프트웨어 마이그레이션 추천·타깃 SW 모델", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test("소프트웨어 추천을 타깃 SW 모델로 저장", { tag: ["@models", "@software", "@unit"] }, async ({ And, page, When, Then }) => {
    await And("\"e2e-sw-source\" 소프트웨어 소스 모델을 선택한다", null, { page });
    await When("소프트웨어 마이그레이션을 추천받아 \"e2e-sw-target\" 타깃 SW 모델로 저장하면", null, { page });
    await Then("타깃 SW 모델 목록에 \"e2e-sw-target\" 이 보인다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/models/추천-SW모델.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "소프트웨어 추천을 타깃 SW 모델로 저장": {"pickleLocation":"11:3","tags":["@models","@software","@unit"],"ownTags":["@unit"]},
};