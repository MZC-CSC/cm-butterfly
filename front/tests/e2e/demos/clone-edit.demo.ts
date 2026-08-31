import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';
import { deleteWorkflowById } from '../support/seedWorkflow';

/**
 * 추천이 돌려준 인프라 모델로 만든 워크플로우를 열 수 있는가.
 *
 * ★ 그 응답은 비워 둔 항목을 전부 null 로 채워 온다. 그것을 타입 불일치로 세면 *정상인
 *   워크플로우가 하나도 빠짐없이 걸리고*, 안내가 모달이라 뒤 화면이 막혀 손댈 자리가 없어진다.
 *   복제 후 편집이 실제로 그렇게 막혔다.
 */
async function shot(page: Page, name: string) {
  fs.mkdirSync('/tmp/clone', { recursive: true });
  await page.screenshot({ path: `/tmp/clone/${name}.png` });
}

test('null 이 든 본문도 편집기가 그대로 연다', async ({ page }) => {
  test.setTimeout(400_000);
  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const token = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const m = (localStorage.getItem(k) ?? '').match(
        /"access_token"\s*:\s*"([^"]+)"/,
      );
      if (m) return m[1];
    }
    return '';
  });

  // 추천 응답이 실제로 그렇게 생겼다 — 쓰지 않는 블록은 통째로 null 이다.
  const body = {
    description: 'cloned',
    targetInfra: {
      name: 'infra01',
      label: null,
      nodeGroups: [{ name: 'g1-1', dataDiskIds: null }],
    },
    targetK8sCluster: {
      label: null,
      k8sNodeGroupList: null,
      securityGroupIds: null,
      subnetIds: null,
    },
    targetOsImageList: [{ commandHistory: null }],
  };
  const name = `clone-null-${String(Date.now()).slice(-6)}`;
  const res = await page.request.post(
    `${config.baseURL}/api/cm-cicada/create-workflow`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        request: {
          name,
          data: {
            task_groups: [
              {
                name: 'g1',
                description: '',
                tasks: [
                  {
                    name: 'infra_migration',
                    task_component: 'beetle_task_infra_migration',
                    spec: { request_body: JSON.stringify(body) },
                    dependencies: [],
                  },
                ],
              },
            ],
          },
        },
      },
    },
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  const id = JSON.parse(await res.text())?.responseData?.id ?? '';

  const wf = new WorkflowPage(page);
  try {
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await page.waitForTimeout(3000);
    await shot(page, '열린-직후');

    const notice = page.getByTestId('wf-broken-ref-notice');
    const blocked = await notice.isVisible().catch(() => false);
    if (blocked) {
      console.log(
        '알림 문구:',
        (await notice.innerText()).replace(/\n+/g, ' | '),
      );
    }
    expect(blocked, 'null 은 결함이 아니므로 알림이 뜨면 안 된다').toBeFalsy();

    // 그대로 편집할 수 있어야 한다.
    await wf.selectTaskInDesigner('', 'infra_migration');
    await expect(page.getByTestId('wf-task-editor')).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(1200);
    await shot(page, '그대로-편집-가능');
    console.log(
      '칸 수:',
      await page.locator('[data-testid^="wf-field-body_params."]').count(),
    );
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});
