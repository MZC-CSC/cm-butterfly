/** Generated from: features/workload/워크로드-MCI.feature */
import { test } from "playwright-bdd";

test.describe("워크로드 운영 (인프라 MCI · 노드 VM · 부하테스트)", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test("인프라(MCI) 목록 조회", { tag: ["@workload", "@unit", "@smoke"] }, async ({ Given, page, Then }) => {
    await Given("워크로드 인프라 목록을 연다", null, { page });
    await Then("인프라 목록이 조회된다", null, { page });
  });

  test("인프라 상세 및 서버(노드) 목록 조회", { tag: ["@workload", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("워크로드 인프라 목록을 연다", null, { page });
    await When("\"e2e-target-infra\" 인프라를 선택한다", null, { page });
    await Then("인프라 상세 정보가 보인다", null, { page });
    await When("\"e2e-target-infra\" 인프라의 서버 목록을 연다", null, { page });
    await Then("\"e2e-target-node\" 노드가 서버 목록에 보인다", null, { page });
  });

  test("노드 부하테스트 실행 및 결과 확인", { tag: ["@workload", "@unit", "@costly"] }, async ({ Given, page, When, Then }) => {
    await Given("워크로드 인프라 목록을 연다", null, { page });
    await When("\"e2e-target-infra\" 인프라의 서버 목록을 연다", null, { page });
    await When("\"e2e-target-node\" 노드로 부하테스트를 실행한다", null, { page });
    await Then("부하테스트 결과가 표시된다", null, { page });
  });

  test("부하테스트 시나리오 템플릿(카탈로그) 저장", { tag: ["@workload", "@unit"] }, async ({ Given, page, When, And, Then }) => {
    await Given("워크로드 인프라 목록을 연다", null, { page });
    await When("\"e2e-target-infra\" 인프라의 서버 목록을 연다", null, { page });
    await And("\"e2e-target-node\" 노드를 선택한다", null, { page });
    await When("부하테스트 시나리오 템플릿 \"e2e-template\"을 저장한다", null, { page });
    await Then("시나리오 템플릿 \"e2e-template\"이 카탈로그에 보인다", null, { page });
  });

  test("인프라(MCI) 삭제", { tag: ["@workload", "@unit", "@costly"] }, async ({ Given, page, When, Then }) => {
    await Given("워크로드 인프라 목록을 연다", null, { page });
    await When("\"e2e-target-infra\" 인프라를 삭제한다", null, { page });
    await Then("\"e2e-target-infra\" 인프라가 목록에서 사라진다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/workload/워크로드-MCI.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "인프라(MCI) 목록 조회": {"pickleLocation":"12:3","tags":["@workload","@unit","@smoke"],"ownTags":["@smoke","@unit"]},
  "인프라 상세 및 서버(노드) 목록 조회": {"pickleLocation":"17:3","tags":["@workload","@unit"],"ownTags":["@unit"]},
  "노드 부하테스트 실행 및 결과 확인": {"pickleLocation":"25:3","tags":["@workload","@unit","@costly"],"ownTags":["@costly","@unit"]},
  "부하테스트 시나리오 템플릿(카탈로그) 저장": {"pickleLocation":"32:3","tags":["@workload","@unit"],"ownTags":["@unit"]},
  "인프라(MCI) 삭제": {"pickleLocation":"40:3","tags":["@workload","@unit","@costly"],"ownTags":["@costly","@unit"]},
};