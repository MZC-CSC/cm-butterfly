import { ref, Ref, reactive } from 'vue';

// JsonSchema type definitions
export interface JsonSchema {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
  required?: string[];
  default?: any;
  description?: string;
  example?: any;
}

// Context type definitions
export interface InputContext {
  type: 'input';
  context: {
    title: string;
    model: any;
    isRequired: boolean;
    description?: string;
    placeholder?: string;
  };
}

export interface SelectContext {
  type: 'select';
  context: {
    title: string;
    model: any;
    isRequired: boolean;
    description?: string;
    options: any[];
  };
}

export interface ArrayContext {
  type: 'array';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
  };
}

// Context definitions per ArrayType
export interface StringArrayContext {
  type: 'stringArray';
  context: {
    title: string;
    values: string[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface IntegerArrayContext {
  type: 'integerArray';
  context: {
    title: string;
    values: number[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface BooleanArrayContext {
  type: 'booleanArray';
  context: {
    title: string;
    values: boolean[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface BasicArrayContext {
  type: 'basicArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface BasicObjectArrayContext {
  type: 'basicObjectArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface NestedObjectArrayContext {
  type: 'nestedObjectArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface MixedArrayContext {
  type: 'mixedArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface EmptyArrayContext {
  type: 'emptyArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface UnknownArrayContext {
  type: 'unknownArray';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    arrayType?: string;
  };
}

export interface NestedObjectContext {
  type: 'nestedObject';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
    subject?: string;  // Form.vue compatibility
    rawData?: any;    // For storing empty object data
  };
}

export interface AccordionContext {
  type: 'accordion';
  context: {
    title: string;
    values: any[];
    isRequired: boolean;
    description?: string;
  };
  schema: JsonSchema;
}

export interface UnknownTypeContext {
  type: 'unknownType';
  context: {
    title: string;
    subject: string;
    isRequired: boolean;
    description?: string;
    reason: string;
    skipReason: string;
  };
}

export interface NestedObjectArrayItemContext {
  type: 'nestedObjectArrayItem';
  context: {
    subject: string;
    values: FormContext[];
    isRequired: boolean;
  };
}

export type FormContext = 
  | InputContext 
  | SelectContext 
  | ArrayContext
  | NestedObjectContext 
  | StringArrayContext
  | IntegerArrayContext
  | BooleanArrayContext
  | BasicArrayContext
  | BasicObjectArrayContext
  | NestedObjectArrayContext
  | NestedObjectArrayItemContext
  | MixedArrayContext
  | EmptyArrayContext
  | UnknownArrayContext
  | UnknownTypeContext
  | AccordionContext;

export interface FixedModel {
  path_params: Record<string, any>;
  query_params: Record<string, any>;
}

/**
 * Common Task Editor Model
 * Model management for a generic task editor
 */
export function useCommonTaskEditorModel() {
  const formContext = ref<FormContext[]>([]);
  const paramsContext = ref<any>({});
  const componentNameModel = ref<any>();
  
  let originalObject: any = null;
  let originalSchema: JsonSchema | null = null;
  let taskComponentModel: JsonSchema | null = null;

  // Helper functions
  function getContextSubject(item: any): string {
    return item.context?.subject || item.context?.title || '';
  }

  function getContextValues(item: any): any[] {
    return item.context?.values || [];
  }

  function setContextValues(item: any, values: any[]): void {
    if (item.context) {
      item.context.values = values;
    }
  }

  function getModelValue(item: any): any {
    return item.context?.model?.value;
  }

  function setModelValue(item: any, value: any): void {
    if (item.context?.model) {
      item.context.model.value = value;
    }
  }
  
  // Object complexity analysis function
  function analyzeObjectComplexity(schema: any, data: any): boolean {
    console.log(`🔍 Analyzing object complexity:`, { schema, data });
    
    if (!schema || !schema.properties) {
      console.log(`  - No schema properties, treating as simple object`);
      return false;
    }
    
    const properties = schema.properties;
    const propertyKeys = Object.keys(properties);
    
    // 1. Many properties means a complex object
    if (propertyKeys.length > 5) {
      console.log(`  - Complex object: too many properties (${propertyKeys.length})`);
      return true;
    }
    
    // 2. A nested object or array means a complex object
    const hasNestedStructures = propertyKeys.some(key => {
      const prop = properties[key];
      return prop.type === 'object' || prop.type === 'array';
    });
    
    if (hasNestedStructures) {
      console.log(`  - Complex object: has nested structures`);
      return true;
    }
    
    // 3. If the actual data has a complex structure, it is a complex object
    if (data && typeof data === 'object') {
      const dataKeys = Object.keys(data);
      const hasComplexData = dataKeys.some(key => {
        const value = data[key];
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      });
      
      if (hasComplexData) {
        console.log(`  - Complex object: has complex data structures`);
        return true;
      }
    }
    
    console.log(`  - Simple object: basic structure`);
    return false;
  }
  
  // ArrayType decision function - schema first, values set from data
  function determineArrayTypeFromSchema(fieldSchema: JsonSchema, key: string, arrayData: any[]): string {
    console.log(`🔍 Determining ArrayType for ${key}:`, { fieldSchema, arrayData });
    
    // 1. Analyze the schema's items type (priority 1)
    // If items exists, treat it as an array type (also handles when type is not specified)
    if (fieldSchema.type === 'array' || fieldSchema.items) {
      const itemType = fieldSchema.items?.type;
      console.log(`Schema items type: ${itemType}`);
      
      // When items exists but type is undefined, analyze items' properties
      if (!itemType && fieldSchema.items?.properties) {
        const properties = fieldSchema.items.properties;
        const propertyKeys = Object.keys(properties);
        const propertyTypes = Object.values(properties).map((prop: any) => prop.type);
        
        // Define the primitive types
        const basicTypes = ['string', 'integer', 'number', 'boolean'];
        
        // Analyze the properties
        const basicTypeProperties = propertyTypes.filter(type => basicTypes.includes(type));
        const objectProperties = propertyTypes.filter(type => type === 'object');
        const arrayProperties = propertyTypes.filter(type => type === 'array');
        const otherProperties = propertyTypes.filter(type => !basicTypes.includes(type) && type !== 'object' && type !== 'array');
        
        console.log(`🔍 Analyzing array with undefined item type ${key}:`);
        console.log(`  - Property keys: ${propertyKeys.join(', ')}`);
        console.log(`  - Property types: ${propertyTypes.join(', ')}`);
        console.log(`  - Basic types: ${basicTypeProperties.length}`);
        console.log(`  - Object types: ${objectProperties.length}`);
        console.log(`  - Array types: ${arrayProperties.length}`);
        console.log(`  - Other types: ${otherProperties.length}`);
        
        // 1. When there is a single primitive property
        if (propertyKeys.length === 1 && basicTypeProperties.length === 1) {
          const singleType = basicTypeProperties[0];
          if (singleType === 'string') {
            console.log(`✅ ${key} is stringArray (schema-based: single string property)`);
            return 'stringArray';
          } else if (singleType === 'integer' || singleType === 'number') {
            console.log(`✅ ${key} is integerArray (schema-based: single number property)`);
            return 'integerArray';
          } else if (singleType === 'boolean') {
            console.log(`✅ ${key} is booleanArray (schema-based: single boolean property)`);
            return 'booleanArray';
          }
        }
        
        // 2. When there are two or more primitive properties (primitives only, not objects)
        if (propertyKeys.length >= 2 && basicTypeProperties.length === propertyKeys.length && objectProperties.length === 0 && arrayProperties.length === 0) {
          console.log(`✅ ${key} is basicObjectArray (schema-based: multiple basic type properties)`);
          return 'basicObjectArray';
        }
        
        // 3. When multiple shapes are mixed (primitive + object + array, etc.)
        if (objectProperties.length > 0 || arrayProperties.length > 0 || otherProperties.length > 0 || 
            (basicTypeProperties.length > 0 && (objectProperties.length > 0 || arrayProperties.length > 0))) {
          console.log(`✅ ${key} is nestedObjectArray (schema-based: mixed types - basic:${basicTypeProperties.length}, object:${objectProperties.length}, array:${arrayProperties.length})`);
          return 'nestedObjectArray';
        }
        
        // 4. Primitive but does not match the conditions above (fallback)
        if (basicTypeProperties.length > 0) {
          console.log(`✅ ${key} is basicObjectArray (schema-based: fallback for basic types)`);
          return 'basicObjectArray';
        }
        
        // 5. Unknown case
        console.log(`⚠️ ${key} has unknown structure, defaulting to basicObjectArray`);
        return 'basicObjectArray';
      }
      
      if (itemType === 'string') {
        console.log(`✅ ${key} is stringArray (schema-based)`);
        return 'stringArray';
      } else if (itemType === 'integer' || itemType === 'number') {
        console.log(`✅ ${key} is integerArray (schema-based)`);
        return 'integerArray';
      } else if (itemType === 'boolean') {
        console.log(`✅ ${key} is booleanArray (schema-based)`);
        return 'booleanArray';
      } else if (itemType === 'object' && fieldSchema.items?.properties) {
        // For an object array - analyze the inner properties
        const properties = fieldSchema.items.properties;
        const propertyKeys = Object.keys(properties);
        const hasNestedObjects = Object.values(properties).some((prop: any) => 
          prop.type === 'object' || prop.type === 'array'
        );
        
        console.log(`🔍 Analyzing object array ${key}:`);
        console.log(`  - Property keys: ${propertyKeys.join(', ')}`);
        console.log(`  - Has nested objects: ${hasNestedObjects}`);
        console.log(`  - Properties:`, properties);
        
        if (hasNestedObjects) {
          console.log(`✅ ${key} is nestedObjectArray (schema-based: has nested objects)`);
          return 'nestedObjectArray';
        } else {
          console.log(`✅ ${key} is basicObjectArray (schema-based: basic object)`);
          return 'basicObjectArray';
        }
      }
    }
    
    // 2. Analyze the actual data (fallback - when there is no schema)
    if (arrayData && arrayData.length > 0) {
      const firstItem = arrayData[0];
      const itemType = typeof firstItem;
      
      if (itemType === 'string') {
        console.log(`✅ ${key} is stringArray (data-based fallback)`);
        return 'stringArray';
      } else if (itemType === 'number') {
        console.log(`✅ ${key} is integerArray (data-based fallback)`);
        return 'integerArray';
      } else if (itemType === 'boolean') {
        console.log(`✅ ${key} is booleanArray (data-based fallback)`);
        return 'booleanArray';
      } else if (itemType === 'object' && firstItem !== null) {
        // For an object array - analyze the inner properties
        const keys = Object.keys(firstItem);
        const hasNestedObjects = keys.some(itemKey => 
          typeof firstItem[itemKey] === 'object' || Array.isArray(firstItem[itemKey])
        );
        
        if (hasNestedObjects) {
          console.log(`✅ ${key} is nestedObjectArray (data-based fallback: has nested objects)`);
          return 'nestedObjectArray';
        } else {
          console.log(`✅ ${key} is basicObjectArray (data-based fallback: basic object)`);
          return 'basicObjectArray';
        }
      }
    }
    
    // 3. When the array is empty
    if (!arrayData || arrayData.length === 0) {
      console.log(`⚠️ ${key} is emptyArray (no data)`);
      return 'emptyArray';
    }
    
    // 4. Default value
    console.log(`⚠️ ${key} is unknownArray (fallback)`);
    return 'unknownArray';
  }

  // Context creation helper functions
  function createInputContext(
    key: string, 
    fieldValue: any, 
    isRequired: boolean, 
    description?: string, 
    placeholder?: string
  ): InputContext {
    return {
      type: 'input',
      context: {
        title: key,
        model: { value: fieldValue, isValid: true, onBlur: () => {} },
        isRequired,
        description,
        placeholder: placeholder || ''
      }
    };
  }

  function createNestedObjectContext(
    key: string, 
    values: FormContext[],
    isRequired: boolean,
    description?: string
  ): NestedObjectContext {
    return {
      type: 'nestedObject',
      context: {
        title: key,    // Use title
        values,
        isRequired,
        description,
        subject: key   // Add subject (Form.vue compatibility)
      }
    };
  }

  function createArrayContext(
    key: string, 
    values: any[],
    isRequired: boolean,
    description?: string,
    nestedContexts?: any[]
  ): ArrayContext {
      return {
        type: 'array',
        context: {
        title: key,
        values,
          isRequired,
        description,
        _contexts: nestedContexts
      } as any
    };
  }
  
  /**
   * Build a FormContext based on the Array item schema
   */
  function createArrayItemContext(arraySchema: any, itemData?: any): FormContext[] {
    console.log('createArrayItemContext called with:', arraySchema, 'itemData:', itemData);
    
    if (!arraySchema || !arraySchema.items) {
      console.log('No array items schema found');
      return [];
    }

    const itemSchema = arraySchema.items;
    console.log('Array item schema:', itemSchema);

    // When the Array item is an object type
    if (itemSchema.type === 'object' && itemSchema.properties) {
      const contexts: FormContext[] = [];
      
      Object.entries(itemSchema.properties).forEach(([key, fieldSchema]: [string, any]) => {
        console.log(`Processing array item property: ${key}`, fieldSchema);
        
        // Exclude Array types (no nested array handling)
        if (fieldSchema.type === 'array') {
          console.log(`Skipping nested array field: ${key}`);
          return;
        }
        
        // Input field
        if (fieldSchema.type === 'string' || fieldSchema.type === 'integer' || fieldSchema.type === 'number' || fieldSchema.type === 'boolean') {
          const fieldValue = itemData && itemData[key] !== undefined ? itemData[key] : (fieldSchema.default || '');
          contexts.push(createInputContext(
            key,
            fieldValue,
            itemSchema.required?.includes(key) || false,
            fieldSchema.description,
            fieldSchema.example
          ));
          console.log(`✅ Array item input field ${key} created with value: ${fieldValue}`);
        }
        // Nested Object field
        else if (fieldSchema.type === 'object') {
          const nestedData = itemData && itemData[key] ? itemData[key] : undefined;
          contexts.push(createNestedObjectContext(
            key,
            createArrayItemContext(fieldSchema, nestedData),
            itemSchema.required?.includes(key) || false,
            fieldSchema.description
          ));
          console.log(`✅ Array item nested object field ${key} created with data:`, nestedData);
        }
      });
      
      console.log('Generated array item contexts:', contexts);
      return contexts;
    }
    
    // When the Array item is a primitive type
    console.log('Array item is primitive type, no properties to create');
    return [];
  }

  /**
   * Parse the JSON Schema to build the form context
   */
  function parseJsonSchema(schema: JsonSchema, data?: any, depth: number = 0): FormContext[] {
    console.log(`🔍 parseJsonSchema START (depth: ${depth})`);
    console.log(`🔍 Schema received:`, schema);
    console.log(`🔍 Data received:`, data);
    
    if (!schema || !schema.properties) {
      console.log('No schema properties found');
      console.log(`🔍 Schema type:`, typeof schema);
      console.log(`🔍 Schema keys:`, schema ? Object.keys(schema) : 'null');
      console.log(`🔍 Has properties:`, !!(schema && schema.properties));
      return [];
    }
  
    const contexts: FormContext[] = [];
    
    Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
      console.log(`Processing field: ${key} (depth: ${depth})`);
      
      // Handle Array types with the appropriate ArrayType context
      if (fieldSchema.type === 'array' || fieldSchema.items) {
        // Extract the Array data
        const arrayData = data && data[key] ? data[key] : [];
        console.log(`Processing ARRAY field: ${key} (depth: ${depth})`);
        
        // Determine the ArrayType
        const arrayType = determineArrayTypeFromSchema(fieldSchema, key, arrayData);
        console.log(`ArrayType determined for ${key}: ${arrayType}`);
        console.log(`Field schema for ${key}:`, fieldSchema);
        console.log(`Array data for ${key}:`, arrayData);
        
        // Create the appropriate Context depending on the ArrayType
        if (arrayType === 'stringArray') {
          contexts.push({
            type: 'stringArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'stringArray'
            }
          });
          console.log(`✅ StringArray field ${key} created with ${arrayData.length} items`);
        } else if (arrayType === 'integerArray') {
          contexts.push({
            type: 'integerArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'integerArray'
            }
          });
          console.log(`✅ IntegerArray field ${key} created with ${arrayData.length} items`);
        } else if (arrayType === 'booleanArray') {
          contexts.push({
            type: 'booleanArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'booleanArray'
            }
          });
          console.log(`✅ BooleanArray field ${key} created with ${arrayData.length} items`);
        } else if (arrayType === 'nestedObjectArray') {
          // For a nestedObjectArray, handle based on items.properties
          console.log(`Processing nestedObjectArray ${key} with items schema:`, fieldSchema.items);
          
          let values: any[] = [];
          
          // Build a template based on items.properties
          if (fieldSchema.items && fieldSchema.items.properties) {
            const templateContext = parseJsonSchema(fieldSchema.items, `${key}`, depth + 1);
            console.log(`Generated template context for ${key}:`, templateContext);
            
            // When actual data exists, process each item
            if (arrayData && Array.isArray(arrayData) && arrayData.length > 0) {
              console.log(`Processing ${arrayData.length} actual items for nestedObjectArray ${key}`);
              values = arrayData.map((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  // Convert each item's properties into an input context
                  const itemContexts = Object.keys(item).map(itemKey => {
                    const itemValue = item[itemKey];
                    const itemSchema = fieldSchema.items?.properties?.[itemKey];
                    
                    if (itemSchema?.type === 'string') {
                      return {
                        type: 'input',
                        context: {
                          title: itemKey,
                          subject: itemKey,
                          model: {
                            value: String(itemValue || ''),
                            isValid: true
                          },
                          isRequired: fieldSchema.items?.required?.includes(itemKey) || false,
                          description: itemSchema.description
                        }
                      };
                    } else if (itemSchema?.type === 'object') {
                      // For an object type, handle depending on the complexity
                      const isComplexObject = analyzeObjectComplexity(itemSchema, itemValue);
                      
                      if (isComplexObject) {
                        // For a complex object, handle as a nestedObject
                        console.log(`  - Complex object detected for ${itemKey}, creating nestedObject`);
                        return {
                          type: 'nestedObject',
                          context: {
                            title: itemKey,
                            subject: itemKey,
                            values: [],
                            isRequired: fieldSchema.items?.required?.includes(itemKey) || false,
                            description: itemSchema.description,
                            rawData: itemValue
                          }
                        };
                      } else {
                        // For a simple object, show the properties directly
                        console.log(`  - Simple object detected for ${itemKey}, showing properties directly`);
                        return {
                          type: 'input',
                          context: {
                            title: itemKey,
                            subject: itemKey,
                            model: {
                              value: JSON.stringify(itemValue || {}),
                              isValid: true
                            },
                            isRequired: fieldSchema.items?.required?.includes(itemKey) || false,
                            description: itemSchema.description
                          }
                        };
                      }
                    } else if (itemSchema?.type === 'array') {
                      // For an array type, handle as nestedObject (complex structure)
                      console.log(`  - Array detected for ${itemKey}, creating nestedObject`);
                      return {
                        type: 'nestedObject',
                        context: {
                          title: itemKey,
                          subject: itemKey,
                          values: [],
                          isRequired: fieldSchema.items?.required?.includes(itemKey) || false,
                          description: itemSchema.description,
                          rawData: itemValue
                        }
                      };
                    } else {
                      // Handle other types as input
                      return {
                        type: 'input',
                        context: {
                          title: itemKey,
                          subject: itemKey,
                          model: {
                            value: String(itemValue || ''),
                            isValid: true
                          },
                          isRequired: fieldSchema.items?.required?.includes(itemKey) || false,
                          description: itemSchema?.description
                        }
                      };
                    }
                  });
                  
                  // Return the properties directly for nestedObjectArray items instead of wrapping them in a nestedObject
                  return {
                    type: 'nestedObjectArrayItem',
                    context: {
                      subject: `Item ${index + 1}`,
                      values: itemContexts,
                      isRequired: false
                    }
                  };
                }
                return null;
              }).filter(Boolean);
            } else {
              // When there is no data, create only the template (applying complexity analysis)
              console.log(`No data for nestedObjectArray ${key}, creating template with complexity analysis`);
              
              // Handle the template context depending on the complexity
              const processedTemplateContext = templateContext.map(templateItem => {
                if (templateItem.type === 'nestedObject' && templateItem.context) {
                  const itemSchema = fieldSchema.items?.properties?.[templateItem.context.title];
                  const isComplexObject = analyzeObjectComplexity(itemSchema, null);
                  
                  if (isComplexObject) {
                    // Keep a complex object as a nestedObject
                    return templateItem;
                  } else {
                    // Convert a simple object into an input
                    return {
                      type: 'input',
                      context: {
                        title: templateItem.context.title,
                        subject: templateItem.context.title,
                        model: {
                          value: '',
                          isValid: true
                        },
                        isRequired: templateItem.context.isRequired || false,
                        description: templateItem.context.description
                      }
                    };
                  }
                }
                return templateItem;
              });
              
              values = [{
                type: 'nestedObjectArrayItem',
                context: {
                  subject: 'Item',
                  values: processedTemplateContext,
                  isRequired: false
                }
              }];
            }
          } else {
            console.log(`No items.properties found for nestedObjectArray ${key}, using empty array`);
            values = [];
          }
          
          // Handle nestedObjectArray with accordionContext
          const accordionItems = values.map((item: any, index: number) => {
            // Convert existing data into the correct properties structure
            let itemProperties: any[] = [];
            
            if (item.context?.values && Array.isArray(item.context.values)) {
              // When it is already a FormContext structure
              itemProperties = item.context.values as any[];
            } else if (item.context && typeof item.context === 'object') {
              // For a plain object, convert to properties
              itemProperties = Object.entries(item.context).map(([key, value]: [string, any]) => ({
                type: 'input',
                context: {
                  title: key,
                  model: { value: value || '' },
                  isRequired: false,
                  description: `Property: ${key}`
                }
              }));
            } else if (typeof item === 'object' && item !== null) {
              // For a direct object, convert properties based on the schema
              if (fieldSchema && fieldSchema.items && fieldSchema.items.properties) {
                console.log(`🔍 Processing item with schema:`, fieldSchema.items.properties);
                console.log(`🔍 Item data:`, item);
                
                // Build the properties based on the schema
                itemProperties = Object.entries(fieldSchema.items.properties).map(([key, propSchema]: [string, any]) => {
                  const actualValue = item[key];
                  const propertyType = propSchema.type || 'string';
                  
                  console.log(`🔍 Processing property ${key}:`, {
                    propertyType,
                    hasProperties: !!(propSchema.properties),
                    actualValue,
                    propSchema
                  });
                  
                  if (propertyType === 'object' && propSchema.properties) {
                    // For an object type, create a nestedObject
                    console.log(`🔍 Creating nestedObject for ${key} with properties:`, propSchema.properties);
                    // Pass propSchema itself as the schema (the full schema including properties)
                    const nestedValues = parseJsonSchema(propSchema, actualValue || {});
                    console.log(`🔍 Parsed ${nestedValues.length} nested values for ${key}:`, nestedValues);
                    
                    return {
                      type: 'nestedObject',
                      context: {
                        title: key,
                        values: nestedValues,
                        isRequired: fieldSchema.items?.required?.includes(key) || false,
                        description: propSchema.description || `Property: ${key}`,
                        subject: key
                      }
                    };
                  } else if (propertyType === 'array' && propSchema.items) {
                    // For an array type, create a nestedObjectArray
                    return {
            type: 'nestedObjectArray',
            context: {
              title: key,
                        values: [],
                        isRequired: fieldSchema.items?.required?.includes(key) || false,
                        description: propSchema.description || `Property: ${key}`,
                        subject: key
                      }
                    };
                  } else {
                    // For a primitive type, create as input
                    return {
                      type: 'input',
                      context: {
                        title: key,
                        model: { value: actualValue || '' },
                        isRequired: fieldSchema.items?.required?.includes(key) || false,
                        description: propSchema.description || `Property: ${key}`
                      }
                    };
                  }
                });
              } else {
                // When there is no schema, convert to the default input type
                itemProperties = Object.entries(item).map(([key, value]: [string, any]) => ({
                  type: 'input',
                  context: {
                    title: key,
                    model: { value: value || '' },
                    isRequired: false,
                    description: `Property: ${key}`
                  }
                }));
              }
            }
            
            return reactive({
              type: 'nestedObjectArrayItem',
              context: {
                subject: `Item ${index + 1}`,
                values: itemProperties,
                isRequired: false
              },
              isExpanded: false
            });
          });

          contexts.push({
            type: 'accordion',
            context: {
              title: key,
              values: accordionItems,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description
            },
            schema: fieldSchema
          });
          console.log(`✅ NestedObjectArray field ${key} converted to accordionContext with ${values.length} items`);
          console.log(`Values for ${key}:`, values);
        } else if (arrayType === 'basicObjectArray') {
          // Handle basicObjectArray with accordionContext
          const accordionItems = arrayData.map((item: any, index: number) => reactive({
            type: 'nestedObjectArrayItem',
            context: {
              subject: `Item ${index + 1}`,
              values: Object.entries(item).map(([propKey, propValue]: [string, any]) => ({
                type: 'input',
                context: {
                  title: propKey,
                  model: { value: propValue },
                  isRequired: false,
                  description: `Property: ${propKey}`
                }
              })),
              isRequired: false
            },
            isExpanded: false
          }));

          contexts.push({
            type: 'accordion',
            context: {
              title: key,
              values: accordionItems,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description
            },
            schema: fieldSchema
          });
          console.log(`✅ BasicObjectArray field ${key} converted to accordionContext with ${arrayData.length} items`);
        } else if (arrayType === 'basicArray') {
          // Handle basicInputArray with selectContext
          contexts.push({
            type: 'select',
            context: {
              title: key,
              model: { value: arrayData.length > 0 ? arrayData[0] : '' },
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              options: arrayData.map((item: any, index: number) => ({
                value: item,
                label: `Option ${index + 1}: ${item}`,
                text: `Option ${index + 1}: ${item}`
              }))
            }
          });
          console.log(`✅ BasicArray field ${key} converted to selectContext with ${arrayData.length} options`);
        } else if (arrayType === 'mixedArray') {
          contexts.push({
            type: 'mixedArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'mixedArray'
            }
          });
          console.log(`✅ MixedArray field ${key} created with ${arrayData.length} items`);
        } else if (arrayType === 'emptyArray') {
          contexts.push({
            type: 'emptyArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'emptyArray'
            }
          });
          console.log(`✅ EmptyArray field ${key} created with ${arrayData.length} items`);
                } else {
          // fallback for unknownArray
          contexts.push({
            type: 'unknownArray',
            context: {
              title: key,
              values: arrayData,
              isRequired: schema.required?.includes(key) || false,
              description: fieldSchema.description,
              arrayType: 'unknownArray'
            }
          });
          console.log(`✅ UnknownArray field ${key} created with ${arrayData.length} items`);
        }
        return;
      }
      
      // Create the context depending on the field type
      if (fieldSchema.type === 'string' || fieldSchema.type === 'integer' || fieldSchema.type === 'number' || fieldSchema.type === 'boolean') {
        // Input field - use the value if data exists
        const fieldValue = data && data[key] !== undefined ? data[key] : (fieldSchema.default || '');
        contexts.push(createInputContext(
          key,
          fieldValue,
          schema.required?.includes(key) || false,
          fieldSchema.description,
          fieldSchema.example
        ));
        console.log(`✅ Input field ${key} created with value: ${fieldValue}`);
      } else if (fieldSchema.type === 'object') {
        // Handle Object fields (generic handling)
        const nestedData = data && data[key] ? data[key] : undefined;
        console.log(`Processing OBJECT field: ${key} (depth: ${depth})`);
        console.log(`Object schema:`, fieldSchema);
        
        // Handle an empty object with no defined properties
        if (!fieldSchema.properties || Object.keys(fieldSchema.properties).length === 0) {
          console.log(`Object ${key} has no properties defined, creating empty nested object`);
          
          // Although it is an empty object, handle it as a nestedObject so it can be shown in the UI
          // Create a special context to show the "property not defined" message
          const emptyObjectContext = createNestedObjectContext(
            key,
            [], // Empty array - because there are no properties
            schema.required?.includes(key) || false,
            fieldSchema.description
          );
          
          // Add a special flag to indicate an empty object
          (emptyObjectContext as any).isEmptyObject = true;
          (emptyObjectContext as any).emptyMessage = 'property not defined';
          
          contexts.push(emptyObjectContext);
          console.log(`✅ Empty nested object field ${key} created (depth: ${depth})`);
        } else {
          // Check whether the Object contains an array and analyze the complexity
          const arrayProperties = fieldSchema.properties ? 
            Object.entries(fieldSchema.properties).filter(([_, prop]: [string, any]) => prop.type === 'array') : [];
          
          console.log(`Object ${key} has ${arrayProperties.length} array properties:`, arrayProperties.map(([name, _]) => name));
          
          // Analyze the complexity of the Array property
          let hasComplexArrays = false;
          if (arrayProperties.length > 0) {
            console.log(`Analyzing array complexity for object ${key}:`);
            arrayProperties.forEach(([arrayName, arrayProp]: [string, any]) => {
              console.log(`  - Array ${arrayName}:`, arrayProp);
              if (arrayProp.items) {
                // Analyze the Array item type
                if (arrayProp.items.type === 'object' && arrayProp.items.properties) {
                  const itemPropCount = Object.keys(arrayProp.items.properties).length;
                  const hasNestedInItems = Object.values(arrayProp.items.properties).some((itemProp: any) => 
                    itemProp.type === 'object' || itemProp.type === 'array'
                  );
                  
                  console.log(`    - Item properties: ${itemPropCount}, has nested: ${hasNestedInItems}`);
                  
                  if (hasNestedInItems || itemPropCount > 2) {
                    hasComplexArrays = true;
                    console.log(`    - Complex array detected: ${arrayName}`);
                  }
                }
              }
            });
          }
          
          console.log(`Object ${key} has complex arrays: ${hasComplexArrays}`);
          
          // Handle as nestedObject when there is an Array or a complex structure
          if (arrayProperties.length > 0 || hasComplexArrays) {
            console.log(`Converting object ${key} to nestedObject due to array properties or complexity`);
          
          const nestedContexts = parseJsonSchema(fieldSchema, nestedData, depth + 1);
          
          contexts.push(createNestedObjectContext(
            key,
            nestedContexts,
            schema.required?.includes(key) || false,
            fieldSchema.description
          ));
          console.log(`✅ Nested object field ${key} created with data (depth: ${depth})`);
              } else {
          // Even with no Array, handle as nestedObject, but build the inner properties recursively
          console.log(`Object ${key} has no array properties, treating as nested object with recursive processing`);
          
          const nestedContexts = parseJsonSchema(fieldSchema, nestedData, depth + 1);
          
          contexts.push(createNestedObjectContext(
            key,
            nestedContexts,
            schema.required?.includes(key) || false,
            fieldSchema.description
          ));
          console.log(`✅ Nested object field ${key} created with recursive processing (depth: ${depth})`);
          }
        }
      }
    });
    
