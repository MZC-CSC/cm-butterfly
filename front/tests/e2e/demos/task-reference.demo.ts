import { test, expect, Page, Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getUser, config } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { installCursor } from '../support/cursor';
import { humanClick } from '../support/humanize';
import {
  seedChainOfTasks,
  seedWorkflowFromTemplate,
  seedWorkflowWithBrokenReference,
  deleteWorkflowById,
} from '../support/seedWorkflow';

/**
 * One take through taking a value from an earlier task, at a pace someone can follow.
 *
 * This is watched, not checked — the assertions here only keep the recording honest, so a step that
 * silently did nothing does not end up in the video looking like it worked. Each part of the feature
 * gets a still as it happens, and the whole run is one video.
 *
 * Run:
 *   E2E_DEMO_PACE=1 E2E_DEMO_BEAT_MS=900 BASE_URL=http://cmig.stage.cscmzc.com:5174 \
 *   npx playwright test tests/e2e/demos/task-reference.demo.ts \
 *     --config=tests/e2e/playwright.demo.config.ts
 */

const BEAT = Number(process.env.E2E_DEMO_BEAT_MS ?? 900);
const SHOTS = path.resolve(
  process.env.E2E_DEMO_SHOT_DIR ?? 'tests/e2e/test-results/task-reference',
);

let shotNo = 0;
async function shot(page: Page, name: string): Promise<string> {
  shotNo += 1;
  const file = path.join(
    SHOTS,
    `${String(shotNo).padStart(2, '0')}-${name}.png`,
  );
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: file });
  return file;
}

/** Hold still long enough that the viewer can read what just changed. */
async function beat(page: Page, count = 1): Promise<void> {
  await page.waitForTimeout(BEAT * count);
}

