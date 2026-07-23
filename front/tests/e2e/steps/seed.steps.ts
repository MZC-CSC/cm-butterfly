import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { ModelsPage } from '../pages/models.page';
import { sourceServer, workflowData } from '../fixtures/test-data';
import { uniqueName } from '../support/naming';
import { scenarioState } from '../support/world';

const { Given, Then } = createBdd(test);

/**
 * Seed steps — create the data that functional (@unit) tests stand on.
 *
 * Source registration, infra collection, and source-model save reuse the steps from
 * source.steps as is; only what the seed alone needs (software collection, SW source
 * model, cost-safe workflow) lives here.
 */

/**
 * "그리고 소스 소프트웨어를 수집한다" — same procedure as infra collection (Collect Software)
 *
 * The target group is the one *registered by this scenario*. The seed registers
 * e2e-nano-source and the migration scenario registers e2e-scn-source, but previously the
 * fixtures name was hardcoded here, so the scenario collected software from the wrong
 * group (the one the seed created).
 */
Given('소스 소프트웨어를 수집한다', async ({ page }) => {
  const source = new SourceServicesPage(page);
  await source.goto();
  await source.selectGroup(
    scenarioState.sourceGroupName ?? uniqueName(sourceServer.name),
  );
  await source.collectSoftware();
});

/** "그리고 수집된 소프트웨어를 {string} 소스 모델로 저장한다" — save the SW source model from the collection-result popup */
Given(
  '수집된 소프트웨어를 {string} 소스 모델로 저장한다',
  async ({ page }, name: string) => {
    const modelName = uniqueName(name);
    await new SourceServicesPage(page).saveCollectedSwAsSourceModel(modelName);
    // The SW recommendation step picks up this model.
    scenarioState.softwareSourceModelName = modelName;
  },
);

/**
 * "그리고 요금 안전 예제 워크플로우 {string} 를 준비한다"
 *
 * ★ Cost-safe — built only from an example template that does not create real infra.
 *   Migration templates (migrate_infra_workflow, etc.) provision EC2, so they cannot be a
 *   @unit target. Here we use the example template cm-cicada ships by default
 *   (_v2_example_xcom_workflow) as is.
 *
 * We call the same proxy (operationId) the console uses, so the login session and path go
 * through the same flow as real usage.
 */
Given(
  '요금 안전 예제 워크플로우 {string} 를 준비한다',
  async ({ page }, name: string) => {
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

    // Find the example template and build a workflow from its definition (task_groups) as is.
    const templateName = workflowData.safeRunTemplateName;
    const listRes = await page.request.post(
      '/api/cm-cicada/list-workflow-template',
      {
        data: {},
        headers,
      },
    );
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
      `요금 안전 예제 템플릿 "${templateName}"을 찾지 못했다. 있는 템플릿: ${(Array.isArray(
        templates,
      )
        ? templates
        : []
      )
        .map((t: { name?: string }) => t?.name)
        .join(', ')}`,
    ).toBeTruthy();

    const res = await page.request.post('/api/cm-cicada/create-workflow', {
      data: {
        request: {
          name: uniqueName(name),
          description:
            'e2e — cost-safe example workflow (no cloud provisioning)',
          data: {
            task_groups:
              template.data?.task_groups ?? template.task_groups ?? [],
          },
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

    // ★ Wait until the DAG is registered.
    //
    //   When creating a workflow, cm-cicada only writes the DAG YAML to disk, and airflow
    //   parses and registers it periodically (tens of seconds). Running before that is
    //   rejected with "provided dag_id is not exist".
    //   So that a functional test caught in this window isn't mistaken for a "run failure",
    //   the seed confirms *until a run is actually accepted* before moving on. Running it
    //   once here also leaves a history so later tests are stable.
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
  },
);

/** The seed alias for "그리고 소스 모델 목록에 {string} 이 보인다" reuses the one from models.steps as is. */
Then('시드 데이터가 준비되었다', async ({ page }) => {
  await new ModelsPage(page).expectModelListVisible();
});