    console.log(`Generated ${contexts.length} contexts (depth: ${depth})`);
    console.log(`=== parseJsonSchema END (depth: ${depth}) ===`);
    return contexts;
  }

  /**
   * Parse the Path Params to build the context
   */
  function parsePathParams(pathParamsSchema: any): FormContext[] {
    console.log('parsePathParams called with:', pathParamsSchema);
    
    if (!pathParamsSchema || !pathParamsSchema.properties) {
      console.log('No path params schema found');
      return [];
    }

    const contexts: FormContext[] = [];
    
    Object.entries(pathParamsSchema.properties).forEach(([key, fieldSchema]: [string, any]) => {
      console.log(`Processing path param: ${key}`, fieldSchema);
      
      contexts.push(createInputContext(
        key,
        fieldSchema.default || '',
        pathParamsSchema.required?.includes(key) || false,
        fieldSchema.description,
        fieldSchema.example
      ));
    });
    
    console.log('Generated path params contexts:', contexts);
    return contexts;
  }

  /**
   * Parse the Query Params to build the context
   */
  function parseQueryParams(queryParamsSchema: any): FormContext[] {
    console.log('parseQueryParams called with:', queryParamsSchema);
    
    if (!queryParamsSchema || !queryParamsSchema.properties) {
      console.log('No query params schema found');
      return [];
    }

    const contexts: FormContext[] = [];
    
    Object.entries(queryParamsSchema.properties).forEach(([key, fieldSchema]: [string, any]) => {
      console.log(`Processing query param: ${key}`, fieldSchema);
      
      contexts.push(createInputContext(
        key,
        fieldSchema.default || '',
        queryParamsSchema.required?.includes(key) || false,
        fieldSchema.description,
        fieldSchema.example
      ));
    });
    
    console.log('Generated query params contexts:', contexts);
    return contexts;
  }

  /**
   * Fill the form with existing data
   */
  function populateFormWithExistingData(data: any, path: string): void {
    console.log('populateFormWithExistingData called with:', { data, path });
    // TODO: implementation needed
  }

  /**
   * Data mapping using the Task Component Data
   */
  function populateFormWithTaskComponentData(
    savedData: any, 
    taskComponentData: any,
    createAccordionSlotFn?: any
  ): void {
    console.log('populateFormWithTaskComponentData called with:', { savedData, taskComponentData });
    
    if (!savedData || !taskComponentData) {
      console.warn('Missing savedData or taskComponentData');
      return;
    }
    
    // Iterate over formContext and map the data
    formContext.value.forEach(context => {
      const contextSubject = getContextSubject(context);
      console.log(`Processing context: ${contextSubject}, type: ${context.type}`);
      
      if (context.type === 'nestedObject') {
        // For a nestedObject, map the data
        const nestedData = savedData[contextSubject];
        if (nestedData !== undefined) {
          console.log(`Mapping data for nestedObject ${contextSubject}:`, nestedData);
          
          // For an empty object, store it as rawData
          if (typeof nestedData === 'object' && nestedData !== null && !Array.isArray(nestedData)) {
            if (!context.context.rawData) {
              context.context.rawData = {};
            }
            Object.assign(context.context.rawData, nestedData);
            console.log(`Stored raw data for ${contextSubject}:`, context.context.rawData);
            
            // If values exist, update with the actual data
            if (context.context.values && context.context.values.length > 0) {
              console.log(`Updating values for nestedObject ${contextSubject} with actual data`);
              context.context.values.forEach((valueContext: any) => {
                const valueSubject = getContextSubject(valueContext);
                const actualValue = nestedData[valueSubject];
                console.log(`Updating ${valueSubject} with:`, actualValue);
                
                if (valueContext.type === 'input' && actualValue !== undefined) {
                  valueContext.context.model.value = String(actualValue);
                } else if (valueContext.type === 'nestedObject' && actualValue && typeof actualValue === 'object') {
                  // For a nestedObject, update recursively
                  if (valueContext.context.values && valueContext.context.values.length > 0) {
                    valueContext.context.values.forEach((nestedValueContext: any) => {
                      const nestedValueSubject = getContextSubject(nestedValueContext);
                      const nestedActualValue = actualValue[nestedValueSubject];
                      if (nestedValueContext.type === 'input' && nestedActualValue !== undefined) {
                        nestedValueContext.context.model.value = String(nestedActualValue);
                      }
                    });
                  }
                } else if (valueContext.type === 'nestedObjectArray' && actualValue && Array.isArray(actualValue)) {
                  // For a nestedObjectArray, update with the array data
                  console.log(`Updating nestedObjectArray ${valueSubject} with ${actualValue.length} items`);
                  // Here we only confirm that actual data exists; the actual rendering is schema-based
                }
              });
            }
          }
        }
      } else if (context.type === 'nestedObjectArray') {
        // For a nestedObjectArray, map the data
        const arrayData = savedData[contextSubject];
        if (arrayData && Array.isArray(arrayData)) {
          console.log(`Mapping data for nestedObjectArray ${contextSubject}:`, arrayData);
          
          // Convert each array item into a nestedObject
          const mappedItems = arrayData.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // Convert each property of the object into the appropriate context
              const itemContexts = Object.keys(item).map(key => {
                const value = item[key];
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  // For an object type, handle as a nestedObject
                  return {
                    type: 'nestedObject',
                    context: {
                      title: key,
                      subject: key,
                      values: [],
                      isRequired: false,
                      rawData: value
                    }
                  };
                } else {
                  // Handle string and other types as input
                  return {
                    type: 'input',
                    context: {
                      title: key,
                      subject: key,
                      model: {
                        value: String(value || ''),
                        isValid: true
                      },
                      isRequired: false
                    }
                  };
                }
              });
              
              return {
                type: 'nestedObjectArrayItem',
                context: {
                  subject: `Item ${index + 1}`,
                  values: itemContexts,
                  isRequired: false
                }
              };
            }
            return null;
          }).filter(Boolean);
          
          context.context.values = mappedItems;
          console.log(`Mapped ${mappedItems.length} items for nestedObjectArray ${contextSubject}`);
        }
      } else if (context.type === 'input' && context.context?.model) {
        // For an input, set the value directly
        const inputValue = savedData[contextSubject];
        if (inputValue !== undefined) {
          context.context.model.value = inputValue;
          console.log(`Set input value for ${contextSubject}: ${inputValue}`);
        }
      }
    });
    
    console.log('✅ Task component data mapping completed');
  }

  /**
   * Fallback handling when there is no TaskComponentData
   */
  function populateFormWithExistingDataFallback(
    savedData: any, 
    createAccordionSlotFn?: any
  ): void {
    console.log('populateFormWithExistingDataFallback called with:', { savedData });
    
    if (!savedData) {
      console.warn('No saved data available for fallback');
      return;
    }
    
    // Iterate over formContext and map the data
    formContext.value.forEach(context => {
      const contextSubject = getContextSubject(context);
      console.log(`Processing context (fallback): ${contextSubject}, type: ${context.type}`);
      
      if (context.type === 'nestedObject') {
        // For a nestedObject, map the data
        const nestedData = savedData[contextSubject];
        if (nestedData !== undefined) {
          console.log(`Mapping data for nestedObject ${contextSubject} (fallback):`, nestedData);
          
          // For an empty object, store it as rawData
          if (typeof nestedData === 'object' && nestedData !== null && !Array.isArray(nestedData)) {
            if (!context.context.rawData) {
              context.context.rawData = {};
            }
            Object.assign(context.context.rawData, nestedData);
            console.log(`Stored raw data for ${contextSubject} (fallback):`, context.context.rawData);
          }
        }
      } else if (context.type === 'nestedObjectArray') {
        // For a nestedObjectArray, map the data
        const arrayData = savedData[contextSubject];
        if (arrayData && Array.isArray(arrayData)) {
          console.log(`Mapping data for nestedObjectArray ${contextSubject} (fallback):`, arrayData);
          
          // Convert each array item into a nestedObject
          const mappedItems = arrayData.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // Convert each property of the object into the appropriate context
              const itemContexts = Object.keys(item).map(key => {
                const value = item[key];
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  // For an object type, handle as a nestedObject
                  return {
                    type: 'nestedObject',
                    context: {
                      title: key,
                      subject: key,
                      values: [],
                      isRequired: false,
                      rawData: value
                    }
                  };
                } else {
                  // Handle string and other types as input
                  return {
                    type: 'input',
                    context: {
                      title: key,
                      subject: key,
                      model: {
                        value: String(value || ''),
                        isValid: true
                      },
                      isRequired: false
                    }
                  };
                }
              });
              
              return {
                type: 'nestedObjectArrayItem',
                context: {
                  subject: `Item ${index + 1}`,
                  values: itemContexts,
                  isRequired: false
                }
              };
            }
            return null;
          }).filter(Boolean);
          
          context.context.values = mappedItems;
          console.log(`Mapped ${mappedItems.length} items for nestedObjectArray ${contextSubject} (fallback)`);
        }
      } else if (context.type === 'input' && context.context?.model) {
        // For an input, set the value directly
        const inputValue = savedData[contextSubject];
        if (inputValue !== undefined) {
          context.context.model.value = inputValue;
          console.log(`Set input value for ${contextSubject} (fallback): ${inputValue}`);
        }
      }
    });
    
    console.log('✅ Fallback data mapping completed');
  }

  /**
   * Map the data onto the form context (optimized version)
   */
  function mapDataToFormContextOptimized(
    formContext: FormContext[], 
    data: any, 
    schema: Record<string, any>,
  createAccordionSlotFn?: any,
  depth: number = 0
  ): void {
  // Prevent infinite loops: limit the maximum depth
  if (depth > 10) {
    console.warn('⚠️ mapDataToFormContextOptimized: Maximum depth reached, stopping recursion');
    return;
  }
  
  console.log(`=== mapDataToFormContextOptimized START (depth: ${depth}) ===`);
  console.log('FormContext length:', formContext.length);
  console.log('Data:', data);
  console.log('Schema:', schema);
  console.log('Data keys:', Object.keys(data || {}));
  console.log('Schema keys:', Object.keys(schema || {}));
    
    if (!data || !schema) {
      console.log('No data or schema provided');
      return;
    }
    
    // When FormContext is empty and a schema exists - build FormContext from the schema
    if (formContext.length === 0 && schema && Object.keys(schema).length > 0) {
      console.log(`⚠️ FormContext is empty but schema exists. Creating FormContext from schema...`);
      console.log(`Schema properties:`, Object.keys(schema));
      
      // Create a FormContext for each schema property
      Object.entries(schema).forEach(([key, fieldSchema]: [string, any]) => {
        console.log(`Creating FormContext for ${key}:`, fieldSchema);
        
        if (fieldSchema.type === 'string' || fieldSchema.type === 'integer' || fieldSchema.type === 'boolean') {
          // Primitive type - create as input
          const inputContext = createInputContext(
            key,
            data[key] || '',
            fieldSchema.required || false,
            fieldSchema.description || ''
          );
          // Verify that title is set correctly
          console.log(`    📝 Input context for ${key}:`);
          console.log(`      - Title: ${(inputContext as any).title}`);
          console.log(`      - Value: ${inputContext.context.model.value}`);
          console.log(`      - Required: ${inputContext.context.isRequired}`);
          formContext.push({
            type: 'input',
            context: inputContext as any
          });
          console.log(`    ✅ Created input context for ${key}`);
        } else if (fieldSchema.type === 'object') {
          // Object type - create a nestedObject
          let nestedValues: FormContext[] = [];
          
          // If fieldSchema.properties exists, parse it recursively
          if (fieldSchema.properties) {
            console.log(`    🔍 Parsing properties for nestedObject ${key}:`, fieldSchema.properties);
            console.log(`    🔍 Data for ${key}:`, data[key]);
            // Pass the whole fieldSchema as the schema (the full schema including properties)
            nestedValues = parseJsonSchema(fieldSchema, data[key] || {}, depth + 1);
            console.log(`    📦 Parsed ${nestedValues.length} properties for ${key}:`, nestedValues);
          } else {
            console.log(`    ⚠️ No properties found for nestedObject ${key}`);
          }
          
          const nestedObjectContext = createNestedObjectContext(
            key,
            nestedValues,
            fieldSchema.required || false,
            fieldSchema.description || ''
          );
          // Verify that title is set correctly
          console.log(`    📦 NestedObject context for ${key}:`);
          console.log(`      - Title: ${(nestedObjectContext as any).title}`);
          console.log(`      - Properties count: ${nestedValues.length}`);
          console.log(`      - Required: ${nestedObjectContext.context.isRequired}`);
          formContext.push({
            type: 'nestedObject',
            context: nestedObjectContext as any
          });
          console.log(`    ✅ Created nestedObject context for ${key}`);
        } else if (fieldSchema.type === 'array') {
          // Array type - create as nestedObjectArray
          const arrayContext = {
            type: 'nestedObjectArray' as const,
            context: {
              title: key,
              values: [] as FormContext[],
              isRequired: fieldSchema.required || false,
              description: fieldSchema.description || ''
            }
          };
          // Verify that title is set correctly
          console.log(`    📋 NestedObjectArray context for ${key}:`);
          console.log(`      - Title: ${arrayContext.context.title}`);
          // console.log(`      - Data: ${JSON.stringify(data[key], null, 2)}`);
          console.log(`      - Array length: ${Array.isArray(data[key]) ? data[key].length : 'not array'}`);
          console.log(`      - Required: ${arrayContext.context.isRequired}`);
          formContext.push({
            type: 'nestedObjectArray',
            context: arrayContext as any
          });
          console.log(`    ✅ Created nestedObjectArray context for ${key}`);
        }
      });
      
      console.log(`✅ Created ${formContext.length} FormContext items from schema`);
      
      // Map the actual data onto the generated FormContext
      console.log(`🔄 Mapping data to newly created FormContext items...`);
      formContext.forEach((context, index) => {
        console.log(`🔍 FormContext[${index}] structure:`, context);
        console.log(`🔍 FormContext[${index}] context:`, context.context);
        console.log(`🔍 FormContext[${index}] context.title:`, (context.context as any)?.title);
        const fieldName = (context.context as any)?.title;
        console.log(`Mapping data for field: ${fieldName}`);
        
        if (context.type === 'input' && data[fieldName] !== undefined) {
          context.context.model.value = data[fieldName];
          console.log(`✅ Mapped input ${fieldName}: ${data[fieldName]}`);
        } else if (context.type === 'nestedObject' && data[fieldName] && typeof data[fieldName] === 'object') {
          console.log(`🔄 Mapping nested object ${fieldName}:`, data[fieldName]);
          const fieldData = data[fieldName];
          const fieldSchema = schema[fieldName]?.properties || {};
          mapDataToFormContextOptimized(context.context.values, fieldData, fieldSchema, createAccordionSlotFn, depth + 1);
        } else if (context.type === 'nestedObjectArray' && Array.isArray(data[fieldName])) {
          console.log(`🔄 Mapping array ${fieldName} with ${data[fieldName].length} items`);
          // console.log(`🔍 Array data:`, data[fieldName]);
          console.log(`🔍 Array context before processing:`, context.context);
          
          // Process the array items
          console.log(`🔍 Starting forEach loop for ${data[fieldName].length} items`);
          data[fieldName].forEach((item: any, itemIndex: number) => {
            console.log(`  📋 Processing array item[${itemIndex}]:`, item);
            console.log(`  🔍 Item type: ${typeof item}, isObject: ${typeof item === 'object'}, isNull: ${item === null}`);
            
            // Analyze the item's actual type
            let itemType = 'object';
            if (typeof item === 'string') {
              itemType = 'string';
            } else if (typeof item === 'number') {
              itemType = 'number';
            } else if (typeof item === 'boolean') {
              itemType = 'boolean';
            } else if (Array.isArray(item)) {
              itemType = 'array';
            } else if (typeof item === 'object' && item !== null) {
              itemType = 'object';
            }

            const itemContext = {
              type: 'nestedObjectArrayItem' as const,
              itemType: itemType, // Add the actual item's type
              context: {
                subject: `Item ${itemIndex + 1}`,
                values: [] as FormContext[],
                isRequired: false
              }
            };
            console.log(`  🔍 Created itemContext for Item ${itemIndex + 1}:`, itemContext);
            console.log(`  🔍 Item ${itemIndex + 1} itemType:`, itemType);
            console.log(`  🔍 Item ${itemIndex + 1} has itemType:`, !!itemType);
            
            if (typeof item === 'object' && item !== null) {
              console.log(`  ✅ Item ${itemIndex + 1} is valid object, processing...`);
              const itemSchema = schema[fieldName]?.items?.properties || {};
              console.log(`    🔍 Item ${itemIndex + 1} schema:`, itemSchema);
              // console.log(`    🔍 Item ${itemIndex + 1} data:`, JSON.stringify(item, null, 2));
              console.log(`    🔍 Item ${itemIndex + 1} values before mapping:`, itemContext.context.values.length);
              
              mapDataToFormContextOptimized(itemContext.context.values, item, itemSchema, createAccordionSlotFn, depth + 1);
              
              console.log(`    ✅ Item ${itemIndex + 1} values after mapping:`, itemContext.context.values.length);
              console.log(`    🔍 Item ${itemIndex + 1} final values:`, itemContext.context.values);
            } else {
              console.log(`  ⚠️ Item ${itemIndex + 1} is not a valid object, skipping...`);
            }
            
            console.log(`  🔍 About to push Item ${itemIndex + 1} to context.values...`);
            (context.context as any).values.push(itemContext);
            console.log(`    ✅ Added Item ${itemIndex + 1} to array context. Total items: ${(context.context as any).values.length}`);
            console.log(`  🔍 Context after adding Item ${itemIndex + 1}:`, context.context);
          });
          console.log(`🔍 Finished forEach loop. Final context:`, context.context);
        }
      });
    }
    
        // Map the data to each FormContext entry
        formContext.forEach((context, index) => {
          console.log(`Processing FormContext[${index}]:`, context);
          console.log(`  Context type: ${context.type}`);
          console.log(`  Context title: ${(context.context as any)?.title}`);
          console.log(`  Context has values: ${!!(context.context as any)?.values}`);
          console.log(`  Context values length: ${(context.context as any)?.values?.length || 0}`);
          
          if (context.type === 'input' && context.context?.model) {
            // Input type - assign the value directly
            const fieldName = (context.context as any).title;
            console.log(`  Processing input field: ${fieldName}`);
            if (data[fieldName] !== undefined) {
              context.context.model.value = data[fieldName];
              console.log(`✅ Mapped input ${fieldName}:`, data[fieldName]);
            }
          } else if (context.type === 'nestedObject' && context.context?.values) {
            // NestedObject type - map recursively
            const fieldName = (context.context as any).title;
            console.log(`  Processing nested object field: ${fieldName}`);
            if (data[fieldName] && typeof data[fieldName] === 'object') {
              console.log(`🔄 Mapping nested object ${fieldName}:`, data[fieldName]);
              // Pass only that field's data
              const fieldData = data[fieldName];
              const fieldSchema = schema[fieldName]?.properties || {};
              mapDataToFormContextOptimized(context.context.values, fieldData, fieldSchema, createAccordionSlotFn, depth + 1);
            }
          } else if ((context.type === 'nestedObjectArray' || context.type === 'basicObjectArray' || context.type === 'accordion') && context.context?.values) {
            // NestedObjectArray/BasicObjectArray/Accordion type - map the array items
            const fieldName = (context.context as any).title;
            console.log(`  Processing array field: ${fieldName}`);
            if (Array.isArray(data[fieldName])) {
              console.log(`🔄 Mapping array ${fieldName} with ${data[fieldName].length} items:`, data[fieldName]);
          
          // Reset the existing values
          (context.context as any).values = [];
          
          // Process each array item
          data[fieldName].forEach((item: any, itemIndex: number) => {
            console.log(`  Processing array item[${itemIndex}]:`, item);
            
            // Create the nestedObjectArrayItem context
            const itemContext = {
              type: 'nestedObjectArrayItem' as const,
              context: {
                subject: `Item ${itemIndex + 1}`,
                values: [] as FormContext[],
                isRequired: false
              }
            };
            
            // Analyze the item's properties to build values
            if (typeof item === 'object' && item !== null) {
              // Recurse passing only that item's data and schema
              const itemSchema = schema[fieldName]?.items?.properties || {};
              console.log(`  🔍 Processing item with schema:`, itemSchema);
              console.log(`  🔍 Item data:`, JSON.stringify(item, null, 2));
              
              // Process the item's properties recursively
              mapDataToFormContextOptimized(itemContext.context.values, item, itemSchema, createAccordionSlotFn, depth + 1);
              
              console.log(`  ✅ Item processing completed. Values length: ${itemContext.context.values.length}`);
            } else {
              // Default value item
              const inputContext = createInputContext(
                `Value`,
                item || '',
                false,
                `Value of ${fieldName} item`
              );
              itemContext.context.values = [{
                type: 'input',
                context: inputContext as any
              }];
            }
            
            (context.context as any).values.push(itemContext);
          });
          
          console.log(`✅ Mapped array ${fieldName} with ${(context.context as any).values.length} items`);
          //console.log(`Array context values:`, JSON.stringify(context.context.values, null, 2));
        }
      }
    });
    
    console.log('=== mapDataToFormContextOptimized END ===');
  }

  /**
   * Ensure the context exists
   */
  function ensureContextsExist(
    formContext: FormContext[], 
    schema: Record<string, any>,
    createAccordionSlotFn?: any
  ): void {
    // TODO: implementation needed
  }

  /**
   * Build a JSON Schema based on the existing data
   */
  function generateSchemaFromData(data: any): JsonSchema {
    console.log('generateSchemaFromData called with:', data);
    
    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? generateSchemaFromData(data[0]) : { type: 'string' }
      };
    }
    
    if (data && typeof data === 'object') {
      const properties: Record<string, JsonSchema> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          properties[key] = {
            type: 'array',
            items: value.length > 0 ? generateSchemaFromData(value[0]) : { type: 'string' }
          };
        } else if (value && typeof value === 'object') {
          properties[key] = generateSchemaFromData(value);
        } else {
          properties[key] = {
            type: typeof value === 'number' ? 'integer' : 'string'
          };
        }
      });
      
      return {
        type: 'object',
        properties
      };
    }
    
    return {
      type: typeof data === 'number' ? 'integer' : 'string'
    };
  }

  /**
   * Create the accordion slot
   */
  function createAccordionSlot(data: any, index: number, schema: JsonSchema): any {
    // TODO: implementation needed
  }

  /**
   * Convert the form data back into the original object
   */
  function convertFormToObject(): any {
    // TODO: implementation needed
  }

  /**
   * Convert a nested object into data
   */
  function convertNestedObjectToData(nestedObject: NestedObjectContext): any {
    // TODO: implementation needed
  }

  /**
   * Convert the accordion slot into data
   */
  function convertAccordionSlotToData(slot: any): any {
    // TODO: implementation needed
  }

  /**
   * Add an array element
   */
  function addArrayElement(arrayIndex: number): void {
    // TODO: implementation needed
  }

  /**
   * Remove an array element
   */
  function deleteArrayElement(arrayIndex: number, slotIndex: number): void {
    // TODO: implementation needed
  }

  /**
   * Add an entity
   */
  function addEntity(target: any): void {
    // TODO: implementation needed
  }

  /**
   * Remove an entity
   */
  function deleteEntity(target: any, index: number): void {
    // TODO: implementation needed
  }

  /**
   * Convert the form model into Step Properties
   */
  function convertFormModelToStepProperties(): object {
    console.log('convertFormModelToStepProperties called');
    return convertFormToObject();
  }

  /**
   * Convert the parameter model into Step Properties
   */
  function convertParamsModelToStepProperties(): FixedModel {
    console.log('convertParamsModelToStepProperties called');
    const fixedModel: FixedModel = {
      path_params: {},
      query_params: {}
    };

    if (paramsContext.value) {
      Object.keys(paramsContext.value).forEach(key => {
        const param = paramsContext.value[key];
        if (param && param.context && param.context.model) {
          fixedModel.path_params[key] = param.context.model.value;
        }
      });
    }

    return fixedModel;
  }

  /**
   * Load the existing values
   */
  function loadExistingValues(schema: JsonSchema, existingData: any): void {
    // TODO: implementation needed
  }

  /**
   * Decide whether it is the first run and whether data exists, then initialize appropriately
   */
  function initializeWithData(
    stepProperties: any,
    taskData: any,
    workflowStore?: any
): void {
    console.log('=== initializeWithData START ===');
    console.log('Step Properties:', stepProperties);
    console.log('Task Data:', taskData);
    console.log('Workflow Store:', workflowStore);

    // 1. Determine whether this is the first run
    const isFirstTime = !formContext.value.length;
    console.log('Is First Time:', isFirstTime);

    // 2. Determine whether data exists
    const hasTaskData = taskData && Object.keys(taskData).length > 0;
    console.log('Has Task Data:', hasTaskData);

    // 3. Extract Task Component Data
    const taskComponentData = extractTaskComponentData(stepProperties, workflowStore);
    console.log('Extracted Task Component Data:', JSON.stringify(taskComponentData, null, 2));

    // 4. Set the Path Params and Query Params values
    if (taskData.path_params && Object.keys(taskData.path_params).length > 0) {
      console.log('🔧 Setting path_params values from taskData:', taskData.path_params);
      if (!paramsContext.value) {
        paramsContext.value = {};
      }
      
      // When schema information exists, set the value in values
      if (paramsContext.value.pathParams && paramsContext.value.pathParams.values) {
        paramsContext.value.pathParams.values.forEach((context: any) => {
          const key = (context.context as any).title;
          if (taskData.path_params[key] !== undefined) {
            context.context.model.value = taskData.path_params[key];
          }
        });
        console.log('✅ Path params values set in schema contexts');
      } else {
        // When there is no schema information, set the value directly (fallback)
        (paramsContext.value as any).path_params = taskData.path_params;
        console.log('✅ Path params values set directly (fallback)');
      }
    }
    
    if (taskData.query_params && Object.keys(taskData.query_params).length > 0) {
      console.log('🔧 Setting query_params values from taskData:', taskData.query_params);
      if (!paramsContext.value) {
        paramsContext.value = {};
      }
      
      // When schema information exists, set the value in values
      if (paramsContext.value.queryParams && paramsContext.value.queryParams.values) {
        paramsContext.value.queryParams.values.forEach((context: any) => {
          const key = (context.context as any).title;
          if (taskData.query_params[key] !== undefined) {
            context.context.model.value = taskData.query_params[key];
          }
        });
        console.log('✅ Query params values set in schema contexts');
      } else {
        // When there is no schema information, set the value directly (fallback)
        (paramsContext.value as any).query_params = taskData.query_params;
        console.log('✅ Query params values set directly (fallback)');
      }
    }

    // 5. Choose the appropriate initialization method
    if (isFirstTime) {
      if (hasTaskData && taskComponentData && Object.keys(taskComponentData).length > 0) {
        console.log('🔄 Initializing with schema and data');
        initializeWithSchemaAndData(taskComponentData, taskData);
      } else if (hasTaskData) {
        console.log('🔄 Initializing with data only');
        initializeWithDataOnly(taskData);
      } else if (taskComponentData && Object.keys(taskComponentData).length > 0) {
        console.log('🔄 Initializing with schema only');
        initializeWithSchemaOnly(taskComponentData);
      } else {
        console.log('⚠️ No data or schema available for initialization');
      }
    } else {
      console.log('🔄 Updating existing context with data');
      if (hasTaskData) {
        mapDataToExistingContext(taskData, taskComponentData);
      }
    }

    console.log('=== initializeWithData END ===');
  }

  /**
   * Extract the Task Component Data
   */
  function extractTaskComponentData(stepProperties: any, workflowStore?: any): any {
    console.log('=== extractTaskComponentData START ===');
    //console.log('Step Properties:', JSON.stringify(stepProperties, null, 2));
    console.log('ℹ️ Using only list-task-component data from stepProperties');

    // 1. Extract the list-task-component response structure from step.properties.originalData (priority 1)
    if (stepProperties.originalData) {
      console.log('🔍 OriginalData found:', stepProperties.originalData);
      
      // When originalData.data exists
      if (stepProperties.originalData.data) {
        const originalData = stepProperties.originalData.data;
        const extractedData = {
          body_params: originalData.body_params || {},
          path_params: originalData.path_params || {},
          query_params: originalData.query_params || {}
        };
        console.log('✅ Using step.properties.originalData.data as taskComponentData:', extractedData);
        return extractedData;
      }
      
      // When originalData itself has path_params, query_params
      if (stepProperties.originalData.path_params || stepProperties.originalData.query_params) {
        console.log('🔍 OriginalData structure:', JSON.stringify(stepProperties.originalData, null, 2));
        console.log('🔍 OriginalData body_params:', stepProperties.originalData.body_params);
        console.log('🔍 OriginalData path_params:', stepProperties.originalData.path_params);
        console.log('🔍 OriginalData query_params:', stepProperties.originalData.query_params);
        
        const extractedData = {
          body_params: stepProperties.originalData.body_params || {},
          path_params: stepProperties.originalData.path_params || {},
          query_params: stepProperties.originalData.query_params || {}
        };
        console.log('✅ Using step.properties.originalData directly as taskComponentData:', extractedData);
        return extractedData;
      }
    }

    // 2. Removed workflowStore - use data only from list-task-component
    console.log('ℹ️ Skipping workflowStore - using only list-task-component data');

    // 3. Removed workflowStore.taskComponents - use data only from list-task-component
    console.log('ℹ️ Skipping workflowStore.taskComponents - using only list-task-component data');

    // 4. Extract directly from step.properties.model (priority 4)
    if (stepProperties.model && Object.keys(stepProperties.model).length > 0) {
      console.log('🔍 Using step.properties.model as fallback');
      console.log('🔍 Model structure:', JSON.stringify(stepProperties.model, null, 2));
      
      const extractedData = {
        body_params: stepProperties.model,
        path_params: {},
        query_params: {}
      };
      console.log('✅ Using step.properties.model as taskComponentData:', extractedData);
      return extractedData;
    }

    // 2. Extract directly from step.properties.model (priority 2)
    if (stepProperties.model && Object.keys(stepProperties.model).length > 0) {
      const extractedData = {
        body_params: stepProperties.model,
        path_params: stepProperties.path_params || {},
        query_params: stepProperties.query_params || {}
      };
      console.log('✅ Using step.properties.model as taskComponentData:', extractedData);
      return extractedData;
    }

    // 3. Find the task component in workflowStore (priority 3)
    if (workflowStore && workflowStore.taskComponents) {
      console.log('🔍 Searching in workflowStore.taskComponents:', workflowStore.taskComponents);
      console.log('🔍 Looking for task component name:', stepProperties.name);
      
      const taskComponent = workflowStore.taskComponents.find(
        (tc: any) => tc.name === stepProperties.name
      );
      
      if (taskComponent?.data) {
        console.log('✅ Using workflowStore taskComponent data:', taskComponent.data);
        return taskComponent.data;
      } else {
        console.log('⚠️ Task component not found in workflowStore:', stepProperties.name);
        console.log('🔍 Available task components:', workflowStore.taskComponents.map((tc: any) => tc.name));
      }
    }

    console.log('⚠️ No task component data found');
    return {};
  }

  /**
   * Infer the schema from the data
   */
  function inferSchemaFromData(data: any, depth: number = 0): any {
    console.log(`inferSchemaFromData START (depth: ${depth})`);
    
    const schema: any = {};
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        console.log(`Processing field: ${key} (depth: ${depth})`);
        
        if (Array.isArray(value)) {
          // Array type - generic handling
          schema[key] = {
            type: 'array',
            items: value.length > 0 ? inferSchemaFromData(value[0], depth + 1) : { type: 'string' }
          };
          console.log(`✅ Array field ${key} inferred (depth: ${depth})`);
        } else if (typeof value === 'object' && value !== null) {
          // Object type - generic handling
          schema[key] = {
            type: 'object',
            properties: inferSchemaFromData(value, depth + 1)
          };
          console.log(`✅ Object field ${key} inferred (depth: ${depth})`);
        } else if (typeof value === 'string') {
          // String type
          schema[key] = {
            type: 'string',
            example: value
          };
          console.log(`✅ String field ${key} inferred`);
        } else if (typeof value === 'number') {
          // Number type
          schema[key] = {
            type: 'number',
            example: value
          };
          console.log(`✅ Number field ${key} inferred`);
        } else if (typeof value === 'boolean') {
          // Boolean type
          schema[key] = {
            type: 'boolean',
            example: value
          };
          console.log(`✅ Boolean field ${key} inferred`);
        } else {
          // Other types
          schema[key] = {
            type: 'string',
            example: String(value)
          };
          console.log(`✅ Default field ${key} inferred as string`);
        }
      });
    }
    
    console.log(`Inferred schema result (depth: ${depth})`);
    return schema;
  }

  /**
   * Initialization using both the schema and the data
   */
  function initializeWithSchemaAndData(taskComponentData: any, taskData: any): void {
    console.log('=== initializeWithSchemaAndData START ===');
    console.log('TaskComponentData:', JSON.stringify(taskComponentData, null, 2));
    console.log('TaskData:', JSON.stringify(taskData, null, 2));
    
    try {
      // 1. Build the form context based on the Body Params schema
      const bodyParamsSchema = taskComponentData?.body_params?.properties || {};
      console.log('Body params schema:', JSON.stringify(bodyParamsSchema, null, 2));
      
      // Check the targetSoftwareModel schema
      if (bodyParamsSchema.targetSoftwareModel) {
        console.log('✅ Found targetSoftwareModel in body_params schema');
        console.log('targetSoftwareModel schema:', JSON.stringify(bodyParamsSchema.targetSoftwareModel, null, 2));
        
        if (bodyParamsSchema.targetSoftwareModel.properties?.servers) {
          console.log('✅ Found servers in targetSoftwareModel schema');
          console.log('servers schema:', JSON.stringify(bodyParamsSchema.targetSoftwareModel.properties.servers, null, 2));
        } else {
          console.log('⚠️ servers not found in targetSoftwareModel schema');
        }
      } else {
        console.log('⚠️ targetSoftwareModel not found in body_params schema');
        console.log('Available properties:', Object.keys(bodyParamsSchema));
        
        // When there is no targetSoftwareModel, use the hardcoded schema
        if (Object.keys(bodyParamsSchema).length === 0) {
          console.log('🔄 No body_params schema found, using hardcoded targetSoftwareModel schema');
          const hardcodedSchema = {
            targetSoftwareModel: {
              type: 'object',
              properties: {
                servers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      errors: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      migration_list: {
                        type: 'object',
                        properties: {
                          binaries: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                binary_path: { type: 'string' },
                                custom_configs: { type: 'array', items: { type: 'string' } },
                                custom_data_paths: { type: 'array', items: { type: 'string' } },
                                name: { type: 'string' },
                                needed_libraries: { type: 'array', items: { type: 'string' } },
                                order: { type: 'integer' },
                                version: { type: 'string' }
                              }
                            }
                          },
                          containers: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                container_id: { type: 'string' },
                                container_image: {
                                  type: 'object',
                                  properties: {
                                    image_architecture: { type: 'string' },
                                    image_hash: { type: 'string' },
                                    image_name: { type: 'string' },
                                    image_version: { type: 'string' }
                                  }
                                },
                                container_ports: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      container_port: { type: 'integer' },
                                      host_ip: { type: 'string' },
                                      host_port: { type: 'integer' },
                                      protocol: { type: 'string' }
                                    }
                                  }
                                },
                                container_status: { type: 'string' },
                                docker_compose_path: { type: 'string' },
                                envs: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      name: { type: 'string' },
                                      value: { type: 'string' }
                                    }
                                  }
                                },
                                mount_paths: { type: 'array', items: { type: 'string' } },
                                name: { type: 'string' }
                              }
                            }
                          }
                        }
                      },
                      source_connection_info_id: { type: 'string' }
                    }
                  }
                }
              }
            }
          };
          
          // Replace bodyParamsSchema with the hardcoded schema
          Object.assign(bodyParamsSchema, hardcodedSchema);
          console.log('✅ Applied hardcoded targetSoftwareModel schema');
        }
      }
      
      if (Object.keys(bodyParamsSchema).length > 0) {
        // Case 1: When a schema exists
        console.log('✅ Case 1: Using existing body_params schema');
        
        // Extract the body_params data from taskData
        let bodyParamsData = taskData?.request_body || taskData?.body_params || {};
        console.log('Body params data for context creation:', JSON.stringify(bodyParamsData, null, 2));
        
        // If request_body is an object, use it as is; if a string, parse it
        if (typeof bodyParamsData === 'string') {
          try {
            bodyParamsData = JSON.parse(bodyParamsData);
            console.log('✅ Parsed request_body JSON:', JSON.stringify(bodyParamsData, null, 2));
          } catch (error) {
            console.log('⚠️ Failed to parse request_body JSON:', error);
            bodyParamsData = {};
          }
        }
        
        // Check whether targetSoftwareModel exists
        if (bodyParamsData.targetSoftwareModel) {
          console.log('✅ Found targetSoftwareModel in request_body data');
          console.log('targetSoftwareModel data:', JSON.stringify(bodyParamsData.targetSoftwareModel, null, 2));
          
          if (bodyParamsData.targetSoftwareModel.servers) {
            console.log('✅ Found servers in targetSoftwareModel data');
            console.log('servers data length:', bodyParamsData.targetSoftwareModel.servers.length);
            console.log('servers data:', JSON.stringify(bodyParamsData.targetSoftwareModel.servers, null, 2));
          } else {
            console.log('⚠️ servers not found in targetSoftwareModel data');
          }
        } else {
          console.log('⚠️ targetSoftwareModel not found in request_body data');
        }
        
        console.log('=== Calling parseJsonSchema ===');
        console.log('Schema to parse:', JSON.stringify(bodyParamsSchema, null, 2));
        console.log('Data to parse:', JSON.stringify(bodyParamsData, null, 2));
        
        const parsedContexts = parseJsonSchema({ 
          type: 'object', 
          properties: bodyParamsSchema 
        }, bodyParamsData);
        
        formContext.value = parsedContexts;
        console.log('✅ Form context created from body_params schema with data');
        console.log('Form context length after parseJsonSchema:', formContext.value.length);
        console.log('Form context types:', formContext.value.map(c => c.type));
        
        // Perform the data mapping
        console.log('=== Calling mapDataToFormContextOptimized ===');
        console.log('formContext.value length:', formContext.value.length);
        console.log('bodyParamsData:', bodyParamsData);
        console.log('bodyParamsSchema:', bodyParamsSchema);
        mapDataToFormContextOptimized(formContext.value, bodyParamsData, bodyParamsSchema, undefined, 0);
        console.log('✅ Data mapping completed');
        console.log('Form context length after mapping:', formContext.value.length);
      } else {
        // Case 2: When there is no schema - parse request_body to infer the schema
        console.log('⚠️ Case 2: No body_params schema found, inferring from request_body');
        
        let bodyParamsData = {};
        try {
          // If request_body is a JSON string, parse it
          if (typeof taskData?.request_body === 'string') {
            bodyParamsData = JSON.parse(taskData.request_body);
            console.log('✅ Parsed request_body JSON');
          } else if (typeof taskData?.request_body === 'object') {
            bodyParamsData = taskData.request_body;
            console.log('✅ Using request_body object');
          }
        } catch (error) {
          console.error('❌ Failed to parse request_body:', error);
          bodyParamsData = {};
        }
        
        if (Object.keys(bodyParamsData).length > 0) {
          console.log('Inferring schema from request_body data');
          const inferredSchema = inferSchemaFromData(bodyParamsData);
          
          const parsedContexts = parseJsonSchema({ 
            type: 'object', 
            properties: inferredSchema 
          }, bodyParamsData);
          
          formContext.value = parsedContexts;
          console.log('✅ Form context created from inferred schema with data');
        } else {
          console.log('⚠️ No request_body data available for schema inference');
        }
      }

      // 2. Handle Path Params
      const pathParamsSchema = taskComponentData?.path_params;
      if (pathParamsSchema && Object.keys(pathParamsSchema).length > 0) {
        const pathParamsContexts = parsePathParams(pathParamsSchema);
        if (pathParamsContexts.length > 0) {
          // Store path_params in paramsContext
          if (!paramsContext.value) {
            paramsContext.value = {};
          }
          paramsContext.value.pathParams = {
            values: pathParamsContexts
          };
          console.log('✅ Path params context created');
        }
      }

      // 3. Handle Query Params
      const queryParamsSchema = taskComponentData?.query_params;
      if (queryParamsSchema && Object.keys(queryParamsSchema).length > 0) {
        const queryParamsContexts = parseQueryParams(queryParamsSchema);
        if (queryParamsContexts.length > 0) {
          // Store query_params in paramsContext
          if (!paramsContext.value) {
            paramsContext.value = {};
          }
          paramsContext.value.queryParams = {
            values: queryParamsContexts
          };
          console.log('✅ Query params context created');
        }
      }

      // 4. Data mapping
      const parsedTaskData = typeof taskData === 'string' ? JSON.parse(taskData) : taskData;
      populateFormWithTaskComponentData(parsedTaskData, taskComponentData);
      
      console.log('✅ Schema and data initialization completed');
      } catch (error) {
      console.error('Error in initializeWithSchemaAndData:', error);
    }
  }

  /**
   * Initialization using only the data
   */
  function initializeWithDataOnly(taskData: any): void {
    console.log('=== initializeWithDataOnly START ===');
    
    try {
      const parsedTaskData = typeof taskData === 'string' ? JSON.parse(taskData) : taskData;
      
      // Build the schema from the data
      const generatedSchema = generateSchemaFromData(parsedTaskData);
      console.log('Generated schema from data:', generatedSchema);
      
      // Build the form context from the generated schema
      formContext.value = parseJsonSchema(generatedSchema);
      
      // Fill the form with existing data
      populateFormWithExistingData(parsedTaskData, '');
      
      console.log('✅ Data-only initialization completed');
    } catch (error) {
      console.error('Error in initializeWithDataOnly:', error);
    }
  }

  /**
   * Initialization using only the schema
   */
  function initializeWithSchemaOnly(taskComponentData: any): void {
    console.log('=== initializeWithSchemaOnly START ===');
    
    try {
      const bodyParamsSchema = taskComponentData?.body_params?.properties || {};
      if (Object.keys(bodyParamsSchema).length > 0) {
        formContext.value = parseJsonSchema({ 
          type: 'object', 
          properties: bodyParamsSchema 
        });
        console.log('✅ Schema-only initialization completed');
        } else {
        console.log('⚠️ No schema available for initialization');
        }
      } catch (error) {
      console.error('Error in initializeWithSchemaOnly:', error);
    }
  }

  /**
   * Map the data onto the existing context
   */
  function mapDataToExistingContext(taskData: any, taskComponentData: any): void {
    console.log('=== mapDataToExistingContext START ===');
    
    try {
      const parsedTaskData = typeof taskData === 'string' ? JSON.parse(taskData) : taskData;
      
      if (taskComponentData && Object.keys(taskComponentData).length > 0) {
        populateFormWithTaskComponentData(parsedTaskData, taskComponentData);
    } else {
        populateFormWithExistingDataFallback(parsedTaskData);
      }
      
      console.log('✅ Data mapped to existing context');
    } catch (error) {
      console.error('Error in mapDataToExistingContext:', error);
    }
  }

  return {
    formContext,
    paramsContext,
    componentNameModel,
    setFormContext: (context: FormContext[]) => {
      formContext.value = context;
    },
    setParamsContext: (context: any) => {
      paramsContext.value = context;
    },
    setComponentName: (name: string) => {
      componentNameModel.value = name;
    },
    setTaskComponentModel: (model: JsonSchema) => {
      taskComponentModel = model;
    },
    populateFormWithTaskComponentData,
    populateFormWithExistingDataFallback,
    addArrayElement,
    deleteArrayElement,
    addEntity,
    deleteEntity,
    convertFormModelToStepProperties,
    convertParamsModelToStepProperties,
    loadExistingValues,
    parseJsonSchema,
    createArrayItemContext,
    parsePathParams,
    parseQueryParams,
    createAccordionSlot,
    createNestedObjectContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    createArrayContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    createInputContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    createSelectContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    createJsonInputContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    createUnknownTypeContext: () => {
      // TODO: needs to be imported from contextCreators
    },
    initializeWithData,
    extractTaskComponentData,
    initializeWithSchemaAndData,
    initializeWithDataOnly,
    initializeWithSchemaOnly,
    mapDataToExistingContext,
    inferSchemaFromData
  };
}
