import { reactive } from 'vue';
import {
  useListDeleteRequests,
  useSaveDeleteRequest,
  useUpdateDeleteRequestStatus,
  useRemoveDeleteRequest,
  type DeleteRequestRecord,
  type DeleteRequestStatus,
} from '@/entities/mci/api/deleteRequest';
import { useGetBeetleRequest, useGetMciList } from '@/entities/mci/api';
import { notify } from '@/entities/notification/lib/notificationStore';
import { registerTracker } from '@/shared/libs/tracking/runner';

/**
 * Tracking for workload (infra) deletes.
 *
 * A delete takes minutes and can fail, so issuing the request is not the end of it — the
 * outcome has to be followed. Two things matter here.
 *
 * **It is kept on the server.** With the request id held in the browser alone, neither the
 * failure nor its reason is visible from another machine. On the server, signing in
 * anywhere picks up where the work left off.
 *
 * **It runs independently of the screen.** Polling that lives in the list screen stops the
 * moment another screen is opened, and only resumes — late — on returning. So this module
 * owns the polling rather than a component, and it keeps running while the app is open.
 *
 * The key is the **uid**, not the infra name. In cb-tumblebug an infra id is its name, so
 * deleting and recreating under the same name makes an old record look like the new infra.
 */

export type DeleteStatus = DeleteRequestStatus;

export interface DeleteRecord {
  uid: string;
  nsId: string;
  infraId: string;
  reqId: string;
  option: string; // 'terminate' | 'force'
  status: DeleteStatus;
  errorReason?: string;
}

const state = reactive<{ records: Record<string, DeleteRecord> }>({
  records: {},
});

/** Converts the server response (snake_case) into the shape the screen uses. */
function fromRecord(r: DeleteRequestRecord): DeleteRecord {
  return {
    uid: r.uid,
    nsId: r.ns_id,
    infraId: r.infra_id,
    reqId: r.req_id,
    option: r.option,
    status: r.status,
    errorReason: r.error_reason || undefined,
  };
}

/** Every record currently tracked, for rendering the list. */
export function allDeleteRecords(): DeleteRecord[] {
  return Object.values(state.records);
}

/** Looks up a record by uid. */
export function getDeleteRecord(uid: string): DeleteRecord | undefined {
  return state.records[uid];
}

/** True while a delete is in flight — guards against issuing a duplicate request. */
/**
 * Whether a delete is still running in the background.
 *
 * Used to decide on keeping the session alive: while one is running the session continues
 * even without interaction, because watching a job through is pointless if the person it
 * would be reported to has been signed out.
 */
export function hasPendingDeletes(): boolean {
  return allDeleteRecords().some(r => r.status === 'Handling');
}

export function isDeleteInProgress(uid: string): boolean {
  return state.records[uid]?.status === 'Handling';
}

/** Records a delete request on the server; an earlier record for the same infra is replaced. */
export async function putDeleteRecord(rec: DeleteRecord): Promise<void> {
  state.records[rec.uid] = rec;
  try {
    await useSaveDeleteRequest({
      uid: rec.uid,
      ns_id: rec.nsId,
      infra_id: rec.infraId,
      req_id: rec.reqId,
      option: rec.option,
      status: rec.status,
      error_reason: rec.errorReason ?? '',
    }).execute();
  } catch (e) {
    // Show progress on this screen even if the server write failed. It will not be visible
    // from anywhere else, though, so do not let it pass silently.
    console.error('[deleteTracker] failed to record the delete request', e);
  }
}

/** Drops the record — the delete succeeded, or the infra is gone from the list. */
export async function clearDeleteRecord(uid: string): Promise<void> {
  delete state.records[uid];
  try {
    await useRemoveDeleteRequest(uid).execute();
  } catch (e) {
    console.error('[deleteTracker] failed to remove the delete record', e);
  }
}

/** Updates the status. Success never comes through here — a success drops the record. */
async function markStatus(
  uid: string,
  status: DeleteStatus,
  errorReason?: string,
): Promise<void> {
  const rec = state.records[uid];
  if (rec) {
    rec.status = status;
    if (errorReason !== undefined) rec.errorReason = errorReason;
  }
  try {
    await useUpdateDeleteRequestStatus(uid, status, errorReason).execute();
  } catch (e) {
    console.error('[deleteTracker] failed to update the delete status', e);
  }
}

/**
 * Records that a delete failed, with the reason. The list shows this in `Delete Status`.
 *
 * **The notification is raised here too.** The tracker only inspects records still in
 * `Handling`, and a request that fails as it is sent is written straight to `Error`, so it
 * never comes up for inspection. Without this the failure exists only as a status value in
 * the list, and anyone who had left the screen never learns of it.
 */
export async function markDeleteFailed(
  uid: string,
  errorReason?: string,
): Promise<void> {
  await markStatus(uid, 'Error', errorReason);
  const rec = state.records[uid];
  if (rec) await notifyFailed(rec, errorReason);
}

