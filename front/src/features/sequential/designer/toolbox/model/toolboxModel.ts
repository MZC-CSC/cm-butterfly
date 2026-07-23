import { ITaskComponentInfoResponse } from '@/features/sequential/designer/toolbox/model/api';
import { parseRequestBody } from '@/shared/utils/stringToObject';
import getRandomId from '@/shared/utils/uuid';
import {
  fixedModel,
  Step,
} from '@/features/workflow/workflowEditor/model/types';
import { toolboxSteps } from '@/features/sequential/designer/toolbox/model/toolboxSteps';
import { ITaskResponse } from '@/entities';
import { toDesignerStepType } from '@/entities/workflow/lib/schemaAdapter';

export function useSequentialToolboxModel() {
  const loadStepsFunc = toolboxSteps();

  function getTaskComponentStep(
    taskComponentList: ITaskComponentInfoResponse[],
  ): Step[] {
    const convertedTackComponentList: Array<Step> = [];
    const taskComponentSteps: Step[] = [];
    taskComponentList.forEach((res: ITaskComponentInfoResponse) => {
      // use body_params as the schema, and parse options.request_body as the initial value
      console.log(`Processing ${res.name} - body_params check:`, {
        hasBodyParams: !!res.data.body_params,
        bodyParams: res.data.body_params,
        hasRequestBody: !!res.data.options.request_body,
        requestBody: res.data.options.request_body
      });
      
      // always parse options.request_body as the initial value, regardless of whether body_params exists
      const modelData = parseRequestBody(
        res.data.options.request_body || '{}'
      );
      
      console.log(`Final modelData for ${res.name}:`, modelData);

      // print model info to the console when a task component is dragged from the toolbox to the canvas
      console.log('=== Task Component Dragged from Toolbox ===');
      console.log(`Task Name: ${res.name}`);
      console.log(`Task ID: ${res.id}`);
      console.log('Model Information:', {
        bodyParams: res.data.body_params,
        requestBody: res.data.options.request_body,
        parsedModel: modelData,
        pathParams: res.data.path_params,
        queryParams: res.data.query_params,
        originalData: res
      });
      
      // print detailed body params model info
      if (res.data.body_params && res.data.body_params.properties) {
        console.log(`📋 ${res.name} Body Params Properties:`, res.data.body_params.properties);
        if (res.data.body_params.required) {
          console.log(`🔒 ${res.name} Required Fields:`, res.data.body_params.required);
        }
      }
      
      console.log('==========================================');

      taskComponentSteps.push(
        loadStepsFunc.defineBettleTaskStep(
          getRandomId(),
          res.name ?? 'undefined',  // name: show the original name in the toolbox; a unique name is generated automatically on canvas drop
          toDesignerStepType(res.name), // type: normalize to a valid swd format (the real name is preserved in name/originalData)
          {
            model: modelData,
            originalData: mappingTaskInfoResponseITaskResponse(res),
            fixedModel: getFixedModel(res),
            taskType: res.type ?? 'http', // cm-cicada task type (for selecting the per-type editor)
            taskComponentData: { ...res.data, spec: res.spec, type: res.type },
          },
        ),
      );
    });

    taskComponentSteps.forEach(step => {
      convertedTackComponentList.push(step);
    });

    return convertedTackComponentList;
  }

  function mappingTaskInfoResponseITaskResponse(
    taskInfoResponse: ITaskComponentInfoResponse,
  ): ITaskResponse {
    return {
      dependencies: [],
      name: taskInfoResponse.name,
      path_params: taskInfoResponse.data.options.path_params,
      request_body: taskInfoResponse.data.options.request_body,
      query_params: '',
      task_component: taskInfoResponse.name,
      type: taskInfoResponse.type ?? 'http',
      spec: taskInfoResponse.spec,
    };
  }

  function getFixedModel(task: ITaskComponentInfoResponse): fixedModel {
    // The description in schema properties is a *hint*, not a value. Leave the value as an empty string so
    // the user fills it in (manual task), or an auto-generated task uses the empty value → backend default.
 // (previously the description was stored as the value, e.g. beetle migration useExisting=<description text>, causing a 400)
    const pathParamsKeyValue = task?.data.path_params?.properties
      ? Object.entries(task.data.path_params?.properties).reduce(
          (acc, [key]) => {
            acc[key] = '';
            return acc;
          },
          {},
        )
      : {};

    const queryParamsKeyValue = task?.data.query_params?.properties
      ? Object.entries(task.data.query_params?.properties).reduce(
          (acc, [key]) => {
            acc[key] = '';
            return acc;
          },
          {},
        )
      : {};

    return {
      path_params: pathParamsKeyValue,
      query_params: queryParamsKeyValue,
    };
  }

  return {
    getTaskComponentStep,
    getFixedModel,
  };
}
