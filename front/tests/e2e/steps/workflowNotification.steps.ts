import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { NotificationPage } from '../pages/notification.page';
import { ok } from '../support/apiMock';

const { Given, Then } = createBdd(test);

/**
 * Workflow run completion notification (BAR-1545, notification badge stage 3) — @mock.
 *
 * What this verifies and what it does not
 * ---------------------------------------
 * The tracker (`entities/workflow/lib/workflowTracker.ts`) is our own state machine: it holds
 * what was known when a run started (workflow id, name, action), asks the engine how the run
 * ended, and turns that into one badge message. That logic — resume on login, resolve the run,
 * guard the completion, word the message by action, dedup, drop the record — is what runs here.
 *
 * It does NOT verify cm-cicada's real response parsing; mocking the engine would only check our
 * parser against our own assumptions (see 워크로드-삭제-화면상태.feature for the same reasoning).
 * The real cm-cicada run is exercised separately with real data.
 *
 * How the cases are staged
 * ------------------------
 * A completion is caught the moment a browser logs in and the tracker resumes the server's
 * records. So instead of driving a real run and waiting minutes, each case seeds one tracked
 * record (as if a run had started earlier) plus the run the engine would report, then logs in.
 * The badge is the observable outcome. This exercises exactly the login→resume→check→notify→
 * badge path, which is the whole point of tracking off-screen.
 */

// ── stateful mock, reset at the start of every scenario ──────────────────────

interface JobRec {
  id: string;
  kind: string;
  natural_key: string;
  label: string;
  action: string;
  started_at: string;
}
interface NotifRec {
  id: string;
  user_id: string;
  category: string;
  level: string;
  message: string;
  detail: string;
  dedup_key: string;
  created_at: string;
}

let jobs: JobRec[] = [];
let notifs: NotifRec[] = [];
let dedup: Set<string> = new Set();
/** workflow id → the sequence of run states the engine reports across successive polls */
let runSeq: Record<string, string[]> = {};
let runPolls: Record<string, number> = {};
let notifSeq = 0;

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function resetState() {
  jobs = [];
  notifs = [];
  dedup = new Set();
  runSeq = {};
  runPolls = {};
  notifSeq = 0;
}

function slugOf(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

/** Registers the stateful handlers on the scenario's mock. Idempotent. */
function installHandlers(mockApi: any) {
  mockApi.use({
    // tracked jobs — the tracker resumes from this on login
    listtrackedjobs: () => ok(jobs),
    savetrackedjob: ({ body }: any) => {
      jobs.push({ id: `job-${jobs.length}`, ...(body || {}) });
      return ok(body);
    },
    removetrackedjob: ({ body }: any) => {
      jobs = jobs.filter(
        j => !(j.kind === body?.kind && j.natural_key === body?.natural_key),
      );
      return ok('removed');
    },

    // workflow runs — what the engine reports for a workflow id
    'cm-cicada/get-workflow-runs': ({ body }: any) => {
      const wfId = body?.pathParams?.wfId as string;
      const seq = runSeq[wfId];
      if (!seq || seq.length === 0) return ok([]);
      const i = Math.min(runPolls[wfId] ?? 0, seq.length - 1);
      runPolls[wfId] = (runPolls[wfId] ?? 0) + 1;
      const state = seq[i];
      return ok([
        {
          workflow_run_id: `run-${slugOf(wfId)}`,
          workflow_id: wfId,
          state,
          start_date: iso(1_800_000), // 30m ago
          end_date: state === 'running' ? '' : iso(1_200_000), // 20m ago when done
          execution_date: iso(1_800_000),
          run_type: 'manual',
          duration_date: 600,
          data_interval_start: '',
          data_interval_end: '',
          last_scheduling_decision: '',
        },
      ]);
    },

    // notification store — dedup enforced server-side, newest first
    addnotification: ({ body }: any) => {
      const key = body?.dedup_key || '';
      if (key && dedup.has(key)) {
        const existing = notifs.find(n => n.dedup_key === key);
        return ok(existing);
      }
      const rec: NotifRec = {
        id: `ntf-${notifSeq++}`,
        user_id: 'cmiguser',
        category: body?.category ?? '',
        level: body?.level ?? 'Info',
        message: body?.message ?? '',
        detail: body?.detail ?? '',
        dedup_key: key,
        created_at: new Date().toISOString(),
      };
      notifs.unshift(rec);
      if (key) dedup.add(key);
      return ok(rec);
    },
    listnotifications: () => ok(notifs),
    readnotification: ({ body }: any) => {
      notifs = notifs.filter(n => n.id !== body?.id);
      return ok('read');
    },
    readallnotifications: () => {
      notifs = [];
      return ok('read-all');
    },
  });
}

// ── steps ────────────────────────────────────────────────────────────────────

/**
 * Seeds one workflow run as if it had started earlier and finished with `result`.
 *  - action "run": the run id is not known at start, so the record is keyed by the workflow id
 *    (the tracker resolves and pins the run id itself).
 *  - action "rerun" / "rerun-failed": the run id is known, so the record carries it.
 *  - result "running-then-success": the engine reports running first, success next — this
 *    drives the resolve-and-pin (retag) path before completion.
 */
Given(
  '추적에 남은 워크플로우 작업을 준비한다: 이름 {string}, 동작 {string}, 결과 {string}',
  async ({ mockApi }, name: string, action: string, result: string) => {
    expect(mockApi, '이 시나리오는 @mock 태그가 필요하다').not.toBeNull();
    resetState();
    installHandlers(mockApi);

    const slug = slugOf(name);
    const wfId = `wf-${slug}`;
    const runId = `run-wf-${slug}`;
    const naturalKey = action === 'run' ? wfId : `${wfId}/${runId}`;

    jobs = [
      {
        id: `job-${slug}`,
        kind: 'workflow',
        natural_key: naturalKey,
        label: name,
        action,
        started_at: iso(3_600_000), // 1h ago — before the run's end_date
      },
    ];

    runSeq[wfId] =
      result === 'running-then-success'
        ? ['running', 'success']
        : [result];
  },
);

/** Opens the badge and asserts a Workflow notification with the given wording and level. */
Then(
  '알림 배지에 {string} 수준의 {string} 알림이 뜬다',
  async ({ page }, levelKo: string, message: string) => {
    const level = levelKo === '오류' ? 'Error' : 'Info';
    const noti = new NotificationPage(page);
    await noti.open();
    await noti.waitForAnyItem();
    await noti.expectNotification(message, level as 'Info' | 'Error');
  },
);

/** The badge caught the outcome without the workflow screen being open. */
Then('현재 화면은 워크플로우 화면이 아니다', async ({ page }) => {
  await expect(page).not.toHaveURL(/workflow-management/);
});

/** After another poll interval no duplicate is posted (the record was dropped on completion). */
Then('잠시 뒤에도 워크플로우 알림은 하나뿐이다', async ({ page }) => {
  const noti = new NotificationPage(page);
  // one runner poll interval is 10s; wait past it, then confirm the count did not grow
  await page.waitForTimeout(12_000);
  await noti.open();
  const count = await noti.count();
  expect(count).toBe(1);
});
