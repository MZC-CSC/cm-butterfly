<script setup lang="ts">
import { CreateForm } from '@/widgets/layout';
import {
  PButton,
  PFieldGroup,
  PSelectDropdown,
  PSpinner,
  PTextInput,
} from '@cloudforet-test/mirinae';
import { useWorkflowToolModel } from '@/features/workflow/workflowEditor/model/workflowEditorModel';
import { useInputModel } from '@/shared/hooks/input/useInputModel';
import { onBeforeMount, onMounted, reactive, ref, Ref, watch } from 'vue';
import { Step } from '@/features/workflow/workflowEditor/model/types';
import {
  ITargetModelResponse,
  ITaskResponse,
  IWorkflow,
  useCreateWorkflow,
  useGetWorkflowTemplateList,
  useUpdateWorkflowV2,
} from '@/entities';
import { Designer } from 'sequential-workflow-designer';
import { DOC_LINKS, openDocLink } from '@/shared/constants/docLinks';
import {
  showErrorMessage,
  showInfoMessage,
  showSuccessMessage,
  toErrorMessage,
} from '@/shared/utils';
import {
  getTaskComponentList,
  ITaskComponentInfoResponse,
} from '@/features/sequential/designer/toolbox/model/api';
import getRandomId from '@/shared/utils/uuid';
import { parseRequestBody } from '@/shared/utils/stringToObject';
import SequentialDesigner from '@/features/sequential/designer/ui/SequentialDesigner.vue';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';
import { normalizeTaskComponentList } from '@/entities/workflow/lib/schemaAdapter';
import { hasWorkflowRunHistory } from '@/entities/workflow/lib/workflowRunHistory';
import { useTaskSchemaLoader } from '@/features/sequential/designer/editor/composables/useTaskSchemaLoader';

interface IProps {
  wftId: string;
  toolType: 'edit' | 'viewer' | 'add';
  targetModel?: ITargetModelResponse;
  migrationType?: 'infra' | 'software';
  recommendedModel?: any;
}

const props = defineProps<IProps>();
const emit = defineEmits([
  'update:close-modal',
  'update:trigger',
  'update:saved',
]);

const workflowToolModel = useWorkflowToolModel();
const workflowName = useInputModel<string>('');
const workflowDescription = useInputModel<string>('');
const workflowData = ref<IWorkflow>();
const sequentialSequence: Ref<Step[]> = ref<Step[]>([]);

// Task schema loader
const { loadTaskSchemasFromResponse, loadAllTaskSchemas, isSchemaLoaded } =
  useTaskSchemaLoader();

const resWorkflowTemplateData = useGetWorkflowTemplateList();
const resTaskComponentList = getTaskComponentList();
const resUpdateWorkflow = useUpdateWorkflowV2(null, null, null);
const resAddWorkFlow = useCreateWorkflow(null);
const loading = ref<boolean>(true);

const trigger = reactive({ value: false });
/**
 * 이 워크플로우의 실행 그래프를 편집기가 그대로 그릴 수 없을 때 켜진다.
 * 그럴 때는 빈 화면을 보여주는 대신 이유를 적고 저장을 막는다 — 그리지 못한 것을
 * 저장하면 실행 순서가 바뀌기 때문이다.
 */
const isUneditable = ref(false);
const loadWarnings = ref<string[]>([]);

/**
 * 이 워크플로우가 실행된 적이 있어 고칠 수 없을 때 켜진다.
 *
 * 정상 경로에서는 여기까지 오지 않는다 — 상세 화면과 실행 뷰어가 실행 이력을 보고
 * 실행 상태로 보내기 때문이다. 이것은 **뒤에 다른 진입이 생겨도 뚫리지 않게 하는
 * 안전망**이고, 열렸을 때는 보여주되 고치지 못하게 한다.
 */
const isRunLocked = ref(false);

/**
 * 워크플로우를 아직 읽지 못한 상태.
 *
 * 방금 만든 워크플로우는 엔진이 Airflow 에서 읽지 못하는 구간이 잠시 있다
 * (개발 서버 측정 약 5초, `get-workflow` 가 400). 그때 조회 결과가 비는데,
 * **그대로 두면 빈 캔버스가 아무 말 없이 뜬다** — 태스크가 하나도 없는 워크플로우처럼
 * 보이고, 그 상태로 저장하면 내용이 날아간다.
 *
 * 그래서 읽힐 때까지 기다렸다가 그리고, 무엇을 기다리는지 화면에 적는다.
 * (복제 직후 편집기로 오는 경로는 복제 응답이 캐시에 있어 곧바로 그려진다.)
 */
const workflowLoadState = ref<'ok' | 'waiting' | 'failed'>('ok');

const WORKFLOW_READY_INTERVAL_MS = 2000;
const WORKFLOW_READY_TIMEOUT_MS = 60000;

async function fetchWorkflowForEdit() {
  const deadline = Date.now() + WORKFLOW_READY_TIMEOUT_MS;
  for (;;) {
    const found = await workflowToolModel.workflowStore.ensureWorkflowById(
      props.wftId,
    );
    if (found) return found;
    if (Date.now() + WORKFLOW_READY_INTERVAL_MS > deadline) return undefined;
    workflowLoadState.value = 'waiting';
    await new Promise(resolve =>
      setTimeout(resolve, WORKFLOW_READY_INTERVAL_MS),
    );
  }
}

console.log(props);

