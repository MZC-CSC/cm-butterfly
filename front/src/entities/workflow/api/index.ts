import { IAxiosResponse, useAxiosPost } from '@/shared/libs';
import { ITaskComponentResponse, IWorkflowResponse } from '../model/types';
import { axiosInstance } from '@/shared/libs/api/instance';

const GET_WORKFLOW_LIST = 'list-workflow';
const GET_WORKFLOW = 'get-workflow';
const CREATE_WORKFLOW = 'create-workflow';
const UPDATE_WORKFLOW = 'update-workflow';
const DELETE_WORKFLOW = 'delete-workflow';

const GET_WORKFLOW_TEMPLATE_LIST = 'list-workflow-template';

const GET_TASK_COMPONENT_LIST = 'list-task-component';
const CREATE_TASK_COMPONENT = 'cm-cicada/create-task-component';
const UPDATE_TASK_COMPONENT = 'update-task-component';
const DELETE_TASK_COMPONENT = 'delete-task-component';

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
