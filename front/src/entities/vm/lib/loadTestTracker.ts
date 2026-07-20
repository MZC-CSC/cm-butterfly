import { useGetLoadTestStateByKey } from '@/entities/vm/api/api';
import { notify } from '@/entities/notification/lib/notificationStore';
import { registerTracker } from '@/shared/libs/tracking/runner';
import {
  putTrackedJob,
  clearTrackedJob,
  trackedJobsOf,
  hasTrackedJobs,
  loadTrackedJobs,
  type TrackedJob,
} from '@/entities/tracking/lib/trackedJobs';

/**
 * Load test tracking.
 *
 * A load test runs for minutes and the VM list is usually left behind while it does. Polling
 * belonged to that screen, so **leaving it ended the tracking.** Moving it here keeps it
 * running for as long as the app is open.
 *
 * ★ **The tracking key is the execution key (`loadTestKey`).**
 *
 * Keying on `{nsId}/{infraId}/{nodeId}` and asking for "the last run on that node" was the
 * first attempt, and it lets **a notification point at the wrong run.** Those three are
 * names, and names get reused — delete a VM, recreate it under the same name, and the
 * deleted VM's run comes back as the answer (measured while fixing the node uid handling).
 * Two runs on the same node have the same problem: the first completion reads as the second.
 *
 * An execution key names one run and nothing else, which removes both cases. The key comes
 * back **in the run response** — cm-ant was already returning it and the screen was
 * discarding it.
 */

const KIND = 'perf' as const;

/** What cm-ant treats as finished. Anything else (on_processing, on_fetching) is still running. */
const TERMINAL_SUCCESS = 'successed';
const TERMINAL_FAILED = 'test_failed';

/**
 * Records that a load test has started.
 *
 * `label` carries **a name the user will recognise**. At completion only the execution key
 * is left, which cannot be turned into a sentence saying which VM this was.
 */
export async function trackLoadTest(params: {
  loadTestKey: string;
  label: string;
}): Promise<void> {
  if (!params.loadTestKey) {
    // Without the key there is nothing to track. Falling back to names would announce a
    // different run, so track nothing instead — no notification beats a wrong one.
    console.warn('[loadTestTracker] no execution key; not tracking');
    return;
  }

  await putTrackedJob({
    kind: KIND,
    naturalKey: params.loadTestKey,
    label: params.label,
    action: 'run',
    startedAt: new Date().toISOString(),
  });
}

/** Whether any load test is still running (used to decide on keeping the session alive). */
export function hasPendingLoadTests(): boolean {
  return hasTrackedJobs(KIND);
}

/** Checks the outcome of one tracked run. */
async function checkOne(job: TrackedJob): Promise<void> {
  let result: any;
  try {
    const res: any = await useGetLoadTestStateByKey(job.naturalKey).execute();
    result = res?.data?.responseData?.result;
  } catch {
    // The lookup failed. Do not call the run failed on that alone — it may still be running.
    // Look again on the next pass.
    return;
  }

  if (!result) return;

  const status = String(result.executionStatus ?? '').toLowerCase();
  if (status !== TERMINAL_SUCCESS && status !== TERMINAL_FAILED) return;

  if (status === TERMINAL_SUCCESS) {
    await notify({
      category: 'Perf',
      level: 'Info',
      message: `Load test on "${job.label}" completed.`,
      dedupKey: `perf:${job.naturalKey}:done`,
    });
  } else {
    await notify({
      category: 'Perf',
      level: 'Error',
      message: `Load test on "${job.label}" failed.`,
      detail: result.failureMessage || '',
      dedupKey: `perf:${job.naturalKey}:error`,
    });
  }

  await clearTrackedJob(KIND, job.naturalKey);
}

registerTracker({
  id: 'load-test',
  check: async () => {
    for (const job of trackedJobsOf(KIND)) {
      await checkOne(job);
    }
  },
  hasWork: hasPendingLoadTests,
  resume: loadTrackedJobs,
  reset: () => {
    /* trackedJobs owns the list — it clears once on logout, so nothing to do here */
  },
});
