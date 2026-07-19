import { useWorkflowStore } from '@/entities/workflow/model/stores';
import {
  fixedModel,
  IWorkFlowDesignerFormData,
  Step,
} from '@/features/workflow/workflowEditor/model/types';
import {
  ITaskGroupResponse,
  ITaskResponse,
  IWorkflow,
  IWorkflowResponse,
} from '@/entities/workflow/model/types';
import getRandomId from '@/shared/utils/uuid';
import { toolboxSteps } from '@/features/sequential/designer/toolbox/model/toolboxSteps';
import {
  parseRequestBody,
  isReferenceRequestBody,
} from '@/shared/utils/stringToObject';
import { ITaskComponentInfoResponse } from '@/features/sequential/designer/toolbox/model/api';
import { isNullOrUndefined } from '@/shared/utils';
import { reactive } from 'vue';
import { useSequentialToolboxModel } from '@/features/sequential/designer/toolbox/model/toolboxModel';
import { encodeBase64, decodeBase64 } from '@/shared/utils/base64';
import {
  buildStepModelFromTaskSpec,
  buildTaskSpecFromStep,
  normalizeWorkflowTaskInPlace,
  toDesignerStepType,
} from '@/entities/workflow/lib/schemaAdapter';
import {
  analyzeTopology,
  ITopologyItem,
} from '@/entities/workflow/lib/designerTopology';
import {
  reviewDesignerSequence,
  serializeDesignerSequence,
  validateDesignerSequence,
} from '@/entities/workflow/lib/designerSerialize';

type dropDownType = {
  name: string;
  label: string;
  type: 'item';
};