onBeforeMount(function () {
  Promise.all<any>([
    resWorkflowTemplateData.execute(),
    resTaskComponentList.execute(),
  ]).then(res => {
    // cm-cicada Type/Spec 응답을 디자이너가 소비하는 legacy 형태로 정규화 (in place).
    // 팔레트/캔버스/템플릿 로드가 모두 이 배열을 참조하므로 여기서 한 번 변환한다.
    normalizeTaskComponentList(res[1].data.responseData);

    workflowToolModel.workflowStore.setWorkflowTemplates(
      res[0].data.responseData,
    );

    // cicada_task_run_script is now included in API response
    // cicada_task_run_script는 이제 API 응답에 포함됨
    workflowToolModel.setTaskComponent(res[1].data.responseData);
    workflowToolModel.setDropDownData(
      workflowToolModel.workflowStore.workflowTemplates,
    );

    if (props.targetModel) {
      console.log('TargetModel received:', props.targetModel);
      console.log('TargetModel type check:', {
        hasCloudInfraModel: !!props.targetModel.cloudInfraModel,
        cloudInfraModel: props.targetModel.cloudInfraModel,
        isCloudModel: props.targetModel.isCloudModel,
        csp: props.targetModel.csp,
        region: props.targetModel.region,
        zone: props.targetModel.zone,
      });

      // ── 타깃 모델 흐름: 템플릿을 로드하되, 마이그레이션 task 본문을 타깃 모델의 리터럴 값으로
      //    채우고 앞 조회 task 에는 선택한 타깃 모델 id 를 넣는다 (BAR-1493 P0) ──
      //
      // cm-cicada v0.5.1 마이그레이션 템플릿은 두 개의 마이그레이션 task 로 나뉜다:
      //   ① damselfly 조회 task(path_params.id 로 타깃 모델을 실행 시점에 조회)
      //   ② 마이그레이션 task(beetle/grasshopper) — 본문이 "①.결과" 참조로 돼 있음.
      // 콘솔은 이미 완성된 타깃 모델을 손에 쥐고 있고, 사용자가 우측 테이블로 값을 편집해야 하므로,
      // ②의 본문을 참조가 아니라 타깃 모델의 리터럴 값으로 직접 채운다(엔진의 리터럴 모드가 그대로
      // 대상 API 로 보낸다 — docs/task-response-passing.md). ①에는 선택한 타깃 모델 id 를 넣어
      // 그대로 성공하게 둔다(②가 리터럴이라 ①의 결과는 쓰이지 않지만 템플릿 구조상 실행은 성공해야
      // 하므로). 실제 주입은 시퀀스를 세운 직후 loadSequence() 끝에서 한다.
      //
      // 이전에는 여기서 mapTargetModelToTaskComponent() 로 '단일 리터럴 task'를 만들면서
      // 동시에 load() 로 템플릿을 비동기 로드해, load 가 나중에 그 단일 task 를 덮어썼다(race).
      // 그 결과 저장물이 참조 본문 그대로인 다중-task 템플릿이 돼 콘솔이 {}/스켈레톤으로 소실시켰다.
      const migrationType =
        props.targetModel.migrationType ||
        (props.targetModel.cloudInfraModel ? 'infra' : 'software');
      const templateName =
        migrationType === 'software'
          ? 'migrate_software_workflow'
          : 'migrate_infra_workflow';
      const migrationTemplate =
        workflowToolModel.workflowStore.workflowTemplates.find(
          template => template.name === templateName,
        );
      if (migrationTemplate) {
        workflowToolModel.dropDownModel.selectedItemId = migrationTemplate.id;
      } else {
        console.warn(`${templateName} template not found`);
      }
      // 템플릿 로드 → 시퀀스 구성 → (loadSequence 끝에서) 타깃 모델 주입.
      load();
    } else if (props.toolType === 'add') {
      // For add mode, use recommendedModel from props
      console.log('Add mode detected, using recommendedModel from props...');

      // Determine migrationType from props or default to 'infra'
      const migrationType = props.migrationType || 'infra';

      // Select appropriate workflow template based on migrationType
      if (migrationType === 'infra') {
        const infraTemplate =
          workflowToolModel.workflowStore.workflowTemplates.find(
            template => template.name === 'migrate_infra_workflow',
          );
        if (infraTemplate) {
          workflowToolModel.dropDownModel.selectedItemId = infraTemplate.id;
          console.log('Selected infra workflow template:', infraTemplate);
        }
      } else if (migrationType === 'software') {
        const softwareTemplate =
          workflowToolModel.workflowStore.workflowTemplates.find(
            template => template.name === 'migrate_software_workflow',
          );
        if (softwareTemplate) {
          workflowToolModel.dropDownModel.selectedItemId = softwareTemplate.id;
          console.log('Selected software workflow template:', softwareTemplate);
        }
      }

      if (props.recommendedModel) {
        console.log('RecommendedModel received:', props.recommendedModel);

        // Add migrationType to the recommended model
        const modelWithMigrationType = {
          ...props.recommendedModel,
          migrationType: migrationType,
        };

        console.log('Using recommended model with migrationType:', {
          recommendedModel: modelWithMigrationType,
          migrationType,
        });

        // Create task based on migrationType
        createTaskForModel(
          modelWithMigrationType,
          workflowToolModel.taskComponentList,
        );
      } else {
        console.warn('No recommendedModel provided for add mode');
      }

      // Load workflow after template selection
      load();
    } else {
      // No targetModel, load default
      load();
    }
  });
});
// resTaskComponentList가 로드된 후 task schema 로드
watch(
  () => resTaskComponentList.data,
  async newData => {
    if (!isSchemaLoaded.value && newData) {
      try {
        console.log('Loading task schemas from resTaskComponentList data...');
        console.log('resTaskComponentList.data:', newData);

        // API 응답 구조 확인
        if ((newData as any).responseData) {
          console.log('Using resTaskComponentList.data.responseData');
          loadTaskSchemasFromResponse(newData as any);
        } else if ((newData as any).value?.responseData) {
          console.log('Using resTaskComponentList.data.value.responseData');
          loadTaskSchemasFromResponse((newData as any).value);
        } else {
          console.log('Unexpected data structure, calling API...');
          await loadAllTaskSchemas();
        }

        console.log('Task schemas loaded successfully in WorkflowEditor');
      } catch (error) {
        console.error('Failed to load task schemas in WorkflowEditor:', error);
      }
    }
  },
  { immediate: true },
);

