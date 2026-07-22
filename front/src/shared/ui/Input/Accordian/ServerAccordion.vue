<script lang="ts">
import { ref, computed } from 'vue';
import BinaryAccordion from '@/shared/ui/Input/Accordian/BinaryAccordion.vue';
import FieldGroup from '@/shared/ui/Input/FieldGroup/FieldGroup.vue';

interface ServerItem {
  header: {
    title: string;
    icon: string;
  };
  content: any[];
  index: number;
}

export default {
  name: 'ServerAccordion',
  components: {
    BinaryAccordion,
    FieldGroup
  },
  props: {
    items: {
      type: Array as () => ServerItem[],
      default: () => []
    }
  },
  emits: ['delete-server', 'delete-migration-item'],
  setup(props, { emit }) {
    const openIndex = ref<number | null>(null);
    const migrationListContextOpen = ref<Set<number>>(new Set());

    const toggleAccordion = (index: number) => {
      openIndex.value = openIndex.value === index ? null : index;
    };

    const isOpen = (index: number) => {
      return openIndex.value === index;
    };

    const start = (el: Element) => {
      (el as HTMLElement).style.height = '0px';
    };

    const end = (el: Element) => {
      (el as HTMLElement).style.height = 'auto';
    };

    const handleDeleteServer = (index: number) => {
      emit('delete-server', index);
    };

    const handleDeleteMigrationItem = (index: number, itemIndex: number) => {
      emit('delete-migration-item', index, itemIndex);
    };

    const handleDeleteMigrationSubItem = (index: number, itemIndex: number, subItemIndex: number) => {
      emit('delete-migration-item', index, itemIndex, subItemIndex);
    };

    const toggleMigrationListContext = (fieldIndex: number) => {
      if (migrationListContextOpen.value.has(fieldIndex)) {
        migrationListContextOpen.value.delete(fieldIndex);
      } else {
        migrationListContextOpen.value.add(fieldIndex);
      }
    };

    const isMigrationListContextOpen = (fieldIndex: number) => {
      return migrationListContextOpen.value.has(fieldIndex);
    };

    // Vue 2 compatible helper functions
    const getFieldTitle = (field: any) => {
      try {
        if (field && field.context) {
          return field.context.title || field.context.subject || 'Field';
        }
        return 'Field';
      } catch (error) {
        console.error('getFieldTitle error:', error);
        return 'Field';
      }
    };

    const hasFieldModel = (field: any) => {
      try {
        return field && field.context && field.context.model;
      } catch (error) {
        console.error('hasFieldModel error:', error);
        return false;
      }
    };

    const getFieldModel = (field: any) => {
      try {
        if (field && field.context && field.context.model) {
          return field.context.model;
        }
        return { value: '', isValid: true, onBlur: () => {} };
      } catch (error) {
        console.error('getFieldModel error:', error);
        return { value: '', isValid: true, onBlur: () => {} };
      }
    };

    const logMigrationList = (field: any) => {
      console.log('=== Migration List Field ===');
      console.log('Field:', field);
      console.log('Field Context:', field.context);
      console.log('Field Context Values:', field.context?.values);
      console.log('Field Context Binaries:', field.context?.binaries);
      console.log('Field Context Values Binaries:', field.context?.values?.binaries);
      console.log('===========================');
    };

    const getMigrationListContent = (field: any) => {
      try {
        if (!field || !field.context) return 'No context';
        
        // Access the actual value of context
        const context = field.context.value || field.context;
        const actualContext = context?.value || context;
        
        // Access values
        const values = actualContext?.values?.value || actualContext?.values;
        
        if (!values || !Array.isArray(values)) {
          return 'No values array';
        }
        
        // Summarize and display each entry of migration_list
        const itemSummaries = values.map((valueItem: any) => {
          const valueContext = valueItem.context?.value || valueItem.context;
          const subject = valueContext?.subject || 'Unknown';
          
          // Extract count or status information for each entry
          if (subject === 'binaries') {
            const binariesFields = valueContext?.fields?.value || valueContext?.fields;
            const count = binariesFields && Array.isArray(binariesFields) ? binariesFields.length : 0;
            return `${subject}: ${count} items`;
          } else if (subject === 'packages') {
            const packagesFields = valueContext?.fields?.value || valueContext?.fields;
            const count = packagesFields && Array.isArray(packagesFields) ? packagesFields.length : 0;
            return `${subject}: ${count} items`;
          } else if (subject === 'containers') {
            const containersFields = valueContext?.fields?.value || valueContext?.fields;
            const count = containersFields && Array.isArray(containersFields) ? containersFields.length : 0;
            return `${subject}: ${count} items`;
          } else if (subject === 'kubernetes') {
            const kubernetesFields = valueContext?.fields?.value || valueContext?.fields;
            const count = kubernetesFields && Array.isArray(kubernetesFields) ? kubernetesFields.length : 0;
            return `${subject}: ${count} items`;
          } else {
            return `${subject}: available`;
          }
        });
        
        return `Migration List (${values.length} categories): ${itemSummaries.join(', ')}`;
      } catch (error) {
        console.error('getMigrationListContent error:', error);
        return 'Error';
      }
    };

    // Function that creates migration_list itself as a Context object
    const getMigrationListContext = (field: any) => {
      try {
        if (!field || !field.context) return null;
        
        // Access the actual value of context
        const context = field.context.value || field.context;
        const actualContext = context?.value || context;
        
        // Access values
        const values = actualContext?.values?.value || actualContext?.values;
        
        if (!values || !Array.isArray(values)) {
          return null;
        }
        
        // Convert all entries of migration_list into BinaryAccordion format
        const migrationItems = values.map((valueItem: any, index: number) => {
          const valueContext = valueItem.context?.value || valueItem.context;
          const subject = valueContext?.subject || `Item ${index + 1}`;
          
          // For a binaries entry, convert it into BinaryAccordion format
          if (subject === 'binaries') {
            const binariesFields = valueContext?.fields?.value || valueContext?.fields;
            if (binariesFields && Array.isArray(binariesFields)) {
              const binaryItems = binariesFields.map((binaryField: any, binaryIndex: number) => {
                const fieldContext = binaryField.context?.value || binaryField.context;
                return {
                  header: {
                    title: fieldContext?.subject || `Binary ${binaryIndex + 1}`,
                    icon: 'ic_chevron-right'
                  },
                  content: getBinaryFields(binaryField),
                  subItems: getBinarySubItems(binaryField),
                  index: binaryIndex
                };
              });
              
              return {
                header: {
                  title: subject,
                  icon: 'ic_chevron-right'
                },
                content: [],
                subItems: [{
                  type: 'binaries',
                  items: binaryItems
                }],
                index: index
              };
            }
          }
          
          // Convert the other entries into the default format
          return {
            header: {
              title: subject,
              icon: 'ic_chevron-right'
            },
            content: getBinaryFields(valueItem),
            subItems: getBinarySubItems(valueItem),
            index: index
          };
        });
        
        // Return migration_list itself as a Context object
        return {
          header: {
            title: 'Migration List',
            icon: 'ic_chevron-right'
          },
          content: [], // migration_list itself has no content
          subItems: migrationItems,
          index: 0
        };
      } catch (error) {
        console.error('getMigrationListContext error:', error);
        return null;
      }
    };

    // Function that analyzes the data shape
    const analyzeDataStructure = (data: any) => {
      try {
        if (!data) return 'empty';
        
        // Get the actual value of a Vue reactive object
        const actualData = data?.value || data;
        
        // When type is explicitly present
        if (actualData.type) {
          return actualData.type;
        }
        
        // When context exists
        if (actualData.context) {
          const context = actualData.context?.value || actualData.context;
          const actualContext = context?.value || context;
          
          // When values is an array
          if (actualContext?.values && Array.isArray(actualContext.values)) {
            return 'array';
          }
          
          // When fields is an array - if subject is 'binaries', 'containers', 'kubernetes', 'packages', treat it as an array
          if (actualContext?.fields && Array.isArray(actualContext.fields)) {
            const subject = actualContext?.subject;
            console.log(`analyzeDataStructure - fields array detected, subject: ${subject}`);
            if (subject === 'binaries' || subject === 'containers' || subject === 'kubernetes' || subject === 'packages') {
              console.log(`analyzeDataStructure - returning 'array' for subject: ${subject}`);
              return 'array';
            }
            console.log(`analyzeDataStructure - returning 'nestedObject' for subject: ${subject}`);
            return 'nestedObject';
          }
          
          // When values is an array (e.g. container_ports)
          if (actualContext?.values && Array.isArray(actualContext.values)) {
            console.log(`analyzeDataStructure - values array detected, subject: ${actualContext?.subject}, values:`, actualContext.values);
            return 'array';
          }
          
          // When model exists (input type)
          if (actualContext?.model) {
            return 'input';
          }
          
          // For a simple object
          if (typeof actualContext === 'object' && actualContext !== null) {
            return 'object';
          }
        }
        
        // For an array
        if (Array.isArray(actualData)) {
          console.log(`analyzeDataStructure - array detected, length: ${actualData.length}, data:`, actualData);
          // If every element of the array is a string, handle it as a stringArray
          if (actualData.every(item => typeof item === 'string')) {
            console.log(`analyzeDataStructure - string array detected, returning 'stringArray'`);
            return 'stringArray';
          }
          return 'array';
        }
        
        // For a simple value (string, number, boolean)
        if (typeof actualData === 'string' || typeof actualData === 'number' || typeof actualData === 'boolean') {
          return 'input';
        }
        
        // For an object
        if (typeof actualData === 'object' && actualData !== null) {
          return 'object';
        }
        
        return 'unknown';
      } catch (error) {
        console.error('analyzeDataStructure error:', error);
        return 'error';
      }
    };

    // Function that creates a Context based on the data shape
    const createContextByType = (data: any, type: string, categoryName: string) => {
      try {
        const actualData = data?.value || data;
        
        switch (type) {
          case 'input':
            // When context exists (existing approach)
            if (actualData.context?.model) {
              return {
                type: 'input',
                title: actualData.context?.title || categoryName,
                value: actualData.context?.model?.value || '',
                isValid: actualData.context?.model?.isValid || true,
                onBlur: actualData.context?.model?.onBlur || (() => {})
              };
            }
            // For a simple value (string, number, boolean)
            return {
              type: 'input',
              title: categoryName,
              value: String(actualData),
              isValid: true,
              onBlur: () => {}
            };
            
          case 'stringArray':
            // For a string array, handle each string as one input
            const stringArrayValues = actualData;
            return {
              type: 'stringArray',
              title: categoryName,
              items: Array.isArray(stringArrayValues) ? stringArrayValues.map((item: string, index: number) => ({
                title: `${categoryName}[${index}]`,
                data: {
                  type: 'input',
                  context: {
                    title: `${categoryName}[${index}]`,
                    model: {
                      value: item,
                      isValid: true,
                      onBlur: () => {}
                    }
                  }
                }
              })) : []
            };

          case 'array':
            // For binaries, containers, kubernetes, packages, use the fields array
            let arrayItems = [];
            if (categoryName === 'binaries' || categoryName === 'containers' || categoryName === 'kubernetes' || categoryName === 'packages') {
              const fields = actualData.context?.fields?.value || actualData.context?.fields || [];
              arrayItems = Array.isArray(fields) ? fields.map((item: any, index: number) => ({
                title: item.context?.title || item.context?.subject || `${categoryName} ${index + 1}`,
                data: item
              })) : [];
            } else {
              // For other arrays such as container_ports, use values
              const values = actualData.context?.values?.value || actualData.context?.values || actualData;
              arrayItems = Array.isArray(values) ? values.map((item: any, index: number) => ({
                title: `${categoryName} ${index + 1}`,
                data: item
              })) : [];
            }
            return {
              type: 'array',
              title: categoryName,
              items: arrayItems
            };
            
          case 'nestedObject':
            const fields = actualData.context?.fields?.value || actualData.context?.fields || [];
            return {
              type: 'nestedObject',
              title: categoryName,
              fields: Array.isArray(fields) ? fields.map((field: any) => ({
                type: field.type || 'unknown',
                title: field.context?.title || field.context?.subject || 'Field',
                data: field
              })) : []
            };
            
          case 'object':
            return {
              type: 'object',
              title: categoryName,
              properties: Object.keys(actualData).map(key => ({
                key: key,
                value: actualData[key],
                type: typeof actualData[key]
              }))
            };
            
          case 'value':
            return {
              type: 'value',
              title: categoryName,
              value: actualData
            };
            
          default:
            return {
              type: 'unknown',
              title: categoryName,
              data: actualData
            };
        }
      } catch (error) {
        console.error('createContextByType error:', error);
        return {
          type: 'error',
          title: categoryName,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    // Function that extracts the four categories of migration_list
    const getMigrationListCategories = (field: any) => {
      try {
        if (!field || !field.context) return [];
        
        // Access the actual value of context
        const context = field.context.value || field.context;
        const actualContext = context?.value || context;
        
        // Access values
        const values = actualContext?.values?.value || actualContext?.values;
        
        if (!values || !Array.isArray(values)) {
          return [];
        }
        
        // Sort the four categories in order
        const categoryOrder = ['binaries', 'containers', 'kubernetes', 'packages'];
        const categories: Array<{name: string, items: any[], dataType?: string, context?: any}> = [];
        
        categoryOrder.forEach(categoryName => {
          const categoryItem = values.find((valueItem: any) => {
            const valueContext = valueItem.context?.value || valueItem.context;
            return valueContext && valueContext.subject === categoryName;
          });
          
          if (categoryItem) {
            // Check the original data structure
            console.log(`ServerAccordion getMigrationListCategories - ${categoryName} raw data:`, categoryItem);
            console.log(`ServerAccordion getMigrationListCategories - ${categoryName} context:`, categoryItem.context);
            console.log(`ServerAccordion getMigrationListCategories - ${categoryName} fields:`, categoryItem.context?.fields);
            
            // For containers, check container_ports
            if (categoryName === 'containers') {
              const fields = categoryItem.context?.fields?.value || categoryItem.context?.fields || [];
              fields.forEach((field: any, index: number) => {
                console.log(`ServerAccordion containers field ${index}:`, field);
                if (field.context?.subject === 'container_ports') {
                  console.log(`ServerAccordion container_ports data:`, field.context);
                  console.log(`ServerAccordion container_ports values:`, field.context?.values);
                  console.log(`ServerAccordion container_ports fields:`, field.context?.fields);
                  
                  // Analyze the type of container_ports
                  const containerPortsType = analyzeDataStructure(field);
                  console.log(`ServerAccordion container_ports type:`, containerPortsType);
                  
                  // Check the values array of container_ports
                  const containerPortsValues = field.context?.values?.value || field.context?.values;
                  console.log(`ServerAccordion container_ports values array:`, containerPortsValues);
                  console.log(`ServerAccordion container_ports values isArray:`, Array.isArray(containerPortsValues));
                  
                  if (Array.isArray(containerPortsValues) && containerPortsValues.length > 0) {
                    console.log(`ServerAccordion container_ports values[0]:`, containerPortsValues[0]);
                    if (containerPortsValues[0].context?.values) {
                      const nestedValues = containerPortsValues[0].context.values.value || containerPortsValues[0].context.values;
                      console.log(`ServerAccordion container_ports nested values:`, nestedValues);
                      console.log(`ServerAccordion container_ports nested values isArray:`, Array.isArray(nestedValues));
                    }
                  }
                }
              });
            }
            
            // Analyze the data shape
            const dataType = analyzeDataStructure(categoryItem);
            console.log(`ServerAccordion getMigrationListCategories - ${categoryName} dataType:`, dataType);
            
            // Build the Context depending on the shape
            const context = createContextByType(categoryItem, dataType, categoryName);
            console.log(`ServerAccordion getMigrationListCategories - ${categoryName} context:`, context);
            
            // Create an item based on the Context
            let items: any[] = [];
            
            switch (dataType) {
              case 'input':
                items = [{
                  header: {
                    title: context.title,
                    icon: 'ic_chevron-right'
                  },
                  content: [{
                    type: 'input',
                    context: {
                      title: context.title,
                      model: {
                        value: context.value,
                        isValid: context.isValid,
                        onBlur: context.onBlur
                      }
                    }
                  }],
                  subItems: [],
                  index: 0
                }];
                break;
                
              case 'stringArray':
                items = (context?.items || []).map((item: any, index: number) => {
                  return {
                    header: {
                      title: `${item.title} [${index}]`,
                      icon: 'ic_chevron-right'
                    },
                    content: [{
                      type: 'input',
                      context: item.data.context
                    }],
                    subItems: [],
                    index: index,
                    itemType: 'input'
                  };
                });
                break;
                
              case 'array':
                items = (context?.items || []).map((item: any, index: number) => {
                  // Analyze the shape of each array element
                  const itemType = analyzeDataStructure(item.data);
                  console.log(`ServerAccordion getMigrationListCategories - ${categoryName} array item ${index} type:`, itemType);
                  
                  // Build content depending on the shape
                  let content: any[] = [];
                  let subItems: any[] = [];
                  
                  switch (itemType) {
                    case 'input':
                      // When context exists (existing approach)
                      if (item.data.context?.model) {
                        content = [{
                          type: 'input',
                          context: {
                            title: item.data.context?.title || item.data.context?.subject || item.title,
                            model: {
                              value: item.data.context?.model?.value || '',
                              isValid: item.data.context?.model?.isValid || true,
                              onBlur: item.data.context?.model?.onBlur || (() => {})
                            }
                          }
                        }];
                      } else {
                        // For a simple value (string, number, boolean)
                        content = [{
                          type: 'input',
                          context: {
                            title: item.data.context?.title || item.data.context?.subject || item.title || `Item ${index}`,
                            model: {
                              value: String(item.data),
                              isValid: true,
                              onBlur: () => {}
                            }
                          }
                        }];
                      }
                      break;
                      
                    case 'object':
                      content = Object.keys(item.data).map(key => ({
                        type: 'property',
                        context: {
                          subject: key,
                          model: {
                            value: item.data[key],
                            isValid: true,
                            onBlur: () => {}
                          }
                        }
                      }));
                      break;
                      
                    case 'nestedObject':
                      const fields = item.data.context?.fields?.value || item.data.context?.fields || [];
                      content = fields.map((field: any) => {
                        const fieldType = analyzeDataStructure(field);
                        console.log(`ServerAccordion array nestedObject field ${field.context?.subject} type:`, fieldType, field);
                        
                        // For an input type, show it as a FieldGroup
                        if (fieldType === 'input') {
                          // When context exists (existing approach)
                          if (field.context?.model) {
                            return {
                              type: 'input',
                              context: {
                                title: field.context?.title || field.context?.subject || 'Field',
                                model: {
                                  value: field.context.model.value || '',
                                  isValid: field.context.model.isValid || true,
                                  onBlur: field.context.model.onBlur || (() => {})
                                }
                              }
                            };
                          } else {
                            // For a simple value (string, number, boolean)
                            return {
                              type: 'input',
                              context: {
                                title: field.context?.title || field.context?.subject || 'Field',
                                model: {
                                  value: String(field),
                                  isValid: true,
                                  onBlur: () => {}
                                }
                              }
                            };
                          }
                        }
                        
                        // For other types, use the existing approach
                        return {
                          type: fieldType,
                          context: field.context || {
                            subject: field.context?.title || field.context?.subject || 'Field',
                            model: {
                              value: field.context?.model?.value || '',
                              isValid: field.context?.model?.isValid || true,
                              onBlur: field.context?.model?.onBlur || (() => {})
                            }
                          }
                        };
                      });
                      break;
                      
                    default:
                      content = getBinaryFields(item.data);
                      subItems = getBinarySubItems(item.data);
                  }
                  
                  return {
                    header: {
                      title: `${item.title} [${index}] (${itemType})`,
                      icon: 'ic_chevron-right'
                    },
                    content: content,
                    subItems: subItems,
                    index: index,
                    itemType: itemType
                  };
                });
                break;
                
              case 'nestedObject':
                // For binaries, containers, kubernetes, packages, handle them like arrays
                if (categoryName === 'binaries' || categoryName === 'containers' || categoryName === 'kubernetes' || categoryName === 'packages') {
                  items = (context?.fields || []).map((field: any, index: number) => {
                    // Analyze the shape of each field
                    const fieldType = analyzeDataStructure(field.data);
                    console.log(`ServerAccordion getMigrationListCategories - ${categoryName} array field ${index} type:`, fieldType);
                    
                    // Build content depending on the shape
                    let content: any[] = [];
                    let subItems: any[] = [];
                    
                    switch (fieldType) {
                      case 'input':
                        // When context exists (existing approach)
                        if (field.data.context?.model) {
                          content = [{
                            type: 'input',
                            context: {
                              title: field.data.context?.title || field.data.context?.subject || field.title,
                              model: {
                                value: field.data.context?.model?.value || '',
                                isValid: field.data.context?.model?.isValid || true,
                                onBlur: field.data.context?.model?.onBlur || (() => {})
                              }
                            }
                          }];
                        } else {
                          // For a simple value (string, number, boolean)
                          content = [{
                            type: 'input',
                            context: {
                              title: field.data.context?.title || field.data.context?.subject || field.title || `Field ${index}`,
                              model: {
                                value: String(field.data),
                                isValid: true,
                                onBlur: () => {}
                              }
                            }
                          }];
                        }
                        break;
                        
                      case 'object':
                        content = Object.keys(field.data).map(key => ({
                          type: 'property',
                          context: {
                            subject: key,
                            model: {
                              value: field.data[key],
                              isValid: true,
                              onBlur: () => {}
                            }
                          }
                        }));
                        break;
                        
                      case 'nestedObject':
                        const nestedFields = field.data.context?.fields?.value || field.data.context?.fields || [];
                        content = nestedFields.map((nestedField: any) => {
                          const nestedFieldType = analyzeDataStructure(nestedField);
                          console.log(`ServerAccordion nestedObject field ${nestedField.context?.subject} type:`, nestedFieldType, nestedField);
                          
                          // For an input type, show it as a FieldGroup
                          if (nestedFieldType === 'input') {
                            // When context exists (existing approach)
                            if (nestedField.context?.model) {
                              return {
                                type: 'input',
                                context: {
                                  title: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                                  model: {
                                    value: nestedField.context?.model?.value || '',
                                    isValid: nestedField.context?.model?.isValid || true,
                                    onBlur: nestedField.context?.model?.onBlur || (() => {})
                                  }
                                }
                              };
                            } else {
                              // For a simple value (string, number, boolean)
                              return {
                                type: 'input',
                                context: {
                                  title: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                                  model: {
                                    value: String(nestedField),
                                    isValid: true,
                                    onBlur: () => {}
                                  }
                                }
                              };
                            }
                          }
                          
                          // For an array type (custom_configs, custom_data_paths, needed_libraries, container_ports, etc.)
                          if (nestedFieldType === 'stringArray' || nestedFieldType === 'array') {
                            const arrayValues = nestedField.context?.values?.value || nestedField.context?.values || [];
                            console.log(`ServerAccordion nestedObject array field ${nestedField.context?.subject} values:`, arrayValues);
                            
                            if (Array.isArray(arrayValues) && arrayValues.length > 0) {
                              // For a string array, handle each string as one input
                              const items = arrayValues.map((item: any, index: number) => {
                                if (typeof item === 'string') {
                                  return {
                                    title: `${nestedField.context?.subject || 'Item'}[${index}]`,
                                    data: {
                                      type: 'input',
                                      context: {
                                        title: `${nestedField.context?.subject || 'Item'}[${index}]`,
                                        model: {
                                          value: item,
                                          isValid: true,
                                          onBlur: () => {}
                                        }
                                      }
                                    }
                                  };
                                } else {
                                  return {
                                    title: `${nestedField.context?.subject || 'Item'}[${index}]`,
                                    data: item
                                  };
                                }
                              });
                              
                              return {
                                type: 'array',
                                context: {
                                  subject: nestedField.context?.subject || 'Array Field',
                                  items: items
                                }
                              };
                            }
                          }
                          
                          // For a nestedObject type (e.g. container_image)
                          if (nestedFieldType === 'nestedObject') {
                            const nestedFields = nestedField.context?.fields?.value || nestedField.context?.fields || [];
                            console.log(`ServerAccordion nestedObject nestedObject field ${nestedField.context?.subject} fields:`, nestedFields);
                            
                            return {
                              type: 'nestedObject',
                              context: {
                                subject: nestedField.context?.subject || 'Nested Object',
                                fields: nestedFields.map((field: any) => ({
                                  type: field.type || 'unknown',
                                  title: field.context?.title || field.context?.subject || 'Field',
                                  data: field
                                }))
                              }
                            };
                          }
                          
                          // Special handling for a nestedObject with values (envs, mount_paths, etc.)
                          if (nestedFieldType === 'nestedObject' && nestedField.context?.values) {
                            const values = nestedField.context.values.value || nestedField.context.values;
                            console.log(`ServerAccordion nestedObject ${nestedField.context?.subject} values:`, values);
                            
                            if (Array.isArray(values)) {
                              return {
                                type: 'array',
                                context: {
                                  subject: nestedField.context?.subject || 'nestedObject',
                                  items: values.map((item: any, index: number) => ({
                                    title: `${nestedField.context?.subject || 'Item'}[${index}]`,
                                    data: item
                                  }))
                                }
                              };
                            }
                          }
                          
                          return {
                            type: nestedFieldType,
                            context: nestedField.context || {
                              subject: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                              model: {
                                value: nestedField.context?.model?.value || '',
                                isValid: nestedField.context?.model?.isValid || true,
                                onBlur: nestedField.context?.model?.onBlur || (() => {})
                              }
                            }
                          };
                        });
                        break;
                        
                      default:
                        content = getBinaryFields(field.data);
                        subItems = getBinarySubItems(field.data);
                    }
                    
                    return {
                      header: {
                        title: `${field.title} [${index}] (${fieldType})`,
                        icon: 'ic_chevron-right'
                      },
                      content: content,
                      subItems: subItems,
                      index: index,
                      fieldType: fieldType
                    };
                  });
                } else {
                  // General nestedObject handling
                  items = (context?.fields || []).map((field: any, index: number) => {
                    // Analyze the shape of each field (one of input, array, nestedObject)
                    const fieldType = analyzeDataStructure(field.data);
                    console.log(`ServerAccordion getMigrationListCategories - ${categoryName} nestedObject field ${index} type:`, fieldType);
                    
                    // Build content and subItems depending on the shape
                    let content: any[] = [];
                    let subItems: any[] = [];
                    
                    switch (fieldType) {
                      case 'input':
                        // When context exists (existing approach)
                        if (field.data.context?.model) {
                          content = [{
                            type: 'input',
                            context: {
                              title: field.data.context?.title || field.title,
                              model: {
                                value: field.data.context?.model?.value || '',
                                isValid: field.data.context?.model?.isValid || true,
                                onBlur: field.data.context?.model?.onBlur || (() => {})
                              }
                            }
                          }];
                        } else {
                          // For a simple value (string, number, boolean)
                          content = [{
                            type: 'input',
                            context: {
                              title: field.data.context?.title || field.title || 'Field',
                              model: {
                                value: String(field.data),
                                isValid: true,
                                onBlur: () => {}
                              }
                            }
                          }];
                        }
                        break;
                        
                    case 'array':
                      const arrayValues = field.data.context?.values?.value || field.data.context?.values || field.data;
                      console.log(`ServerAccordion nestedObject array - ${field.title} values:`, arrayValues);
                      console.log(`ServerAccordion nestedObject array - ${field.title} isArray:`, Array.isArray(arrayValues));
                      
                      if (Array.isArray(arrayValues)) {
                        // For container_ports, handle the nested structure
                        if (field.title === 'container_ports' && arrayValues.length === 1 && arrayValues[0].context?.values) {
                          const nestedValues = arrayValues[0].context.values.value || arrayValues[0].context.values;
                          console.log(`ServerAccordion nestedObject array - ${field.title} nested values:`, nestedValues);
                          
                          if (Array.isArray(nestedValues)) {
                            content = nestedValues.map((nestedItem: any, nestedIndex: number) => {
                              const nestedItemType = analyzeDataStructure(nestedItem);
                              console.log(`ServerAccordion nestedObject nested array item ${nestedIndex} type:`, nestedItemType, nestedItem);
                              
                              // For an input type, show it as a FieldGroup
                              if (nestedItemType === 'input') {
                                // When context exists (existing approach)
                                if (nestedItem.context?.model) {
                                  return {
                                    type: 'input',
                                    context: {
                                      title: nestedItem.context?.title || `${field.title} [${nestedIndex}]`,
                                      model: {
                                        value: nestedItem.context.model.value || '',
                                        isValid: nestedItem.context.model.isValid || true,
                                        onBlur: nestedItem.context.model.onBlur || (() => {})
                                      }
                                    }
                                  };
                                } else {
                                  // For a simple value (string, number, boolean)
                                  return {
                                    type: 'input',
                                    context: {
                                      title: `${field.title} [${nestedIndex}]`,
                                      model: {
                                        value: String(nestedItem),
                                        isValid: true,
                                        onBlur: () => {}
                                      }
                                    }
                                  };
                                }
                              }
                              
                              return {
                                type: nestedItemType,
                                context: {
                                  subject: `${field.title} [${nestedIndex}]`,
                                  model: {
                                    value: nestedItem.context?.model?.value || nestedItem || '',
                                    isValid: true,
                                    onBlur: () => {}
                                  }
                                }
                              };
                            });
                          } else {
                            content = [];
                          }
                        } else if (field.title === 'container_ports' && arrayValues.length === 1 && arrayValues[0].context?.subject?.includes('[0]')) {
                          // For container_ports[0], show the subject and handle it as a nestedObject
                          const containerPortsItem = arrayValues[0];
                          const containerPortsType = analyzeDataStructure(containerPortsItem);
                          console.log(`ServerAccordion container_ports[0] type:`, containerPortsType);
                          
                          // Add an item that shows the subject of container_ports[0]
                          content = [{
                            type: 'nestedObject',
                            context: {
                              subject: containerPortsItem.context?.subject || `${field.title}[0]`,
                              type: containerPortsType
                            }
                          }];
                          
                          if (containerPortsType === 'nestedObject') {
                            // For a nestedObject, handle its fields
                            const nestedFields = containerPortsItem.context?.fields?.value || containerPortsItem.context?.fields || [];
                            console.log(`ServerAccordion container_ports[0] nested fields:`, nestedFields);
                            
                            // Add nested fields to the existing content
                            const nestedContent = nestedFields.map((nestedField: any, nestedIndex: number) => {
                              const nestedFieldType = analyzeDataStructure(nestedField);
                              console.log(`ServerAccordion container_ports[0] nested field ${nestedIndex} type:`, nestedFieldType, nestedField);
                              
                              // For an input type, show it as a FieldGroup
                              if (nestedFieldType === 'input') {
                                // When context exists (existing approach)
                                if (nestedField.context?.model) {
                                  return {
                                    type: 'input',
                                    context: {
                                      title: nestedField.context?.title || `${field.title} [${nestedIndex}]`,
                                      model: {
                                        value: nestedField.context.model.value || '',
                                        isValid: nestedField.context.model.isValid || true,
                                        onBlur: nestedField.context.model.onBlur || (() => {})
                                      }
                                    }
                                  };
                                } else {
                                  // For a simple value (string, number, boolean)
                                  return {
                                    type: 'input',
                                    context: {
                                      title: `${field.title} [${nestedIndex}]`,
                                      model: {
                                        value: String(nestedField),
                                        isValid: true,
                                        onBlur: () => {}
                                      }
                                    }
                                  };
                                }
                              }
                              
                              return {
                                type: nestedFieldType,
                                context: {
                                  subject: `${field.title} [${nestedIndex}]`,
                                  model: {
                                    value: nestedField.context?.model?.value || nestedField || '',
                                    isValid: true,
                                    onBlur: () => {}
                                  }
                                }
                              };
                            });
                            
                            // Add nested fields to content
                            content = [...content, ...nestedContent];
                          }
                        } else {
                          // General array handling
                          content = arrayValues.map((arrayItem: any, arrayIndex: number) => {
                            const arrayItemType = analyzeDataStructure(arrayItem);
                            console.log(`ServerAccordion nestedObject array item ${arrayIndex} type:`, arrayItemType, arrayItem);
                            
                            // For an input type, show it as a FieldGroup
                            if (arrayItemType === 'input') {
                              // When context exists (existing approach)
                              if (arrayItem.context?.model) {
                                return {
                                  type: 'input',
                                  context: {
                                    title: arrayItem.context?.title || `${field.title} [${arrayIndex}]`,
                                    model: {
                                      value: arrayItem.context.model.value || '',
                                      isValid: arrayItem.context.model.isValid || true,
                                      onBlur: arrayItem.context.model.onBlur || (() => {})
                                    }
                                  }
                                };
                              } else {
                                // For a simple value (string, number, boolean)
                                return {
                                  type: 'input',
                                  context: {
                                    title: `${field.title} [${arrayIndex}]`,
                                    model: {
                                      value: String(arrayItem),
                                      isValid: true,
                                      onBlur: () => {}
                                    }
                                  }
                                };
                              }
                            }
                            
                            // For an object, show its properties as individual fields
                            if (arrayItemType === 'object' && typeof arrayItem === 'object' && arrayItem !== null) {
                              return {
                                type: 'object',
                                context: {
                                  subject: `${field.title} [${arrayIndex}]`,
                                  properties: Object.keys(arrayItem).map(key => ({
                                    key: key,
                                    value: arrayItem[key],
                                    type: typeof arrayItem[key]
                                  }))
                                }
                              };
                            }
                            
                            return {
                              type: arrayItemType,
                              context: {
                                subject: `${field.title} [${arrayIndex}]`,
                                model: {
                                  value: arrayItem.context?.model?.value || arrayItem || '',
                                  isValid: true,
                                  onBlur: () => {}
                                }
                              }
                            };
                          });
                        }
                      } else {
                        // If it is not an array, treat it as an empty array
                        console.log(`ServerAccordion nestedObject array - ${field.title} is not array:`, arrayValues);
                        content = [];
                      }
                      break;
                        
                      case 'nestedObject':
                        const nestedFields = field.data.context?.fields?.value || field.data.context?.fields || [];
                        content = nestedFields.map((nestedField: any) => {
                          const nestedFieldType = analyzeDataStructure(nestedField);
                          
                          // For an input type, show it as a FieldGroup
                          if (nestedFieldType === 'input') {
                            // When context exists (existing approach)
                            if (nestedField.context?.model) {
                              return {
                                type: 'input',
                                context: {
                                  title: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                                  model: {
                                    value: nestedField.context?.model?.value || '',
                                    isValid: nestedField.context?.model?.isValid || true,
                                    onBlur: nestedField.context?.model?.onBlur || (() => {})
                                  }
                                }
                              };
                            } else {
                              // For a simple value (string, number, boolean)
                              return {
                                type: 'input',
                                context: {
                                  title: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                                  model: {
                                    value: String(nestedField),
                                    isValid: true,
                                    onBlur: () => {}
                                  }
                                }
                              };
                            }
                          }
                          
                          // For other types, use the existing approach
                          return {
                            type: nestedFieldType,
                            context: nestedField.context || {
                              subject: nestedField.context?.title || nestedField.context?.subject || 'Nested Field',
                              model: {
                                value: nestedField.context?.model?.value || '',
                                isValid: nestedField.context?.model?.isValid || true,
                                onBlur: nestedField.context?.model?.onBlur || (() => {})
                              }
                            }
                          };
                        });
                        break;
                        
                      default:
                        content = getBinaryFields(field.data);
                        subItems = getBinarySubItems(field.data);
                    }
                    
                    return {
                      header: {
                        title: `${field.title} (${fieldType})`,
                        icon: 'ic_chevron-right'
                      },
                      content: content,
                      subItems: subItems,
                      index: index,
                      fieldType: fieldType
                    };
                  });
                }
                break;
                
              case 'object':
                items = [{
                  header: {
                    title: context.title,
                    icon: 'ic_chevron-right'
                  },
                  content: (context?.properties || []).map((prop: any) => ({
                    type: 'property',
                    context: {
                      subject: prop.key,
                      model: {
                        value: prop.value,
                        isValid: true,
                        onBlur: () => {}
                      }
                    }
                  })),
                  subItems: [],
                  index: 0
                }];
                break;
                
              case 'value':
                items = [{
                  header: {
                    title: context.title,
                    icon: 'ic_chevron-right'
                  },
                  content: [{
                    type: 'value',
                    context: {
                      subject: 'value',
                      model: {
                        value: context.value,
                        isValid: true,
                        onBlur: () => {}
                      }
                    }
                  }],
                  subItems: [],
                  index: 0
                }];
                break;
                
              default:
                items = [{
                  header: {
                    title: context.title,
                    icon: 'ic_chevron-right'
                  },
                  content: getBinaryFields(categoryItem),
                  subItems: getBinarySubItems(categoryItem),
                  index: 0
                }];
            }
            
            categories.push({
              name: categoryName,
              items: items,
              dataType: dataType,
              context: context
            });
          } else {
            // Add an empty array even if the category is absent
            categories.push({
              name: categoryName,
              items: [],
              dataType: 'empty',
              context: null
            });
          }
        });
        
        return categories;
      } catch (error) {
        console.error('getMigrationListCategories error:', error);
        return [];
      }
    };

    // Function that extracts the binaries entry from migration_list (kept as is)
    const getBinariesFromMigrationList = (field: any) => {
      try {
        if (!field || !field.context) return [];
        
        // Access the actual value of context
        const context = field.context.value || field.context;
        const actualContext = context?.value || context;
        
        // Access values
        const values = actualContext?.values?.value || actualContext?.values;
        
        if (!values || !Array.isArray(values)) {
          return [];
        }
        
        // Find the entry whose subject is "binaries" in values
        const binariesItem = values.find((valueItem: any) => {
          const valueContext = valueItem.context?.value || valueItem.context;
          return valueContext && valueContext.subject === 'binaries';
        });
        
        if (!binariesItem) {
          return [];
        }
        
        // Get the binaries entry's fields and convert them into BinaryAccordion format
        const binariesContext = binariesItem.context?.value || binariesItem.context;
        const binariesFields = binariesContext?.fields?.value || binariesContext?.fields;
        
        if (!binariesFields || !Array.isArray(binariesFields)) {
          return [];
        }
        
        // Convert to BinaryAccordion format
        return binariesFields.map((binaryField: any, index: number) => {
          const fieldContext = binaryField.context?.value || binaryField.context;
          return {
            header: {
              title: fieldContext?.subject || `Binary ${index + 1}`,
              icon: 'ic_chevron-right'
            },
            content: getBinaryFields(binaryField),
            subItems: getBinarySubItems(binaryField),
            index: index
          };
        });
      } catch (error) {
        console.error('getBinariesFromMigrationList error:', error);
        return [];
      }
    };


    // Function that extracts a Binary item's basic fields
    const getBinaryFields = (binaryItem: any) => {
      try {
        console.log('ServerAccordion getBinaryFields - binaryItem:', binaryItem);
        
        // Get the actual value of a Vue reactive object
        const actualItem = binaryItem?.value || binaryItem;
        console.log('ServerAccordion getBinaryFields - actualItem:', actualItem);
        
        // Access the actual value of context
        const context = actualItem?.context?.value || actualItem?.context;
        console.log('ServerAccordion getBinaryFields - context:', context);
        
        // If context is a reactive object, access it via .value
        const actualContext = context?.value || context;
        console.log('ServerAccordion getBinaryFields - actualContext:', actualContext);
        
        // Access fields
        const fields = actualContext?.fields?.value || actualContext?.fields;
        console.log('ServerAccordion getBinaryFields - fields:', fields);
        
        // For a nestedObjectDisplay type, extract the fields from fields
        if (fields && Array.isArray(fields)) {
          console.log('ServerAccordion getBinaryFields - fields is array, length:', fields.length);
          
          // Extract all fields (including array fields)
          const allFields = fields;
          
          // For an input type, convert it to show title and model.value
          const processedFields = allFields.map((field: any) => {
            const fieldContext = field.context?.value || field.context;
            const actualFieldContext = fieldContext?.value || fieldContext;
            
            console.log('ServerAccordion getBinaryFields - processing field:', {
              fieldType: field.type,
              fieldContext: actualFieldContext,
              hasTitle: !!actualFieldContext?.title,
              hasModel: !!actualFieldContext?.model
            });
            
            // For an input type
            if (field.type === 'input' && actualFieldContext?.title && actualFieldContext?.model) {
              console.log('ServerAccordion getBinaryFields - processing input field:', actualFieldContext.title);
              return {
                ...field,
                type: 'input', // Keep the type information
                context: {
                  ...actualFieldContext,
                  subject: actualFieldContext.title,
                  model: {
                    ...actualFieldContext.model,
                    value: actualFieldContext.model.value || actualFieldContext.model.value?.value || ''
                  }
                }
              };
            }
            
            // For a stringArray type (custom_configs, custom_data_paths, needed_libraries)
            if (field.type === 'stringArray' || field.type === 'array' || ['custom_configs', 'custom_data_paths', 'needed_libraries'].includes(actualFieldContext?.subject)) {
              console.log('ServerAccordion getBinaryFields - processing array field:', actualFieldContext?.subject);
              const arrayValues = actualFieldContext?.values?.value || actualFieldContext?.values || actualFieldContext?.value || [];
              
              if (Array.isArray(arrayValues)) {
                // For a string array, handle each string as one input
                const items = arrayValues.map((item: any, index: number) => {
                  if (typeof item === 'string') {
                    return {
                      title: `${actualFieldContext?.subject || 'Item'}[${index}]`,
                      data: {
                        type: 'input',
                        context: {
                          title: `${actualFieldContext?.subject || 'Item'}[${index}]`,
                          model: {
                            value: item,
                            isValid: true,
                            onBlur: () => {}
                          }
                        }
                      }
                    };
                  } else {
                    return {
                      title: `${actualFieldContext?.subject || 'Item'}[${index}]`,
                      data: item
                    };
                  }
                });
                
                return {
                  ...field,
                  type: 'array',
                  context: {
                    subject: actualFieldContext?.subject || 'Array Field',
                    items: items
                  }
                };
              }
            }
            
            // Add type information explicitly to every field
            return {
              ...field,
              type: field.type || 'unknown'
            };
          });
          
          console.log('ServerAccordion getBinaryFields - processedFields:', processedFields);
          return processedFields;
        }
        
        // fallback: for a simple object, extract the fields directly
        const simpleFields: any[] = [];
        
        if (actualItem && typeof actualItem === 'object') {
          Object.keys(actualItem).forEach(key => {
            if (key !== 'custom_configs' && key !== 'custom_data_paths' && key !== 'needed_libraries') {
              simpleFields.push({
                context: {
                  subject: key,
                  model: {
                    value: actualItem[key],
                    isValid: true,
                    onBlur: () => {}
                  }
                }
              });
            }
          });
        }
        
        console.log('ServerAccordion getBinaryFields - simpleFields:', simpleFields);
        return simpleFields;
      } catch (error) {
        console.error('ServerAccordion getBinaryFields error:', error);
        return [];
      }
    };

    // Function that gets a Binary item's child array entries
    const getBinarySubItems = (binaryItem: any) => {
      try {
        console.log('ServerAccordion getBinarySubItems - binaryItem:', binaryItem);
        
        // Get the actual value of a Vue reactive object
        const actualItem = binaryItem?.value || binaryItem;
        console.log('ServerAccordion getBinarySubItems - actualItem:', actualItem);
        
        // Access the actual value of context
        const context = actualItem?.context?.value || actualItem?.context;
        console.log('ServerAccordion getBinarySubItems - context:', context);
        
        // If context is a reactive object, access it via .value
        const actualContext = context?.value || context;
        console.log('ServerAccordion getBinarySubItems - actualContext:', actualContext);
        
        // Access fields
        const fields = actualContext?.fields?.value || actualContext?.fields;
        console.log('ServerAccordion getBinarySubItems - fields:', fields);
        
        const subItems: any[] = [];
        
        // For a nestedObjectDisplay type, extract the array fields from fields
        if (fields && Array.isArray(fields)) {
          console.log('ServerAccordion getBinarySubItems - fields is array, length:', fields.length);
          
          // Extract only the array fields from fields
          const arrayFields = fields.filter((field: any) => {
            const fieldContext = field.context?.value || field.context;
            const actualFieldContext = fieldContext?.value || fieldContext;
            return actualFieldContext && (field.type === 'stringArray' || field.type === 'array' || ['custom_configs', 'custom_data_paths', 'needed_libraries'].includes(actualFieldContext.subject));
          });
          
          console.log('ServerAccordion getBinarySubItems - arrayFields:', arrayFields);
          
          arrayFields.forEach((field: any) => {
            const fieldContext = field.context?.value || field.context;
            const actualFieldContext = fieldContext?.value || fieldContext;
            
            if (actualFieldContext) {
              // Get the data from the values array
              const values = actualFieldContext.values?.value || actualFieldContext.values || actualFieldContext.value || [];
              
              if (Array.isArray(values) && values.length > 0) {
                subItems.push({
                  type: actualFieldContext.subject,
                  items: values.map((item: any, index: number) => ({
                    context: {
                      subject: `${actualFieldContext.subject}[${index}]`,
                      model: {
                        value: typeof item === 'string' ? item : JSON.stringify(item),
                        isValid: true,
                        onBlur: () => {}
                      }
                    }
                  }))
                });
              }
            }
          });
        } else {
          // fallback: for a simple object, extract the array fields directly
          if (actualItem && typeof actualItem === 'object') {
            ['custom_configs', 'custom_data_paths', 'needed_libraries'].forEach(key => {
              if (actualItem[key] && Array.isArray(actualItem[key])) {
                subItems.push({
                  type: key,
                  items: actualItem[key].map((item: any, index: number) => ({
                    context: {
                      subject: `${key} ${index + 1}`,
                      model: {
                        value: typeof item === 'string' ? item : JSON.stringify(item),
                        isValid: true,
                        onBlur: () => {}
                      }
                    }
                  }))
                });
              }
            });
          }
        }
        
        console.log('ServerAccordion getBinarySubItems - subItems:', subItems);
        return subItems;
      } catch (error) {
        console.error('ServerAccordion getBinarySubItems error:', error);
        return [];
      }
    };

    // Function that finds the migration_list field in content
    const getMigrationListFromContent = (content: any[]) => {
      console.log('### ServerAccordion getMigrationListFromContent - content:', content);
      try {
        if (!content || !Array.isArray(content)) return null;
        
        const migrationListField = content.find((field: any) => 
          field.context && field.context.subject === 'migration_list'
        );
        
        if (migrationListField) {
          console.log('ServerAccordion getMigrationListFromContent - migrationListField:', migrationListField);
          return migrationListField;
        }
        
        return null;
      } catch (error) {
        console.error('ServerAccordion getMigrationListFromContent error:', error);
        return null;
      }
    };

    // Function that converts all elements of the migration_list field into BinaryAccordion format
    const getMigrationListItems = (migrationListField: any) => {
      try {
        if (!migrationListField || !migrationListField.context) {
          return [];
        }
        
        // Access the actual value of the migration_list field
        const context = migrationListField.context.value || migrationListField.context;
        const actualContext = context?.value || context;
        const migrationListData = actualContext?.values?.value || actualContext?.values;
        
        console.log('ServerAccordion getMigrationListItems - migrationListData:', migrationListData);
        
        if (!migrationListData || typeof migrationListData !== 'object') {
          return [];
        }
        
        const items: any[] = [];
        
        // Handle the binaries array
        if (migrationListData.binaries && Array.isArray(migrationListData.binaries)) {
          items.push({
            title: 'Binaries',
            //items: getBinariesAccordionItems(migrationListData.binaries)
          });
        }
        
        // Handle the containers array
        if (migrationListData.containers && Array.isArray(migrationListData.containers)) {
          items.push({
            title: 'Containers',
            //items: getBinariesAccordionItems(migrationListData.containers)
          });
        }
        
        // Handle the kubernetes array
        if (migrationListData.kubernetes && Array.isArray(migrationListData.kubernetes)) {
          items.push({
            title: 'Kubernetes',
            //items: getBinariesAccordionItems(migrationListData.kubernetes)
          });
        }
        
        // Handle the packages array
        if (migrationListData.packages && Array.isArray(migrationListData.packages)) {
          items.push({
            title: 'Packages',
            //items: getBinariesAccordionItems(migrationListData.packages)
          });
        }
        
        console.log('ServerAccordion getMigrationListItems - items:', items);
        return items;
      } catch (error) {
        console.error('ServerAccordion getMigrationListItems error:', error);
        return [];
      }
    };

    // Function that converts Binaries into BinaryAccordion format
    const getBinariesAccordionItems = (binariesList: any[]) => {
      try {
        if (!binariesList || !Array.isArray(binariesList)) {
          return [];
        }
        
        return binariesList.map((binaryItem, index) => {
          // Get the actual value of a Vue reactive object
          const actualBinaryItem = binaryItem?.value || binaryItem;
          
          // Extract the binary item's fields
          const binaryFields = getBinaryFields(actualBinaryItem);
          const subItems = getBinarySubItems(actualBinaryItem);
          
          return {
            header: {
              title: actualBinaryItem?.name || actualBinaryItem?.context?.subject || `Binary ${index + 1}`,
              icon: 'ic_chevron-right'
            },
            content: binaryFields,
            subItems: subItems,
            index: index
          };
        });
      } catch (error) {
        console.error('ServerAccordion getBinariesAccordionItems error:', error);
        return [];
      }
    };

    return {
      openIndex,
      toggleAccordion,
      isOpen,
      start,
      end,
      handleDeleteServer,
      handleDeleteMigrationItem,
      handleDeleteMigrationSubItem,
      toggleMigrationListContext,
      isMigrationListContextOpen,
      getFieldTitle,
      hasFieldModel,
      getFieldModel,
      logMigrationList,
      getMigrationListContent,
      getMigrationListContext,
      analyzeDataStructure,
      createContextByType,
      getMigrationListCategories,
      getBinariesFromMigrationList,
      getBinaryFields,
      getBinarySubItems,
      getMigrationListFromContent,
      getMigrationListItems,
      getBinariesAccordionItems
    };
  }
};
</script>

<template>
  <div class="server-accordion">
    <div v-for="(item, index) in items" :key="index" class="server-accordion-item">
      <div class="server-accordion-header">
        <slot
          name="header"
          :header="item.header"
          :item="{ header: item.header, content: item.content }"
          :index="index"
          :isOpen="isOpen(index)"
          :click="() => toggleAccordion(index)"
          :deleteServer="() => handleDeleteServer(index)"
        >
          <div class="w-full h-full flex justify-between items-center" @click="toggleAccordion(index)">
            <div class="flex items-center">
              <button
                :class="['chevron-button', isOpen(index) && 'accordion-isOpen']"
                @click.stop="toggleAccordion(index)"
              >
                {{ isOpen(index) ? '▼' : '▶' }}
              </button>
              {{ item.header?.title || `Server ${index + 1}` }}
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">{{ item.content?.length || 0 }} items</span>
              <button
                class="delete-button"
                @click.stop="handleDeleteServer(index)"
              >
                ✕
              </button>
            </div>
          </div>
        </slot>
      </div>

      <transition
        name="accordion"
        @enter="start"
        @after-enter="end"
        @before-leave="start"
        @after-leave="end"
      >
        <div v-show="isOpen(index)" class="server-accordion-content">
          <slot
            name="content"
            :content="item.content"
            :item="{ header: item.header, content: item.content }"
            :serverIndex="index"
          >
           
            <div
              v-for="(field, fieldIndex) of item.content" 
              :key="fieldIndex"
              class="field-group"
            >
              <!-- For a migration_list field, show it as a hierarchy -->
              <div v-if="getFieldTitle(field) === 'migration_list'" class="migration-list-field">
                <div class="migration-list-header">
                  <div class="field-title-box">
                    {{ getFieldTitle(field) }}
                  </div>
                  <div class="field-content-box">
                    <div @click="logMigrationList(field)" style="cursor: pointer; margin-bottom: 8px;">
                      {{ getMigrationListContent(field) }} (click to view log)
                    </div>
                  </div>
                </div>
                
                <!-- Show the four categories of migration_list -->
                <div class="migration-categories">
                  <div v-for="category in getMigrationListCategories(field)" :key="category.name" class="migration-category">
                    <div class="category-name">
                      - {{ category.name }} : 
                      <span class="data-type-badge" :class="`type-${category.dataType}`">
                        {{ category.dataType }}
                      </span>
                    </div>
                    <div class="category-content">
                      <div v-if="category.items && category.items.length > 0">
                        <div v-for="(item, itemIndex) in category.items" :key="itemIndex" class="category-item">
                          <div class="item-title">
                            {{ item.header?.title || `${category.name} ${itemIndex + 1}` }}
                            <span v-if="item.itemType || item.fieldType" class="item-type-badge" :class="`type-${item.itemType || item.fieldType}`">
                              {{ item.itemType || item.fieldType }}
                            </span>
                          </div>
                          
                          <!-- Show the item's content -->
                          <div v-if="item.content && item.content.length > 0" class="item-content">
                            <div v-for="contentField in item.content" :key="contentField.context?.subject" class="content-field">
                              <!-- Debug log -->
                              <!-- <div v-if="contentField.type === 'input'" style="background: yellow; padding: 4px; margin: 2px 0; font-size: 10px;">
                                    DEBUG: input field detected - {{ contentField.context?.title }}
                                    <br>Full context: {{ JSON.stringify(contentField.context, null, 2) }}
                              </div> -->
                              
                              <!-- For an input type, use FieldGroup -->
                              <div v-if="contentField.type === 'input' && contentField.context?.title && contentField.context?.model" style="background: lightblue; padding: 4px; margin: 2px 0;">
                                <!-- <div style="font-size: 10px; color: blue;">
                                  DEBUG FieldGroup: title={{ contentField.context.title }}, value={{ contentField.context.model.value }}, isValid={{ contentField.context.model.isValid }}
                                </div> -->
                                <FieldGroup
                                  :title="contentField.context.title"
                                  :model-value="contentField.context.model.value || ''"
                                  :invalid="!contentField.context.model.isValid"
                                  :on-blur="contentField.context.model.onBlur"
                                  @update:model-value="(value) => contentField.context.model.value = value"
                                />
                              </div>
                              <!-- For an object type, show its properties -->
                              <div v-else-if="contentField.type === 'object' && contentField.context?.properties" class="object-display">
                                <div class="object-title">{{ contentField.context.subject }}:</div>
                                <div v-for="prop in contentField.context.properties" :key="prop.key" class="object-property">
                                  <span class="property-key">{{ prop.key }}:</span>
                                  <span class="property-value">{{ prop.value }}</span>
                                  <span class="property-type">({{ prop.type }})</span>
                                </div>
                              </div>
                              
                              <!-- For an array type, show the array items -->
                              <div v-else-if="contentField.type === 'array' && contentField.context?.items" class="array-display">
                                <div class="array-title">
                                  {{ contentField.context?.subject }}:
                                  <span class="array-type">(type: array)</span>
                                </div>
                                <div v-for="(item, itemIndex) in contentField.context.items" :key="itemIndex" class="array-item">
                                  <div class="array-item-title">{{ item.title }} [{{ itemIndex }}]:</div>
                                  <div v-if="item.data && typeof item.data === 'object'" class="array-item-content">
                                    <div v-for="(value, key) in item.data" :key="key" class="array-item-property">
                                      <span class="property-key">{{ key }}:</span>
                                      <span class="property-value">{{ value }}</span>
                                    </div>
                                  </div>
                                  <div v-else-if="item.data && item.data.context" class="array-item-content">
                                    <div class="array-item-context">
                                      <div v-if="item.data.context.model" class="context-model">
                                        <span class="property-key">value:</span>
                                        <span class="property-value">{{ item.data.context.model.value || 'N/A' }}</span>
                                      </div>
                                      <div v-if="item.data.context.subject" class="context-subject">
                                        <span class="property-key">subject:</span>
                                        <span class="property-value">{{ item.data.context.subject }}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div v-else class="array-item-content">
                                    <span class="property-value">{{ item.data || 'N/A' }}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <!-- For a nestedObject type, show subject and type -->
                              <div v-else-if="contentField.type === 'nestedObject'" class="nested-object-display">
                                <div class="nested-object-title">
                                  {{ contentField.context?.subject }}:
                                  <span class="nested-object-type">(type: nestedObject)</span>
                                </div>
                                <div v-if="contentField.context?.fields" class="nested-object-fields">
                                  <div v-for="(field, fieldIndex) in contentField.context.fields" :key="fieldIndex" class="nested-field">
                                    <!-- For an input type, use FieldGroup -->
                                    <FieldGroup
                                      v-if="field.type === 'input' && field.data && field.data.context && field.data.context.model"
                                      :title="field.data.context.title || field.data.context.subject || field.title"
                                      :model-value="field.data.context.model.value || ''"
                                      :invalid="!field.data.context.model.isValid"
                                      :on-blur="field.data.context.model.onBlur"
                                      @update:model-value="(value) => field.data.context.model.value = value"
                                    />
                                    <!-- For other types, use the existing approach -->
                                    <div v-else class="nested-field-content">
                                      <div class="nested-field-title">{{ field.title }}:</div>
                                      <div v-if="field.data && field.data.context" class="nested-field-data">
                                        <span class="field-value">{{ field.data.context?.model?.value || field.data.context?.subject || 'N/A' }}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <!-- For other types, use the existing approach -->
                              <div v-else class="field-display">
                                <span class="field-name">{{ contentField.context?.subject }}:</span>
                                <span class="field-value">{{ contentField.context?.model?.value || 'N/A' }}</span>
                                <span style="color: red; font-size: 10px;">(type: {{ contentField.type }})</span>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Show the item's subItems (using BinaryAccordion) -->
                          <div v-if="item.subItems && item.subItems.length > 0" class="item-sub-items">
                            <div v-for="subItem in item.subItems" :key="subItem.type" class="sub-item">
                              <div class="sub-item-title">{{ subItem.type }}</div>
                              <div v-if="subItem.items && subItem.items.length > 0">
                                <BinaryAccordion 
                                  :items="subItem.items"
                                  @delete-server="(binaryIndex) => handleDeleteMigrationItem(index, binaryIndex)"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <!-- When the item is simple -->
                          <div v-if="(!item.content || item.content.length === 0) && (!item.subItems || item.subItems.length === 0)" class="simple-item">
                            <span class="simple-item-text">Item available</span>
                          </div>
                        </div>
                      </div>
                      <div v-else class="no-items">No items</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- For a normal field, show it in the existing way -->
              <div v-else class="field-group flex border-bottom">
              <div class="field-title-box">
                {{ getFieldTitle(field) }}
              </div>
              <div class="field-content-box">
                <input
                  v-if="hasFieldModel(field)"
                  v-model="getFieldModel(field).value"
                  class="text-input"
                  :class="{ 'invalid': !getFieldModel(field).isValid }"
                  @blur="getFieldModel(field).onBlur"
                />
                <div v-else class="text-gray-500">
                  <span>{{ JSON.stringify(field.context, null, 2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </slot>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.server-accordion {
  width: 100%;
}

.server-accordion-item {
  border: 1px solid #e5e7eb;
  margin-bottom: 8px;
  border-radius: 4px;
}

.server-accordion-header {
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
  cursor: pointer;
  padding: 8px 16px;
}

.server-accordion-content {
  padding: 16px;
  background-color: #ffffff;
}

.field-group {
  display: flex;
  align-items: center;
  min-height: 44px;
  border-bottom: 1px solid #e5e7eb;
}

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
  align-items: center;
  width: 310px;
  height: 44px;
  padding: 6px 16px 6px 16px;
}

.border-bottom {
  border-bottom: 1px solid #e5e7eb;
}

.subject-title {
  padding-right: 16px;
  padding-left: 16px;
  margin-top: 16px;
  height: 44px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #6b7280;
  font-weight: 600;
}

.migration-list-section {
  margin: 8px 0;
  padding: 8px;
  background-color: #f8fafc;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
}

.migration-item {
  margin: 8px 0;
  padding: 8px;
  background-color: #f0fdf4;
  border-left: 2px solid #10b981;
  border-radius: 4px;
}

.binary-sub-item {
  margin: 8px 0;
  padding: 8px;
  background-color: #f9fafb;
  border-left: 2px solid #6b7280;
  border-radius: 4px;
}

.binary-array-content {
  margin-top: 8px;
}

.chevron-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 8px;
  font-size: 12px;
  color: #666;
  transition: transform 0.2s ease;
}

.chevron-button:hover {
  color: #333;
}

.chevron-button.accordion-isOpen {
  transform: rotate(90deg);
}

.delete-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
  color: #999;
  border-radius: 3px;
}

.delete-button:hover {
  background-color: #f5f5f5;
  color: #666;
}

.text-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
  background-color: #ffffff;
  transition: border-color 0.2s ease;
}

.text-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.text-input.invalid {
  border-color: #ef4444;
}

.text-input.invalid:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.accordion-enter-active,
.accordion-leave-active {
  transition: height 0.3s ease;
  overflow: hidden;
}

.accordion-enter-from,
.accordion-leave-to {
  height: 0;
}

.migration-list-context {
  margin: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background-color: #f9fafb;
}

.context-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
}

.context-content {
  padding: 16px;
  background-color: #ffffff;
}

.sub-item-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #e5e7eb;
}

