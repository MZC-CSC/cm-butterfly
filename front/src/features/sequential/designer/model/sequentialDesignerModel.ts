import {
  Designer,
  DesignerConfiguration,
  Sequence,
} from 'sequential-workflow-designer';
import { Definition, Step } from 'sequential-workflow-model';
import getRandomId from '@/shared/utils/uuid';
import { toolboxSteps } from '@/features/sequential/designer/toolbox/model/toolboxSteps';
import { editorProviders } from '@/features/sequential/designer/editor/model/editorProviders';
import testSvg from '@/shared/asset/image/testSvg.svg';
import {
  collectStepNames,
  nextAvailableName,
} from '@/entities/workflow/lib/stepNaming';

export function useSequentialDesignerModel(refs: any) {
  let designer: Designer | null = null;
  // 저장된 워크플로우를 올리는 동안에는 이름 짓기를 멈춘다
  let isLoading = false;
  const placeholder = refs.placeholder;
  const designerOptionsState: any = {
    id: '',
    name: '',
    sequence: [],
    others: {
      theme: 'light',
      isReadonly: false, // optional, default: false
      undoStackSize: 10, // optional, default: 0 - disabled, 1+ - enabled
      controlBar: true,
      contextMenu: true,
    },
    toolbox: {
      isCollapsed: false,
    },
    editors: {
      isCollapsed: true,
    },
  };
  let definition: Definition;
  let configuration: DesignerConfiguration<Definition>;
  let toolBoxGroup: Array<{ name: string; steps: Step[] }> = [
    {
      name: 'Tool',
      steps: [],
    },
    {
      name: 'taskGroup',
      steps: [],
    },
    {
      name: 'Components',
      steps: [],
    },
  ];

  function defineDefaultDefinition(workflowName: string, sequence: Step[]) {
    return {
      properties: {
        workflow: workflowName,
      },
      sequence: sequence,
    };
  }

  function defineStepEvent() {
    return {
      // all properties in this section are optional
      iconUrlProvider: (componentType: any, type: any) => {
        return testSvg;
      },
      //
      // isDraggable: (step, parentSequence) => {
      //   return step.name !== 'y';
      // },
      isDeletable: (step, parentSequence) => {
        return step.properties['isDeletable'];
      },
      isDuplicable: (step, parentSequence) => {
        return true;
      },
      canInsertStep: (step, targetSequence, targetIndex) => {
        // 저장된 워크플로우를 여는 중에는 이름을 건드리지 않는다. 다른 task 의 의존
        // 관계가 지금 이름을 가리키고 있으므로, 여기서 바꾸면 연결이 끊어진다.
        if (isLoading) return true;

        // 팔레트에서 갓 꺼낸 것인지(이름이 아직 종류 이름 그대로), 아니면 사람이
        // 지어 준 이름인지로 가른다. 후자는 겹칠 때만 손댄다.
        const taken = collectStepNames(definition?.sequence);
        const isFreshFromToolbox = step.name === step.type;

        if (isFreshFromToolbox || taken.has(step.name)) {
          step.name = nextAvailableName(step.name, taken);
        }
        return true;
      },
      // canMoveStep: (sourceSequence, step, targetSequence, targetIndex) => {
      //   return !step.properties['isLocked'];
      // },
      // canDeleteStep: (step, parentSequence) => {
      //   return confirm('Are you sure?');
      // },
    };
  }

  function defineStepValidate() {
    return {
      // 상자 하나를 두고 보는 검사. 저장 형식으로 옮길 수 없는 모양을 여기서 알린다.
      step: (step: any) => {
        if (step.componentType === 'task') {
          return String(step.name ?? '').trim().length > 0;
        }
        // 상자 안에 (몇 겹이든) task 가 하나도 없으면 저장되지 않는다.
        // 상자를 겹쳐 놓는 것 자체는 막지 않는다 — 저장되는 것은 선뿐이라
        // 겹친 모양에서 선만 뽑아내면 되기 때문이다.
        const countTasks = (node: any): number =>
          node.componentType === 'task'
            ? 1
            : (node.sequence ?? []).reduce(
                (sum: number, child: any) => sum + countTasks(child),
                0,
              );
        return countTasks(step) > 0;
      },
      // 전체를 두고 보는 검사 — 이름은 워크플로우 안에서 하나여야 한다
      root: (currentDefinition: any) => {
        const names: string[] = [];
        const walk = (steps: any[] | undefined) => {
          (steps ?? []).forEach(step => {
            if (step.componentType === 'task') names.push(step.name);
            walk(step.sequence);
          });
        };
        walk(currentDefinition?.sequence);
        return names.length > 0 && new Set(names).size === names.length;
      },
    };
  }

  function setToolboxGroupsSteps(
    toolSteps: Step[] | null,
    taskGroupSteps: Step[] | null,
    componentSteps: Step[],
  ) {
    toolBoxGroup = [
      // 'Tool' 묶음은 **한 번도 내용이 있었던 적이 없다** — 유일한 호출부가 늘
      // null 을 넘겨 왔고(SequentialDesigner.vue), 무엇을 담으려던 자리였는지도
      // 남아 있지 않다. 빈 묶음이 팔레트에 보이면 "여기 뭔가 있어야 하는데
      // 비었나" 하고 헷갈리므로 우선 감춘다. 쓸 일이 생기면 되살린다.
      // {
      //   name: 'Tool',
      //   steps: toolSteps ?? [],
      // },
      {
        // 묶음 이름이 'TaskGroup' 이면 그 안의 TaskGroup·Parallel 이 형제가 아니라
        // 상하 관계처럼 읽힌다. 둘 다 *실행 흐름을 만드는 상자* 라 Flow 로 묶는다.
        name: 'Flow',
        steps: taskGroupSteps ?? [
          toolboxSteps().defineTaskGroupStep(
            getRandomId(),
            'TaskGroup',
            'taskGroup',
            { model: {} },
          ),
          // 병렬 상자 — 안에 넣은 task 가 동시에 실행되고, 다음 단계는 전부
          // 끝나야 시작한다. 엔진은 원래 이렇게 실행할 수 있었는데 화면이
          // 만들지 못해 직선만 그려졌다.
          toolboxSteps().defineParrelStep(getRandomId(), 'Parallel', {
            model: {},
          }),
          // 조건 분기(If)는 엔진에 대응하는 개념이 없어 아직 내놓지 않는다.
        ],
      },
      {
        name: 'Components',
        steps: componentSteps,
      },
    ];
    // console.log(toolBoxGroup);
  }

  function loadConfiguration() {
    return {
      steps: defineStepEvent(),
      validator: defineStepValidate(),
      toolbox: {
        isCollapsed: designerOptionsState.toolbox.isCollapsed,
        groups: toolBoxGroup,
      },

      editors: {
        isCollapsed: designerOptionsState.editors.isCollapsed,
        rootEditorProvider: (definition, rootContext, isReadonly) => {
          designer?.setIsEditorCollapsed(true);
          return editorProviders().defaultRootEditorProvider(
            definition,
            rootContext,
            isReadonly,
          );
        },
        stepEditorProvider: (step, stepContext, definition, isReadonly) => {
          designer?.setIsEditorCollapsed(false);
          return editorProviders().defaultStepEditorProvider(
            step,
            stepContext,
            definition,
            isReadonly,
          );
        },
      },
      ...designerOptionsState.others,
    };
  }

  function setDefaultSequence(sequence: Sequence) {
    designerOptionsState.sequence = [...sequence];
  }

  function initDesigner() {
    if (designer) {
      designer.destroy();
    }
    definition = defineDefaultDefinition(
      designerOptionsState.name,
      designerOptionsState.sequence,
    );
    configuration = loadConfiguration();
  }

  function draw() {
    isLoading = true;
    designer = Designer.create(placeholder, definition, configuration);
    isLoading = false;
    designer.onDefinitionChanged.subscribe(newDefinition => {});
  }

  function getDesigner(): Designer | null {
    return designer;
  }

  return {
    designer,
    designerOptionsState,
    setDefaultSequence,
    setToolboxGroupsSteps,
    initDesigner,
    draw,
    getDesigner,
  };
}
