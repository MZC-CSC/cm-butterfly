import { useWorkflowStore } from '@/entities/workflow/model/stores.ts';
import {
  IWorkFlowDesignerFormData,
  Step,
} from '@/features/workflow/model/types.ts';
import {
  ITaskGroupResponse,
  ITaskResponse,
  IWorkflow,
} from '@/entities/workflow/model/types.ts';
import getRandomId from '@/shared/utils/uuid';

export function useWorkflowToolModel() {
  const workflowStore = useWorkflowStore();
  function getWorkflowToolData(
    type: 'template' | 'data' = 'data',
    workflowId: string,
  ) {
    let workflow;
    if (type === 'template') {
      workflow = workflowStore.getTemplateById(workflowId);
    } else {
      workflow = workflowStore.getWorkFlowById(workflowId);
    }

    if (workflow) {
      convertWorkFlowToDesignerFormData(workflow);
    }
  }

  function convertWorkFlowToDesignerFormData(
    workflow: IWorkflow,
  ): IWorkFlowDesignerFormData {
    const sequence: Step[] = [];

    // 스택에 부모 taskGroup과 현재 taskGroup을 함께 저장
    const stack: {
      parentTaskGroup: Step | null;
      currentTaskGroup: ITaskGroupResponse;
    }[] = workflow.data.task_groups.map(taskGroup => ({
      parentTaskGroup: null,
      currentTaskGroup: taskGroup,
    }));

    while (stack.length) {
      const { parentTaskGroup, currentTaskGroup } = stack.pop()!;

      const currentDesignerTaskGroup =
        convertToDesignerTaskGroup(currentTaskGroup);

      if (currentTaskGroup.tasks) {
        for (const task of currentTaskGroup.tasks) {
          const currentDesignerTask = convertToDesignerTask(task);
          currentDesignerTaskGroup.sequence!.push(currentDesignerTask);
        }
      }

      if (parentTaskGroup) {
        parentTaskGroup.sequence!.push(currentDesignerTaskGroup);
      } else {
        sequence.push(currentDesignerTaskGroup);
      }

      if (currentTaskGroup.task_groups) {
        for (const subTaskGroups of currentTaskGroup.task_groups) {
          stack.push({
            parentTaskGroup: currentDesignerTaskGroup,
            currentTaskGroup: subTaskGroups,
          });
        }
      }
    }

    return { sequence };
  }

  function convertToDesignerTask(task: ITaskResponse): Step {
    return {
      id: getRandomId(),
      name: task.name,
      componentType: 'task',
      type: 'bettle_task',
      properties: {
        isDeletable: true,
        mci: {
          name: task.request_body.name,
          description: task.request_body.description,
          vms: task.request_body.vm.map(vm => ({
            id: vm.label,
            name: vm.name,
            serverQuantity: vm.subGroupSize,
            commonSpec: vm.commonSpec,
            osImage: vm.commonImage,
            diskType: vm.rootDiskType,
            diskSize: vm.rootDiskSize,
            password: vm.vmUserPassword,
            connectionName: vm.connectionName,
          })),
        },
      },
    };
  }

  function convertToDesignerTaskGroup(taskGroup: ITaskGroupResponse): Step {
    return {
      id: getRandomId(),
      name: taskGroup.name,
      componentType: 'container',
      type: 'MCI',
      properties: {
        isDeletable: true,
      },
      sequence: [],
    };
  }

  return {
    getWorkflowToolData,
    setWorkflowSequenceModel: convertWorkFlowToDesignerFormData,
  };
}