.sub-sub-item-title {
  font-weight: 500;
  color: #6b7280;
  margin: 8px 0 4px 0;
  padding: 2px 0;
  font-size: 14px;
}

.sub-item-content {
  margin: 8px 0;
  padding: 8px;
  background-color: #f9fafb;
  border-radius: 4px;
  border-left: 3px solid #3b82f6;
}

.migration-list-field {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin: 8px 0;
  background-color: #f9fafb;
}

.migration-list-header {
  display: flex;
  align-items: center;
  min-height: 44px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f3f4f6;
}

.migration-categories {
  padding: 16px;
  background-color: #ffffff;
}

.migration-category {
  margin: 8px 0;
  padding: 8px;
  border-left: 2px solid #3b82f6;
  background-color: #f8fafc;
  border-radius: 4px;
}

.category-name {
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
  font-size: 14px;
}

.category-content {
  margin-left: 16px;
}

.category-item {
  margin: 4px 0;
  padding: 4px 8px;
  background-color: #ffffff;
  border-radius: 3px;
  border: 1px solid #e5e7eb;
}

.item-title {
  font-weight: 500;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-type-badge {
  display: inline-block;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.item-content {
  margin-left: 8px;
}

.content-field {
  display: flex;
  margin: 2px 0;
  font-size: 12px;
}

.field-display {
  display: flex;
  margin: 2px 0;
  font-size: 12px;
}

.field-name {
  font-weight: 500;
  color: #4b5563;
  margin-right: 8px;
  min-width: 80px;
}

.field-value {
  color: #6b7280;
}

.no-items {
  color: #9ca3af;
  font-style: italic;
  font-size: 12px;
}

.item-sub-items {
  margin: 8px 0;
  padding: 8px;
  background-color: #f1f5f9;
  border-radius: 4px;
  border-left: 2px solid #10b981;
}

.sub-item {
  margin: 4px 0;
}

.simple-item {
  margin: 4px 0;
  padding: 4px 8px;
  background-color: #fef3c7;
  border-radius: 3px;
  border: 1px solid #f59e0b;
}

.simple-item-text {
  color: #92400e;
  font-size: 12px;
  font-style: italic;
}

.data-type-badge {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.type-input {
  background-color: #dbeafe;
  color: #1e40af;
}

.type-array {
  background-color: #dcfce7;
  color: #166534;
}

.type-nestedObject {
  background-color: #fef3c7;
  color: #92400e;
}

.type-object {
  background-color: #e0e7ff;
  color: #3730a3;
}

.type-value {
  background-color: #f3e8ff;
  color: #7c3aed;
}

.type-unknown {
  background-color: #f3f4f6;
  color: #6b7280;
}

.type-empty {
  background-color: #fef2f2;
  color: #dc2626;
}

.type-error {
  background-color: #fef2f2;
  color: #dc2626;
}

.object-display {
  margin: 4px 0;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background-color: #f9fafb;
}

.object-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
  font-size: 13px;
}

.object-property {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  padding: 2px 0;
  font-size: 12px;
}

.property-key {
  font-weight: 500;
  color: #6b7280;
  min-width: 80px;
}

.property-value {
  color: #111827;
  flex: 1;
}

.property-type {
  color: #9ca3af;
  font-size: 10px;
}

.nested-object-display {
  margin: 4px 0;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background-color: #f3f4f6;
}

.nested-object-title {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nested-object-type {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

.array-display {
  margin: 4px 0;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background-color: #f0f9ff;
}

.array-title {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.array-type {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

.array-item {
  margin: 4px 0;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  background-color: #ffffff;
}

.array-item-title {
  font-weight: 500;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 4px;
}

.array-item-content {
  margin-left: 8px;
}

.array-item-property {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  font-size: 11px;
}

.nested-object-fields {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  background-color: #ffffff;
}

.nested-field {
  margin: 4px 0;
  padding: 4px 0;
}

.nested-field-title {
  font-weight: 500;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 2px;
}

.nested-field-content {
  margin-left: 8px;
}

.field-value {
  color: #111827;
  font-size: 11px;
}

.array-item-context {
  margin-left: 8px;
}

.context-model,
.context-subject {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
  font-size: 11px;
}

.nested-field-data {
  margin-left: 8px;
}
</style>