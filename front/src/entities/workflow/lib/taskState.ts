/**
 * Rules for displaying execution state.
 *
 * cm-cicada does not define its own state constants; it passes the execution
 * engine's state strings through as-is. So an unknown value can arrive here, and
 * we must not make it look normal — classify it as `unknown` and expose the raw
 * state string.
 */

export type TaskStateKind =
  | 'running'
  | 'success'
  | 'failed'
  | 'upstreamFailed'
  | 'retry'
  | 'skipped'
  | 'pending'
  | 'unknown';

const KIND_BY_STATE: Record<string, TaskStateKind> = {
  running: 'running',
  restarting: 'running',
  success: 'success',
  failed: 'failed',
  upstream_failed: 'upstreamFailed',
  up_for_retry: 'retry',
  up_for_reschedule: 'retry',
  deferred: 'retry',
  skipped: 'skipped',
  removed: 'skipped',
  queued: 'pending',
  scheduled: 'pending',
  none: 'pending',
};

/** A task that has not started yet arrives with the state string "None" */
export function taskStateKind(state?: string | null): TaskStateKind {
  if (!state) return 'pending';
  return KIND_BY_STATE[state.toLowerCase()] ?? 'unknown';
}

const LABEL_BY_KIND: Record<TaskStateKind, string> = {
  running: 'Running',
  success: 'Success',
  failed: 'Failed',
  upstreamFailed: 'Not run (upstream failed)',
  retry: 'Waiting for retry',
  skipped: 'Skipped',
  pending: 'Pending',
  unknown: 'Unknown state',
};

/** For an unknown state, show the original string as-is */
export function taskStateLabel(state?: string | null): string {
  const kind = taskStateKind(state);
  if (kind === 'unknown') return `${LABEL_BY_KIND.unknown} (${state})`;
  return LABEL_BY_KIND[kind];
}

/** badge-type for mirinae PBadge */
const BADGE_BY_KIND: Record<TaskStateKind, string> = {
  running: 'blue',
  success: 'green',
  failed: 'red',
  upstreamFailed: 'yellow',
  retry: 'yellow',
  skipped: 'gray',
  pending: 'gray',
  unknown: 'gray',
};

export function taskStateBadgeType(state?: string | null): string {
  return BADGE_BY_KIND[taskStateKind(state)];
}

/** Has the run state reached a terminal state? — condition to stop polling */
export function isRunFinished(runState?: string | null): boolean {
  if (!runState) return false;
  return ['success', 'failed'].includes(runState.toLowerCase());
}
