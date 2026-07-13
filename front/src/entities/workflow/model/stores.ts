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
   * API 응답 → 스토어에 담는 형태.
   *
   * 담는 형태를 아는 곳은 여기 하나뿐이다. 목록으로 담든 한 건으로 담든 이 함수를
   * 거치므로, 저장 구조가 바뀌어도 고칠 곳은 여기 한 곳이다.
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
   * 한 건 담기·갱신.
   *
   * 목록 화면은 이 배열을 watch 해서 표를 그린다. 그래서 자리를 바꿔 끼우지 않고
   * *배열을 새로 만들어* 넣는다 — push로 밀어 넣으면 목록이 다시 그려지지 않아,
   * 복제로 새로 생긴 워크플로우가 목록에 나타나지 않는다.
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
   * 워크플로우를 돌려준다. 캐시에 없으면 받아서 채운 뒤 돌려준다.
   *
   * 캐시 정책을 여기 한 곳에만 둔다. 호출자가 "없으면 목록을 다시 받아 넣는" 일을
   * 각자 하기 시작하면, 워크플로우를 새로 만드는 기능이 생길 때마다 같은 코드가
   * 늘어나고 어디선가 빠뜨린다 (복제본을 편집기로 열었을 때 빈 화면이 뜬 것이 그 예다).
   */
  async function ensureWorkflowById(
    workflowId: string | null | undefined,
  ): Promise<IWorkflow | undefined> {
    if (!workflowId) return undefined;

    const cached = getWorkflowById(workflowId);
    if (cached) return cached;

    // 컴포저블(useGetWorkflow)은 컴포넌트 setup 맥락에서 쓰도록 만들어져 있다.
    // 스토어 액션에서 부르면 요청이 정상적으로 끝나지 않아 호출자가 계속 기다리게 된다.
    // 그래서 여기서는 axios 호출을 직접 쓴다.
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
      // cm-cicada Type/Spec 응답을 legacy `data` 형태로 정규화 (idempotent).
      // 정규화하지 않으면 `.data` 가 undefined 라 상세 JSON 뷰가 비어 보인다.
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

    // 각 task component의 model 정보를 콘솔에 출력
    console.log('=== Task Components Model Information ===');
    _taskComponents.forEach(taskComponent => {
      console.log(`Task: ${taskComponent.name}`, {
        id: taskComponent.id,
        model: taskComponent.data,
        created_at: taskComponent.created_at,
        updated_at: taskComponent.updated_at,
      });

      // Task component의 body_params 모델 정보 상세 출력
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
