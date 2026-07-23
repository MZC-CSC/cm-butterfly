<script setup lang="ts">
import {
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  onUpdated,
  reactive,
  ref,
  toRef,
  UnwrapRef,
  watch,
} from 'vue';
import { PTextInput } from '@cloudforet-test/mirinae';
import { useGrasshopperTaskEditorModel } from '@/features/sequential/designer/editor/model/grasshopperTaskEditorModel';
import DepthField from '@/features/sequential/designer/editor/components/DepthField.vue';
import SequentialShortCut from '@/features/sequential/designer/shortcut/ui/SequentialShortCut.vue';
import ObjectArray from '@/shared/ui/Input/ObjectArray/ObjectArray.vue';
import { Step } from '@/features/workflow/workflowEditor/model/types.ts';

interface IProps {
  step: Step;
}

const props = defineProps<IProps>();
const emit = defineEmits([
  'saveComponentName',
  'saveContext',
  'saveFixedModel',
]);
const taskEditorModel = useGrasshopperTaskEditorModel();

// Log the info received from props
console.log('=== Props info ===');
console.log('props.step:', props.step);
console.log('props.step.properties:', props.step.properties);
console.log('props.step.properties.model:', props.step.properties.model);
console.log('props.step.properties.fixedModel:', props.step.properties.fixedModel);
console.log('props.step.name:', props.step.name);

// Log the initial taskEditorModel state
console.log('=== taskEditorModel initial state ===');
console.log('taskEditorModel:', taskEditorModel);
console.log('taskEditorModel.componentNameModel:', taskEditorModel.componentNameModel);
console.log('taskEditorModel.formContext:', taskEditorModel.formContext);
console.log('taskEditorModel.paramsContext:', taskEditorModel.paramsContext);
const shortCutModel = ref({
  open: false,
  xPos: 0,
  yPos: 0,
  delete: {
    label: 'Delete',
    callback: function () {},
  },
});
const editorFormElement = ref(null);
let shortCut;

