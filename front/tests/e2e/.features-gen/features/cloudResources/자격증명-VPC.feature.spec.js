/** Generated from: features/cloudResources/자격증명-VPC.feature */
import { test } from "playwright-bdd";

test.describe("클라우드 리소스 — CSP 자격증명·VPC", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test("CSP 자격증명 목록 조회", { tag: ["@cloudResources", "@unit"] }, async ({ When, page, Then }) => {
    await When("CSP 자격증명 화면을 열면", null, { page });
    await Then("CSP 자격증명 목록이 보인다", null, { page });
  });

  test("CSP 자격증명 등록", { tag: ["@cloudResources", "@unit"] }, async ({ And, page, Then }) => {
    await And("\"aws\" CSP 자격증명을 등록한다", null, { page });
    await Then("\"aws\" 자격증명이 목록에 있다", null, { page });
  });

  test("CSP 자격증명 해제", { tag: ["@cloudResources", "@unit"] }, async ({ And, page, When, Then }) => {
    await And("\"aws\" CSP 자격증명을 등록한다", null, { page });
    await When("\"aws\" CSP 자격증명을 해제하면", null, { page });
    await Then("\"aws\" 자격증명이 목록에서 사라진다", null, { page });
  });

  test("VPC 목록 조회", { tag: ["@cloudResources", "@unit"] }, async ({ Given, page, Then }) => {
    await Given("VPC 화면을 연다", null, { page });
    await Then("VPC 목록이 보인다", null, { page });
  });

  test("VPC 삭제", { tag: ["@cloudResources", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("VPC 화면을 연다", null, { page });
    await When("\"e2e-vpc\" VPC를 삭제하면", null, { page });
    await Then("\"e2e-vpc\" VPC가 목록에서 사라진다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/cloudResources/자격증명-VPC.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "CSP 자격증명 목록 조회": {"pickleLocation":"11:3","tags":["@cloudResources","@unit"],"ownTags":["@unit"]},
  "CSP 자격증명 등록": {"pickleLocation":"16:3","tags":["@cloudResources","@unit"],"ownTags":["@unit"]},
  "CSP 자격증명 해제": {"pickleLocation":"21:3","tags":["@cloudResources","@unit"],"ownTags":["@unit"]},
  "VPC 목록 조회": {"pickleLocation":"27:3","tags":["@cloudResources","@unit"],"ownTags":["@unit"]},
  "VPC 삭제": {"pickleLocation":"32:3","tags":["@cloudResources","@unit"],"ownTags":["@unit"]},
};