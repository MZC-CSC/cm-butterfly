/** Generated from: features/navigation/네비게이션.feature */
import { test } from "playwright-bdd";

test.describe("상단 메뉴 네비게이션", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test.describe("각 메뉴 카테고리 화면이 정상 로드된다", () => {

    test("Example #1", { tag: ["@navigation", "@smoke", "@unit"] }, async ({ When, page, Then }) => {
      await When("\"Source Computing\" 메뉴로 이동하면", null, { page });
      await Then("\"Source Computing\" 화면이 보인다", null, { page });
    });

    test("Example #2", { tag: ["@navigation", "@smoke", "@unit"] }, async ({ When, page, Then }) => {
      await When("\"Models\" 메뉴로 이동하면", null, { page });
      await Then("\"Models\" 화면이 보인다", null, { page });
    });

    test("Example #3", { tag: ["@navigation", "@smoke", "@unit"] }, async ({ When, page, Then }) => {
      await When("\"Workflow Management\" 메뉴로 이동하면", null, { page });
      await Then("\"Workflow Management\" 화면이 보인다", null, { page });
    });

    test("Example #4", { tag: ["@navigation", "@smoke", "@unit"] }, async ({ When, page, Then }) => {
      await When("\"Workload Operations\" 메뉴로 이동하면", null, { page });
      await Then("\"Workload Operations\" 화면이 보인다", null, { page });
    });

    test("Example #5", { tag: ["@navigation", "@smoke", "@unit"] }, async ({ When, page, Then }) => {
      await When("\"Cloud Resources\" 메뉴로 이동하면", null, { page });
      await Then("\"Cloud Resources\" 화면이 보인다", null, { page });
    });

  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/navigation/네비게이션.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "각 메뉴 카테고리 화면이 정상 로드된다|Example #1": {"pickleLocation":"16:7","tags":["@navigation","@smoke","@unit"]},
  "각 메뉴 카테고리 화면이 정상 로드된다|Example #2": {"pickleLocation":"17:7","tags":["@navigation","@smoke","@unit"]},
  "각 메뉴 카테고리 화면이 정상 로드된다|Example #3": {"pickleLocation":"18:7","tags":["@navigation","@smoke","@unit"]},
  "각 메뉴 카테고리 화면이 정상 로드된다|Example #4": {"pickleLocation":"19:7","tags":["@navigation","@smoke","@unit"]},
  "각 메뉴 카테고리 화면이 정상 로드된다|Example #5": {"pickleLocation":"20:7","tags":["@navigation","@smoke","@unit"]},
};