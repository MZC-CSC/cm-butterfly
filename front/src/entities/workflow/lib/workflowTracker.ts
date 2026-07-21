import { useGetWorkflowRuns } from '@/entities/workflow/api';
import { isRunFinished } from '@/entities/workflow/lib/taskState';
import { notify } from '@/entities/notification/lib/notificationStore';
import { registerTracker } from '@/shared/libs/tracking/runner';
import {
  putTrackedJob,
  clearTrackedJob,
  retagTrackedJob,
  trackedJobsOf,
  hasTrackedJobs,
  loadTrackedJobs,
  type TrackedJob,
} from '@/entities/tracking/lib/trackedJobs';
import type { TrackedJobAction } from '@/entities/tracking/api';
import type { IWorkflowRun } from '@/entities/workflow/model/types';

/**
 * Workflow run tracking (notification badge, stage 3).
 *
 * A workflow run takes minutes and the run viewer is usually left behind while it runs. As
 * with the delete and load-test checkers, moving the polling here keeps the outcome catchable
 * for as long as the app is open, rather than only on the screen that started it.
 *
 * ★ **Workflow is the hard one — there is no endpoint that returns a single run.** A run does
 * not hand back its own id when it starts, and there is no "get this run" call. All that can
 * be done is to list every run of the workflow (`get-workflow-runs`) and pick the newest. So
 * the tracked record keeps the **workflow id** and the checker resolves the run from the list.
 *
 * The natural key is `"{wfId}/{runId}"`. Until the run id is known it is just `"{wfId}"`, and
 * the checker retags it once the run shows up in the list. Keying on the run id keeps two
 * runs of the same workflow apart; a re-run, though, reuses the same run id, so the run id
 * alone cannot tell two attempts apart. `startedAt` does — it is what the dedup key and the
 * "is this the new completion?" guard are built on.
 *
 * `label` and `action` are captured at the start because at completion there is only an id,
 * which cannot be turned into a sentence. `action` ("run" / "rerun" / "rerun-failed") is what
 * makes the message say **which attempt** finished, not just "a workflow finished".
 */

const KIND = 'workflow' as const;

// Clock skew between this browser and the engine. Used only to loosen the time comparisons
// below so a completion is not missed by a few seconds; the gap to a stale prior completion
// is normally far larger, so this does not re-admit one.
const SKEW_MS = 5_000;

interface WorkflowKey {
  wfId: string;
  runId: string | null;
}

/** Splits the natural key back into its parts. The wfId is a UUID, so the first slash wins. */
function parseKey(naturalKey: string): WorkflowKey {
  const slash = naturalKey.indexOf('/');
  if (slash < 0) return { wfId: naturalKey, runId: null };
  return {
    wfId: naturalKey.slice(0, slash),
    runId: naturalKey.slice(slash + 1),
  };
}

const startTime = (r: IWorkflowRun): number =>
  new Date(r.start_date || r.execution_date || 0).getTime();

/**
 * Records that a workflow run has started.
 *
 * `runId` is optional because most triggers do not have it yet — a plain run only knows the
 * workflow. A re-run does know it (it re-clears an existing run), so it passes it and the
 * checker never has to resolve it.
 */
export async function trackWorkflow(params: {
  wfId: string;
  label: string;
  action?: TrackedJobAction;
  runId?: string | null;
}): Promise<void> {
  if (!params.wfId) {
    // Without the workflow id there is nothing to list runs for. Track nothing rather than
    // guess — no notification beats a wrong one.
    console.warn('[workflowTracker] no workflow id; not tracking');
    return;
  }

  await putTrackedJob({
    kind: KIND,
    naturalKey: params.runId ? `${params.wfId}/${params.runId}` : params.wfId,
    label: params.label,
    action: params.action ?? 'run',
    startedAt: new Date().toISOString(),
  });
}

/** Whether any workflow run is still being tracked (used to keep the session alive). */
export function hasPendingWorkflows(): boolean {
  return hasTrackedJobs(KIND);
}

/** The sentence shown in the badge, built from the action captured at the start. */
function buildMessage(job: TrackedJob, ok: boolean): string {
  const outcome = ok ? 'finished' : 'failed';
  switch (job.action) {
    case 'rerun':
      return `Re-run of workflow "${job.label}" ${outcome}.`;
    case 'rerun-failed':
      return `Re-run of failed tasks in "${job.label}" ${outcome}.`;
    default:
      return `Workflow "${job.label}" ${outcome}.`;
  }
}

/**
 * A terminal state is only *this attempt's* result if the run finished at or after we started
 * tracking. A re-run reuses the run id and leaves the previous completion's state in place
 * until it finishes again, so without this guard the old success/failure would be announced
 * the moment tracking starts.
 */
function completedAfterStart(run: IWorkflowRun, startedAt: string): boolean {
  if (!run.end_date) return false;
  return (
    new Date(run.end_date).getTime() >= new Date(startedAt).getTime() - SKEW_MS
  );
}

/** Checks the outcome of one tracked run. */
async function checkOne(job: TrackedJob): Promise<void> {
  const { wfId, runId } = parseKey(job.naturalKey);

  let runs: IWorkflowRun[];
  try {
    const res: any = await useGetWorkflowRuns(wfId).execute();
    runs = res?.data?.responseData ?? [];
  } catch {
    // The list failed. A freshly created workflow answers 400 (DAG not found) for a few
    // seconds, and a transient error is not a completion. Look again next pass.
    return;
  }
  if (!Array.isArray(runs) || runs.length === 0) return;

  // Resolve which run this record is about.
  let run: IWorkflowRun | undefined;
  if (runId) {
    // A re-run already knows the run id — find it directly.
    run = runs.find(r => r.workflow_run_id === runId);
  } else {
    // A plain run does not. The run we started is the newest one that began at or after we
    // started tracking; an older run must not be mistaken for it.
    const startedAtMs = new Date(job.startedAt).getTime() - SKEW_MS;
    run = runs
      .filter(r => startTime(r) >= startedAtMs)
      .sort((a, b) => startTime(b) - startTime(a))[0];
  }
  if (!run) return; // not registered yet — wait for the next pass

  if (!isRunFinished(run.state)) {
    // Pin the key to this exact run so later passes are stable and the dedup key is fixed.
    // Only needed once, while the key is still the bare workflow id.
    if (!runId) {
      await retagTrackedJob(job, `${wfId}/${run.workflow_run_id}`);
    }
    return;
  }

  if (!completedAfterStart(run, job.startedAt)) {
    // Terminal, but it is the previous attempt's result (a re-run that has not re-run yet).
    return;
  }

  const ok = run.state.toLowerCase() === 'success';
  await notify({
    category: 'Workflow',
    level: ok ? 'Info' : 'Error',
    message: buildMessage(job, ok),
    dedupKey: `workflow:${run.workflow_run_id}:${job.startedAt}:${
      ok ? 'done' : 'error'
    }`,
  });

  await clearTrackedJob(KIND, job.naturalKey);
}

registerTracker({
  id: 'workflow-run',
  check: async () => {
    for (const job of trackedJobsOf(KIND)) {
      await checkOne(job);
    }
  },
  hasWork: hasPendingWorkflows,
  resume: loadTrackedJobs,
  reset: () => {
    /* trackedJobs owns the list — it clears on logout, so nothing to do here */
  },
});