onBeforeMount(() => {
  console.log('=== onBeforeMount start ===');

  // Set Form Context
  console.log('props.step.properties.model before set:', props.step.properties.model);
  taskEditorModel.setFormContext(props.step.properties.model ?? '');
  console.log('Form Context after set:', taskEditorModel.formContext.value);

  // Set Params Context
  if (props.step.properties.fixedModel) {
    console.log('props.step.properties.fixedModel before set:', props.step.properties.fixedModel);
    taskEditorModel.setParamsContext(props.step.properties.fixedModel);
    console.log('Params Context after set:', taskEditorModel.paramsContext.value);
  }

  // Set Component Name
  console.log('props.step.name before set:', props.step.name);
  taskEditorModel.setComponentName(props.step.name);
  console.log('Component Name after set:', taskEditorModel.componentNameModel.value);

  console.log('=== onBeforeMount done ===');
  console.log('final taskEditorModel state:', {
    componentNameModel: taskEditorModel.componentNameModel.value,
    formContext: taskEditorModel.formContext.value,
    paramsContext: taskEditorModel.paramsContext.value
  });

  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(
  taskEditorModel.componentNameModel,
  nv => {
    if (nv.context.model.value !== '') {
      emit('saveComponentName', nv.context.model.value);
    }
  },
  { deep: true },
);

watch(
  taskEditorModel.formContext,
  nv => {
    emit('saveContext', taskEditorModel.convertFormModelToStepProperties());
  },
  { deep: true },
);

watch(
  taskEditorModel.paramsContext,
  () => {
    emit(
      'saveFixedModel',
      taskEditorModel.convertParamsModelToStepProperties(),
    );
  },
  { deep: true },
);

function openShortCut(e) {
  shortCutModel.value.open = true;
  shortCutModel.value.xPos = e.offsetX + e.target.offsetLeft;
  shortCutModel.value.yPos = e.offsetY + e.target.offsetTop;
}

function closeShortCut() {
  shortCutModel.value.open = false;
}

function deleteEntity(e, index) {
  e.preventDefault();
  shortCutModel.value.delete.callback = () =>
    taskEditorModel.deleteEntity(index);
  openShortCut(e);
}

function deleteArrayElement(
  e: MouseEvent,
  targetArr: Array<any>,
  targetIndex: number,
) {
  e.preventDefault();
  shortCutModel.value.delete.callback = () =>
    taskEditorModel.deleteArrayElement(targetArr, targetIndex);
  openShortCut(e);
}

function handleClickOutside(event: MouseEvent) {
  const sequentialShortCutElement = document.querySelector(
    '.sequential-shortcut',
  );
  if (
    sequentialShortCutElement &&
    !sequentialShortCutElement.contains(event.target as Node)
  ) {
    closeShortCut();
  }
}

// Checks whether the value is an array type at depth 0
function isDepthZeroArray(formData: any): boolean {
  console.log('=== isDepthZeroArray check ===');
  console.log('formData.type:', formData.type);
  console.log('formData.context.subject:', formData.context.subject);
  
  // Read the depth info from the subject (e.g. "[d-sub-0-array] key")
  const isArray = formData.type === 'array';
  const hasDepthZero = formData.context.subject.includes('[d-sub-0-array]');
  
  console.log('isArray:', isArray);
  console.log('hasDepthZero:', hasDepthZero);
  console.log('final result:', isArray && hasDepthZero);
  
  return isArray && hasDepthZero;
}

// Converts an ArrayContext into an ObjectArrayContext (handles up to depth 4)
function convertToObjectArrayContext(formData: any) {
  console.log('=== convertToObjectArrayContext start ===');
  console.log('formData:', formData);
  console.log('formData.context.values:', formData.context.values);
  
  const subject = formData.context.subject.replace(/^\[d-sub-\d+-array\] /, '');
  
  // Convert values into ObjectContext so we only render up to depth 4
  const items = formData.context.values.map((item: any, index: number) => {
    console.log(`=== item ${index} processing start ===`);
    console.log('item:', item);
    console.log('item.type:', item.type);
    console.log('item.context:', item.context);
    
    if (item.type === 'nestedObject') {
      // Convert nestedObject into ObjectContext (handles up to depth 3)
      const fields = item.context.values.map((field: any) => {
        if (field.type === 'input') {
          return {
            type: 'keyValue',
            key: field.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
            value: field.context.model
          };
        } else if (field.type === 'keyValueInput') {
          // Handle KeyValueInputContext
          return {
            type: 'keyValue',
            key: (field.context.title.value || 'key'),
            value: field.context.model
          };
        } else if (field.type === 'nestedObject') {
          // Handle the depth-2 nestedObject
          console.log('=== depth 2 nestedObject processing start ===');
          console.log('field:', field);
          console.log('field.context.values:', field.context.values);
          
          const nestedFields = field.context.values.map((nestedField: any) => {
            console.log('processing nestedField:', nestedField.type, nestedField);
            
            if (nestedField.type === 'input') {
              return {
                type: 'keyValue',
                key: nestedField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                value: nestedField.context.model
              };
            } else if (nestedField.type === 'keyValueInput') {
              // Handle KeyValueInputContext (depth 2)
              return {
                type: 'keyValue',
                key: (nestedField.context.title.value || 'key'),
                value: nestedField.context.model
              };
            } else if (nestedField.type === 'array') {
              console.log('=== depth 2 nestedObject inner array processing start ===');
              console.log('nestedField (array):', nestedField);
              console.log('nestedField.context.values:', nestedField.context.values);
              
              // Handle the depth-2 array - convert to ObjectArray
              const arrayItems = nestedField.context.values.map((arrayItem: any, arrayIndex: number) => {
                console.log(`depth 2 arrayItem ${arrayIndex}:`, arrayItem);
                
                if (arrayItem.type === 'input') {
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: [{
                      type: 'keyValue',
                      key: arrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                      value: arrayItem.context.model
                    }]
                  };
                } else if (arrayItem.type === 'keyValueInput') {
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: [{
                      type: 'keyValue',
                      key: (arrayItem.context.title.value || 'key'),
                      value: arrayItem.context.model
                    }]
                  };
                } else if (arrayItem.type === 'nestedObject') {
                  const arrayItemFields = arrayItem.context.values.map((arrayField: any) => {
                    if (arrayField.type === 'input') {
                      return {
                        type: 'keyValue',
                        key: arrayField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                        value: arrayField.context.model
                      };
                    }
                    return arrayField;
                  });
                  
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: arrayItemFields
                  };
                }
                console.log(`unhandled depth 2 arrayItem type: ${arrayItem.type}`, arrayItem);
                return arrayItem;
              });
              
              console.log('depth 2 arrayItems result:', arrayItems);
              
              return {
                type: 'objectArray',
                subject: nestedField.context.subject.replace(/^\[d-sub-\d+-array\] /, ''),
                items: arrayItems
              };
            } else if (nestedField.type === 'nestedObject') {
              // Handle the depth-3 nestedObject
              const depth3Fields = nestedField.context.values.map((depth3Field: any) => {
                if (depth3Field.type === 'input') {
                  return {
                    type: 'keyValue',
                    key: depth3Field.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                    value: depth3Field.context.model
                  };
                } else if (depth3Field.type === 'keyValueInput') {
                  // Handle KeyValueInputContext (depth 3)
                  return {
                    type: 'keyValue',
                    key: (depth3Field.context.title.value || 'key'),
                    value: depth3Field.context.model
                  };
                } else if (depth3Field.type === 'nestedObject') {
                  // Handle the depth-4 nestedObject
                  const depth4Fields = depth3Field.context.values.map((depth4Field: any) => {
                    if (depth4Field.type === 'input') {
                      return {
                        type: 'keyValue',
                        key: depth4Field.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                        value: depth4Field.context.model
                      };
                    } else if (depth4Field.type === 'keyValueInput') {
                      // Handle KeyValueInputContext (depth 4)
                      return {
                        type: 'keyValue',
                        key: (depth4Field.context.title.value || 'key'),
                        value: depth4Field.context.model
                      };
                    }
                    // At depth 4 we do not render any deeper nesting
                    return depth4Field;
                  });
                  
                  return {
                    type: 'object',
                    subject: depth3Field.context.subject.replace(/^\[d-sub-\d+-\w+\] /, ''),
                    fields: depth4Fields
                  };
                } else if (depth3Field.type === 'array') {
                  // Handle the depth-3 array
                  const depth3ArrayItems = depth3Field.context.values.map((depth3ArrayItem: any, depth3ArrayIndex: number) => {
                    if (depth3ArrayItem.type === 'input') {
                      return {
                        type: 'object',
                        subject: `Item ${depth3ArrayIndex + 1}`,
                        fields: [{
                          type: 'keyValue',
                          key: depth3ArrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                          value: depth3ArrayItem.context.model
                        }]
                      };
                    } else if (depth3ArrayItem.type === 'keyValueInput') {
                      return {
                        type: 'object',
                        subject: `Item ${depth3ArrayIndex + 1}`,
                        fields: [{
                          type: 'keyValue',
                          key: depth3ArrayItem.context.title.value || 'key',
                          value: depth3ArrayItem.context.model
                        }]
                      };
                    } else if (depth3ArrayItem.type === 'nestedObject') {
                      const depth3ArrayItemFields = depth3ArrayItem.context.values.map((depth3ArrayField: any) => {
                        if (depth3ArrayField.type === 'input') {
                          return {
                            type: 'keyValue',
                            key: depth3ArrayField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                            value: depth3ArrayField.context.model
                          };
                        }
                        return depth3ArrayField;
                      });
                      
                      return {
                        type: 'object',
                        subject: `Item ${depth3ArrayIndex + 1}`,
                        fields: depth3ArrayItemFields
                      };
                    }
                    return depth3ArrayItem;
                  });
                  
                  return {
                    type: 'objectArray',
                    subject: depth3Field.context.subject.replace(/^\[d-sub-\d+-array\] /, ''),
                    items: depth3ArrayItems
                  };
                }
                return depth3Field;
              });
              
              return {
                type: 'object',
                subject: nestedField.context.subject.replace(/^\[d-sub-\d+-\w+\] /, ''),
                fields: depth3Fields
              };
            } else if (nestedField.type === 'array') {
              // Handle the depth-2 array - convert to ObjectArray
              console.log('=== depth 2 array processing start ===');
              console.log('nestedField:', nestedField);
              console.log('nestedField.context.values:', nestedField.context.values);
              
              const arrayItems = nestedField.context.values.map((arrayItem: any, arrayIndex: number) => {
                console.log(`depth 2 arrayItem ${arrayIndex}:`, arrayItem);
                
                if (arrayItem.type === 'input') {
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: [{
                      type: 'keyValue',
                      key: arrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                      value: arrayItem.context.model
                    }]
                  };
                } else if (arrayItem.type === 'keyValueInput') {
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: [{
                      type: 'keyValue',
                      key: (arrayItem.context.title.value || 'key'),
                      value: arrayItem.context.model
                    }]
                  };
                } else if (arrayItem.type === 'nestedObject') {
                  const arrayItemFields = arrayItem.context.values.map((arrayField: any) => {
                    if (arrayField.type === 'input') {
                      return {
                        type: 'keyValue',
                        key: arrayField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                        value: arrayField.context.model
                      };
                    } else if (arrayField.type === 'array') {
                      // Handle the depth-2 array - convert to ObjectArray
                      const nestedArrayItems = arrayField.context.values.map((nestedArrayItem: any, nestedArrayIndex: number) => {
                        if (nestedArrayItem.type === 'input') {
                          return {
                            type: 'object',
                            subject: `Item ${nestedArrayIndex + 1} [depth-2-array-input]`,
                            fields: [{
                              type: 'keyValue',
                              key: nestedArrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                              value: nestedArrayItem.context.model
                            }]
                          };
                        }
                        return nestedArrayItem;
                      });
                      
                      return {
                        type: 'objectArray',
                        subject: arrayField.context.subject.replace(/^\[d-sub-\d+-array\] /, ''),
                        items: nestedArrayItems
                      };
                    }
                    return arrayField;
                  });
                  
                  return {
                    type: 'object',
                    subject: `Item ${arrayIndex + 1}`,
                    fields: arrayItemFields
                  };
                }
                console.log(`unhandled arrayItem type: ${arrayItem.type}`, arrayItem);
                return arrayItem;
              });
              
              console.log('arrayItems result:', arrayItems);
              
              return {
                type: 'objectArray',
                    subject: field.context.subject.replace(/^\[d-sub-\d+-array\] /, ''),
                items: arrayItems
              };
            }
            return nestedField;
          });
          
          return {
            type: 'object',
            subject: field.context.subject.replace(/^\[d-sub-\d+-\w+\] /, ''),
            fields: nestedFields
          };
        } else if (field.type === 'array') {
          // Handle the depth-1 array - convert to ObjectArray
          console.log('=== depth 1 array processing start ===');
          console.log('field:', field);
          console.log('field.context.values:', field.context.values);
          
          const arrayItems = field.context.values.map((arrayItem: any, arrayIndex: number) => {
            console.log(`arrayItem ${arrayIndex}:`, arrayItem);
            
            if (arrayItem.type === 'input') {
              return {
                type: 'object',
                subject: `Item ${arrayIndex + 1}`,
                fields: [{
                  type: 'keyValue',
                  key: arrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                  value: arrayItem.context.model
                }]
              };
            } else if (arrayItem.type === 'keyValueInput') {
              return {
                type: 'object',
                subject: `Item ${arrayIndex + 1}`,
                fields: [{
                  type: 'keyValue',
                  key: (arrayItem.context.title.value || 'key'),
                  value: arrayItem.context.model
                }]
              };
            } else if (arrayItem.type === 'nestedObject') {
              const arrayItemFields = arrayItem.context.values.map((arrayField: any) => {
                if (arrayField.type === 'input') {
                  return {
                    type: 'keyValue',
                    key: arrayField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                    value: arrayField.context.model
                  };
                } else if (arrayField.type === 'array') {
                  // Handle the depth-2 array - convert to ObjectArray
                  const nestedArrayItems = arrayField.context.values.map((nestedArrayItem: any, nestedArrayIndex: number) => {
                    if (nestedArrayItem.type === 'input') {
                      return {
                        type: 'object',
                        subject: `Item ${nestedArrayIndex + 1} [depth-2-array-input]`,
                        fields: [{
                          type: 'keyValue',
                          key: nestedArrayItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
                          value: nestedArrayItem.context.model
                        }]
                      };
                    }
                    return nestedArrayItem;
                  });
                  
                  return {
                    type: 'objectArray',
                    subject: arrayField.context.subject.replace(/^\[d-sub-\d+-array\] /, '') + ' [depth-2-array]',
                    items: nestedArrayItems
                  };
                }
                return arrayField;
              });
              
              return {
                type: 'object',
                subject: `Item ${arrayIndex + 1}`,
                fields: arrayItemFields
              };
            }
            console.log(`unhandled arrayItem type: ${arrayItem.type}`, arrayItem);
            return arrayItem;
          });
          
          console.log('arrayItems result:', arrayItems);
          
          return {
            type: 'objectArray',
                subject: field.context.subject.replace(/^\[d-sub-\d+-array\] /, ''),
            items: arrayItems
          };
        }
        return field;
      });
      
      return {
        type: 'object',
        subject: `Object ${index + 1}`,
        fields: fields
      };
    } else if (item.type === 'input') {
      // Convert a plain input into a keyValue
      return {
        type: 'object',
        subject: `Object ${index + 1}`,
        fields: [{
          type: 'keyValue',
          key: item.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
          value: item.context.model
        }]
      };
    } else if (item.type === 'keyValueInput') {
      // Handle KeyValueInputContext (depth 0)
      return {
        type: 'object',
        subject: `Object ${index + 1}`,
        fields: [{
          type: 'keyValue',
          key: item.context.title.value || 'key',
          value: item.context.model
        }]
      };
    } else if (item.type === 'accordion') {
      // Handle AccordionContext - convert each AccordionSlotContext into an ObjectContext
      const accordionItems = item.context.values.map((slot: any, slotIndex: number) => {
        const slotFields = slot.content.map((contentItem: any) => {
          if (contentItem.type === 'input') {
            return {
              type: 'keyValue',
              key: contentItem.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
              value: contentItem.context.model
            };
          }
          return contentItem;
        });
        
        return {
          type: 'object',
          subject: slot.header.title,
          fields: slotFields
        };
      });
      
      return {
        type: 'objectArray',
        subject: item.context.subject,
        items: accordionItems
      };
    } else if (item.type === 'softwareModel') {
      // Handle SoftwareModelContext
      const softwareFields = item.context.values.map((softwareField: any) => {
        if (softwareField.type === 'input') {
          return {
            type: 'keyValue',
            key: softwareField.context.title.replace(/^\[d-tit-\d+-\w+\] /, ''),
            value: softwareField.context.model
          };
        }
        return softwareField;
      });
      
      return {
        type: 'object',
        subject: item.context.subject,
        fields: softwareFields
      };
    }
    
    return item;
  });
  
  const result = {
    type: 'objectArray' as const,
    subject: subject,
    items: items
  };
  
  console.log('conversion result:', result);
  return result;
}

