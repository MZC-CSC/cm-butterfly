import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import {
  ITaskComponentResponse,
  ITaskInstance,
  IWorkflowResponse,
  IWorkflowRun,
  ISoftwareMigrationStatusResponse,
  ITaskInstanceReference,
} from '@/entities/workflow/model/types';
import { axiosInstance } from '@/shared/libs/api/instance';

const GET_WORKFLOW_LIST = 'cm-cicada/list-workflow';
const GET_WORKFLOW = 'cm-cicada/get-workflow';
const CREATE_WORKFLOW = 'cm-cicada/create-workflow';
const UPDATE_WORKFLOW = 'cm-cicada/update-workflow';
const RUN_WORKFLOW = 'cm-cicada/run-workflow';
const DELETE_WORKFLOW = 'cm-cicada/delete-workflow';
const GET_WORKFLOW_RUNS = 'cm-cicada/get-workflow-runs';
const GET_TASK_INSTANCES = 'cm-cicada/get-task-instances';
const GET_TASK_LOGS = 'cm-cicada/get-task-logs';
const CLEAR_TASK_INSTANCES = 'cm-cicada/clear-task-instances';
const CLONE_WORKFLOW = 'cm-cicada/clone-workflow';
const GET_SOFTWARE_MIGRATION_STATUS =
  'cm-grasshopper/get-software-migration-status';

// const GET_DISK_TYPE = 'GET_DISK_TYPE';
const GET_WORKFLOW_TEMPLATE_LIST = 'cm-cicada/list-workflow-template';

const GET_TASK_COMPONENT_LIST = 'cm-cicada/list-task-component';
const GET_TASK_COMPONENT = 'cm-cicada/get-task-component';
const CREATE_TASK_COMPONENT = 'cm-cicada/create-task-component';
const UPDATE_TASK_COMPONENT = 'cm-cicada/update-task-component';
const DELETE_TASK_COMPONENT = 'cm-cicada/delete-task-component';

// 1. workflow
export function useGetWorkflowList() {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse[]>, null>(
    GET_WORKFLOW_LIST,
    null,
  );
}

export function useGetWorkflow(wfId: string | null) {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(GET_WORKFLOW, {
    pathParams: {
      wfId,
    },
  });
}

export function useUpdateWorkflow<T, D>(
  wfId: string | null,
  workflowData: D | null,
) {
  const requestBodyWrapper = {
    pathParams: {
      wfId: wfId || null,
    },
    request: {
      data: workflowData,
    },
  };

  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(
    UPDATE_WORKFLOW,
    requestBodyWrapper,
  );
}

export function useUpdateWorkflowV2(
  wfId: string | null,
  workflowData: IWorkflowResponse['data'] | null,
  name: string | null,
) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<
        | {
            wfId: string | null;
          }
        | {
            data: IWorkflowResponse['data'] | null;
            name: string | null;
            spec_version?: string;
            nsId?: string;
          }
      >,
      'pathParams' | 'request'
    >
  > = {
    pathParams: {
      wfId: wfId,
    },
    request: {
      data: workflowData,
      name: name,
    },
  };

  return useAxiosPost<
    IAxiosResponse<IWorkflowResponse>,
    Required<
      Pick<
        RequestBodyWrapper<
          | {
              wfId: string | null;
            }
          | {
              data: IWorkflowResponse['data'] | null;
              name: string | null;
              spec_version?: string;
              nsId?: string;
            }
        >,
        'pathParams' | 'request'
      >
    >
  >(UPDATE_WORKFLOW, requestBodyWrapper);
}

// Required<
//     Pick<RequestBodyWrapper<Pick<IMciRequestParams, 'nsId'>>, 'pathParams'>
// >
export function useRunWorkflow(wfId: string) {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(RUN_WORKFLOW, {
    pathParams: {
      wfId,
    },
  });
}

export function useBulkDeleteWorkflow(wfIds: string[]) {
  const promiseArr = wfIds.map(wfId => {
    return axiosInstance.post(DELETE_WORKFLOW, {
      pathParams: {
        wfId,
      },
    });
  });

  return Promise.all(promiseArr);
}

// 2. workflow template
export function useGetWorkflowTemplateList() {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse[]>, null>(
    GET_WORKFLOW_TEMPLATE_LIST,
    null,
  );
}

// export function useUpdateWorkflowTemplate<T, D>(
//   wfId: string | null,
//   workflowData: D | null,
// ) {
//   const requestBodyWrapper = {
//     pathParams: {
//       wfId: wfId || null,
//     },
//     request: {
//       data: workflowData,
//     },
//   };

//   return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(
//     UPDATE_WORKFLOW,
//     requestBodyWrapper,
//   );
// }

// 3. task component
export function useGetTaskComponentList() {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse[]>, null>(
    GET_TASK_COMPONENT_LIST,
    null,
  );
}

export function useGetTaskComponent(tcId: string | null) {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(
    GET_TASK_COMPONENT,
    {
      pathParams: {
        tcId,
      },
    },
  );
}

