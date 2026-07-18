import { Step as _Step } from 'sequential-workflow-model';
import { ITaskResponse } from '@/entities';
export interface fixedModel {
  path_params: Record<string, string>;
  query_params: Record<string, string>;
}

export interface Step extends _Step {
  sequence?: Step[];
  branches?: { true: Step[]; false: Step[] };
  componentType: 'switch' | 'container' | 'task' | 'launchPad';
  type: string;
  properties: {
    isDeletable: boolean;
    isParallel?: boolean;
    isEnabled?: boolean;
    model?: object;
    originalData?: ITaskResponse;
    fixedModel?: fixedModel;
    // cm-cicada task type (http | http_xcom | bash | ssh | trigger_workflow),
    // used to pick the per-type editor and to build the save-time spec.
    taskType?: string;
    // Normalized task component (`data` + `type`/`spec`) for schema-driven UI.
    taskComponentData?: any;
    // 원본 request_body 가 cm-cicada 런타임 참조였을 때, 저장 시 스켈레톤으로
    // 덮어쓰지 않고 참조를 그대로 되돌려 놓기 위해 함께 보관하는 값.
    referenceRequestBody?: string;
    referenceSkeletonModel?: any;
  };
}

export interface IWorkFlowDesignerFormData {
  sequence: Step[];
  /** 정의의 흠·그릴 수 없는 이유. 감추지 말고 화면에 드러낸다 */
  warnings?: string[];
  /** 편집기가 이 워크플로우의 실행 그래프를 그대로 그릴 수 있나 */
  representable?: boolean;
}
