import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkflowPage } from '../pages/workflow.page';
import { NotificationPage } from '../pages/notification.page';
import { workflowData } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * Workflow completion notification — real data (@live, no mock).
 *
 * The @mock scenarios prove the tracker's own logic. This one closes the last gap: a real Run
 * click in the real UI firing trackWorkflow, a real cm-cicada run finishing, and the real
 * notification store surfacing it on the badge. It uses the cost-safe example workflow
 * (bash/http echo — no cloud provisioning), so it finishes in seconds without spend.
 */

async function bearer(page: any): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? '';
      const m = v.match(/"access_token"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
    }
    return '';
  });
  expect(token, '로그인 세션에서 access token을 찾지 못했다').not.toEqual('');
  return token;
}

/** Creates the cost-safe example workflow under an exact name (idempotent-ish per run). */
Given(
  '요금 안전 예제로 워크플로우 {string} 를 만든다',
  async ({ page }, name: string) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await bearer(page)}`,
    };
    // Idempotent: a re-run must not pile up duplicates of the same name.
    const existing = await page.request.post('/api/cm-cicada/list-workflow', {
      data: {},
      headers,
    });
    const wfs = (await existing.json())?.responseData ?? [];
    if ((Array.isArray(wfs) ? wfs : []).some((w: any) => w?.name === name)) {
      return;
    }
    const listRes = await page.request.post(
      '/api/cm-cicada/list-workflow-template',
      { data: {}, headers },
    );
    expect(listRes.ok()).toBeTruthy();
    const templates = (await listRes.json())?.responseData ?? [];
    const template = (Array.isArray(templates) ? templates : []).find(
      (t: { name?: string }) => t?.name === workflowData.safeRunTemplateName,
    );
    expect(template, '요금 안전 예제 템플릿을 찾지 못했다').toBeTruthy();

    const res = await page.request.post('/api/cm-cicada/create-workflow', {
      data: {
        request: {
          name,
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
      `워크플로우 생성 실패: ${res.status()} ${await res.text()}`,
    ).toBeTruthy();
  },
);

/**
 * Runs it through the real UI. The Run click goes through the real handleRunWorkflow, which is
 * where trackWorkflow fires. A freshly created workflow may need a moment for Airflow to
 * register the DAG, so the click is retried a few times; the badge (asserted next) is the
 * success signal.
 */
When(
  '워크플로우 {string} 를 실제로 실행한다',
  async ({ page }, name: string) => {
    const wf = new WorkflowPage(page);
    for (let i = 0; i < 4; i++) {
      await wf.gotoWorkflows();
      await wf.runWorkflow(name);
      // give the run time to start and the DAG time to register before the next attempt
      await page.waitForTimeout(15_000);
      // if a notification has already landed, no need to trigger again
      const badgeText = await page
        .getByTestId('notification-count')
        .textContent()
        .catch(() => null);
      if (badgeText && badgeText.trim() !== '' && badgeText.trim() !== '0')
        break;
    }
  },
);

/** Waits for the real completion notification (a real run takes longer than a mock). */
Then(
  '실제 알림 배지에 {string} 알림이 뜬다',
  async ({ page }, message: string) => {
    const noti = new NotificationPage(page);
    await noti.open();
    // a real run plus the tracker's poll interval takes longer than a mocked one
    await noti.waitForAnyItem(150_000);
    await noti.expectNotification(message, 'Info');
  },
);