export function useCreateTaskComponent<T, D>(taskComponentData: D | null) {
  const requestBodyWrapper = {
    request: {
      data: taskComponentData,
    },
  };

  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(
    CREATE_TASK_COMPONENT,
    requestBodyWrapper,
  );
}

export function useUpdateTaskComponent<T, D>(
  tcId: string | null,
  taskComponentData: D | null,
) {
  const requestBodyWrapper = {
    pathParams: {
      tcId: tcId || null,
    },
    request: {
      data: taskComponentData,
    },
  };

  return useAxiosPost<IAxiosResponse<ITaskComponentResponse>, any>(
    UPDATE_TASK_COMPONENT,
    requestBodyWrapper,
  );
}

export function useBulkDeleteTaskComponent(tcIds: string[]) {
  const promiseArr = tcIds.map(tcId => {
    return axiosInstance.post(DELETE_TASK_COMPONENT, {
      pathParams: {
        tcId,
      },
    });
  });

  return Promise.all(promiseArr);
}

export function useCreateWorkflow(data: IWorkflowResponse['data'] | null) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<{
        data: IWorkflowResponse['data'] | null;
        name?: string;
        spec_version?: string;
        nsId?: string;
      }>,
      'request'
    >
  > = {
    request: {
      data,
    },
  };

  return useAxiosPost<
    IAxiosResponse<any>,
    Required<
      Pick<
        RequestBodyWrapper<{
          data: IWorkflowResponse['data'] | null;
          name?: string;
          spec_version?: string;
          nsId?: string;
        }>,
        'request'
      >
    >
  >(CREATE_WORKFLOW, requestBodyWrapper);
}

export function useGetWorkflowRuns(wfId: string | null) {
  return useAxiosPost<IAxiosResponse<IWorkflowRun[]>, any>(GET_WORKFLOW_RUNS, {
    pathParams: {
      wfId,
    },
  });
}

export function useGetTaskInstances(
  wfId: string | null,
  wfRunId: string | null,
) {
  return useAxiosPost<IAxiosResponse<ITaskInstance[]>, any>(
    GET_TASK_INSTANCES,
    {
      pathParams: {
        wfId,
        wfRunId: wfRunId ? encodeURIComponent(wfRunId) : wfRunId,
      },
    },
  );
}

export function useGetTaskLogs(
  wfId: string | null,
  wfRunId: string | null,
  taskId: string | null,
  taskTryNum: string | null,
) {
  return useAxiosPost<IAxiosResponse<any>, any>(GET_TASK_LOGS, {
    pathParams: {
      wfId,
      wfRunId: wfRunId ? encodeURIComponent(wfRunId) : wfRunId,
      taskId,
      taskTryNum,
    },
  });
}

/**
 * 태스크 재실행. 엔진은 이것을 "실행 이력 초기화(clear)"로 처리한다.
 *
 * dryRun을 켜면 **실제로 실행하지 않고 대상 목록만** 돌려준다. 어떤 태스크가 다시
 * 도는지는 화면의 그림이 아니라 엔진이 정하므로, 실행 전에 반드시 이것으로 확인한다.
 */
export interface IClearTaskOption {
  dryRun: boolean;
  taskIds: string[];
  includeUpstream: boolean;
  includeDownstream: boolean;
  onlyFailed: boolean;
  resetDagRuns: boolean;
}

export function useClearTaskInstances(
  wfId: string | null,
  wfRunId: string | null,
  option: IClearTaskOption,
) {
  return useAxiosPost<IAxiosResponse<ITaskInstanceReference[]>, any>(
    CLEAR_TASK_INSTANCES,
    {
      pathParams: {
        wfId,
        wfRunId: wfRunId ? encodeURIComponent(wfRunId) : wfRunId,
      },
      request: option,
    },
  );
}

/**
 * 워크플로우 복제.
 *
 * 엔진이 복제본에 출처(원본 워크플로우)를 함께 기록하므로, 원본과의 연결이 끊기지
 * 않는다. 이름은 `{원본}_copy` 로 엔진이 알아서 붙인다.
 *
 * 파라미터를 바꿔 실행하려면 원본을 고치지 말고 이것으로 복제한 뒤 복제본을 고친다 —
 * 원본을 고치면 그 워크플로우의 *과거 실행*이 화면에서 엉뚱한 값으로 보이게 된다
 * (엔진은 "그 실행에 쓰인 정의"를 돌려주지 않는다).
 */
export function useCloneWorkflow(wfId: string | null) {
  return useAxiosPost<IAxiosResponse<IWorkflowResponse>, any>(CLONE_WORKFLOW, {
    pathParams: {
      wfId,
    },
  });
}

export function useGetSoftwareMigrationStatus(executionId: string | null) {
  return useAxiosPost<IAxiosResponse<ISoftwareMigrationStatusResponse>, any>(
    GET_SOFTWARE_MIGRATION_STATUS,
    {
      pathParams: {
        executionId,
      },
    },
  );
}
