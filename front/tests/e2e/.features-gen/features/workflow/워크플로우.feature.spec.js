/** Generated from: features/workflow/워크플로우.feature */
import { test } from "playwright-bdd";

test.describe("워크플로우 관리", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test("워크플로우 목록 조회", { tag: ["@workflow", "@unit"] }, async ({ When, page, Then }) => {
    await When("워크플로우 목록 화면을 연다", null, { page });
    await Then("워크플로우 목록이 조회된다", null, { page });
  });

  test("워크플로우 템플릿 목록 조회", { tag: ["@workflow", "@unit"] }, async ({ When, page, Then }) => {
    await When("워크플로우 템플릿 화면을 연다", null, { page });
    await Then("워크플로우 템플릿 목록이 조회된다", null, { page });
  });

  test("Task Component 목록 조회 (type/spec 스키마)", { tag: ["@workflow", "@unit"] }, async ({ When, page, Then }) => {
    await When("Task Component 화면을 연다", null, { page });
    await Then("Task Component 목록이 조회된다", null, { page });
  });

  test("워크플로우 디자이너(에디터) 열기", { tag: ["@workflow", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("워크플로우 목록 화면을 연다", null, { page });
    await When("워크플로우 디자이너를 연다", null, { page });
    await Then("워크플로우 디자이너가 표시된다", null, { page });
  });

  test("워크플로우 실행 및 상태 확인 (요금 안전 예제)", { tag: ["@workflow", "@unit", "@run"] }, async ({ When, page, Then, And }) => {
    await When("\"e2e-sample-bash-workflow\" 워크플로우를 실행하면", null, { page });
    await Then("워크플로우 실행 이력이 생성된다", null, { page });
    await And("워크플로우 실행이 정상 완료된다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/workflow/워크플로우.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "워크플로우 목록 조회": {"pickleLocation":"11:3","tags":["@workflow","@unit"],"ownTags":["@unit"]},
  "워크플로우 템플릿 목록 조회": {"pickleLocation":"16:3","tags":["@workflow","@unit"],"ownTags":["@unit"]},
  "Task Component 목록 조회 (type/spec 스키마)": {"pickleLocation":"21:3","tags":["@workflow","@unit"],"ownTags":["@unit"]},
  "워크플로우 디자이너(에디터) 열기": {"pickleLocation":"26:3","tags":["@workflow","@unit"],"ownTags":["@unit"]},
  "워크플로우 실행 및 상태 확인 (요금 안전 예제)": {"pickleLocation":"35:3","tags":["@workflow","@unit","@run"],"ownTags":["@run","@unit"]},
};