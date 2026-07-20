import { useGetWorkflowRuns } from '@/entities/workflow/api';

/**
 * 이 워크플로우가 한 번이라도 실행됐는가.
 *
 * **엔진은 "그 실행에 어떤 정의가 쓰였는지"를 남기지 않는다.** 그래서 실행된
 * 워크플로우를 고치면 과거 실행을 열었을 때 *지금 정의*의 값이 그 실행의 값인 것처럼
 * 보인다. 사용자는 구분할 방법이 없다. 그래서 이력이 없으면 고칠 수 있게 두고,
 * 있으면 원본 대신 복제본을 고치도록 막는다.
 *
 * **실행 이력을 담은 속성은 워크플로우 자체에 없다.** 실행 목록을 조회해 그 길이로만
 * 알 수 있고, 실행 상태 화면의 버튼 구성도 같은 값을 쓴다.
 *
 * ★ **조회 실패는 "실행된 적 없음"으로 본다.**
 * 갓 만든 워크플로우는 엔진이 Airflow 에서 DAG 를 찾지 못해 한동안 실패로 답한다
 * (`400` + `The Dag with ID ... not found`). 그건 오류가 아니라 *아직 한 번도 돌지
 * 않았다*는 뜻이므로, 실행된 것으로 보면 **복제해서 고치라고 안내해 놓고 그 복제본마저
 * 잠그게 된다.** 반대 방향의 위험(정말 실행된 것을 편집 가능하다고 보는 것)은 실제
 * 진입 경로가 실행 상태 화면 하나뿐이라 여기까지 오지 않는다.
 *
 * 측정(2026-07-19, 개발 서버): 복제 직후 **약 5초** 동안 `400 DAG 없음`, 그 뒤
 * `200`(실행 없으면 목록이 비어 있거나 `null`). 0.5초 간격으로 재어 얻은 값이다.
 */
export async function hasWorkflowRunHistory(
  workflowId: string,
): Promise<boolean> {
  if (!workflowId) return false;
  try {
    const { data, execute } = useGetWorkflowRuns(workflowId);
    await execute();
    return (data.value?.responseData ?? []).length > 0;
  } catch {
    return false;
  }
}