export function useWorkflowToolModel() {
  const workflowStore = useWorkflowStore();
  const { defineTaskGroupStep, defineBettleTaskStep, defineParrelStep } =
    toolboxSteps();
  const sequentialToolboxModel = useSequentialToolboxModel();
  const taskComponentList: Array<ITaskComponentInfoResponse> = [];
  const dropDownModel = reactive<{
    state: any;
    data: dropDownType[];
    selectedItemId: string;
  }>({
    state: { disabled: false },
    data: [],
    selectedItemId: '',
  });

  function setTaskComponent(
    _taskComponentList: Array<ITaskComponentInfoResponse>,
  ) {
    console.log('=== setTaskComponent called ===');
    console.log('Task components to add:', _taskComponentList.length);

    _taskComponentList.forEach(component => {
      taskComponentList.push(component);
    });

    // Workflow Store에도 저장
    workflowStore.setTaskComponents(_taskComponentList);
    console.log('✅ Task components saved to workflow store');
    console.log(
      'Current store task components count:',
      workflowStore.taskComponents.length,
    );
  }

  function setDropDownData(workspaceResponse: IWorkflowResponse[]) {
    workspaceResponse.forEach(workspace => {
      dropDownModel.data.push({
        name: workspace.id,
        label: workspace.name,
        type: 'item',
      });
    });
  }

  function getWorkflowData(workflowId: string) {
    return workflowStore.getWorkflowById(workflowId);
  }

  function getWorkflowTemplateData(workflowTemplateId: string) {
    return workflowStore.getWorkflowTemplateById(workflowTemplateId);
  }

  /**
   * 저장된 워크플로우를 화면에 올린다.
   *
   * 그리는 근거는 **의존 관계**다. task_group 이 놓인 순서가 아니다. 엔진도 그렇게
   * 실행하므로, 이렇게 해야 화면에 보이는 순서가 실제 실행 순서와 같아진다.
   * 예전에는 그룹을 놓인 순서대로 늘어놓기만 해서, 병렬로 저장한 워크플로우가
   * 아무 말 없이 한 줄로 보였고 그대로 저장하면 병렬이 사라졌다.
   */
  function convertCicadaToDesignerFormData(
    workflow: IWorkflow,
    taskComponentList: Array<ITaskComponentInfoResponse>,
  ): IWorkFlowDesignerFormData {
    const analysis = analyzeTopology(workflow.data?.task_groups);
    const allTasks = (workflow.data?.task_groups ?? []).flatMap(
      group => group.tasks ?? [],
    );
    const descriptionByGroup = new Map<string, string>(
      (workflow.data?.task_groups ?? []).map(group => [
        group.name,
        group.description ?? '',
      ]),
    );

    if (!analysis.items.length || !analysis.representable) {
      // 그릴 수 없는 그림이면 화면을 만들지 않는다. 억지로 펴서 보여주면 저장하는
      // 순간 없던 선이 생겨 워크플로우가 조용히 바뀐다.
      return {
        sequence: [],
        warnings: analysis.warnings,
        representable: analysis.representable,
      };
    }

    const toStep = (task: ITaskResponse): Step => {
      const normalized = normalizeWorkflowTaskInPlace(task, taskComponentList);
      const requestBody = getMappingWorkflowTaskComponentRequestBody(
        normalized,
        taskComponentList,
        allTasks,
      );
      return convertToDesignerTask(normalized, requestBody);
    };

    /**
     * 한 줄의 그림을 화면 단계로 만든다.
     *
     * 같은 그룹에 속한 것들은 **하나의 TaskGroup 상자**에 담는다. 그 안에서 갈라지는
     * 병렬도 같은 상자 **안**에 들어간다 — 그룹은 이름표일 뿐이고, 한 그룹이 갈라진다고
     * 해서 다른 그룹이 되지는 않기 때문이다. 예전에는 병렬을 만나면 상자를 닫아 버려서
     * **한 그룹이 두 상자로 쪼개져 보였다.**
     *
     * 병렬 상자는 그룹이 아니라 **갈라짐 표시**다. 그래서 그룹 상자 안에 있을 때는
     * 그룹 이름을 달지 않는다. 저장할 때도 안의 task 는 바깥 그룹 이름으로 묶인다.
     */
    let parallelSeq = 0;
    const materialize = (
      items: ITopologyItem[],
      // 이 줄을 감싸고 있는 그룹 이름. 같은 그룹이면 상자를 또 두르지 않는다.
      enclosingGroupName: string | null = null,
    ): Step[] => {
      const out: Step[] = [];
      let openGroup: Step | null = null;

      const closeGroup = () => {
        if (openGroup) {
          out.push(openGroup);
          openGroup = null;
        }
      };

      /** 지금 놓을 곳 — 열려 있는 그룹 상자가 있으면 그 안, 없으면 바깥 */
      const place = (step: Step) => {
        if (openGroup) openGroup.sequence!.push(step);
        else out.push(step);
      };

      /** 이 항목이 속한 그룹을 열어 둔다(이미 같은 그룹이 열려 있으면 그대로) */
      const openGroupFor = (groupName: string | null) => {
        if (!groupName || groupName === enclosingGroupName) {
          closeGroup();
          return;
        }
        if (!openGroup || openGroup.name !== groupName) {
          closeGroup();
          openGroup = defineTaskGroupStep(getRandomId(), groupName, 'MCI', {
            model: { description: descriptionByGroup.get(groupName) ?? '' },
          });
        }
      };

      items.forEach(item => {
        if (item.kind === 'parallel') {
          openGroupFor(item.groupName);

          // 그룹 상자 안에 들어가면 그룹 이름은 상자가 이미 달고 있다. 밖에 홀로
          // 놓일 때만 그룹 이름을 달아 저장 시 묶일 곳이 있게 한다.
          const inGroup = openGroup !== null;
          parallelSeq += 1;
          const boxName = inGroup
            ? `Parallel ${parallelSeq}`
            : (item.groupName ?? `Parallel ${parallelSeq}`);

          const parallel = defineParrelStep(getRandomId(), boxName, {
            model: {
              description: inGroup
                ? ''
                : (descriptionByGroup.get(boxName) ?? ''),
            },
          });

          parallel.sequence = item.branches.map((branch, index) => {
            const inner = materialize(branch, item.groupName);
            // 갈래에 하나만 있으면 그대로 놓는다. 여러 개면 한 줄로 이어 보이도록
            // 상자에 담는다 — 상자는 보기 좋으라고 두는 것이고 실행에는 영향이 없다.
            if (inner.length === 1) return inner[0];
            const holder = defineTaskGroupStep(
              getRandomId(),
              `Branch ${index + 1}`,
              'MCI',
              { model: {} },
            );
            holder.sequence = inner;
            return holder as Step;
          }) as Step[];

          place(parallel as Step);
          return;
        }

        openGroupFor(item.groupName);
        place(toStep(item.task));
      });

      closeGroup();
      return out;
    };

    const sequence = materialize(analysis.items);

    return { sequence, warnings: analysis.warnings, representable: true };
  }

  function createFixedModel(task: ITaskResponse): fixedModel {
    const fixedModel: fixedModel = {
      path_params: task.path_params,
      query_params: task.query_params,
    };
    if (
      isNullOrUndefined(fixedModel.path_params) ||
      isNullOrUndefined(fixedModel.query_params)
    ) {
      const taskComponent = taskComponentList.find(
        taskComponent => taskComponent.name === task.task_component,
      );

      if (taskComponent) {
        const { path_params, query_params } =
          sequentialToolboxModel.getFixedModel(taskComponent);

        if (isNullOrUndefined(fixedModel.path_params)) {
          fixedModel.path_params = path_params;
        }
        if (isNullOrUndefined(fixedModel.query_params)) {
          fixedModel.query_params = query_params;
        }
      }
    }
    return fixedModel;
  }

  function convertToDesignerTask(
    task: ITaskResponse,
    requestBody: string,
  ): Step {
    // Task component 정보 찾기
    const taskComponent = taskComponentList.find(
      tc => tc.name === task.task_component,
    );

    // cm-cicada task type 결정 (per-type editor 및 저장 spec 생성에 사용)
    const taskType = task.type ?? taskComponent?.type ?? 'http';

    // http 이외 타입(bash/ssh/http_xcom/trigger_workflow)은 spec에서 직접 model 구성
    const customModel = buildStepModelFromTaskSpec(
      taskType,
      task.spec,
      taskComponent,
    );

    let model: any;
    let fixedModel: fixedModel;

    if (customModel !== null) {
      model = customModel;
      fixedModel = { path_params: {}, query_params: {} };
    } else {
      // http: 기존 request_body → model 흐름 유지
      model = parseRequestBody(requestBody);

      // Base64 decode content field for cicada_task_run_script
      if (task.task_component === 'cicada_task_run_script' && model.content) {
        model.content = decodeBase64(model.content);
      }

      fixedModel = createFixedModel(task);
    }

    const stepProperties: any = {
      model,
      originalData: task,
      fixedModel,
      taskType,
    };

    // request_body 가 cm-cicada 런타임 참조였다면(위 getMapping...에서 스켈레톤으로
    // 폴백된 경우), 원본 참조 문자열과 폴백 스켈레톤 model 을 함께 보관한다.
    // 저장 시(convertToCicadaTaskWithDependencies) 사용자가 body 를 손대지 않았으면
    // 스켈레톤 리터럴("{}" 등)로 덮어쓰지 않고 원본 참조를 그대로 재출력해
    // cicada 의 출력 주입 의미를 보존한다(D-2 라운드트립).
    if (taskType === 'http' && isReferenceRequestBody(task.request_body)) {
      stepProperties.referenceRequestBody = task.request_body;
      stepProperties.referenceSkeletonModel = model;
    }

    // Task component data 추가 (schema 정보 — http 폼 렌더링용 + 타입별 고정 필드 표시용)
    if (taskComponent) {
      stepProperties.taskComponentData = {
        ...taskComponent.data,
        spec: taskComponent.spec,
        type: taskComponent.type,
      };
    }

    return defineBettleTaskStep(
      getRandomId(),
      task.name,
      toDesignerStepType(task.task_component),
      stepProperties,
    );
  }

  /** 구조 변환은 `designerSerialize` 가 맡고, 여기서는 task 하나의 내용만 만든다. */
  function convertDesignerSequenceToCicada(sequence: Step[]) {
    return serializeDesignerSequence(sequence, (step, dependencies) =>
      convertToCicadaTaskWithDependencies(step as Step, dependencies),
    );
  }

  function convertToCicadaTaskWithDependencies(
    step: Step,
    dependencies: string[],
  ): any {
    if (step.componentType === 'task') {
      const taskComponent = step.properties.originalData?.task_component;
      const taskType =
        step.properties.taskType ??
        step.properties.originalData?.type ??
        'http';

      // Base64 encode content field for cicada_task_run_script (http only)
      const modelToSend: any = { ...step.properties.model };
      if (taskComponent === 'cicada_task_run_script' && modelToSend.content) {
        modelToSend.content = encodeBase64(modelToSend.content);
      }

      // cm-cicada Type/Spec 스키마로 task spec 생성 (타입별 task-level 필드)
      let spec: any;

      // D-2 라운드트립: 원본 request_body 가 런타임 참조였고 사용자가 body 를 손대지
      // 않았다면(현재 model 이 로드 시 폴백된 스켈레톤 그대로), 스켈레톤 리터럴로
      // 덮어쓰지 않고 원본 참조 문자열을 그대로 재출력한다. 그래야 cicada 가 앞선
      // task 출력을 주입하는 참조 의미를 잃지 않는다.
      const referenceRequestBody = step.properties.referenceRequestBody;
      const referenceSkeletonModel = step.properties.referenceSkeletonModel;
      const bodyUntouched =
        typeof referenceRequestBody === 'string' &&
        referenceRequestBody !== '' &&
        JSON.stringify(modelToSend) ===
          JSON.stringify(referenceSkeletonModel ?? {});

      if (taskType === 'http' && bodyUntouched) {
        const fixedModel = step.properties.fixedModel;
        spec = {
          request_body: referenceRequestBody,
          path_params: fixedModel?.path_params ?? {},
          query_params: fixedModel?.query_params ?? {},
        };
      } else {
        spec = buildTaskSpecFromStep(
          taskType,
          modelToSend,
          step.properties.fixedModel,
        );
      }

      console.log('\n=== Task Conversion ===');
      console.log('Task:', step.name);
      console.log('Type:', taskType);
      console.log('Dependencies:', dependencies);
      console.log('Task Component:', taskComponent);

      return {
        name: step.name,
        task_component: taskComponent,
        spec,
        dependencies: dependencies,
      };
    }
  }

  function getMappingWorkflowTaskComponentRequestBody(
    task: ITaskResponse,
    taskComponentList: Array<ITaskComponentInfoResponse>,
    taskList: Array<ITaskResponse>,
  ): string {
    // request_body 는 다음 중 하나다:
    //  (a) 빈 문자열 — 컴포넌트 스켈레톤을 사용한다.
    //  (b) cm-cicada 런타임 참조 — 앞선 task 의 출력을 주입한다. task 이름 그대로거나
    //      (v0.5.1 부터) "<task>.<jsonpath>"(예: "infra_recommend_get.cloudInfraModel")·
    //      "${...}" 같은 형태로 온다. 이 문자열은 유효 JSON 이 아니다.
    //  (c) 실제 리터럴 JSON body.
    //
    // (a)(b) 는 컴포넌트 스켈레톤으로 폴백해 우측 폼이 필드/값을 정상으로 그리게 하고,
    // (c) 만 원문 그대로 반환한다. (b) 를 그대로 반환하면 convertToDesignerTask 의
    // parseRequestBody 가 JSON.parse 에 실패해 model 이 {} 가 되어 값이 전부 공란이 된다.
    //
    // 기존 조건은 "정확한 task 이름 일치"만 봐서 점 경로 참조(.cloudInfraModel 접미사)를
    // 놓쳤다. 참조의 head(`<task>` 부분)가 task 이름과 일치하는지, 그리고 유효 JSON 이
    // 아닌지까지 확인해 참조를 폭넓게 인식한다.
    const bodyRef = String(task.request_body ?? '');
    const refHead = bodyRef.split('.')[0];
    const isTaskRef = taskList.some(
      el => el.name === bodyRef || el.name === refHead,
    );
    const condition =
      bodyRef === '' || isTaskRef || isReferenceRequestBody(bodyRef);

    if (condition) {
      const taskInstance = taskComponentList.find(
        taskComponent => taskComponent.name === task.task_component,
      );
      return taskInstance?.data.options.request_body ?? '';
    }
    return bodyRef;
  }

  return {
    workflowStore,
    dropDownModel,
    taskComponentList,
    toolboxSteps,
    setTaskComponent,
    setDropDownData,
    convertToDesignerTask,
    getWorkflowTemplateData,
    getWorkflowData,
    convertCicadaToDesignerFormData,
    convertDesignerSequenceToCicada,
    validateDesignerSequence,
    reviewDesignerSequence,
  };
}
