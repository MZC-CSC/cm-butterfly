/** Generated from: features/models/소스모델.feature */
import { test } from "playwright-bdd";

test.describe("소스 모델", () => {

  test("소스 모델 목록 조회", { tag: ["@models", "@migration", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await When("소스 모델 화면을 열면", null, { page });
    await Then("소스 모델 목록이 보인다", null, { page });
  });

  test("수집된 정보를 소스 모델로 저장", { tag: ["@models", "@migration", "@unit"] }, async ({ Given, page, And, When, Then }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await And("소스 모델 화면을 연다", null, { page });
    await When("수집된 정보를 \"e2e-nano-source\" 소스 모델로 저장하면", null, { page });
    await Then("소스 모델 목록에 \"e2e-nano-source\" 이 보인다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/models/소스모델.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "소스 모델 목록 조회": {"pickleLocation":"8:3","tags":["@models","@migration","@unit"],"ownTags":["@unit"]},
  "수집된 정보를 소스 모델로 저장": {"pickleLocation":"14:3","tags":["@models","@migration","@unit"],"ownTags":["@unit"]},
};