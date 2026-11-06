import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';
import { deleteWorkflowById } from '../support/seedWorkflow';

/**
 * 밖에서 손댄 워크플로우를 열었을 때 무슨 일이 일어나는가.
 *
 * 둘을 나눠 본다 — 본문을 아예 읽지 못하는 것과, 읽히지만 값의 형식이 어긋난 것.
 * 앞은 고칠 자리가 없어 나갈 길을 줘야 하고, 뒤는 여기서 바로잡을 수 있다.
 */
const OUT = '/tmp/loadguard';
async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function seedRaw(
  page: Page,
  token: string,
  name: string,
  bodies: string[],
): Promise<string> {
  const tasks = bodies.map((body, index) => ({
    name: `step_${index + 1}`,
    task_component: 'cicada_task_time_sleep',
    spec: { request_body: body },
    dependencies: index === 0 ? [] : [`step_${index}`],
  }));
  const res = await page.request.post(
    `${config.baseURL}/api/cm-cicada/create-workflow`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        request: {
          name,
          data: { task_groups: [{ name: 'g1', description: '', tasks }] },
        },
      },
    },
  );
  const text = await res.text();
  expect(
    res.ok(),
    `워크플로우를 만들지 못했다: ${text.slice(0, 200)}`,
  ).toBeTruthy();
  return JSON.parse(text)?.responseData?.id ?? '';
}

/** 로그인하고 토큰을 받는다. */
async function signIn(page: Page): Promise<string> {
  page.on('pageerror', e =>
    console.log('[pageerror]', String(e).slice(0, 250)),
  );
  page.on('console', m => {
    if (m.type() === 'error') console.log('[browser]', m.text().slice(0, 600));
  });
  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const m = (localStorage.getItem(k) ?? '').match(
        /"access_token"\s*:\s*"([^"]+)"/,
      );
      if (m) return m[1];
    }
    return '';
  });
}

// ★ 두 갈래를 한 테스트에 담지 않는다. 편집기를 한 번 거친 뒤 목록으로 돌아가면 검색이
//   멈추는 일이 있어, 각자 깨끗한 화면에서 시작하게 둔다.