onMounted(async () => {
  // Task schema가 아직 로드되지 않았다면 API 호출
  if (!isSchemaLoaded.value) {
    try {
      console.log('No existing data, calling API...');
      await loadAllTaskSchemas();
      console.log('Task schemas loaded successfully in WorkflowEditor');
    } catch (error) {
      console.error('Failed to load task schemas in WorkflowEditor:', error);
    }
  }
});

async function load() {
  loading.value = true;

  // Only load workflow if no targetModel or if targetModel template selection is already done
  if (!props.targetModel || workflowToolModel.dropDownModel.selectedItemId) {
    await loadWorkflow();
    loadSequence();
  }

  loading.value = false;
}

/** targetModel에서 진입시 targetModel의 특정 정보를 가지고 있어야한다는 요구사항에 의한 함수 */
function mapTargetModelToTaskComponent(
  targetModel: ITargetModelResponse,
  taskComponentList: Array<ITaskComponentInfoResponse>,
) {
  // Determine if this is infra or software model based on migrationType
  let isInfraModel = false;
  let isSoftwareModel = false;

  // Check if migrationType is available
  if (targetModel.migrationType) {
    isInfraModel = targetModel.migrationType === 'infra';
    isSoftwareModel = targetModel.migrationType === 'software';
    console.log('mapTargetModelToTaskComponent - Using migrationType:', {
      migrationType: targetModel.migrationType,
      isInfraModel,
      isSoftwareModel,
    });
  } else {
    // Fallback to existing logic based on cloudInfraModel
    isInfraModel = !!targetModel.cloudInfraModel && targetModel.isCloudModel;
    isSoftwareModel = !targetModel.cloudInfraModel && targetModel.isCloudModel;
    console.log('mapTargetModelToTaskComponent - Using fallback logic:', {
      isInfraModel,
      isSoftwareModel,
    });
  }

  console.log('mapTargetModelToTaskComponent - Final model type:', {
    isInfraModel,
    isSoftwareModel,
    targetModel,
  });

  let taskComponentName = '';
  let taskComponent: ITaskComponentInfoResponse | undefined = undefined;

  if (isInfraModel) {
    // Use infra migration task for infra models
    taskComponentName = 'beetle_task_infra_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
    console.log('Using infra migration task component:', taskComponent);
  } else if (isSoftwareModel) {
    // Use software migration task for software models
    taskComponentName = 'grasshopper_task_software_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
    console.log('Using software migration task component:', taskComponent);
  } else {
    console.warn('Unknown model type, using default infra migration task');
    taskComponentName = 'beetle_task_infra_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
  }

  if (!taskComponent) {
    console.error(`Task component '${taskComponentName}' not found`);
    throw new Error(`Task component '${taskComponentName}' not found`);
  }

  const taskGroup = workflowToolModel
    .toolboxSteps()
    .defineTaskGroupStep(getRandomId(), 'TaskGroup', 'MCI', { model: {} });

  const parseString = parseRequestBody(taskComponent.data.options.request_body);

  if (isInfraModel && targetModel?.cloudInfraModel?.targetInfra) {
    // Handle infra model data - use targetInfra from cloudInfraModel
    console.log(
      'Processing infra model with targetInfra:',
      targetModel.cloudInfraModel.targetInfra,
    );

    if (parseString) {
      // Set the targetInfra data directly
      parseString['targetInfra'] = targetModel.cloudInfraModel.targetInfra;

      // Also set other related infra data if available
      if (targetModel.cloudInfraModel.targetSecurityGroupList) {
        parseString['targetSecurityGroupList'] =
          targetModel.cloudInfraModel.targetSecurityGroupList;
      }
      if (targetModel.cloudInfraModel.targetSshKey) {
        parseString['targetSshKey'] = targetModel.cloudInfraModel.targetSshKey;
      }
      if (targetModel.cloudInfraModel.targetVNet) {
        parseString['targetVNet'] = targetModel.cloudInfraModel.targetVNet;
      }
      if (targetModel.cloudInfraModel.targetOsImageList) {
        parseString['targetOsImageList'] =
          targetModel.cloudInfraModel.targetOsImageList;
      }
      if (targetModel.cloudInfraModel.targetSpecList) {
        parseString['targetSpecList'] =
          targetModel.cloudInfraModel.targetSpecList;
      }
    }
    console.log('Processed infra model data:', parseString);
  } else if (isSoftwareModel && (targetModel as any)?.targetSoftwareModel) {
    // Handle software model data - use targetSoftwareModel
    const targetSoftwareModel = (targetModel as any).targetSoftwareModel;
    console.log(
      'Processing software model with targetSoftwareModel:',
      targetSoftwareModel,
    );

    if (parseString) {
      // Set the targetSoftwareModel data directly
      parseString['targetSoftwareModel'] = targetSoftwareModel;

      // Also set other related software data if available
      if (targetSoftwareModel.softwareList) {
        parseString['softwareList'] = targetSoftwareModel.softwareList;
      }
      if (targetSoftwareModel.targetSpecList) {
        parseString['targetSpecList'] = targetSoftwareModel.targetSpecList;
      }
      if (targetSoftwareModel.targetOsImageList) {
        parseString['targetOsImageList'] =
          targetSoftwareModel.targetOsImageList;
      }
      if (targetSoftwareModel.targetSecurityGroupList) {
        parseString['targetSecurityGroupList'] =
          targetSoftwareModel.targetSecurityGroupList;
      }
      if (targetSoftwareModel.targetSshKey) {
        parseString['targetSshKey'] = targetSoftwareModel.targetSshKey;
      }
      if (targetSoftwareModel.targetVNet) {
        parseString['targetVNet'] = targetSoftwareModel.targetVNet;
      }

      // Set basic model information
      parseString['softwareModel'] = {
        id: targetModel.id,
        name: targetModel.userModelName,
        description: targetModel.description,
        csp: targetModel.csp,
        region: targetModel.region,
        zone: targetModel.zone,
      };
    }
    console.log('Processed software model data:', parseString);
  }

  // Set path_params and query_params from task component with nsId default value.
  // ★ 스키마 properties의 description은 *설명(placeholder)*이지 값이 아니다. 값은 비워 두어
  //   자동 생성 task가 백엔드 기본값을 쓰거나(선택 파라미터) 사용자가 채우게 한다.
  //   (과거 description을 값으로 넣어 예: cm-beetle 마이그레이션 nameSeed=<설명문>이 되어 400 — BAR-1393)
  const pathParamsKeyValue = taskComponent?.data.path_params?.properties
    ? Object.entries(taskComponent.data.path_params.properties).reduce(
        (acc, [key]) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  const queryParamsKeyValue = taskComponent?.data.query_params?.properties
    ? Object.entries(taskComponent.data.query_params.properties).reduce(
        (acc, [key]) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  // Set nsId to DEFAULT_NAMESPACE if it exists in path_params or query_params
  let pathParams =
    Object.keys(pathParamsKeyValue).length > 0 ? pathParamsKeyValue : null;
  let queryParams =
    Object.keys(queryParamsKeyValue).length > 0 ? queryParamsKeyValue : null;

  if (pathParams && 'nsId' in pathParams) {
    pathParams = { ...pathParams, nsId: DEFAULT_NAMESPACE };
  }
  if (queryParams && 'nsId' in queryParams) {
    queryParams = { ...queryParams, nsId: DEFAULT_NAMESPACE };
  }

  const task: ITaskResponse = {
    dependencies: [],
    name: taskComponentName,
    path_params: pathParams,
    query_params: queryParams,
    request_body: JSON.stringify(parseString),
    id: '',
    task_component: taskComponentName,
  };

  const step = workflowToolModel.convertToDesignerTask(task, task.request_body);

  // ❌ CRITICAL FIX: Do NOT overwrite step.properties.model with schema!
  // step.properties.model should contain actual DATA (from parseString), not SCHEMA
  // TaskComponentEditor will get schema from step.properties.taskComponentData (set in editorProviders)
  //
  // Previously this was causing schema to be saved in request_body instead of actual data:
  // if (taskComponent.data.body_params && Object.keys(taskComponent.data.body_params).length > 0) {
  //   step.properties.model = taskComponent.data.body_params;  // ❌ This overwrites DATA with SCHEMA!
  // }

  console.log('✅ step.properties.model contains actual data (not schema):', {
    modelKeys: Object.keys(step.properties.model || {}),
    modelSample: JSON.stringify(step.properties.model).substring(0, 200),
  });

  taskGroup.sequence?.push(step);
  sequentialSequence.value = [taskGroup];

  console.log('Created workflow sequence with task:', {
    taskGroup,
    step,
    sequence: sequentialSequence.value,
  });
}

/** Add 모드에서 GetModels API 결과를 사용하여 task를 생성하는 함수 */
function createTaskForModel(
  targetModel: ITargetModelResponse,
  taskComponentList: Array<ITaskComponentInfoResponse>,
) {
  // Determine if this is infra or software model based on migrationType
  let isInfraModel = false;
  let isSoftwareModel = false;

  // Check if migrationType is available
  if (targetModel.migrationType) {
    isInfraModel = targetModel.migrationType === 'infra';
    isSoftwareModel = targetModel.migrationType === 'software';
    console.log('createTaskForModel - Using migrationType:', {
      migrationType: targetModel.migrationType,
      isInfraModel,
      isSoftwareModel,
    });
  } else {
    // Fallback to existing logic based on cloudInfraModel
    isInfraModel = !!targetModel.cloudInfraModel && targetModel.isCloudModel;
    isSoftwareModel = !targetModel.cloudInfraModel && targetModel.isCloudModel;
    console.log('createTaskForModel - Using fallback logic:', {
      isInfraModel,
      isSoftwareModel,
    });
  }

  console.log('createTaskForModel - Final model type:', {
    isInfraModel,
    isSoftwareModel,
    targetModel,
  });

  let taskComponentName = '';
  let taskComponent: ITaskComponentInfoResponse | undefined = undefined;

  if (isInfraModel) {
    // Use infra migration task for infra models
    taskComponentName = 'beetle_task_infra_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
    console.log('Using infra migration task component:', taskComponent);
  } else if (isSoftwareModel) {
    // Use software migration task for software models
    taskComponentName = 'grasshopper_task_software_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
    console.log('Using software migration task component:', taskComponent);
  } else {
    console.warn('Unknown model type, using default infra migration task');
    taskComponentName = 'beetle_task_infra_migration';
    taskComponent = taskComponentList.find(
      taskComponent => taskComponent.name === taskComponentName,
    );
  }

  if (!taskComponent) {
    console.error(`Task component '${taskComponentName}' not found`);
    throw new Error(`Task component '${taskComponentName}' not found`);
  }

  const taskGroup = workflowToolModel
    .toolboxSteps()
    .defineTaskGroupStep(getRandomId(), 'TaskGroup', 'MCI', { model: {} });

  const parseString = parseRequestBody(taskComponent.data.options.request_body);

  if (isInfraModel && targetModel?.cloudInfraModel?.targetInfra) {
    // Handle infra model data - use targetInfra from cloudInfraModel
    console.log(
      'Processing infra model with targetInfra:',
      targetModel.cloudInfraModel.targetInfra,
    );

    if (parseString) {
      // Set the targetInfra data directly
      parseString['targetInfra'] = targetModel.cloudInfraModel.targetInfra;

      // Also set other related infra data if available
      if (targetModel.cloudInfraModel.targetSecurityGroupList) {
        parseString['targetSecurityGroupList'] =
          targetModel.cloudInfraModel.targetSecurityGroupList;
      }
      if (targetModel.cloudInfraModel.targetSshKey) {
        parseString['targetSshKey'] = targetModel.cloudInfraModel.targetSshKey;
      }
      if (targetModel.cloudInfraModel.targetVNet) {
        parseString['targetVNet'] = targetModel.cloudInfraModel.targetVNet;
      }
      if (targetModel.cloudInfraModel.targetOsImageList) {
        parseString['targetOsImageList'] =
          targetModel.cloudInfraModel.targetOsImageList;
      }
      if (targetModel.cloudInfraModel.targetSpecList) {
        parseString['targetSpecList'] =
          targetModel.cloudInfraModel.targetSpecList;
      }
    }
    console.log('Processed infra model data:', parseString);
  } else if (isSoftwareModel && (targetModel as any)?.targetSoftwareModel) {
    // Handle software model data - use targetSoftwareModel
    const targetSoftwareModel = (targetModel as any).targetSoftwareModel;
    console.log(
      'Processing software model with targetSoftwareModel:',
      targetSoftwareModel,
    );

    if (parseString) {
      // Set the targetSoftwareModel data directly
      parseString['targetSoftwareModel'] = targetSoftwareModel;

      // Also set other related software data if available
      if (targetSoftwareModel.softwareList) {
        parseString['softwareList'] = targetSoftwareModel.softwareList;
      }
      if (targetSoftwareModel.targetSpecList) {
        parseString['targetSpecList'] = targetSoftwareModel.targetSpecList;
      }
      if (targetSoftwareModel.targetOsImageList) {
        parseString['targetOsImageList'] =
          targetSoftwareModel.targetOsImageList;
      }
      if (targetSoftwareModel.targetSecurityGroupList) {
        parseString['targetSecurityGroupList'] =
          targetSoftwareModel.targetSecurityGroupList;
      }
      if (targetSoftwareModel.targetSshKey) {
        parseString['targetSshKey'] = targetSoftwareModel.targetSshKey;
      }
      if (targetSoftwareModel.targetVNet) {
        parseString['targetVNet'] = targetSoftwareModel.targetVNet;
      }

      // Set basic model information
      parseString['softwareModel'] = {
        id: targetModel.id,
        name: targetModel.userModelName,
        description: targetModel.description,
        csp: targetModel.csp,
        region: targetModel.region,
        zone: targetModel.zone,
      };
    }
    console.log('Processed software model data:', parseString);
  }

  // Set path_params and query_params from task component with nsId default value.
  // ★ 스키마 properties의 description은 *설명(placeholder)*이지 값이 아니다. 값은 비워 두어
  //   자동 생성 task가 백엔드 기본값을 쓰거나(선택 파라미터) 사용자가 채우게 한다.
  //   (과거 description을 값으로 넣어 예: cm-beetle 마이그레이션 nameSeed=<설명문>이 되어 400 — BAR-1393)
  const pathParamsKeyValue = taskComponent?.data.path_params?.properties
    ? Object.entries(taskComponent.data.path_params.properties).reduce(
        (acc, [key]) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  const queryParamsKeyValue = taskComponent?.data.query_params?.properties
    ? Object.entries(taskComponent.data.query_params.properties).reduce(
        (acc, [key]) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  // Set nsId to DEFAULT_NAMESPACE if it exists in path_params or query_params
  let pathParams =
    Object.keys(pathParamsKeyValue).length > 0 ? pathParamsKeyValue : null;
  let queryParams =
    Object.keys(queryParamsKeyValue).length > 0 ? queryParamsKeyValue : null;

  if (pathParams && 'nsId' in pathParams) {
    pathParams = { ...pathParams, nsId: DEFAULT_NAMESPACE };
  }
  if (queryParams && 'nsId' in queryParams) {
    queryParams = { ...queryParams, nsId: DEFAULT_NAMESPACE };
  }

  const task: ITaskResponse = {
    dependencies: [],
    name: taskComponentName,
    path_params: pathParams,
    query_params: queryParams,
    request_body: JSON.stringify(parseString),
    id: '',
    task_component: taskComponentName,
  };

  const step = workflowToolModel.convertToDesignerTask(task, task.request_body);

  // ❌ CRITICAL FIX: Do NOT overwrite step.properties.model with schema!
  // step.properties.model should contain actual DATA (from parseString), not SCHEMA
  // TaskComponentEditor will get schema from step.properties.taskComponentData (set in editorProviders)
  //
  // Previously this was causing schema to be saved in request_body instead of actual data:
  // if (taskComponent.data.body_params && Object.keys(taskComponent.data.body_params).length > 0) {
  //   step.properties.model = taskComponent.data.body_params;  // ❌ This overwrites DATA with SCHEMA!
  // }

  console.log('✅ step.properties.model contains actual data (not schema):', {
    modelKeys: Object.keys(step.properties.model || {}),
    modelSample: JSON.stringify(step.properties.model).substring(0, 200),
  });

  taskGroup.sequence?.push(step);
  sequentialSequence.value = [taskGroup];

  console.log('Created workflow sequence with task:', {
    taskGroup,
    step,
    sequence: sequentialSequence.value,
  });
}

/*
  이 편집기로 들어오는 길과, 그때 **엔진에서 워크플로우를 읽어야 하는가**

  | 들어온 길 | toolType | 무엇으로 그리나 | 기다림 |
  |---|---|---|---|
  | 실행 상태 → Edit (미실행 원본) | edit | 스토어(목록에서 이미 받음) → 없으면 엔진 | 필요 |
  | 실행 상태 → Clone & Edit | edit | 스토어(복제 응답을 바로 넣어 둔다) | 사실상 즉시 |
  | JSON 으로 만든 워크플로우를 나중에 열기 | edit | 스토어 → 없으면 엔진 | 필요 |
  | 타깃 모델에서 진입 | add | 템플릿 | 불필요 |
  | 목록의 새로 만들기(지금은 막혀 있다) | add | 템플릿 | 불필요 |

  기다림이 필요한 것은 **`edit` 하나뿐**이다 — `add` 는 기존 워크플로우를 읽지 않고
  템플릿으로 그리므로 엔진 상태와 무관하다. 그래서 대기도 이 분기 안에만 둔다.
*/
async function loadWorkflow() {
  if (props.toolType === 'edit') {
    // 캐시에 없으면 스토어가 받아서 채운다. 목록 화면을 거치지 않고 열린 워크플로우
    // (예: 방금 만든 복제본)도 이 경로로 정상 로드된다.
    workflowData.value = await fetchWorkflowForEdit();
    workflowLoadState.value = workflowData.value ? 'ok' : 'failed';
    if (!workflowData.value) return;
    // 실행 이력이 있으면 보여주기만 한다. 정상 경로(실행 상태 화면)는 이력이 있는
    // 워크플로우를 아예 여기로 보내지 않으므로, 이것은 뒤에 다른 진입이 생겨도
    // 뚫리지 않게 하는 안전망이다.
    isRunLocked.value = await hasWorkflowRunHistory(props.wftId);
  } else if (props.toolType === 'add') {
    workflowData.value = workflowToolModel.getWorkflowTemplateData(
      workflowToolModel.dropDownModel.selectedItemId,
    );
  }

  // Set workflow name and description
  if (props.toolType === 'add') {
    // For add mode, set default name based on migrationType
    const defaultName =
      props.migrationType === 'infra'
        ? 'Infra Migration Workflow'
        : 'Software Migration Workflow';
    workflowName.value.value = workflowData.value?.name || defaultName;
  } else {
    workflowName.value.value = workflowData.value?.name || '';
  }

  workflowDescription.value.value = workflowData.value?.description || '';

  console.log('loadWorkflow - Set workflow name:', {
    toolType: props.toolType,
    migrationType: props.migrationType,
    workflowName: workflowName.value.value,
    workflowDataName: workflowData.value?.name,
  });
}

function loadSequence() {
  if (workflowData.value) {
    const loaded = workflowToolModel.convertCicadaToDesignerFormData(
      workflowData.value,
      resTaskComponentList.data.value?.responseData!,
    );
    sequentialSequence.value = loaded.sequence;
    // 그릴 수 없는 모양이면 빈 화면 대신 이유를 내놓는다. 억지로 펴서 보여주면
    // 저장하는 순간 없던 의존 관계가 생겨 워크플로우가 조용히 바뀐다.
    isUneditable.value = loaded.representable === false;
    loadWarnings.value = loaded.warnings ?? [];
    // 타깃 모델에서 진입한 경우, 조회 task 에 타깃 모델 id 를, 마이그레이션 task 에 리터럴 본문을 주입한다.
    // 시퀀스를 세운 직후(디자이너 렌더 전) 주입하므로 저장 시 그대로 반영된다.
    if (props.targetModel) {
      injectTargetModelIntoSequence();
    }
  }
}

/**
 * 타깃 모델 흐름 전용 주입 — 로드된 템플릿 시퀀스에서
 *  ① 조회 task(damselfly_task_get_cloud_infra_model / _get_target_software_model)의
 *     path_params.id 를 선택한 타깃 모델 id 로 채우고,
 *  ② 마이그레이션 task(beetle_task_infra_migration / grasshopper_task_software_migration)의
 *     본문(model)을 타깃 모델의 리터럴 값으로 덮어써, 참조가 아니라 실제 값이 저장되게 한다.
 * 나머지 task(sleep/install_docker/email 등)는 템플릿 그대로 둔다.
 *
 * ②가 리터럴이면 ①의 조회 결과는 실제로 쓰이지 않지만, 템플릿 구조상 ①도 성공해야 실행이 끝나므로
 * 유효한 타깃 모델 id 를 넣어 둔다(하드코딩된 예시 id 를 그대로 저장하던 문제도 함께 해소).
 */
function injectTargetModelIntoSequence() {
  const tm = props.targetModel;
  if (!tm) return;
  const isInfra =
    tm.migrationType === 'infra' ||
    (!!tm.cloudInfraModel && tm.migrationType !== 'software');
  const lookupComponent = isInfra
    ? 'damselfly_task_get_cloud_infra_model'
    : 'damselfly_task_get_target_software_model';
  const migrationComponent = isInfra
    ? 'beetle_task_infra_migration'
    : 'grasshopper_task_software_migration';
  /*
    두 마이그레이션의 본문 형태가 다르다 — 같은 모양으로 넣으면 안 된다.
     - 인프라(beetle): cloudInfraModel 의 *내용*(targetInfra/targetVNet 등)이 곧 본문이다.
     - 소프트웨어(grasshopper): 본문을 `targetSoftwareModel` 로 한 겹 *감싼* 형태로 받는다
       (smdl `TargetSoftwareModel{ TargetSoftwareModel ... json:"targetSoftwareModel" }`).
    안쪽 객체({servers:[...]})만 넣으면 grasshopper 가 servers 를 빈 값으로 바인딩해
    아무 소프트웨어도 처리하지 않은 채 200 + execution_id 를 돌려준다. 그러면 태스크는
    성공으로 보이는데 결과(target_mappings)는 비어 원인을 찾기 어렵다.
  */
  const softwareModel = (tm as any).targetSoftwareModel;
  const literalBody = isInfra
    ? tm.cloudInfraModel
    : softwareModel
      ? { targetSoftwareModel: softwareModel }
      : undefined;

  const visit = (steps: any[] | undefined) => {
    for (const step of steps ?? []) {
      const component = step?.properties?.originalData?.task_component;
      if (component === lookupComponent) {
        step.properties.fixedModel = step.properties.fixedModel ?? {
          path_params: {},
          query_params: {},
        };
        step.properties.fixedModel.path_params = {
          ...(step.properties.fixedModel.path_params ?? {}),
          id: tm.id,
        };
      } else if (component === migrationComponent && literalBody) {
        // 참조 본문 대신 타깃 모델의 리터럴 값을 넣는다(우측 테이블도 이 값으로 채워진다).
        step.properties.model = { ...literalBody };
      }
      if (step?.sequence) visit(step.sequence);
    }
  };
  visit(sequentialSequence.value);
}

function getCicadaData(designer: Designer | null): IWorkflow {
  const workflow: IWorkflow = {
    created_at: '',
    data: { description: '', task_groups: [] },
    description: '',
    id: '',
    name: '',
    updated_at: '',
  };
  if (designer) {
    try {
      const definition = designer.getDefinition();
      console.log('=== getCicadaData Debug ===');
      console.log('Definition sequence:', definition.sequence);
      console.log('Sequence length:', definition.sequence.length);

      // Detailed step analysis
      definition.sequence.forEach((step: any, index: number) => {
        console.log(`Step ${index}:`, {
          name: step.name,
          type: step.type,
          properties: step.properties,
          'properties.model': step.properties?.model,
          'properties.fixedModel': step.properties?.fixedModel,
          'properties.originalData': step.properties?.originalData,
        });

        // Check nested sequences (like TaskGroup)
        if (step.sequence && step.sequence.length > 0) {
          console.log(`  Nested sequence (${step.sequence.length} items):`);
          step.sequence.forEach((nestedStep: any, nestedIndex: number) => {
            console.log(`    Nested step ${nestedIndex}:`, {
              name: nestedStep.name,
              type: nestedStep.type,
              'properties.model': nestedStep.properties?.model,
              'properties.fixedModel': nestedStep.properties?.fixedModel,
              'properties.originalData': nestedStep.properties?.originalData,
              'fixedModel.request_body':
                nestedStep.properties?.fixedModel?.request_body,
            });

            // Log request_body if exists
            if (nestedStep.properties?.fixedModel?.request_body) {
              try {
                const requestBody =
                  typeof nestedStep.properties.fixedModel.request_body ===
                  'string'
                    ? JSON.parse(nestedStep.properties.fixedModel.request_body)
                    : nestedStep.properties.fixedModel.request_body;
                console.log('    Request body parsed:', requestBody);
                console.log('    Request body keys:', Object.keys(requestBody));
              } catch (e) {
                console.log(
                  '    Request body (raw):',
                  nestedStep.properties.fixedModel.request_body,
                );
              }
            }
          });
        }
      });

      Object.assign(workflow, {
        data: {
          description: '',
          task_groups: workflowToolModel.convertDesignerSequenceToCicada(
            definition.sequence as Step[],
          ),
        },
        description: workflowDescription.value.value,
        id: '',
        name: workflowName.value.value,
      });

      console.log('Converted workflow data:', workflow.data);
      console.log('Task groups:', workflow.data.task_groups);
      console.log('===========================');
    } catch (e: any) {
      showErrorMessage('Error', e);
    }
  }
  return workflow;
}

function postWorkflow(workflow: IWorkflow) {
  console.log('postWorkflow - workflow data:', {
    toolType: props.toolType,
    workflowName: workflow.name,
    workflowData: workflow.data,
    workflowDescription: workflow.description,
  });

  if (props.toolType === 'edit') {
    resUpdateWorkflow
      .execute({
        pathParams: {
          wfId: props.wftId,
        },
        request: {
          data: workflow.data,
          name: workflow.name,
          spec_version: '1.0', // Add spec_version
          nsId: DEFAULT_NAMESPACE, // Add namespace ID
        } as any, // Type assertion for additional parameters
      })
      .then(res => {
        showSuccessMessage('Success', 'Success');
        emit('update:trigger');
        emit('update:close-modal', false); // 저장 성공 후 모달 닫기
        // 저장 다음에 하는 일은 대개 실행이다. 어느 워크플로우를 저장했는지 알려
        // 화면이 그 워크플로우의 실행 상태로 옮겨 가게 한다.
        emit('update:saved', props.wftId);
      })
      .catch(err => {
        showErrorMessage(
          'Error',
          toErrorMessage(err, 'Failed to process the workflow.'),
        );
      });
  } else if (props.toolType === 'add') {
    resAddWorkFlow
      .execute({
        request: {
          data: workflow.data,
          name: workflow.name,
          spec_version: '1.0', // Add spec_version
          nsId: DEFAULT_NAMESPACE, // Add namespace ID
        } as any, // Type assertion for additional parameters
      })
      .then(res => {
        showSuccessMessage('Success', 'Success');
        emit('update:trigger');
        emit('update:close-modal', false); // 저장 성공 후 모달 닫기
        // 새로 만든 워크플로우의 id 는 응답에서만 알 수 있다. 복제 API 와 같은 모양으로
        // 워크플로우 전체를 돌려준다. **id 가 없으면 옮기지 않는다** — 엉뚱한
        // 워크플로우의 실행 상태를 보여주느니 있던 화면에 머무는 편이 낫다.
        const createdId = res?.data?.responseData?.id;
        if (createdId) emit('update:saved', createdId);
      })
      .catch(err => {
        showErrorMessage(
          'Error',
          toErrorMessage(err, 'Failed to process the workflow.'),
        );
      });
  }
}

function handleSaveCallback(designer: Designer | null) {
  trigger.value = false;
  try {
    const definition = designer?.getDefinition();
    const problems = workflowToolModel.validateDesignerSequence(
      (definition?.sequence ?? []) as Step[],
    );
    if (problems.length) {
      showErrorMessage('Cannot save', problems.join('\n'));
      return;
    }

    // 틀리지는 않지만 만들다 만 것으로 보이는 상태는 저장은 하되 짚어 준다.
    // 화면을 닫으면 그림은 사라지고 저장된 선만 남기 때문이다.
    const notices = workflowToolModel.reviewDesignerSequence(
      (definition?.sequence ?? []) as Step[],
    );
    if (notices.length) {
      showInfoMessage('Check the parallel steps', notices.join('\n'));
    }

    const cicadaData = getCicadaData(designer);
    postWorkflow(cicadaData);
  } catch (e) {
    console.log(e);
  }
}

function handleCancel() {
  emit('update:close-modal', false);
  // emit('update:trigger');
}

function handleSave() {
  if (isUneditable.value || isRunLocked.value) return;
  // 읽지 못한 상태로 저장하면 빈 정의를 덮어쓴다
  if (workflowLoadState.value !== 'ok') return;
  trigger.value = true;
}

function handleSelectTemplate(e) {
  workflowToolModel.dropDownModel.selectedItemId = e;
  load();
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      title="Workflow Tool"
      :need-widget-layout="false"
      :loading="loading"
      @update:modal-state="handleCancel"
    >
      <template #add-content="{ loading }">
        <div v-if="!loading" class="workflow-tool-modal-page w-full">
          <header class="h-[54px] workflow-tool-header mb-[16px]">
            <PFieldGroup class="flex-1" :label="'Workflow Name'" required>
              <p-text-input
                v-model="workflowName.value.value"
                data-testid="workflow-name-input"
                block
              />
            </PFieldGroup>
            <PFieldGroup class="flex-1" :label="'Description'">
              <p-text-input v-model="workflowDescription.value.value" block />
            </PFieldGroup>
            <!--
              병렬은 팔레트에서 명시적으로 꺼내 써야 하고, 좌우 배치는 병렬 상자
              안에서만 된다. 처음 쓰는 사람이 그 규칙을 알 길이 화면에 없어서
              가이드로 연결한다.
            -->
            <PFieldGroup class="flex-1" :label="'Workflow Template'" required>
              <p-select-dropdown
                class="w-full"
                data-testid="workflow-template-select"
                :menu="workflowToolModel.dropDownModel.data"
                :disabled="props.toolType !== 'add'"
                @select="handleSelectTemplate"
              />
            </PFieldGroup>
            <button
              type="button"
              class="workflow-tool-help"
              data-testid="workflow-parallel-guide-link"
              @click="openDocLink(DOC_LINKS.workflowParallelSteps)"
            >
              How to run tasks in parallel
            </button>
          </header>
          <div
            v-if="loadWarnings.length"
            class="workflow-tool-notice mb-[12px]"
          >
            <p class="workflow-tool-notice__title">
              {{
                isUneditable
                  ? 'This workflow cannot be opened in the graphical editor'
                  : 'Check this workflow'
              }}
            </p>
            <ul>
              <li v-for="(warning, i) in loadWarnings" :key="i">
                {{ warning }}
              </li>
            </ul>
          </div>
          <!--
            실행된 적 있는 워크플로우가 어떤 경로로든 열렸을 때. 고칠 수 없다는 것과
            어떻게 하면 되는지를 함께 알린다.
          -->
          <div
            v-if="isRunLocked"
            class="workflow-tool-notice workflow-tool-notice--locked mb-[12px]"
            data-testid="workflow-run-locked-notice"
          >
            <p class="workflow-tool-notice__title">
              View only — this workflow has been run
            </p>
            <ul>
              <li>
                Editing it in place would change what its past runs appear to
                have used, and that cannot be undone.
              </li>
              <li>
                To work on it, go to Run Status and use Clone &amp; Edit. The
                copy keeps a link back to this workflow.
              </li>
            </ul>
          </div>
          <!--
            아직 읽어 오지 못한 상태. **왜 늦는지는 적지 않는다** — 여기까지 오는 길이
            여럿이라(복제본·타깃 모델·새로 만들기·JSON 으로 만든 것 열기) 화면이 원인을
            단정할 수 없다. 기다리는 중이라는 사실만 알리고, 되면 그때 그린다.
          -->
          <div
            v-if="workflowLoadState === 'waiting'"
            class="workflow-tool-loading"
            data-testid="workflow-load-notice"
          >
            <p-spinner size="md" />
            <p>Getting this workflow ready…</p>
          </div>
          <div
            v-else-if="workflowLoadState === 'failed'"
            class="workflow-tool-notice mb-[12px]"
            data-testid="workflow-load-notice"
          >
            <p class="workflow-tool-notice__title">
              This workflow could not be read
            </p>
            <ul>
              <li>
                Nothing is shown rather than an empty canvas, because saving an
                empty canvas would wipe the workflow. Close this and open it
                again in a moment.
              </li>
            </ul>
          </div>
          <section
            v-if="!isUneditable && workflowLoadState === 'ok'"
            class="workflow-tool-body"
          >
            <SequentialDesigner
              :sequence="sequentialSequence"
              :readonly="isRunLocked"
              :trigger="trigger.value"
              :task-component-list="
                resTaskComponentList.data.value?.responseData
              "
              @getDesigner="handleSaveCallback"
            />
          </section>
        </div>
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          @click="emit('update:close-modal', false)"
        >
          Cancel
        </p-button>
        <p-button
          data-testid="workflow-designer-save"
          :loading="resUpdateWorkflow.isLoading.value"
          :disabled="isUneditable || isRunLocked || workflowLoadState !== 'ok'"
          @click="handleSave"
        >
          Save
        </p-button>
      </template>
    </create-form>
  </div>
</template>

<style scoped lang="postcss">
.workflow-tool-help {
  align-self: center;
  white-space: nowrap;
  text-decoration: underline;
  font-size: 0.8125rem;
  color: #6b7280;
}
.workflow-tool-help:hover {
  color: #1f2937;
}
.workflow-tool-notice {
  border-left: 4px solid #f0a020;
  background: #fff8e6;
  padding: 12px 16px;
  border-radius: 4px;
}
/* 고칠 수 없다는 것은 경고가 아니라 상태다 — 노란 경고와 색을 달리한다 */
.workflow-tool-notice--locked {
  border-left-color: #6b7280;
  background: #f3f4f6;
}
.workflow-tool-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 240px;
  color: #4b5563;
  font-size: 0.875rem;
}
.workflow-tool-notice__title {
  font-weight: 600;
  margin-bottom: 4px;
}
.workflow-tool-notice ul {
  list-style: disc;
  padding-left: 20px;
}

:deep(.workflow-tool-modal-page) {
  height: calc(100% - 7.4rem);
  max-height: calc(100% - 7.4rem);
}

.workflow-tool-header {
  @apply h-[54px] flex gap-[16px];
}

.workflow-tool-body {
  @apply h-[calc(100%-70px)];
}
</style>
