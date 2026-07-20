import { reactive } from 'vue';
import {
  useListTrackedJobs,
  useSaveTrackedJob,
  useRemoveTrackedJob,
  type TrackedJobRecord,
  type TrackedJobKind,
  type TrackedJobAction,
} from '@/entities/tracking/api';

/**
 * The list of long-running jobs being tracked, shared by every checker.
 *
 * Each checker takes out only the entries of its own `kind`.
 *
 * **Why a record is needed** — neither a load test nor a workflow run hands back its own id
 * when it starts. All that is in hand at that moment is *which node* or *which workflow*,
 * and that has to be kept to later ask how the last run on it turned out.
 *
 * **Why the name and the action are kept too** — once it ends there is only an id, which
 * cannot be turned into a sentence. Writing "the **re-run** of workflow X has finished"
 * means capturing the name and the action at the start.
 */

export interface TrackedJob {
  kind: TrackedJobKind;
  naturalKey: string;
  label: string;
  action: TrackedJobAction;
  startedAt: string;
}

const state = reactive<{ jobs: Record<string, TrackedJob> }>({ jobs: {} });

const keyOf = (kind: string, naturalKey: string) => `${kind}::${naturalKey}`;

function fromRecord(r: TrackedJobRecord): TrackedJob {
  return {
    kind: r.kind as TrackedJobKind,
    naturalKey: r.natural_key,
    label: r.label,
    action: (r.action || 'run') as TrackedJobAction,
    startedAt: r.started_at,
  };
}

/** Tracked jobs of one kind. */
export function trackedJobsOf(kind: TrackedJobKind): TrackedJob[] {
  return Object.values(state.jobs).filter(j => j.kind === kind);
}

/** Whether anything is being tracked (used to decide on keeping the session alive). */
export function hasTrackedJobs(kind: TrackedJobKind): boolean {
  return trackedJobsOf(kind).length > 0;
}

/** Records that a job has started. */
export async function putTrackedJob(job: TrackedJob): Promise<void> {
  state.jobs[keyOf(job.kind, job.naturalKey)] = job;
  try {
    await useSaveTrackedJob({
      kind: job.kind,
      natural_key: job.naturalKey,
      label: job.label,
      action: job.action,
      started_at: job.startedAt,
    }).execute();
  } catch (e) {
    // Keep tracking in this browser even if the server write failed. It will not carry to
    // another seat, though, so do not let it pass silently.
    console.error('[trackedJobs] failed to record the job', e);
  }
}

/** Re-records under a different natural key, for when the real id is only known after the start. */
export async function retagTrackedJob(
  job: TrackedJob,
  nextNaturalKey: string,
): Promise<TrackedJob> {
  await clearTrackedJob(job.kind, job.naturalKey);
  const next = { ...job, naturalKey: nextNaturalKey };
  await putTrackedJob(next);
  return next;
}

/** Drops a finished job from the list. */
export async function clearTrackedJob(
  kind: TrackedJobKind,
  naturalKey: string,
): Promise<void> {
  delete state.jobs[keyOf(kind, naturalKey)];
  try {
    await useRemoveTrackedJob(kind, naturalKey).execute();
  } catch (e) {
    console.error('[trackedJobs] failed to remove the job record', e);
  }
}

/** Loads the tracking records kept on the server (on login and on app start). */
export async function loadTrackedJobs(): Promise<void> {
  try {
    const res: any = await useListTrackedJobs().execute();
    const list: TrackedJobRecord[] = res?.data?.responseData ?? [];
    const next: Record<string, TrackedJob> = {};
    for (const r of Array.isArray(list) ? list : []) {
      next[keyOf(r.kind, r.natural_key)] = fromRecord(r);
    }
    state.jobs = next;
  } catch (e) {
    console.error('[trackedJobs] failed to load tracking records', e);
  }
}