// Updates the ObjectArrayContext (handles up to depth 4)
function updateObjectArrayContext(index: number, updatedContext: any) {
  console.log('=== updateObjectArrayContext start ===');
  console.log('index:', index);
  console.log('updatedContext:', updatedContext);
  
  // Convert the ObjectArrayContext back into an ArrayContext to update formContext
  const originalFormData = taskEditorModel.formContext.value[index];
  if (originalFormData.type === 'array') {
    // Convert the ObjectArrayContext items back into ArrayContext values (handles up to depth 4)
    const updatedValues = updatedContext.items.map((item: any) => {
      // Convert ObjectContext into nestedObject (handles up to depth 3)
      const nestedValues = item.fields.map((field: any) => {
        if (field.type === 'keyValue') {
          return {
            type: 'input',
            context: {
              title: `[d-tit-1-string] ${field.key}`,
              model: field.value
            }
          };
        } else if (field.type === 'object') {
          // Handle the depth-2 object
          const nestedObjectValues = field.fields.map((nestedField: any) => {
            if (nestedField.type === 'keyValue') {
              return {
                type: 'input',
                context: {
                  title: `[d-tit-2-string] ${nestedField.key}`,
                  model: nestedField.value
                }
              };
            } else if (nestedField.type === 'object') {
              // Handle the depth-3 object
              const depth3ObjectValues = nestedField.fields.map((depth3Field: any) => {
                if (depth3Field.type === 'keyValue') {
                  return {
                    type: 'input',
                    context: {
                      title: `[d-tit-3-string] ${depth3Field.key}`,
                      model: depth3Field.value
                    }
                  };
                } else if (depth3Field.type === 'object') {
                  // Handle the depth-4 object
                  const depth4ObjectValues = depth3Field.fields.map((depth4Field: any) => {
                    if (depth4Field.type === 'keyValue') {
                      return {
                        type: 'input',
                        context: {
                          title: `[d-tit-4-string] ${depth4Field.key}`,
                          model: depth4Field.value
                        }
                      };
                    }
                    return depth4Field;
                  });
                  
                  return {
                    type: 'nestedObject',
                    context: {
                      subject: `[d-sub-4-object] ${depth3Field.subject}`,
                      values: depth4ObjectValues
                    }
                  };
                }
                return depth3Field;
              });
              
              return {
                type: 'nestedObject',
                context: {
                  subject: `[d-sub-3-object] ${nestedField.subject}`,
                  values: depth3ObjectValues
                }
              };
            } else if (nestedField.type === 'objectArray') {
              // Handle the depth-3 objectArray
              const depth3ArrayValues = nestedField.items.map((depth3ArrayItem: any) => {
                const depth3ArrayItemValues = depth3ArrayItem.fields.map((depth3ArrayField: any) => {
                  if (depth3ArrayField.type === 'keyValue') {
                    return {
                      type: 'input',
                      context: {
                        title: `[d-tit-3-string] ${depth3ArrayField.key}`,
                        model: depth3ArrayField.value
                      }
                    };
                  }
                  return depth3ArrayField;
                });
                
                return {
                  type: 'nestedObject',
                  context: {
                    subject: `[d-sub-3-object] ${depth3ArrayItem.subject}`,
                    values: depth3ArrayItemValues
                  }
                };
              });
              
              return {
                type: 'array',
                context: {
                  subject: `[d-sub-3-array] ${nestedField.subject}`,
                  values: depth3ArrayValues
                },
                originalData: []
              };
            }
            return nestedField;
          });
          
          return {
            type: 'nestedObject',
            context: {
              subject: `[d-sub-2-object] ${field.subject}`,
              values: nestedObjectValues
            }
          };
        } else if (field.type === 'objectArray') {
          // Handle the depth-1 objectArray
          const arrayValues = field.items.map((arrayItem: any) => {
            const arrayItemValues = arrayItem.fields.map((arrayField: any) => {
              if (arrayField.type === 'keyValue') {
                return {
                  type: 'input',
                  context: {
                    title: `[d-tit-2-string] ${arrayField.key}`,
                    model: arrayField.value
                  }
                };
              }
              return arrayField;
            });
            
            return {
              type: 'nestedObject',
              context: {
                subject: `[d-sub-2-object] ${arrayItem.subject}`,
                values: arrayItemValues
              }
            };
          });
          
          return {
            type: 'array',
            context: {
              subject: `[d-sub-1-array] ${field.subject}`,
              values: arrayValues
            },
            originalData: []
          };
        }
        return field;
      });
      
      return {
        type: 'nestedObject',
        context: {
          subject: `[d-sub-1-object] ${item.subject}`,
          values: nestedValues
        }
      };
    });
    
    // Update formContext
    originalFormData.context.values = updatedValues;
    console.log('updated formData:', originalFormData);
  }
}

