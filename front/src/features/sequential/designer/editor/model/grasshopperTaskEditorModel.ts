import { useInputModel } from '@/shared/hooks/input/useInputModel.ts';
import { ref, UnwrapRef } from 'vue';
import { isArray } from 'lodash';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';

interface fixedModel {
  path_params: Record<string, string>;
  query_params: Record<string, string>;
}

type EntityContext = {
  type: 'entity';
  context: {
    subject: 'Entity';
    values: Array<InputContext | KeyValueInputContext>;
  };
};

type InputContext = {
  type: 'input';
  context: {
    title: string;
    model: ReturnType<typeof useInputModel<string>>;
  };
};

type KeyValueInputContext = {
  type: 'keyValueInput';
  context: {
    title: ReturnType<typeof useInputModel<string>>;
    model: ReturnType<typeof useInputModel<string>>;
  };
};

type AccordionSlotContext = {
  header: {
    icon: string;
    title: string; // index
  };
  content: Array<InputContext>;
};

type AccordionContext = {
  type: 'accordion';
  context: {
    subject: string;
    values: Array<AccordionSlotContext>;
  };
  index: number;
  originalData: Array<any>;
};

type QueryParamsModel = {
  type: 'params';
  context: {
    subject: 'Query_Params';
    values: Array<InputContext>;
  };
};

type PathParamsModel = {
  type: 'params';
  context: {
    subject: 'Path_Params';
    values: Array<InputContext>;
  };
};

// Additional Context types
type NestedObjectContext = {
  type: 'nestedObject';
  context: {
    subject: string;
    values: Array<InputContext | NestedObjectContext | ArrayContext | ObjectArrayContext>;
  };
};

type ArrayContext = {
  type: 'array';
  context: {
    subject: string;
    values: Array<InputContext | NestedObjectContext | ArrayContext | ObjectArrayContext>;
  };
  originalData: Array<any>;
};

type ObjectArrayContext = {
  type: 'objectArray';
  context: {
    subject: string;
    values: Array<AccordionSlotContext>;
  };
  originalData: Array<any>;
};

type SoftwareModelContext = {
  type: 'softwareModel';
  context: {
    subject: 'Software Model';
    values: Array<InputContext>;
  };
};

type ConvertedData = EntityContext | AccordionContext | NestedObjectContext | ArrayContext | ObjectArrayContext | SoftwareModelContext;

