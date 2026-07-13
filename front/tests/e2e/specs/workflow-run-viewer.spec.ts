import { expect, test } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';

/**
 * 실행 상태 뷰어 — 실제 브라우저로 확인한다.
 *
 * 확인하려는 것은 "화면이 뜬다"가 아니라 **실행 상태가 사실대로 보이는가**와
 * **재실행이 실제로 동작하는가**다. 그래서 색을 눈으로 보지 않고 노드가 내보내는
 * 상태 값을 단언하고, 재실행은 확인 모달에 *엔진이 정한 대상*이 뜨는지까지 본다.
 *
 * 전제: 대상 서버에 "병렬 3갈래 중 하나가 실패하고 다시 합류하는" 워크플로우가 있어야 한다.
 *   실행: BASE_URL=http://<host>:<port> npx playwright test --config=playwright.runviewer.config.ts
 */
const WORKFLOW =
  process.env.E2E_RUN_VIEWER_WORKFLOW ?? 'demo-runviewer-parallel';

test.describe('워크플로우 실행 상태 뷰어', () => {
  test.beforeEach(async ({ page }) => {
    const user = getUser('cmiguser');
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.id, user.password);
    // login()은 이동을 기다리지 않는다. 기다리지 않으면 다음 이동과 경합해 로그인 화면에 남는다.
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

    // 앞이 실패해 돌지 못한 태스크는 "실패"가 아니다 — 고칠 곳은 앞이다
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
    // 엔진이 주는 로그는 평문이 아니다. 껍데기가 벗겨져 있어야 한다
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

    // "이 태스크와 그 이후" — 병렬 갈래 하나만 골랐으므로 다른 갈래는 대상이 아니다
    const targets = await workflow.previewRerun('after');
    await expect(targets).toHaveCount(3);
    await expect(targets).toContainText([
      /data-branch-fails/,
      /verify/,
      /report/,
    ]);

    // 취소하면 아무것도 실행되지 않는다
    await workflow.cancelRerun();
    await workflow.expectTaskState('data-branch-fails', 'failed');
  });

  test('실행 전체의 실패분 재실행은 태스크를 고르지 않아도 된다', async ({
    page,
  }) => {
    const workflow = new WorkflowPage(page);
    await workflow.gotoWorkflows();
    await workflow.openRunViewer(WORKFLOW);

    // 실행 상태가 들어온 뒤에 누른다 (대상은 이 실행의 태스크들에서 정해진다)
    await workflow.expectTaskState('data-branch-fails', 'failed');

    // 태스크를 선택하지 않은 상태에서도 눌러야 한다 — 실행 단위 동작이기 때문이다
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

    // 몇 개 중 몇 개가 끝났는지 — 도는 중에도 멈춘 것처럼 보이지 않게 하는 근거
    await expect(workflow.runProgressCount).toContainText(/\d+ \/ \d+ tasks/);
    await expect(workflow.runProgress).toHaveAttribute('data-state', /\w+/);

    // 드롭다운은 고르고 나면 접힌다. 무엇을 보고 있는지는 화면에 남아야 한다
    await expect(workflow.runMeta).toContainText('Run ID');
    await expect(page.getByTestId('workflow-run-meta-id')).not.toBeEmpty();
  });
});