</script>

<template>
  <div
    class="task-editor-form"
    ref="editorFormElement"
    @click.right="
      e => {
        e.preventDefault();
      }
    "
  >
    <div class="step-name-box w-full">
      <div class="subject-title border-bottom">Component Name</div>
      <div class="field-group flex border-bottom">
        <div class="field-title-box">
          {{ taskEditorModel.componentNameModel.value.context.title }}
        </div>
        <div class="field-content-box">
          <PTextInput
            v-model="taskEditorModel.componentNameModel.value.context.model.value"
            :size="'md'"
            block
            readonly
          ></PTextInput>
        </div>
      </div>
    </div>
    <div>
      <div class="params-box w-full h-full">
        <!-- Path Params -->
        <div v-if="taskEditorModel.paramsContext.value?.path_params && taskEditorModel.paramsContext.value.path_params.context.values.length > 0">
          <div class="subject-title border-bottom">
            {{ taskEditorModel.paramsContext.value.path_params.context.subject.replace(/^\[d-sub-\d+-\w+\] /, '') }}
          </div>
          <div
            v-for="(param, paramIndex) of taskEditorModel.paramsContext.value.path_params.context.values"
            :key="paramIndex"
            class="field-group flex border-bottom"
          >
            <div class="field-title-box">
              {{ param.context.title }}
            </div>
            <div class="field-content-box">
              <PTextInput
                v-model="param.context.model.value"
                :size="'md'"
                block
                :invalid="!param.context.model.isValid"
                :readonly="param.context.title === 'nsId'"
                @blur="param.context.model.onBlur"
              ></PTextInput>
            </div>
          </div>
        </div>
        
        <!-- Query Params -->
        <div v-if="taskEditorModel.paramsContext.value?.query_params && taskEditorModel.paramsContext.value.query_params.context.values.length > 0">
          <div class="subject-title border-bottom">
            {{ taskEditorModel.paramsContext.value.query_params.context.subject.replace(/^\[d-sub-\d+-\w+\] /, '') }}
          </div>
          <div
            v-for="(param, paramIndex) of taskEditorModel.paramsContext.value.query_params.context.values"
            :key="paramIndex"
            class="field-group flex border-bottom"
          >
            <div class="field-title-box">
              {{ param.context.title }}
            </div>
            <div class="field-content-box">
              <PTextInput
                v-model="param.context.model.value"
                :size="'md'"
                block
                :invalid="!param.context.model.isValid"
                :readonly="param.context.title === 'nsId'"
                @blur="param.context.model.onBlur"
              ></PTextInput>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Form Context -->
    <div v-for="(formData, index) of taskEditorModel.formContext.value" :key="index">
      <!-- Entity Context -->
      <div v-if="formData.type === 'entity'" class="entity-box w-full h-full">
        <div class="subject-title border-bottom">
          {{ formData.context.subject.replace(/^\[d-sub-\d+-\w+\] /, '') }}
        </div>
        <div
          v-for="(field, fieldIndex) of formData.context.values" 
          :key="fieldIndex"
          class="field-group flex border-bottom"
        >
          <div class="field-row">
            <div class="field-title-box">
              {{ field.context.title }}
          </div>
          <div class="field-content-box">
              <PTextInput v-if="field.context.model && field.context.model.value !== undefined" v-model="field.context.model.value"></PTextInput>
              <PTextInput v-else></PTextInput>
            </div>
          </div>
        </div>
      </div>

      <!-- Array Context - use ObjectArray.vue when the depth-0 value is an array type -->
      <div v-else-if="formData.type === 'array'" class="array-box w-full h-full">
        <div class="subject-title border-bottom">
          {{ formData.context.subject.replace(/^\[d-sub-\d+-\w+\] /, '') }}
        </div>
        <!-- Use ObjectArray.vue when depth 0 is an array (renders only up to depth 1) -->
        <ObjectArray
          v-if="isDepthZeroArray(formData)"
          :context="convertToObjectArrayContext(formData)"
          :readonly="false"
          @update:context="updateObjectArrayContext(index, $event)"
        />
        <!-- Legacy approach (using DepthField) -->
        <div v-else>
          <div 
            v-for="(item, itemIndex) of formData.context.values" 
            :key="itemIndex"
            class="array-item"
          >
            <DepthField :field="item" :current-depth="0" :max-depth="5" />
          </div>
        </div>
      </div>
    </div>
    <SequentialShortCut
      :open="shortCutModel.open"
      :x-pos="shortCutModel.xPos"
      :y-pos="shortCutModel.yPos"
      :items="[
        {
          label: shortCutModel.delete.label,
          callback: shortCutModel.delete.callback,
        },
      ]"
      @close="closeShortCut"
    ></SequentialShortCut>
  </div>
