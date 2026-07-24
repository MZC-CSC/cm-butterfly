import { expect, test } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * Run status viewer — verified in a real browser.
 *
 * What we want to verify is not "the screen shows up" but **whether the run status is
 * shown truthfully** and **whether re-run actually works**. So instead of eyeballing
 * colors we assert the status values the nodes emit, and for re-run we go as far as
 * checking that the confirm modal shows *the targets the engine decided*.
 *
 * Precondition: the target server must have a workflow where "one of three parallel
 * branches fails and then rejoins".
 *   Run: BASE_URL=http://<host>:<port> npx playwright test --config=playwright.runviewer.config.ts
 */
const WORKFLOW =
  process.env.E2E_RUN_VIEWER_WORKFLOW ?? 'demo-runviewer-parallel';

/**
 * A workflow this spec is allowed to actually *run*. The "still running" indicators only
 * exist while a run is in flight, so they cannot be checked on history alone.
 *
 * It must be a workflow whose tasks touch nothing outside themselves (the sample example
 * tasks). Pointing this at a migration workflow would create real cloud resources.
 */
const RUNNABLE_WORKFLOW =
  process.env.E2E_RUN_VIEWER_RUNNABLE_WORKFLOW ?? 'e2e-sample-bash-workflow';

test.describe('워크플로우 실행 상태 뷰어', () => {
  test.beforeEach(async ({ page }) => {
    const user = getUser('cmiguser');
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.id, user.password);
    // login() does not wait for navigation. Without waiting, it races the next navigation and stays on the login screen.
    await login.expectLoggedIn();
  });

  test('실행 상태가 사실대로 그려진다 (병렬은 병렬로, 상위 실패는 실패와 구분해서)', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    await workflow.expectTaskState('start', 'success');
    await workflow.expectTaskState('infra-branch', 'success');
    await workflow.expectTaskState('software-branch', 'success');
    await workflow.expectTaskState('data-branch-fails', 'failed');

    // A task that couldn't run because an upstream one failed is not "failed" — the place to fix is upstream
    await workflow.expectTaskState('verify', 'upstream_failed');
    await workflow.expectTaskState('report', 'upstream_failed');
  });

  test('실패한 태스크의 원인과 로그를 그 자리에서 볼 수 있다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    await workflow.selectTask('data-branch-fails');
    await expect(page.getByTestId('workflow-run-task-state')).toContainText(
      'Failed',
    );

    const log = await workflow.openTaskLog(1);
    // The log the engine gives is not plain text. Its wrapper must be stripped off
    await expect(log).not.toContainText('[(');
    await expect(workflow.failureSummary).toContainText(
      /exit code|AirflowException/i,
    );
  });

  test('재실행은 실행하지 않고 먼저 대상을 보여주고 확인을 받는다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);
    await workflow.selectTask('data-branch-fails');

    // "This task and everything after it" — we picked only one parallel branch, so the other branches are not targets
    const targets = await workflow.previewRerun('after');
    await expect(targets).toHaveCount(3);
    await expect(targets).toContainText([
      /data-branch-fails/,
      /verify/,
      /report/,
    ]);

    // Canceling runs nothing
    await workflow.cancelRerun();
    await workflow.expectTaskState('data-branch-fails', 'failed');
  });

  test('실행 전체의 실패분 재실행은 태스크를 고르지 않아도 된다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    // Click after the run status has arrived (the targets are decided from this run's tasks)
    await workflow.expectTaskState('data-branch-fails', 'failed');

    // It must be clickable even with no task selected — because it is a run-level action
    const targets = await workflow.previewRerunFailed();
    await expect(targets).toContainText([
      /data-branch-fails/,
      /verify/,
      /report/,
    ]);
    await workflow.cancelRerun();
  });

  test('복제도 확인 없이 만들지 않는다 (누를 때마다 워크플로우가 늘어나므로)', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    const modal = await workflow.openCloneConfirm();
    await expect(modal).toContainText(/copy/i);
    await workflow.cancelClone();
  });

  test('새 실행은 재실행과 구분되고, 확인 없이 시작하지 않는다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    const modal = await workflow.openNewRunConfirm();
    await expect(modal).toContainText(/new run/i);
    await workflow.cancelNewRun();
  });

  test('진행 상황과 어느 실행을 보고 있는지가 화면에 남는다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    // The progress bar appears *only while running*. If a 100% bar remains on a finished run,
    // it reads as "is something still running now?" (this workflow's last run is finished).
    await expect(workflow.runProgress).toBeHidden();

    // The dropdown collapses once you pick. What you are viewing must remain on screen
    await expect(workflow.runMeta).toContainText('Run ID');
    await expect(page.getByTestId('workflow-run-meta-id')).not.toBeEmpty();
  });

  /**
   * A long task leaves the progress bar at the same width and every number unchanged, so the
   * screen becomes indistinguishable from one that has died. What has to be proven is not
   * "an indicator exists" but that **something keeps changing while a task is running** —
   * hence the assertion on the counter *ticking*, not merely on it being visible.
   *
   * This one actually starts a run, so it points at a workflow that touches nothing outside
   * itself. Do not aim it at a migration workflow.
   */
  test('오래 걸리는 태스크에서도 지금 무엇이 도는지·얼마나 됐는지가 계속 움직인다', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(RUNNABLE_WORKFLOW);

    // Nothing is running yet, so neither indicator may be present
    await expect(workflow.runningIndicator).toBeHidden();
    expect(await workflow.runNodeSpinners.count()).toBe(0);

    await page.getByTestId('workflow-viewer-run-btn').click();
    await page.getByTestId('workflow-run-confirm-ok').click();

    const elapsedSeen = new Set<string>();
    let sawIndicator = false;
    let sawNodeSpinner = false;

    // Sample faster than the 1s tick so the change is actually observable
    for (let i = 0; i < 150; i++) {
      const visible = await workflow.runningIndicator
        .isVisible()
        .catch(() => false);
      if (visible) {
        sawIndicator = true;
        const elapsed = await workflow.runElapsed.innerText().catch(() => '');
        if (elapsed) elapsedSeen.add(elapsed);
        if ((await workflow.runNodeSpinners.count().catch(() => 0)) > 0) {
          sawNodeSpinner = true;
        }
      } else if (sawIndicator && i > 20) {
        break; // the run finished
      }
      await page.waitForTimeout(600);
    }

    expect(sawIndicator, '실행 중 표시가 나타났다').toBe(true);
    expect(sawNodeSpinner, '실행 중 태스크에 스피너가 붙었다').toBe(true);
    expect(elapsedSeen.size, '경과 시간이 실제로 흘렀다').toBeGreaterThan(1);

    // Once the run ends, the indicators must go away — a spinner left turning on a finished
    // run says "still working" when nothing is.
    await expect(workflow.runningIndicator).toBeHidden({ timeout: 30_000 });
    expect(await workflow.runNodeSpinners.count()).toBe(0);
  });
});
