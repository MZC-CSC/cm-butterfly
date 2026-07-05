/** Generated from: features/auth/로그인.feature */
import { test } from "playwright-bdd";

test.describe("로그인", () => {

  test("유효한 자격증명으로 로그인 성공", { tag: ["@auth", "@unit", "@smoke"] }, async ({ Given, page, Then }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await Then("메인 화면이 보인다", null, { page });
  });

  test("잘못된 비밀번호로 로그인 실패", { tag: ["@auth", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("로그인 화면을 연다", null, { page });
    await When("\"cmiguser\"와 \"wrong-password\"로 로그인을 시도하면", null, { page });
    await Then("로그인에 실패하고 로그인 화면에 머문다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/auth/로그인.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "유효한 자격증명으로 로그인 성공": {"pickleLocation":"7:3","tags":["@auth","@unit","@smoke"],"ownTags":["@smoke","@unit"]},
  "잘못된 비밀번호로 로그인 실패": {"pickleLocation":"12:3","tags":["@auth","@unit"],"ownTags":["@unit"]},
};