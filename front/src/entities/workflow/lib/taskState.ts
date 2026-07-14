/**
 * 실행 상태 표시 규칙.
 *
 * cm-cicada는 자체 상태 상수를 두지 않고 실행 엔진의 상태 문자열을 그대로
 * 통과시킨다. 따라서 여기서 모르는 값이 들어올 수 있고, 그때 정상인 것처럼
 * 보이게 만들면 안 된다 — `unknown`으로 분류해 상태 문자열을 그대로 노출한다.
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

/** 아직 시작하지 않은 태스크는 state가 "None" 문자열로 온다 */
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

/** 모르는 상태는 원래 문자열을 그대로 보여준다 */
export function taskStateLabel(state?: string | null): string {
  const kind = taskStateKind(state);
  if (kind === 'unknown') return `${LABEL_BY_KIND.unknown} (${state})`;
  return LABEL_BY_KIND[kind];
}

/** mirinae PBadge의 badge-type */
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

/** 실행(run) 상태가 종료에 도달했는가 — 폴링 중단 조건 */
export function isRunFinished(runState?: string | null): boolean {
  if (!runState) return false;
  return ['success', 'failed'].includes(runState.toLowerCase());
}
