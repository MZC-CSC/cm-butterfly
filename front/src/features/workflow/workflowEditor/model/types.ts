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
    // When the original request_body was a cm-cicada runtime reference, this value is kept
    // alongside so that on save we restore the reference as-is instead of overwriting it with the skeleton.
    referenceRequestBody?: string;
    referenceSkeletonModel?: any;
  };
}

export interface IWorkFlowDesignerFormData {
  sequence: Step[];
  /** Flaws in the definition / reasons it can't be drawn. Surface them on screen, don't hide them */
  warnings?: string[];
  /** Whether the editor can draw this workflow's execution graph as-is */
  representable?: boolean;
}
