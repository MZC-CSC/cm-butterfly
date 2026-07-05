/** Generated from: features/scenarios/인프라마이그레이션.feature */
import { test } from "playwright-bdd";

test.describe("인프라 마이그레이션 (전체 흐름)", () => {

  test("온프렘 소스를 저비용 클라우드 인프라로 마이그레이션하고 인스턴스 생성 확인", { tag: ["@migration", "@scenario", "@e2e"] }, async ({ Given, page, And, When, Then, request }) => {
    await Given("\"cmiguser\"로 로그인한다", null, { page });
    await And("소스 서비스에 \"e2e-nano-source\" 소스서버를 등록한다", null, { page });
    await And("소스 인프라를 수집한다", null, { page });
    await And("수집된 정보를 소스 모델로 저장한다", null, { page });
    await When("타깃 인프라를 \"small\" 저비용으로 추천받아 타깃 모델로 저장하면", null, { page });
    await And("마이그레이션 워크플로우를 생성하고 실행하면", null, { page });
    await Then("타깃 EC2 인스턴스가 정상 생성된다", null, { page });
    await And("생성된 워크로드에 nginx를 설치한다", null, { request });
    await Then("nginx가 외부에서 접근 가능하다", null, { request });
    await And("생성된 워크로드에 부하 테스트를 실행한다", null, { page });
    await Then("부하 테스트 결과가 조회된다", null, { page });
    await And("생성된 인스턴스를 중지한다", null, { page });
    await And("생성된 리소스를 정리한다", null, { page });
  });

});

// == technical section ==

test.use({
  $test: ({}, use) => use(test),
  $uri: ({}, use) => use("features/scenarios/인프라마이그레이션.feature"),
  $bddFileMeta: ({}, use) => use(bddFileMeta),
  $lang: ({}, use) => use("ko"),
});

const bddFileMeta = {
  "온프렘 소스를 저비용 클라우드 인프라로 마이그레이션하고 인스턴스 생성 확인": {"pickleLocation":"9:3","tags":["@migration","@scenario","@e2e"],"ownTags":["@e2e","@scenario"]},
};