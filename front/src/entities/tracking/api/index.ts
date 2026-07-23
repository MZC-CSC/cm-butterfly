import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * Storage API for tracking long-running jobs (cm-butterfly's own domain).
 *
 * Neither a load test nor a workflow run **hands back its own id when it starts.** What is
 * knowable at that point — which node, which workflow — is kept as a natural key, and that
 * key is what later asks how the last run turned out.
 *
 * It lives on the server for the same reason delete tracking does: kept in the browser
 * alone, the outcome would be invisible from anywhere else.
 */

export type TrackedJobKind = 'perf' | 'workflow';
export type TrackedJobAction = 'run' | 'rerun' | 'rerun-failed';

export interface TrackedJobRecord {
  id: string;
  kind: TrackedJobKind | string;
  natural_key: string;
  label: string;
  action: string;
  started_at: string;
  requested_by?: string;
}

/** Every tracked job — picked up on login and on app start. */
export function useListTrackedJobs() {
  return useAxiosPost<IAxiosResponse<TrackedJobRecord[]>, any>(
    'listtrackedjobs',
    {},
  );
}

/** Records a job start; an earlier record for the same target is replaced. */
export function useSaveTrackedJob(payload: {
  kind: TrackedJobKind;
  natural_key: string;
  label: string;
  action: TrackedJobAction;
  started_at: string;
}) {
  return useAxiosPost<IAxiosResponse<TrackedJobRecord>, any>(
    'savetrackedjob',
    payload,
  );
}

/** Drops a job that has finished and been announced. */
export function useRemoveTrackedJob(kind: TrackedJobKind, naturalKey: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('removetrackedjob', {
    kind,
    natural_key: naturalKey,
  });
}
