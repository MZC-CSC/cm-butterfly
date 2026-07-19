import { ITaskGroupResponse } from '@/entities/workflow/model/types';
import { analyzeTopology } from '@/entities/workflow/lib/designerTopology';

/**
 * 이 워크플로우를 **워크플로우 툴로 열어도 되는가**를 한 곳에서 판정한다.
 *
 * 툴은 상자를 겹쳐 그림을 그리는 방식이라, 실행 그래프 중 일부는 그대로 옮길 수 없다.
 * 못 옮기는 것을 억지로 열면 화면이 실제 실행과 달라지고, 그 상태로 저장하면 실행 순서가
 * 조용히 바뀐다. 그러니 못 여는 것은 **열지 않고 JSON 으로 보낸다.**
 *
 * ★ 이 판정이 필요한 곳이 둘이고, 서로 달라지면 안 된다.
 *   ① 워크플로우 툴이 워크플로우를 읽어 올릴 때
 *   ② 실행 상태 화면에서 Edit·Clone&Edit 를 눌렀을 때 (툴로 보낼지 JSON 으로 보낼지)
 * 그래서 두 곳이 이 함수 하나를 쓴다.
 *
 * 판정 근거는 **되돌려 대조**다 — 선을 보고 그림을 세운 뒤, 그 그림에서 다시 선을 뽑아
 * 원래 선과 하나라도 다르면 못 여는 것으로 본다. 그래서 "무엇을 지원하는지"를 목록으로
 * 관리할 필요가 없다. 앞으로 툴이 더 많은 모양을 그리게 되면 이 판정도 저절로 넓어지고,
 * 아직 다루지 못하는 모양(예: 갈래 중간에서 빠지는 곁가지)은 저절로 걸러진다.
 */
export interface IDesignerSupport {
  /** 워크플로우 툴로 열어도 되는가 */
  canEdit: boolean;
  /** 열 수 없는 이유. 사용자에게 그대로 보여도 되는 문장이다 */
  reasons: string[];
}

export function checkDesignerSupport(
  taskGroups: Array<ITaskGroupResponse> | undefined,
): IDesignerSupport {
  const analysis = analyzeTopology(taskGroups);
  return {
    canEdit: analysis.representable,
    reasons: analysis.warnings,
  };
}