</template>

<style scoped lang="postcss">
.task-editor-form {
  position: relative;
  overflow: hidden;
  overflow-y: scroll;
  width: 100%;
  height: calc(100% - 20px);

  .field-group {
    .field-title-box {
      display: flex;
      align-items: center;
      width: 200px;
      height: 44px;
      font-size: 14px;
      font-weight: 700;
      padding: 6px 16px 6px 16px;
    }

    .field-content-box {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 310px;
      min-height: 44px;
      padding: 6px 16px 6px 16px;
    }
    
    .json-textarea {
      width: 100%;
      height: 200px;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      line-height: 1.4;
      resize: vertical;
      background-color: #f9fafb;
    }
    
    .json-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
  }
}

.border-bottom {
  border-bottom: 1px solid;
  @apply border-gray-200;
}

.subject-title {
  @apply pr-[16px] pl-[16px] mt-[16px] h-[44px] text-gray-500;
}

:deep(.accordion-item) {
  border-color: transparent;
}

:deep(.accordion-content) {
  padding-left: 0;
}

:deep(.accordion-header) {
  border-color: transparent;
}

.accordion-box {
  .item-content.field-group {
    border-color: transparent;

    .field-title-box {
      padding-left: 40px;
    }
  }

  .field-content-box {
    padding-left: 10px;
  }

  .item-content.field-group:last-child {
    border-color: inherit;
  }
}