test('형식이 어긋난 값은 알려 주고 고쳐 준다', async ({ page }) => {
  test.setTimeout(400_000);
  const token = await signIn(page);
  const name = `loadguard-type-${String(Date.now()).slice(-6)}`;
  const id = await seedRaw(page, token, name, ['{"time": 30}']);
  const wf = new WorkflowPage(page);

  try {
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await page.waitForTimeout(2000);

    const notice = page.getByTestId('wf-broken-ref-notice');
    await expect(notice, '형식이 어긋났다고 알려야 한다').toBeVisible({
      timeout: 15_000,
    });
    console.log(
      '[형식] 문구:',
      (await notice.innerText()).replace(/\n+/g, ' | '),
    );
    await shot(page, 'type');

    await expect(page.getByTestId('wf-broken-ref-leave')).toBeVisible();
    await expect(page.getByTestId('wf-broken-ref-open-json')).toBeVisible();
    await expect(
      page.getByTestId('wf-broken-ref-close'),
      '무엇을 승낙하는지 알 수 없는 OK 는 두지 않는다',
    ).toHaveCount(0);
    await page.getByTestId('wf-broken-ref-coerce').click();
    await page.waitForTimeout(1200);
    await page.locator('.sqd-step-task').first().click();
    await page.waitForTimeout(1500);
    const marks = await page
      .locator('[data-testid^="wf-field-coerced-"]')
      .count();
    console.log('[형식] 바뀐 칸 표시:', marks);
    expect(marks, '무엇이 바뀌었는지 보여야 한다').toBeGreaterThan(0);
    await shot(page, 'type-after-convert');
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});

test('읽지 못하는 본문은 나갈 길을 준다', async ({ page }) => {
  test.setTimeout(400_000);
  const token = await signIn(page);
  const name = `loadguard-broken-${String(Date.now()).slice(-6)}`;
  const id = await seedRaw(page, token, name, ['{"time": "1" "extra": 2}']);
  const wf = new WorkflowPage(page);

  try {
    await wf.gotoWorkflows();
    await wf.selectWorkflow(name);
    await wf.openEditorFromDetail();
    await page.waitForTimeout(2000);

    const notice = page.getByTestId('wf-broken-ref-notice');
    await expect(notice, '읽지 못했다고 알려야 한다').toBeVisible({
      timeout: 15_000,
    });
    console.log(
      '[깨짐] 문구:',
      (await notice.innerText()).replace(/\n+/g, ' | '),
    );
    await shot(page, 'broken');

    // 여기서는 고칠 자리가 없다 — 칸을 그릴 수 없으니 나갈 길이 있어야 한다.
    await expect(page.getByTestId('wf-broken-ref-leave')).toBeVisible();
    await expect(page.getByTestId('wf-broken-ref-open-json')).toBeVisible();
    await expect(
      page.getByTestId('wf-broken-ref-coerce'),
      '읽지도 못하는 것을 변환해 준다고 해서는 안 된다',
    ).toHaveCount(0);

    await page.getByTestId('wf-broken-ref-leave').click();
    await page.waitForTimeout(1800);
    console.log(
      '[깨짐] 나간 뒤 디자이너:',
      await page.getByTestId('workflow-designer').count(),
    );
    await shot(page, 'broken-after-leave');
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});

test('참조의 인용부호가 어긋나면 맞춰 주고 표시한다', async ({ page }) => {
  test.setTimeout(400_000);
  const token = await signIn(page);
  const name = `loadguard-quote-${String(Date.now()).slice(-6)}`;

  // 밖에서 쓴 파일처럼 참조를 전부 따옴표 안에 넣어 둔다. nodeGroups 는 배열이라
  // 따옴표가 붙어 있으면 실행할 때 배열이 아니라 배열처럼 생긴 문자열이 전달된다.
  const tasks = [
    {
      name: 'recommend',
      task_component: 'damselfly_task_get_cloud_infra_model',
      spec: { request_body: '{}' },
      dependencies: [] as string[],
    },
    {
      name: 'migrate',
      task_component: 'beetle_task_infra_migration',
      spec: {
        request_body: JSON.stringify({
          description: '${recommend.$.cloudInfraModel.targetInfra.name}',
          targetInfra: {
            nodeGroups: '${recommend.$.cloudInfraModel.targetInfra.nodeGroups}',
          },
        }),
      },
      dependencies: ['recommend'],
    },
  ];
  const res = await page.request.post(
    `${config.baseURL}/api/cm-cicada/create-workflow`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        request: {
          name,
          data: { task_groups: [{ name: 'g1', description: '', tasks }] },
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
    await page.waitForTimeout(2500);

    const notice = page.getByTestId('wf-broken-ref-notice');
    await expect(notice, '인용부호가 어긋났다고 알려야 한다').toBeVisible({
      timeout: 15_000,
    });
    console.log(
      '[인용] 문구:',
      (await notice.innerText()).replace(/\n+/g, ' | '),
    );
    await shot(page, 'quote');

    // 문자열 칸은 지금 모양이 맞으므로 목록에 없어야 한다.
    await expect(
      page.getByTestId('wf-body-misquoted-migrate-description'),
      '문자열 칸은 따옴표 안이 맞다',
    ).toHaveCount(0);
    await expect(
      page.getByTestId('wf-body-misquoted-migrate-targetInfra.nodeGroups'),
    ).toBeVisible();

    await page.getByTestId('wf-broken-ref-coerce').click();
    await page.waitForTimeout(1500);
    await page.getByTestId('workflow-designer-save').click();
    await page.waitForTimeout(5000);

    const read = await page.request.post(
      `${config.baseURL}/api/cm-cicada/get-workflow`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { pathParams: { wfId: id } },
      },
    );
    const doc = JSON.parse(await read.text());
    const groups = doc?.responseData?.data?.task_groups ?? [];
    const bodies: string[] = groups.flatMap((g: any) =>
      (g.tasks ?? []).map((t: any) => String(t.spec?.request_body ?? '')),
    );
    const migrateBody = bodies.find(one => one.includes('nodeGroups')) ?? '';
    console.log('[인용] 저장된 본문:', migrateBody.slice(0, 300));
    expect(
      /"nodeGroups"\s*:\s*\$\{/.test(migrateBody),
      '배열 칸의 참조는 따옴표 없이 저장돼야 한다',
    ).toBeTruthy();
    expect(
      /"description"\s*:\s*"\$\{/.test(migrateBody),
      '문자열 칸의 참조는 따옴표 안에 그대로 있어야 한다',
    ).toBeTruthy();
  } finally {
    await deleteWorkflowById({ request: page.request, token, id });
  }
});