export function useGrasshopperTaskEditorModel() {
  const formContext = ref<ConvertedData[]>([]);
  const paramsContext = ref<{
    path_params: PathParamsModel;
    query_params: QueryParamsModel;
  }>();
  const componentNameModel = ref();
  
  // Variable to hold originalObject
  let originalObject: any = null;

  function loadInputContext(
    key: string,
    value: string | '' | null,
    depth: number = 0,
    valueType: string = 'string',
  ): InputContext {
    const depthPrefix = '';
    return {
      type: 'input',
      context: {
        title: `${depthPrefix}${key}`,
        model: useInputModel(value ?? ''),
      },
    };
  }

  function loadKeyValueInputContext(): KeyValueInputContext {
    return {
      type: 'keyValueInput',
      context: {
        title: useInputModel(''),
        model: useInputModel(''),
      },
    };
  }

  function loadAccordionContext(
    object: object,
    index: number,
    depth: number = 0,
  ): AccordionSlotContext {
    return {
      header: {
        icon: 'ic_chevron-down',
        title: index.toString(),
      },
      content: Object.entries(object)
        .filter(([key, value]: [key: string, value: any]) => {
          // Handle both string and object types
          return typeof value === 'string' || (typeof value === 'object' && value !== null);
        })
        .map(([key, value]: [key: string, value: any]) => {
          if (typeof value === 'string') {
            return loadInputContext(key, value, depth + 1, 'string');
          } else if (typeof value === 'object' && value !== null) {
            // For objects, stringify with JSON to display
            return loadInputContext(key, JSON.stringify(value, null, 2), depth + 1, 'object');
          }
          return loadInputContext(key, '', depth + 1, 'string');
        }),
    };
  }

  // Context creation functions
  function loadNestedObjectContext(
    key: string,
    object: any,
    depth: number = 0,
  ): NestedObjectContext {
    const values: Array<InputContext | NestedObjectContext | ArrayContext> = [];
    const objectType = object?.type || 'object';
    const depthPrefix = `[d-sub-${depth}-${objectType}] `;
    
    Object.entries(object).forEach(([subKey, subValue]) => {
      if (typeof subValue === 'string' || typeof subValue === 'number' || typeof subValue === 'boolean') {
        values.push(loadInputContext(subKey, String(subValue), depth + 1, typeof subValue));
      } else if (Array.isArray(subValue)) {
        // @ts-ignore
        values.push(loadArrayContext(subKey, subValue, depth + 1));
      } else if (typeof subValue === 'object' && subValue !== null) {
        values.push(loadNestedObjectContext(subKey, subValue, depth + 1));
      }
    });

    return {
      type: 'nestedObject',
      context: {
        subject: `${depthPrefix}${key}`,
        values,
      },
    };
  }

  function loadArrayContext(
    key: string,
    array: any[],
    depth: number = 0,
  ): ArrayContext | ObjectArrayContext | AccordionContext {
    console.log(`=== loadArrayContext start ===`);
    console.log(`key: ${key}, depth: ${depth}, array:`, array);
    
    // At depth 5, use AccordionContext (whether an object array or a string array)
    if (depth === 5 && array.length > 0) {
      console.log(`using AccordionContext at depth ${depth}`);
      return loadArrayAccordionContext(key, array, depth);
    }
    
    const values: Array<InputContext | NestedObjectContext | ArrayContext | ObjectArrayContext> = [];
    const depthPrefix = `[d-sub-${depth}-array] `;
    
    array.forEach((item, index) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        values.push(loadInputContext(`${key}[${index}]`, String(item), depth + 1, typeof item));
      } else if (Array.isArray(item)) {
        // @ts-ignore
        values.push(loadArrayContext(`${key}[${index}]`, item, depth + 1));
      } else if (typeof item === 'object' && item !== null) {
        // Special handling for the servers array
        if (key === 'servers') {
          values.push(loadServerContext(`${key}[${index}]`, item, index, depth + 1));
        } else {
          values.push(loadNestedObjectContext(`${key}[${index}]`, item, depth + 1));
        }
      }
    });

    return {
      type: 'array',
      context: {
        subject: `${depthPrefix}${key}`,
        values,
      },
      originalData: array,
    };
  }

  function loadArrayAccordionContext(
    key: string,
    array: any[],
    depth: number = 0,
  ): AccordionContext {
    console.log(`=== loadArrayAccordionContext start ===`);
    console.log(`key: ${key}, depth: ${depth}, array:`, array);
    
    const depthPrefix = `[d-sub-${depth}-array] `;
    
    return {
      type: 'accordion',
      context: {
        subject: `${depthPrefix}${key}`,
        values: array.map((item, index) => {
          console.log(`processing ArrayAccordionContext - index: ${index}, item:`, item);
          
          const content: Array<InputContext> = [];
          
          if (typeof item === 'object' && item !== null) {
            // Convert each object property into an InputContext
            Object.entries(item).forEach(([subKey, subValue]) => {
              console.log(`  - ${subKey}: ${subValue} (${typeof subValue})`);
              content.push(loadInputContext(subKey, String(subValue), depth + 1, typeof subValue));
            });
          } else {
            // Convert primitive types (string, number, boolean) into an InputContext
            console.log(`  - primitive type: ${item} (${typeof item})`);
            content.push(loadInputContext('value', String(item), depth + 1, typeof item));
          }
          
          return {
            header: {
              icon: 'ic_chevron-down',
              title: index.toString(),
            },
            content,
          };
        }),
      },
      index: 0,
      originalData: array,
    };
  }

  function loadObjectArrayContext(
    key: string,
    array: any[],
    depth: number = 0,
  ): ObjectArrayContext {
    console.log(`=== loadObjectArrayContext start ===`);
    console.log(`key: ${key}, depth: ${depth}, array:`, array);
    
    const depthPrefix = `[d-sub-${depth}-objectArray] `;
    
    return {
      type: 'objectArray',
      context: {
        subject: `${depthPrefix}${key}`,
        values: array.map((item, index) => {
          console.log(`processing ObjectArrayContext - index: ${index}, item:`, item);
          
          const content: Array<InputContext> = [];
          
          if (typeof item === 'object' && item !== null) {
            // Convert each object property into an InputContext
            Object.entries(item).forEach(([subKey, subValue]) => {
              console.log(`  - ${subKey}: ${subValue} (${typeof subValue})`);
              content.push(loadInputContext(subKey, String(subValue), depth + 1, typeof subValue));
            });
          }
          
          return {
            header: {
              icon: 'ic_chevron-down',
              title: index.toString(),
            },
            content,
          };
        }),
      },
      originalData: array,
    };
  }

  function loadSoftwareModelContext(softwareModel: any): SoftwareModelContext {
    const values: Array<InputContext> = [];
    
    Object.entries(softwareModel).forEach(([key, value]) => {
      values.push(loadInputContext(key, String(value)));
    });

    return {
      type: 'softwareModel',
      context: {
        subject: 'Software Model',
        values,
      },
    };
  }

  function loadServerContext(
    key: string,
    server: any,
    index: number,
    depth: number = 0,
  ): NestedObjectContext {
    const values: Array<InputContext | NestedObjectContext | ArrayContext> = [];
    const depthPrefix = `[d-sub-${depth}-server] `;
    
    Object.entries(server).forEach(([subKey, subValue]) => {
      console.log(`processing server[${index}]: ${subKey}`, subValue);
      
      if (typeof subValue === 'string' || typeof subValue === 'number' || typeof subValue === 'boolean') {
        values.push(loadInputContext(subKey, String(subValue), depth + 1, typeof subValue));
      } else if (Array.isArray(subValue)) {
        // Handle the errors array and other arrays
        // @ts-ignore
        values.push(loadArrayContext(subKey, subValue, depth + 1));
      } else if (typeof subValue === 'object' && subValue !== null) {
        // Handle nested objects like migration_list
        values.push(loadNestedObjectContext(subKey, subValue, depth + 1));
      }
    });

    return {
      type: 'nestedObject',
      context: {
        subject: `${depthPrefix}Server ${index + 1}`,
        values,
      },
    };
  }

  function setComponentName(name: string) {
    componentNameModel.value = loadInputContext('name', name);
  }

  function setParamsContext(fixedModel: fixedModel) {
    console.log('=== setParamsContext start ===');
    console.log('received fixedModel:', fixedModel);
    
    // If nsId exists in path_params, set it to DEFAULT_NAMESPACE
    const processedPathParams = { ...fixedModel.path_params };
    console.log('original path_params:', fixedModel.path_params);
    if ('nsId' in processedPathParams) {
      processedPathParams.nsId = DEFAULT_NAMESPACE;
      console.log('changed nsId to DEFAULT_NAMESPACE:', processedPathParams);
    }

    // If nsId exists in query_params, set it to DEFAULT_NAMESPACE
    const processedQueryParams = { ...fixedModel.query_params };
    console.log('original query_params:', fixedModel.query_params);
    if ('nsId' in processedQueryParams) {
      processedQueryParams.nsId = DEFAULT_NAMESPACE;
      console.log('changed nsId to DEFAULT_NAMESPACE:', processedQueryParams);
    }

    console.log('processedPathParams entries:', Object.entries(processedPathParams));
    console.log('processedQueryParams entries:', Object.entries(processedQueryParams));
    
    paramsContext.value = {
      path_params: {
        type: 'params',
        context: {
          subject: 'Path_Params',
          values: Object.entries(processedPathParams).map(([key, value]) =>
            loadInputContext(key, value),
          ),
        },
      },
      query_params: {
        type: 'params',
        context: {
          subject: 'Query_Params',
          values: Object.entries(processedQueryParams).map(([key, value]) =>
            loadInputContext(key, value),
          ),
        },
      },
    };
    
    console.log('final paramsContext:', paramsContext.value);
    console.log('=== setParamsContext complete ===');
  }

  function setFormContext(object: object | '') {
    console.log('=== setFormContext start ===');
    console.log('received object:', object);
    console.log('object type:', typeof object);
    
    // Store originalObject (for the new model structure, store the whole object)
    if (typeof object === 'object' && object !== null && 'targetSoftwareModel' in object) {
      console.log('object has targetSoftwareModel.');
      originalObject = object;
      // Extract and process only targetSoftwareModel
      object = (object as any).targetSoftwareModel || '';
      console.log('extracted targetSoftwareModel:', object);
    } else {
      console.log('plain object or empty string.');
      originalObject = null;
    }
    
    const context: ConvertedData[] = [];
    
    // Add Software Model (extracted from originalObject)
    if (originalObject && (originalObject as any).softwareModel) {
      console.log('adding Software Model:', (originalObject as any).softwareModel);
      context.push(loadSoftwareModelContext((originalObject as any).softwareModel));
    }
    
    if (typeof object === 'object' && object !== null) {
      console.log('start processing object, Object.entries:', Object.entries(object));
      Object.entries(object).forEach(
        ([key, value]: [key: string, value: any], index) => {
          console.log(`processing: key=${key}, value=`, value, `type=${typeof value}`);
          
          // Start mapping from servers
          if (key === 'servers' && Array.isArray(value)) {
            console.log('processing servers array:', key, value);
            context.push(loadArrayContext(key, value, 0));
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            console.log('processing primitive type:', key, value);
            // Primitive types are added to the Entity
            if (context.length === 0 || context[0].type !== 'entity') {
              context.unshift({
                type: 'entity',
                context: {
                  subject: 'Entity',
                  values: [],
                },
              });
            }
            if (context[0].type === 'entity') {
              context[0].context.values.push(loadInputContext(key, String(value), 0, typeof value));
            }
          } else if (Array.isArray(value)) {
            console.log('processing array:', key, value);
            context.push(loadArrayContext(key, value, 0));
          } else if (typeof value === 'object' && value !== null) {
            console.log('processing nested object:', key, value);
            context.push(loadNestedObjectContext(key, value, 0));
          }
        },
      );
    }
    
    console.log('final context:', context);
    // @ts-ignore
    formContext.value = context;
    console.log('=== setFormContext complete ===');
  }

  function convertFormModelToStepProperties(): object {
    // Only the new model structure is supported: update only the targetSoftwareModel value on originalObject
    const updatedTargetSoftwareModel: any = {};
    const updatedSoftwareModel: any = {};
    
    formContext.value.forEach(data => {
      if (data.type === 'entity') {
        const convertedObject: any[] = [];
        data.context.values.forEach(value => {
          if (value.type === 'keyValueInput') {
            if (
              value.context.title.value !== '' &&
              !entityKeyValidation(value.context.title)
            ) {
              //@ts-ignore
              convertedObject.push(getKeyValueInputData(value.context));
            }
          } else if (value.type === 'input') {
            //@ts-ignore
            convertedObject.push(getInputData(value.context));
          }
        });

        Object.assign(updatedTargetSoftwareModel, ...convertedObject);
      } else if (data.type === 'softwareModel') {
        // Handle Software Model
        data.context.values.forEach(value => {
          if (value.type === 'input') {
            //@ts-ignore
            Object.assign(updatedSoftwareModel, getInputData(value.context));
          }
        });
      } else if (data.type === 'array') {
        // Handle array
        // @ts-ignore
        updatedTargetSoftwareModel[data.context.subject] = convertArrayContextToData(data);
      } else if (data.type === 'objectArray') {
        // Handle object array
        console.log(`processing ObjectArrayContext:`, data);
        const subjectKey = data.context.subject.replace(/^\[d-sub-\d+-objectArray\] /, '');
        // @ts-ignore
        updatedTargetSoftwareModel[subjectKey] = convertObjectArrayContextToData(data);
      } else if (data.type === 'nestedObject') {
        // Handle nested object
        // @ts-ignore
        updatedTargetSoftwareModel[data.context.subject] = convertNestedObjectContextToData(data);
      } else if (data.type === 'accordion') {
        if (data.context.subject === 'servers') {
          updatedTargetSoftwareModel.servers = data.context.values.map(value =>
            // @ts-ignore
            getAccordionSlotData(value),
          );
        } else {
          // Handle depth-5 arrays (string arrays, etc.)
          const subjectKey = data.context.subject.replace(/^\[d-sub-\d+-array\] /, '');
          console.log(`processing AccordionContext array - subjectKey: ${subjectKey}`, data);
          updatedTargetSoftwareModel[subjectKey] = data.context.values.map(value =>
            // @ts-ignore
            getAccordionSlotData(value),
          );
        }
      }
    });
    
    // Update targetSoftwareModel and softwareModel on originalObject and return the whole object
    return {
      ...originalObject,
      targetSoftwareModel: updatedTargetSoftwareModel,
      softwareModel: updatedSoftwareModel
    };
  }

  function convertParamsModelToStepProperties() {
    const fixedModel: fixedModel = {
      path_params: {},
      query_params: {},
    };

    Object.assign(
      fixedModel.path_params,
      paramsContext.value?.path_params.context.values.reduce((acc, value) => {
        acc[value.context.title] = value.context.model.value;
        return acc;
      }, {}),
    );
    Object.assign(
      fixedModel.query_params,
      paramsContext.value?.query_params.context.values.reduce((acc, value) => {
        acc[value.context.title] = value.context.model.value;
        return acc;
      }, {}),
    );

    return fixedModel;
  }

  function getAccordionSlotData(accordionSlotContext: AccordionSlotContext) {
    // For string arrays (when only the value field exists)
    if (accordionSlotContext.content.length === 1 && 
        accordionSlotContext.content[0].context.title === 'value') {
      const inputData = getInputData(accordionSlotContext.content[0].context);
      return inputData.value || '';
    }
    
    // For objects
    const object = {};
    accordionSlotContext.content.forEach(data => {
      const inputData = getInputData(data.context);
      Object.entries(inputData).forEach(([key, value]) => {
        // If it is a JSON string, parse it into an object
        if (typeof value === 'string' && ((value as string).startsWith('{') || (value as string).startsWith('['))) {
          try {
            object[key] = JSON.parse(value);
          } catch (e) {
            // If JSON parsing fails, keep the original string
            object[key] = value;
          }
        } else {
          object[key] = value;
        }
      });
    });

    return object;
  }

  function getKeyValueInputData(object: KeyValueInputContext['context']) {
    return {
      // @ts-ignore
      [object.title.value]: object.model.value,
    };
  }

  function getInputData(inputContext: InputContext['context']) {
    return {
      [inputContext.title]: inputContext.model.value,
    };
  }

  // Functions that convert the Context types into data
  function convertArrayContextToData(arrayContext: ArrayContext): any[] {
    return arrayContext.context.values.map(value => {
      if (value.type === 'input') {
        return value.context.model.value;
      } else if (value.type === 'nestedObject') {
        return convertNestedObjectContextToData(value);
      } else if (value.type === 'array') {
        return convertArrayContextToData(value);
      }
      return value;
    });
  }

  function convertObjectArrayContextToData(objectArrayContext: ObjectArrayContext): any[] {
    console.log(`=== convertObjectArrayContextToData start ===`);
    console.log(`objectArrayContext:`, objectArrayContext);
    
    const result = objectArrayContext.context.values.map(slot => {
      console.log(`processing slot:`, slot);
      return getAccordionSlotData(slot);
    });
    
    console.log(`conversion result:`, result);
    return result;
  }

  function convertNestedObjectContextToData(nestedObjectContext: NestedObjectContext): any {
    const result: any = {};
    
    nestedObjectContext.context.values.forEach(value => {
      if (value.type === 'input') {
        result[value.context.title] = value.context.model.value;
      } else if (value.type === 'nestedObject') {
        result[value.context.subject] = convertNestedObjectContextToData(value);
      } else if (value.type === 'array') {
        result[value.context.subject] = convertArrayContextToData(value);
      }
    });
    
    return result;
  }

  function addEntity(
    target: UnwrapRef<Array<InputContext | KeyValueInputContext>>,
  ) {
    // @ts-ignore
    target.push(loadKeyValueInputContext());
  }

  function addArray(parentIndex: number) {
    if (formContext.value[parentIndex].type === 'accordion') {
      formContext.value[parentIndex].context.values.push(
        // @ts-ignore
        loadAccordionContext(formContext.value[parentIndex].originalData[0], 0, 0),
      );
    }
  }

  // Returns true if something like a return exists, false otherwise
  function entityKeyValidation(
    model: UnwrapRef<ReturnType<typeof useInputModel<string>>>,
  ): boolean {
    if (formContext.value[0].type === 'entity') {
      const valid = formContext.value[0].context.values.some(value => {
        // @ts-ignore
        if (value.type === 'input') {
          // @ts-ignore
          return value.context.title === model.value;
        }
        return false;
      });
      model.isValid = !valid;
      return valid;
    }
    return false;
  }

  function deleteEntity(index: number) {
    if (formContext.value[0].type === 'entity') {
      formContext.value[0].context.values.splice(index, 1);
    }
  }

  function deleteArrayElement(
    targetArr:
      | UnwrapRef<Array<InputContext | KeyValueInputContext>>
      | UnwrapRef<Array<AccordionSlotContext>>,
    targetIndex: number,
  ) {
    targetArr.splice(targetIndex, 1);
  }

  return {
    componentNameModel,
    formContext,
    paramsContext,
    setComponentName,
    setParamsContext,
    setFormContext,
    convertFormModelToStepProperties,
    convertParamsModelToStepProperties,
    addEntity,
    addArray,
    entityKeyValidation,
    deleteEntity,
    deleteArrayElement,
  };
}