test('taking a value from a task that runs earlier', async ({ page }) => {
  test.setTimeout(900_000);
  await installCursor(page);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();
  await beat(page);

  const token = await getToken(page);
  const stamp = String(Date.now()).slice(-6);
  const made: string[] = [];

  const chainName = `demo-chain-${stamp}`;
  const infraName = `demo-infra-${stamp}`;
  const brokenName = `demo-broken-${stamp}`;

  made.push(
    await seedChainOfTasks({
      request: page.request,
      token,
      name: chainName,
      taskNames: ['first_step', 'second_step'],
    }),
  );
  made.push(
    await seedWorkflowFromTemplate({
      request: page.request,
      token,
      templateName: 'migrate_infra_workflow',
      name: infraName,
    }),
  );
  made.push(
    await seedWorkflowWithBrokenReference({
      request: page.request,
      token,
      name: brokenName,
    }),
  );

  try {
    // ── 1. A task with nothing before it ─────────────────────────────────────
    await openEditor(page, chainName);
    await shot(page, 'editor-opened');

    await selectTask(page, 'first_step');
    await beat(page);
    await expect(page.getByTestId('wf-ref-none-available')).toBeVisible();
    await expect(page.getByTestId('wf-ref-pick-on-canvas')).toHaveCount(0);
    await shot(page, 'first-task-has-nowhere-to-take-from');
    await beat(page, 2);

    // ── 2. A task with something before it ───────────────────────────────────
    await selectTask(page, 'second_step');
    await beat(page);
    await expect(page.getByTestId('wf-ref-pick-on-canvas')).toBeVisible();
    await shot(page, 'second-task-can-take-a-value');
    await beat(page, 2);

    // ── 3. Picking on the canvas ─────────────────────────────────────────────
    await openEditor(page, infraName);
    await selectTask(page, 'install_docker');
    await beat(page);
    await shot(page, 'task-with-three-earlier-tasks');

    await humanClick(page.getByTestId('wf-ref-pick-on-canvas'));
    await expect(
      page.locator('.sqd-step-task.sqd-pick-allowed').first(),
    ).toBeVisible({ timeout: 15_000 });
    await beat(page);
    await shot(page, 'canvas-lights-up-what-can-be-picked');
    await beat(page, 2);

    await humanClick(
      page
        .locator('.sqd-step-task.sqd-pick-allowed')
        .filter({ hasText: 'infra_recommend_get' })
        .last(),
    );
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await beat(page);
    await shot(page, 'value-list-opens-for-that-task');
    await beat(page, 2);

    // ── 4. Searching across every earlier task ───────────────────────────────
    await page.getByTestId('wf-ref-search').fill('id');
    await beat(page);
    await shot(page, 'search-runs-across-all-earlier-tasks');
    await beat(page);
    await page.getByTestId('wf-ref-search').fill('');
    await beat(page);

    // ── 5. Choosing a value ──────────────────────────────────────────────────
    await humanClick(
      page.getByTestId('wf-ref-node-infra_recommend_get-$.id').first(),
    );
    await beat(page);
    await expect(page.getByTestId('wf-ref-preview')).toContainText(
      '${infra_recommend_get.$.id}',
    );
    await shot(page, 'what-will-be-saved-and-whether-the-type-fits');
    await beat(page, 2);

    await humanClick(page.getByTestId('wf-ref-apply'));
    await expect(page.getByTestId('wf-ref-popover')).toBeHidden({
      timeout: 15_000,
    });
    await beat(page);
    await shot(page, 'the-field-now-shows-a-reference');
    await beat(page, 2);

    // ── 6. A second field, pointing somewhere else ───────────────────────────
    await humanClick(page.getByTestId('wf-field-ref-add-body_params.infra_id'));
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await humanClick(
      page.getByTestId('wf-ref-node-infra_migration-$.data').first(),
    );
    await humanClick(page.getByTestId('wf-ref-apply'));
    await beat(page);
    await shot(page, 'each-field-can-point-at-a-different-task');
    await beat(page, 2);

    // ── 7. Clearing one ──────────────────────────────────────────────────────
    await humanClick(
      page.getByTestId('wf-field-ref-clear-body_params.infra_id'),
    );
    await beat(page);
    await expect(
      page.getByTestId('wf-field-body_params.infra_id'),
    ).toBeVisible();
    await shot(page, 'clearing-gives-an-empty-box-back');
    await beat(page, 2);

    // ── 8. The whole body from one task ──────────────────────────────────────
    await humanClick(page.getByTestId('wf-body-source-whole'));
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await humanClick(
      page.getByTestId('wf-ref-node-infra_recommend_get-$').first(),
    );
    await humanClick(page.getByTestId('wf-ref-apply'));
    await beat(page);
    await expect(page.getByTestId('wf-ref-whole')).toBeVisible();
    await shot(page, 'the-whole-body-and-what-it-will-pass');
    await beat(page, 2);

    // ── 9. A task that does not say what it returns ──────────────────────────
    await humanClick(page.getByTestId('wf-body-source-fields'));
    await beat(page);
    await humanClick(page.getByTestId('wf-field-ref-add-body_params.ns_id'));
    await expect(page.getByTestId('wf-ref-popover')).toBeVisible({
      timeout: 15_000,
    });
    await beat(page);
    await shot(page, 'every-earlier-task-in-one-list');
    await humanClick(page.getByTestId('wf-ref-cancel'));
    await beat(page);

    // ── 10. A workflow that reads a task which does not run first ────────────
    await openEditor(page, brokenName, { expectNotice: true });
    await expect(page.getByTestId('wf-broken-ref-notice')).toBeVisible({
      timeout: 20_000,
    });
    await beat(page);
    await shot(page, 'a-workflow-that-will-fail-when-run');
    await beat(page, 3);

    await humanClick(page.getByTestId('wf-broken-ref-close'));
    await selectTask(page, 'reads_a_later_task');
    await beat(page);
    await expect(
      page.getByTestId('wf-field-ref-invalid-body_params.infra_id'),
    ).toBeVisible();
    await shot(page, 'the-field-itself-is-marked-where-it-sits');
    await beat(page, 3);
  } finally {
    for (const id of made) {
      await deleteWorkflowById({ request: page.request, token, id });
    }
  }
});

/** Read the session token the way the console stores it. */
async function getToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const hit = (localStorage.getItem(key) ?? '').match(
        /"access_token"\s*:\s*"([^"]+)"/,
      );
      if (hit) return hit[1];
    }
    return '';
  });
}

/** Walk to the workflow list, open the workflow, and open its editor. */
async function openEditor(
  page: Page,
  name: string,
  opts: { expectNotice?: boolean } = {},
): Promise<void> {
  await page.goto(`${config.baseURL}/main/workflow-management/workflows`);
  await page.reload();
  const row = page.locator('tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await humanClick(row.locator('td').nth(1));
  await beat(page);
  await humanClick(page.getByTestId('workflow-viewer-edit-btn'));
  await expect(page.getByTestId('workflow-designer')).toBeVisible({
    timeout: 20_000,
  });
  if (!opts.expectNotice) {
    await expect(page.locator('.sqd-step-task').first()).toBeVisible({
      timeout: 20_000,
    });
  }
  await beat(page);
}

/** Click a task on the canvas so its panel opens. */
async function selectTask(page: Page, name: string): Promise<void> {
  const step: Locator = page
    .locator('.sqd-step-task')
    .filter({ hasText: name })
    .last();
  await humanClick(step);
  await expect(page.getByTestId('wf-task-editor')).toBeVisible({
    timeout: 15_000,
  });
}
