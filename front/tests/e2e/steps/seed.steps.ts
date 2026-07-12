import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { ModelsPage } from '../pages/models.page';
import { sourceServer, workflowData } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';

const { Given, Then } = createBdd(test);

/**
 * 시드 스텝 — 기능(@unit) 테스트가 딛고 설 데이터를 만든다.
 *
 * 소스 등록·인프라 수집·소스모델 저장은 source.steps의 스텝을 그대로 재사용하고,
 * 여기에는 시드에만 필요한 것(소프트웨어 수집·SW 소스모델·요금 안전 워크플로우)을 둔다.
 */

/** "그리고 소스 소프트웨어를 수집한다" — 인프라 수집과 같은 절차(Collect Software) */
Given('소스 소프트웨어를 수집한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  await source.goto();
  await source.selectGroup(uniqueName(sourceServer.name));
  await source.collectSoftware();
});

/** "그리고 수집된 소프트웨어를 {string} 소스 모델로 저장한다" — 수집 결과 팝업에서 SW 소스모델 저장 */
Given('수집된 소프트웨어를 {string} 소스 모델로 저장한다', async ({ page }, name: string) => {
  await new SourceServicesPage(page).saveCollectedSwAsSourceModel(uniqueName(name));
});

/**
 * "그리고 요금 안전 예제 워크플로우 {string} 를 준비한다"
 *
 * ★ 요금 안전 — 실제 인프라를 만들지 않는 예제 템플릿으로만 만든다.
 *   마이그레이션 템플릿(migrate_infra_workflow 등)은 EC2를 프로비저닝하므로 @unit 실행 대상이 될 수 없다.
 *   여기서는 cm-cicada가 기본 제공하는 예제 템플릿(_v2_example_xcom_workflow)을 그대로 쓴다.
 *
 * 콘솔이 쓰는 프록시(operationId)를 그대로 호출해 로그인 세션·경로를 실제 사용 흐름과 같게 태운다.
 */
Given('요금 안전 예제 워크플로우 {string} 를 준비한다', async ({ page }, name: string) => {
  test.setTimeout(10 * 60_000);
  const token = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k) ?? '';
      const m = v.match(/"access_token"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
    }
    return '';
  });
  expect(token, '로그인 세션에서 access token을 찾지 못했다').not.toEqual('');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 예제 템플릿을 찾아 그 정의(task_groups)를 그대로 워크플로우로 만든다.
  const templateName = workflowData.safeRunTemplateName;
  const listRes = await page.request.post('/api/cm-cicada/list-workflow-template', {
    data: {},
    headers,
  });
  expect(
    listRes.ok(),
    `워크플로우 템플릿 조회 실패: ${listRes.status()} ${await listRes.text()}`,
  ).toBeTruthy();
  const templates = (await listRes.json())?.responseData ?? [];
  const template = (Array.isArray(templates) ? templates : []).find(
    (t: { name?: string }) => t?.name === templateName,
  );
  expect(
    template,
    `요금 안전 예제 템플릿 "${templateName}"을 찾지 못했다. 있는 템플릿: ${(Array.isArray(templates) ? templates : [])
      .map((t: { name?: string }) => t?.name)
      .join(', ')}`,
  ).toBeTruthy();

  const res = await page.request.post('/api/cm-cicada/create-workflow', {
    data: {
      request: {
        name: uniqueName(name),
        description: 'e2e — cost-safe example workflow (no cloud provisioning)',
        data: { task_groups: template.data?.task_groups ?? template.task_groups ?? [] },
      },
    },
    headers,
  });
  expect(
    res.ok(),
    `요금 안전 워크플로우 준비 실패: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  const wfId = (await res.json())?.responseData?.id;
  expect(wfId, '생성된 워크플로우 id를 받지 못했다').toBeTruthy();

  // ★ DAG가 등록될 때까지 기다린다.
  //
  //   cm-cicada는 워크플로우를 만들 때 DAG YAML을 디스크에 쓰기만 하고, airflow가 그걸 주기적으로 파싱해
  //   등록한다(수십 초). 그 전에 실행하면 "provided dag_id is not exist"로 거부된다.
  //   기능 테스트가 이 창에 걸려 실행이 안 되는 걸 "실행 실패"로 오해하지 않도록, 시드에서 *실제로 실행이
  //   받아들여질 때까지* 확인하고 넘어간다. 여기서 한 번 돌려 두면 이력도 남아 뒤 테스트가 안정된다.
  const deadline = Date.now() + 5 * 60_000;
  let lastStatus = 0;
  let lastBody = '';
  for (;;) {
    const run = await page.request.post(`/api/cm-cicada/run-workflow`, {
      data: { pathParams: { wfId } },
      headers,
    });
    lastStatus = run.status();
    if (run.ok()) break;
    lastBody = (await run.text()).slice(0, 200);
    expect(
      Date.now() < deadline,
      `요금 안전 워크플로우 실행이 끝내 받아들여지지 않았다(${lastStatus}): ${lastBody}\n` +
        'airflow가 DAG를 등록하지 못했을 수 있다 — DagBag import 오류를 확인한다.',
    ).toBeTruthy();
    await page.waitForTimeout(15_000);
  }
});

/** "그리고 소스 모델 목록에 {string} 이 보인다" 의 시드용 별칭은 models.steps의 것을 그대로 쓴다. */
Then('시드 데이터가 준비되었다', async ({ page }) => {
  await new ModelsPage(page).expectModelListVisible();
});
