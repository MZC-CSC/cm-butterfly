import { defineStore } from 'pinia';
import {
  IWorkflow,
  IWorkflowResponse,
  ITaskComponent,
} from '@/entities/workflow/model/types';
import { normalizeTaskComponentInPlace } from '@/entities/workflow/lib/schemaAdapter';
import { axiosPost } from '@/shared/libs/api/request';
import { IAxiosResponse } from '@/shared/libs';
import { ref } from 'vue';

const NAMESPACE = 'WORKFLOW';

export const useWorkflowStore = defineStore(NAMESPACE, () => {
  // const workflows = ref<Record<string, IWorkflow>>({});
  const workflows = ref<IWorkflow[]>([]);
  // const workflowTemplates = ref<Record<string, IWorkflow>>({});
  const workflowTemplates = ref<IWorkflow[]>([]);
  const taskComponents = ref<ITaskComponent[]>([]);

  /**
   * API response → the shape stored in the store.
   *
   * This is the only place that knows the stored shape. Whether stored as a list or a
   * single item, everything goes through this function, so if the storage structure
   * changes, this is the one place to fix.
   */
  function toWorkflowEntry(workflow: IWorkflowResponse): IWorkflow {
    return {
      created_at: workflow.created_at,
      data: workflow.data,
      name: workflow.name,
      updated_at: workflow.updated_at,
      id: workflow.id,
      description: '',
    };
  }

  function getWorkflowById(workflowId: string | null | undefined) {
    return workflows.value.find(workflow => workflow.id === workflowId);
  }

  function setWorkFlows(_workflows: IWorkflowResponse[]) {
    workflows.value = _workflows.map(toWorkflowEntry);
  }

  /**
   * Insert or update a single item.
   *
   * The list screen watches this array to render the table. So instead of swapping an
   * element in place, we *build a new array*. Pushing into it wouldn't re-render the
   * list, and a workflow newly created by cloning wouldn't appear in the list.
   */
  function upsertWorkflow(workflow: IWorkflowResponse) {
    const entry = toWorkflowEntry(workflow);
    const index = workflows.value.findIndex(w => w.id === workflow.id);
    workflows.value =
      index >= 0
        ? workflows.value.map((w, i) => (i === index ? entry : w))
        : [...workflows.value, entry];
  }

  /**
   * Return the workflow. If it isn't in the cache, fetch it, fill the cache, then return it.
   *
   * The cache policy lives in this one place. If callers each start doing "refetch the
   * list if it's missing", the same code multiplies every time a new create-workflow
   * feature appears and someone somewhere leaves it out (the blank screen when opening
   * a clone in the editor was one such case).
   */
  async function ensureWorkflowById(
    workflowId: string | null | undefined,
  ): Promise<IWorkflow | undefined> {
    if (!workflowId) return undefined;

    const cached = getWorkflowById(workflowId);
    if (cached) return cached;

    // The composable (useGetWorkflow) is built to be used within a component setup
    // context. Called from a store action, the request doesn't finish properly and the
    // caller keeps waiting. So here we use the axios call directly.
    const response = await axiosPost<IAxiosResponse<IWorkflowResponse>, any>(
      'cm-cicada/get-workflow',
      { pathParams: { wfId: workflowId } },
    );
    const fetched = response?.data?.responseData;
    if (!fetched?.id) return undefined;

    upsertWorkflow(fetched);
    return getWorkflowById(workflowId);
  }

  function getWorkflowTemplateById(templateId: string | null | undefined) {
    return workflowTemplates.value.find(template => template.id === templateId);
  }

  function setWorkflowTemplates(_workflowTemplates: IWorkflowResponse[]) {
    workflowTemplates.value = _workflowTemplates.map(template => ({
      created_at: template.created_at,
      data: template.data,
      name: template.name,
      updated_at: template.updated_at,
      id: template.id,
      description: '',
    }));
  }

  function getTaskComponentById(taskComponentId: string | null | undefined) {
    return taskComponents.value.find(
      taskComponent => taskComponent.id === taskComponentId,
    );
  }

  function setTaskComponents(_taskComponents: ITaskComponent[]) {
    taskComponents.value = _taskComponents.map(taskComponent => {
      // Normalize the cm-cicada Type/Spec response into the legacy `data` shape (idempotent).
      // Without normalizing, `.data` is undefined so the detail JSON view looks empty.
      normalizeTaskComponentInPlace(taskComponent);
      return {
        created_at: taskComponent.created_at,
        data: taskComponent.data,
        id: taskComponent.id,
        name: taskComponent.name,
        description: '',
        updated_at: taskComponent.updated_at,
        type: (taskComponent as any).type,
        spec: (taskComponent as any).spec,
      };
    });

    // Print each task component's model information to the console
    console.log('=== Task Components Model Information ===');
    _taskComponents.forEach(taskComponent => {
      console.log(`Task: ${taskComponent.name}`, {
        id: taskComponent.id,
        model: taskComponent.data,
        created_at: taskComponent.created_at,
        updated_at: taskComponent.updated_at,
      });

      // Print the task component's body_params model information in detail
      if (taskComponent.data && (taskComponent.data as any).body_params) {
        console.log(
          `📋 ${taskComponent.name} Body Params Model:`,
          (taskComponent.data as any).body_params,
        );
      }
    });
    console.log('==========================================');
  }

  function setWorkFlow(
    state: Record<string, IWorkflow>,
    res: IWorkflowResponse,
  ) {
    const defaultWorkFlow: IWorkflow = {
      description: '',
      created_at: '',
      data: res.data,
      name: '',
      updated_at: '',
      id: '',
    };

    const existingWorkflow = state[res.id];
    if (!existingWorkflow) {
      state[res.id] = {
        ...defaultWorkFlow,
        ...res,
      };
    }
  }

  return {
    workflows,
    workflowTemplates,
    taskComponents,
    setWorkFlows,
    getWorkflowById,
    ensureWorkflowById,
    upsertWorkflow,
    setWorkflowTemplates,
    getWorkflowTemplateById,
    setTaskComponents,
    getTaskComponentById,
    // getWorkFlowById: (workflowId: string) =>
    //   getWorkFlowById(workflows.value, workflowId),
    // getTemplateById: (templateId: string) =>
    //   getWorkFlowById(workflowTemplates.value, templateId),
    // setWorkFlow: (res: IWorkflowResponse) => setWorkFlow(workflows.value, res),
    // setTemplate: (res: IWorkflowResponse) =>
    //   setWorkFlow(workflowTemplates.value, res),
    // setWorkFlows: (res: IWorkflowResponse[]) =>
    //   setWorkFlows(workflows.value, res),
    // setTemplates: (res: IWorkflowResponse[]) =>
    //   setWorkFlows(workflowTemplates.value, res),
  };
});
