import { useGetWorkflowRuns } from '@/entities/workflow/api';

/**
 * 실행 이력이 있나 — **모를 수 있다.**
 *
 * `'unknown'` 은 조회가 실패한 상태다. 갓 만든 워크플로우에서 *정상적으로* 나온다 —
 * 엔진은 실행 이력을 Airflow 에서 읽는데, 방금 만든 DAG 를 Airflow 가 아직 읽어들이지
 * 않아 한동안 404 로 답한다(복제 직후가 늘 이렇다).
 *
 * 그래서 모를 때 어떻게 할지는 **부르는 쪽이 정한다.** 한쪽으로 정해 두면 어느 한
 * 경우가 반드시 틀린다 — 아래 `RUN_HISTORY_UNKNOWN` 주석 참조.
 */
export type WorkflowRunHistory = 'has-runs' | 'no-runs' | 'unknown';

/**
 * 이 워크플로우가 한 번이라도 실행됐는가.
 *
 * **엔진은 "그 실행에 어떤 정의가 쓰였는지"를 남기지 않는다.** 그래서 실행된
 * 워크플로우를 고치면 과거 실행을 열었을 때 *지금 정의*의 값이 그 실행의 값인 것처럼
 * 보인다. 사용자는 구분할 방법이 없다. 그래서 실행 이력이 있으면 원본을 고치지 않고
 * 복제해서 고치도록 유도한다.
 *
 * 판정이 필요한 곳이 둘 이상이라 여기 한 곳에 둔다 — 실행 상태 뷰어(버튼 구성)와
 * 워크플로우 상세(툴로 보낼지 실행 상태로 보낼지). 두 곳이 다르게 판단하면
 * 상세에서 툴로 보냈는데 뷰어는 못 고치는 워크플로우로 보는 어긋남이 생긴다.
 */
export async function getWorkflowRunHistory(
  workflowId: string,
): Promise<WorkflowRunHistory> {
  if (!workflowId) return 'no-runs';
  try {
    const { data, execute } = useGetWorkflowRuns(workflowId);
    await execute();
    return (data.value?.responseData ?? []).length > 0 ? 'has-runs' : 'no-runs';
  } catch {
    return 'unknown';
  }
}

/*
  RUN_HISTORY_UNKNOWN — 모를 때 어느 쪽으로 기울일지

  · **편집으로 보낼지 정할 때**는 막는 쪽으로 기운다. 실제로 실행된 워크플로우였다면
    고치는 순간 과거 기록의 뜻이 조용히 바뀌고 되돌릴 수 없다. 실행 상태로 보내도
    사용자는 거기서 복제해 고칠 수 있으므로 잃는 것이 적다.

  · **편집기 안에서 잠글지 정할 때**는 잠그지 않는 쪽으로 기운다. 갓 만든 복제본이
    바로 이 상태로 열리는데(Airflow 가 아직 DAG 를 못 읽었다), 여기서 잠그면
    **복제해서 고치라고 안내해 놓고 그 복제본도 못 고치게 된다.**
*/
export async function shouldSendToRunStatus(
  workflowId: string,
): Promise<boolean> {
  return (await getWorkflowRunHistory(workflowId)) !== 'no-runs';
}

export async function isEditingLockedByRunHistory(
  workflowId: string,
): Promise<boolean> {
  return (await getWorkflowRunHistory(workflowId)) === 'has-runs';
}