/** Loads the tracking records kept on the server (on app start and on login). */
export async function loadDeleteRecords(): Promise<void> {
  try {
    const res: any = await useListDeleteRequests().execute();
    const list: DeleteRequestRecord[] =
      res?.data?.responseData ?? res?.data?.data ?? res?.data ?? [];
    const next: Record<string, DeleteRecord> = {};
    for (const r of Array.isArray(list) ? list : []) {
      next[r.uid] = fromRecord(r);
    }
    state.records = next;
  } catch (e) {
    console.error('[deleteTracker] failed to load tracking records', e);
  }
}

// ── Runner registration ─────────────────────────────────────────────────────
//
// The runner owns the interval, the overlap guard and the login/logout lifecycle
// ([runner](@/shared/libs/tracking/runner)). This side knows only *what to ask*: a delete is
// judged finished by querying cm-beetle, while a load test and a workflow each look at
// something different. Folding those together would grow a switch, not a shared mechanism.

/** Whether the infra is still listed — the tie-breaker when the outcome is unclear. */
async function infraStillListed(rec: DeleteRecord): Promise<boolean> {
  try {
    const res: any = await useGetMciList(rec.nsId, '').execute();
    const data =
      res?.data?.responseData?.data ?? res?.data?.data ?? res?.data ?? {};
    const list = data?.infra ?? data?.mci ?? [];
    return (Array.isArray(list) ? list : []).some(
      (m: any) => m?.uid === rec.uid,
    );
  } catch {
    // If listing itself failed, decide nothing and look again on the next pass.
    return true;
  }
}

async function notifyDone(rec: DeleteRecord): Promise<void> {
  // A force delete removes only the internal record and leaves the CSP resources — a
  // success, but one that still needs attention.
  const forced = rec.option === 'force';
  await notify({
    category: 'Workload',
    level: forced ? 'Error' : 'Info',
    message: forced
      ? `Infra "${rec.infraId}" was force-deleted. CSP resources may remain.`
      : `Infra "${rec.infraId}" has been deleted.`,
    detail: forced
      ? 'Force delete removes the record only. Any surviving CSP resources keep billing and must be removed by hand.'
      : '',
    dedupKey: `delete:${rec.reqId}:done`,
  });
}

async function notifyFailed(rec: DeleteRecord, reason?: string): Promise<void> {
  // Carry the reason in the notification. The status cell is narrow and shows only the
  // start of it, and this notification is often where the failure is first noticed. When no
  // reason came back, say where one can be obtained instead.
  await notify({
    category: 'Workload',
    level: 'Error',
    message: `Failed to delete infra "${rec.infraId}".`,
    detail: reason
      ? `${reason}\n\nDeleting it again shows the same reason before it starts.`
      : 'No reason was returned. Deleting it again shows the reason before it starts.',
    dedupKey: `delete:${rec.reqId}:error`,
  });
}

async function notifyUnknown(rec: DeleteRecord): Promise<void> {
  await notify({
    category: 'Workload',
    level: 'Error',
    message: `Could not confirm the deletion of infra "${rec.infraId}".`,
    detail:
      'The request record is gone but the infra is still listed, so the outcome is unknown. Check the workload list.',
    dedupKey: `delete:${rec.reqId}:unknown`,
  });
}

/** Checks the outcome of one in-flight delete. */
async function checkOne(rec: DeleteRecord): Promise<void> {
  try {
    const res: any = await useGetBeetleRequest(rec.reqId).execute();
    const details =
      res?.data?.responseData?.data ??
      res?.data?.data ??
      res?.data?.responseData ??
      res?.data ??
      res;
    const status = String(details?.status ?? '').toLowerCase();

    if (status === 'success') {
      await notifyDone(rec);
      // A success leaves nothing to keep — the infra is gone from the list, so there is
      // nothing left to show it against.
      await clearDeleteRecord(rec.uid);
    } else if (status === 'error') {
      const reason = details?.errorResponse || undefined;
      await markStatus(rec.uid, 'Error', reason);
      await notifyFailed(rec, reason);
    }
    // Still Handling: leave it and look again on the next pass.
  } catch {
    // The lookup failed. cm-beetle's request records do not survive its restart, so a
    // request that completed normally can land here. Rather than calling it failed, decide
    // by whether the infra is still there.
    const listed = await infraStillListed(rec);
    if (!listed) {
      // No infra means it is gone by some route. Nothing to keep.
      await notifyDone(rec);
      await clearDeleteRecord(rec.uid);
    } else {
      // The infra is there but the request record is not — the outcome is unknown.
      await markStatus(rec.uid, 'Unknown');
      await notifyUnknown(rec);
    }
  }
}

registerTracker({
  id: 'mci-delete',
  check: async () => {
    const handling = allDeleteRecords().filter(r => r.status === 'Handling');
    for (const rec of handling) {
      await checkOne(rec);
    }
  },
  hasWork: hasPendingDeletes,
  resume: loadDeleteRecords,
  reset: () => {
    state.records = {};
  },
});
