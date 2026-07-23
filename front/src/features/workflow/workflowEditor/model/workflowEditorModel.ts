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

    // Also save to the Workflow Store
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
   * Loads a saved workflow onto the canvas.
   *
   * The diagram is built from the **dependencies**, not the order the task_groups are
   * stored in. The engine runs by dependencies too, so this is what makes the on-screen
   * order match the actual execution order. Previously we just laid the groups out in
   * stored order, so a workflow saved as parallel silently appeared as a single line, and
   * saving it that way made the parallelism disappear.
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
      // If the diagram can't be drawn, don't build a canvas. Forcing it into a straight
      // line would create edges that weren't there the moment it's saved, silently
      // altering the workflow.
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
     * Turns a linear diagram into canvas steps.
     *
     * Items in the same group go into **one TaskGroup box**. Parallelism that branches
     * within it goes **inside** that same box too — a group is just a label, and a group
     * branching doesn't make it a different group. Previously we closed the box whenever we
     * hit parallelism, so **one group appeared split across two boxes.**
     *
     * A parallel box is not a group but a **branch marker**. So when it's inside a group
     * box, it isn't given the group name. On save, the tasks inside it are grouped under
     * the outer group name.
     */
    let parallelSeq = 0;
    const materialize = (
      items: ITopologyItem[],
      // Name of the group enclosing this line. If it's the same group, don't wrap another box.
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

      /** Where to place now — inside the open group box if there is one, otherwise outside */
      const place = (step: Step) => {
        if (openGroup) openGroup.sequence!.push(step);
        else out.push(step);
      };

      /** Keep the group this item belongs to open (leave it if the same group is already open) */
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

          // Inside a group box, the box already carries the group name. Only when it stands
          // alone outside do we attach the group name so there's something to group it under on save.
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
            // If a branch has just one item, place it as-is. If it has several, wrap them in
            // a box so they read as one line — the box is purely cosmetic and has no effect on execution.
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
    // Find the Task component info
    const taskComponent = taskComponentList.find(
      tc => tc.name === task.task_component,
    );

    // Determine the cm-cicada task type (used for the per-type editor and for generating the save spec)
    const taskType = task.type ?? taskComponent?.type ?? 'http';

    // For non-http types (bash/ssh/http_xcom/trigger_workflow), build the model directly from the spec
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
      // http: keep the existing request_body → model flow
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

    // If request_body was a cm-cicada runtime reference (and fell back to a skeleton in
    // getMapping... above), keep both the original reference string and the fallback
    // skeleton model. On save (convertToCicadaTaskWithDependencies), if the user didn't
    // touch the body, we re-emit the original reference as-is rather than overwriting it
    // with a skeleton literal ("{}" etc.), preserving cicada's output-injection semantics
    // (D-2 round trip).
    if (taskType === 'http' && isReferenceRequestBody(task.request_body)) {
      stepProperties.referenceRequestBody = task.request_body;
      stepProperties.referenceSkeletonModel = model;
    }

    // Add Task component data (schema info — for rendering the http form + showing type-specific fixed fields)
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

  /** `designerSerialize` handles the structural conversion; here we only build the contents of a single task. */
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

      // Generate the task spec from the cm-cicada Type/Spec schema (type-specific task-level fields)
      let spec: any;

      // D-2 round trip: if the original request_body was a runtime reference and the user
      // didn't touch the body (the current model is still the skeleton it fell back to on
      // load), re-emit the original reference string as-is rather than overwriting it with
      // a skeleton literal. This keeps the reference semantics by which cicada injects a
      // prior task's output.
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
    // request_body is one of:
    //  (a) empty string — use the component skeleton.
    //  (b) a cm-cicada runtime reference — injects a prior task's output. It comes as the
    //      task name itself, or (since v0.5.1) as "<task>.<jsonpath>" (e.g.
    //      "infra_recommend_get.cloudInfraModel") or "${...}". This string is not valid JSON.
    //  (c) an actual literal JSON body.
    //
    // (a) and (b) fall back to the component skeleton so the right-side form renders its
    // fields/values correctly, and only (c) is returned verbatim. Returning (b) as-is would
    // make parseRequestBody in convertToDesignerTask fail JSON.parse, leaving model as {}
    // and all values blank.
    //
    // The previous condition only checked for an "exact task name match" and missed dot-path
    // references (the .cloudInfraModel suffix). We now recognize references more broadly by
    // checking whether the reference head (the `<task>` part) matches a task name and whether
    // it isn't valid JSON.
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
