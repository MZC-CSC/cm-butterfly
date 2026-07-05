/** Generated from: features/source/소스서비스.feature */
import { test } from "playwright-bdd";

test.describe("소스 서비스 (소스 컴퓨팅)", () => {

  test.beforeEach(async ({ Given, page }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
  });

  test("소스그룹 생성", { tag: ["@source", "@migration", "@unit"] }, async ({ Given, page, When, Then }) => {
    await Given("소스 서비스 화면을 연다", null, { page });
    await When("\"e2e-src-group\" 이름으로 소스그룹을 생성하면", null, { page });
    await Then("소스그룹 목록에 \"e2e-src-group\" 이(가) 보인다", null, { page });
  });

  test("연결정보 등록", { tag: ["@source", "@migration", "@unit"] }, async ({ Given, page, When, Then, And }) => {
    await Given("소스 서비스 화면을 연다", null, { page });
    await When("\"e2e-conn-group\" 소스그룹에 \"e2e-conn\" 연결정보를 등록하면", null, { page });
    await Then("소스그룹 목록에 \"e2e-conn-group\" 이(가) 보인다", null, { page });
    await And("\"e2e-conn-group\" 소스그룹을 선택한다", null, { page });
    await And("\"e2e-conn\" 연결정보를 선택한다", null, { page });
    await Then("연결정보 목록에 \"e2e-conn\" 이(가) 보인다", null, { page });
  });

  test("수집 실행 (인프라 수집 결과 확인)", { tag: ["@source", "@migration", "@unit"] }, async ({ Given, page, When, And, Then }) => {
    await Given("소스 서비스 화면을 연다", null, { page });
    await When("\"e2e-collect-group\" 소스그룹에 \"e2e-collect-conn\" 연결정보를 등록하면", null, { page });
    await And("\"e2e-collect-group\" 소스그룹을 선택한다", null, { page });
    await And("\"e2e-collect-conn\" 연결정보를 선택한다", null, { page });
    await And("인프라 수집을 실행하면", null, { page });
    await Then("인프라 수집 결과가 조회된다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/source/소스서비스.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "소스그룹 생성": {"pickleLocation":"11:3","tags":["@source","@migration","@unit"],"ownTags":["@unit"]},
  "연결정보 등록": {"pickleLocation":"17:3","tags":["@source","@migration","@unit"],"ownTags":["@unit"]},
  "수집 실행 (인프라 수집 결과 확인)": {"pickleLocation":"26:3","tags":["@source","@migration","@unit"],"ownTags":["@unit"]},
};