.software-model-box {
  margin-bottom: 20px;
}

.array-box {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  
  .array-item {
    margin-bottom: 15px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    background-color: #f9fafb;
    width: 100%;
  }
}

.nested-object-box {
  display: flex;
  flex-direction: column;
  
  .field-group {
    margin-left: 20px;
    margin-right: 0;
    display: flex;
    flex-direction: column;
    
    .field-title-box {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .field-content-box {
      width: 100%;
    }
  }
}

.field-group {
  display: flex;
  flex-direction: row;
  margin-bottom: 10px;
  align-items: center;
  
  .field-title-box {
    font-size: 13px;
    color: #6b7280;
    margin-right: 10px;
    min-width: 120px;
    flex-shrink: 0;
  }
  
  .field-content-box {
    flex: 1;
    width: 100%;
  }
}

/* Force a field-group with the flex class to lay out horizontally */
.field-group.flex {
  display: flex;
  flex-direction: row;
  align-items: center;
  
  .field-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    
    .field-title-box {
      margin-right: 10px;
      min-width: 80px;
      max-width: 120px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .field-content-box {
      flex: 1;
      min-width: 0;
      max-width: calc(100% - 130px);
      overflow: hidden;
    }
  }
}

.field-group-vertical {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
  
  .field-title-box {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 5px;
  }
  
  .field-content-box {
    width: 100%;
  }
  
  /* A field-group inside field-group-vertical lays out horizontally */
  .field-group {
    display: flex;
    flex-direction: row;
    margin-bottom: 10px;
    align-items: center;
    
    .field-title-box {
      font-size: 13px;
      color: #6b7280;
      margin-right: 10px;
      min-width: 120px;
      flex-shrink: 0;
    }
    
    .field-content-box {
      flex: 1;
      width: 100%;
    }
  }
}

.migration-list-box {
  display: flex;
  flex-direction: column;
  width: 100%;
  
  .migration-array-item {
    margin-bottom: 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px;
    background-color: #f8fafc;
    width: 100%;
    display: flex;
    flex-direction: column;
    
    .field-group {
      display: flex;
      flex-direction: column;
      margin-bottom: 5px;
      
      .field-title-box {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 2px;
      }
      
      .field-content-box {
        width: 100%;
      }
    }
  }
}

/* A field-group inside migration_list lays out vertically */
.array-item .field-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 5px;
  
  .field-title-box {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 2px;
  }
  
  .field-content-box {
    width: 100%;
  }
}
</style>