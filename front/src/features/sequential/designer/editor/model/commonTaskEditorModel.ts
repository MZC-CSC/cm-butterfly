import { ref, Ref, reactive } from 'vue';

// JsonSchema 타입 정의
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

// Context 타입 정의
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

// ArrayType별 Context 정의
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
    subject?: string;  // Form.vue 호환성
    rawData?: any;    // 빈 객체 데이터 저장용
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
 * 범용적인 태스크 에디터를 위한 모델 관리
 */
export function useCommonTaskEditorModel() {
  const formContext = ref<FormContext[]>([]);
  const paramsContext = ref<any>({});
  const componentNameModel = ref<any>();
  
  let originalObject: any = null;
  let originalSchema: JsonSchema | null = null;
  let taskComponentModel: JsonSchema | null = null;

  // 헬퍼 함수들
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
  
  // Object 복잡도 분석 함수
  function analyzeObjectComplexity(schema: any, data: any): boolean {
    console.log(`🔍 Analyzing object complexity:`, { schema, data });
    
    if (!schema || !schema.properties) {
      console.log(`  - No schema properties, treating as simple object`);
      return false;
    }
    
    const properties = schema.properties;
    const propertyKeys = Object.keys(properties);
    
    // 1. properties 개수가 많으면 복잡한 객체
    if (propertyKeys.length > 5) {
      console.log(`  - Complex object: too many properties (${propertyKeys.length})`);
      return true;
    }
    
    // 2. 중첩된 object나 array가 있으면 복잡한 객체
    const hasNestedStructures = propertyKeys.some(key => {
      const prop = properties[key];
      return prop.type === 'object' || prop.type === 'array';
    });
    
    if (hasNestedStructures) {
      console.log(`  - Complex object: has nested structures`);
      return true;
    }
    
    // 3. 실제 데이터가 복잡한 구조를 가지고 있으면 복잡한 객체
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
  
  // ArrayType 결정 함수 - 스키마 우선, 데이터로 값 설정
  function determineArrayTypeFromSchema(fieldSchema: JsonSchema, key: string, arrayData: any[]): string {
    console.log(`🔍 Determining ArrayType for ${key}:`, { fieldSchema, arrayData });
    
    // 1. 스키마의 items 타입 분석 (우선순위 1)
    // items가 있으면 array 타입으로 간주 (type이 명시되지 않은 경우도 처리)
    if (fieldSchema.type === 'array' || fieldSchema.items) {
      const itemType = fieldSchema.items?.type;
      console.log(`Schema items type: ${itemType}`);
      
      // items가 있지만 type이 undefined인 경우, items의 properties를 분석
      if (!itemType && fieldSchema.items?.properties) {
        const properties = fieldSchema.items.properties;
        const propertyKeys = Object.keys(properties);
        const propertyTypes = Object.values(properties).map((prop: any) => prop.type);
        
        // 기본형 타입들 정의
        const basicTypes = ['string', 'integer', 'number', 'boolean'];
        
        // properties 분석
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
        
        // 1. properties가 1개의 기본형인 경우
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
        
        // 2. properties가 2개 이상의 기본형인 경우 (객체가 아닌 기본형들만)
        if (propertyKeys.length >= 2 && basicTypeProperties.length === propertyKeys.length && objectProperties.length === 0 && arrayProperties.length === 0) {
          console.log(`✅ ${key} is basicObjectArray (schema-based: multiple basic type properties)`);
          return 'basicObjectArray';
        }
        
        // 3. 여러 형태가 섞여있는 경우 (기본형 + 객체 + 배열 등)
        if (objectProperties.length > 0 || arrayProperties.length > 0 || otherProperties.length > 0 || 
            (basicTypeProperties.length > 0 && (objectProperties.length > 0 || arrayProperties.length > 0))) {
          console.log(`✅ ${key} is nestedObjectArray (schema-based: mixed types - basic:${basicTypeProperties.length}, object:${objectProperties.length}, array:${arrayProperties.length})`);
          return 'nestedObjectArray';
        }
        
        // 4. 기본형이지만 위 조건에 맞지 않는 경우 (fallback)
        if (basicTypeProperties.length > 0) {
          console.log(`✅ ${key} is basicObjectArray (schema-based: fallback for basic types)`);
          return 'basicObjectArray';
        }
        
        // 5. 알 수 없는 경우
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
        // 객체 배열인 경우 - 내부 properties 분석
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
    
    // 2. 실제 데이터 분석 (fallback - 스키마가 없는 경우)
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
        // 객체 배열인 경우 - 내부 properties 분석
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
    
    // 3. 빈 배열인 경우
    if (!arrayData || arrayData.length === 0) {
      console.log(`⚠️ ${key} is emptyArray (no data)`);
      return 'emptyArray';
    }
    
    // 4. 기본값
    console.log(`⚠️ ${key} is unknownArray (fallback)`);
    return 'unknownArray';
  }

  // Context 생성 헬퍼 함수들
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
        title: key,    // title 사용
        values,
        isRequired,
        description,
        subject: key   // subject 추가 (Form.vue 호환성)
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
   * Array item의 스키마를 기반으로 FormContext 생성
   */
  function createArrayItemContext(arraySchema: any, itemData?: any): FormContext[] {
    console.log('createArrayItemContext called with:', arraySchema, 'itemData:', itemData);
    
    if (!arraySchema || !arraySchema.items) {
      console.log('No array items schema found');
      return [];
    }

    const itemSchema = arraySchema.items;
    console.log('Array item schema:', itemSchema);

    // Array item이 object 타입인 경우
    if (itemSchema.type === 'object' && itemSchema.properties) {
      const contexts: FormContext[] = [];
      
      Object.entries(itemSchema.properties).forEach(([key, fieldSchema]: [string, any]) => {
        console.log(`Processing array item property: ${key}`, fieldSchema);
        
        // Array 타입은 제외 (중첩 배열 처리 안함)
        if (fieldSchema.type === 'array') {
          console.log(`Skipping nested array field: ${key}`);
          return;
        }
        
        // Input 필드
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
        // Nested Object 필드
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
    
    // Array item이 primitive 타입인 경우
    console.log('Array item is primitive type, no properties to create');
    return [];
  }

  /**
   * JSON Schema를 파싱하여 폼 컨텍스트 생성
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
      
      // Array 타입은 적절한 ArrayType context로 처리
      if (fieldSchema.type === 'array' || fieldSchema.items) {
        // Array 데이터 추출
        const arrayData = data && data[key] ? data[key] : [];
        console.log(`Processing ARRAY field: ${key} (depth: ${depth})`);
        
        // ArrayType 결정
        const arrayType = determineArrayTypeFromSchema(fieldSchema, key, arrayData);
        console.log(`ArrayType determined for ${key}: ${arrayType}`);
        console.log(`Field schema for ${key}:`, fieldSchema);
        console.log(`Array data for ${key}:`, arrayData);
        
        // ArrayType에 따라 적절한 Context 생성
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
          // nestedObjectArray인 경우 items.properties를 기반으로 처리
          console.log(`Processing nestedObjectArray ${key} with items schema:`, fieldSchema.items);
          
          let values: any[] = [];
          
          // items.properties를 기반으로 템플릿 생성
          if (fieldSchema.items && fieldSchema.items.properties) {
            const templateContext = parseJsonSchema(fieldSchema.items, `${key}`, depth + 1);
            console.log(`Generated template context for ${key}:`, templateContext);
            
            // 실제 데이터가 있는 경우 각 아이템을 처리
            if (arrayData && Array.isArray(arrayData) && arrayData.length > 0) {
              console.log(`Processing ${arrayData.length} actual items for nestedObjectArray ${key}`);
              values = arrayData.map((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  // 각 아이템의 properties를 input context로 변환
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
                      // object 타입인 경우 복잡도에 따라 처리
                      const isComplexObject = analyzeObjectComplexity(itemSchema, itemValue);
                      
                      if (isComplexObject) {
                        // 복잡한 object인 경우 nestedObject로 처리
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
                        // 단순한 object인 경우 properties를 직접 표시
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
                      // array 타입인 경우 nestedObject로 처리 (복잡한 구조)
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
                      // 기타 타입은 input으로 처리
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
                  
                  // nestedObjectArray의 아이템은 nestedObject로 래핑하지 않고 직접 properties 반환
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
              // 데이터가 없는 경우 템플릿만 생성 (복잡도 분석 적용)
              console.log(`No data for nestedObjectArray ${key}, creating template with complexity analysis`);
              
              // 템플릿 컨텍스트를 복잡도에 따라 처리
              const processedTemplateContext = templateContext.map(templateItem => {
                if (templateItem.type === 'nestedObject' && templateItem.context) {
                  const itemSchema = fieldSchema.items?.properties?.[templateItem.context.title];
                  const isComplexObject = analyzeObjectComplexity(itemSchema, null);
                  
                  if (isComplexObject) {
                    // 복잡한 object는 nestedObject로 유지
                    return templateItem;
                  } else {
                    // 단순한 object는 input으로 변환
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
          
          // nestedObjectArray는 accordionContext로 처리
          const accordionItems = values.map((item: any, index: number) => {
            // 기존 데이터를 올바른 properties 구조로 변환
            let itemProperties: any[] = [];
            
            if (item.context?.values && Array.isArray(item.context.values)) {
              // 이미 FormContext 구조인 경우
              itemProperties = item.context.values as any[];
            } else if (item.context && typeof item.context === 'object') {
              // 일반 객체인 경우 properties로 변환
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
              // 직접 객체인 경우 스키마를 기반으로 properties 변환
              if (fieldSchema && fieldSchema.items && fieldSchema.items.properties) {
                console.log(`🔍 Processing item with schema:`, fieldSchema.items.properties);
                console.log(`🔍 Item data:`, item);
                
                // 스키마 기반으로 properties 생성
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
                    // object 타입인 경우 nestedObject로 생성
                    console.log(`🔍 Creating nestedObject for ${key} with properties:`, propSchema.properties);
                    // propSchema 자체를 스키마로 전달 (properties가 포함된 전체 스키마)
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
                    // array 타입인 경우 nestedObjectArray로 생성
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
                    // 기본 타입인 경우 input으로 생성
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
                // 스키마가 없는 경우 기본 input 타입으로 변환
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
          // basicObjectArray는 accordionContext로 처리
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
          // basicInputArray는 selectContext로 처리
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
      
      // 필드 타입에 따라 컨텍스트 생성
      if (fieldSchema.type === 'string' || fieldSchema.type === 'integer' || fieldSchema.type === 'number' || fieldSchema.type === 'boolean') {
        // Input 필드 - 데이터가 있으면 해당 값을 사용
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
        // Object 필드 처리 (범용적 처리)
        const nestedData = data && data[key] ? data[key] : undefined;
        console.log(`Processing OBJECT field: ${key} (depth: ${depth})`);
        console.log(`Object schema:`, fieldSchema);
        
        // Properties가 정의되지 않은 빈 객체인 경우 처리
        if (!fieldSchema.properties || Object.keys(fieldSchema.properties).length === 0) {
          console.log(`Object ${key} has no properties defined, creating empty nested object`);
          
          // 빈 객체이지만 nestedObject로 처리하여 UI에서 표시할 수 있도록 함
          // "property 정의되지 않음" 메시지를 표시하기 위해 특별한 컨텍스트 생성
          const emptyObjectContext = createNestedObjectContext(
            key,
            [], // 빈 배열 - properties가 없으므로
            schema.required?.includes(key) || false,
            fieldSchema.description
          );
          
          // 빈 객체임을 표시하기 위한 특별한 플래그 추가
          (emptyObjectContext as any).isEmptyObject = true;
          (emptyObjectContext as any).emptyMessage = 'property not defined';
          
          contexts.push(emptyObjectContext);
          console.log(`✅ Empty nested object field ${key} created (depth: ${depth})`);
        } else {
          // Object 내부에 array가 있는지 확인하고 복잡도 분석
          const arrayProperties = fieldSchema.properties ? 
            Object.entries(fieldSchema.properties).filter(([_, prop]: [string, any]) => prop.type === 'array') : [];
          
          console.log(`Object ${key} has ${arrayProperties.length} array properties:`, arrayProperties.map(([name, _]) => name));
          
          // Array property의 복잡도 분석
          let hasComplexArrays = false;
          if (arrayProperties.length > 0) {
            console.log(`Analyzing array complexity for object ${key}:`);
            arrayProperties.forEach(([arrayName, arrayProp]: [string, any]) => {
              console.log(`  - Array ${arrayName}:`, arrayProp);
              if (arrayProp.items) {
                // Array item의 타입 분석
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
          
          // Array가 있거나 복잡한 구조인 경우 nestedObject로 처리
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
          // Array가 없는 경우에도 nestedObject로 처리하되, 내부 properties는 재귀적으로 생성
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
   * Path Params를 파싱하여 컨텍스트 생성
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
   * Query Params를 파싱하여 컨텍스트 생성
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
   * 기존 데이터로 폼 채우기
   */
  function populateFormWithExistingData(data: any, path: string): void {
    console.log('populateFormWithExistingData called with:', { data, path });
    // TODO: 구현 필요
  }

  /**
   * Task Component Data를 활용한 데이터 매핑
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
    
    // formContext를 순회하며 데이터 매핑
    formContext.value.forEach(context => {
      const contextSubject = getContextSubject(context);
      console.log(`Processing context: ${contextSubject}, type: ${context.type}`);
      
      if (context.type === 'nestedObject') {
        // nestedObject인 경우 데이터 매핑
        const nestedData = savedData[contextSubject];
        if (nestedData !== undefined) {
          console.log(`Mapping data for nestedObject ${contextSubject}:`, nestedData);
          
          // 빈 객체인 경우 rawData로 저장
          if (typeof nestedData === 'object' && nestedData !== null && !Array.isArray(nestedData)) {
            if (!context.context.rawData) {
              context.context.rawData = {};
            }
            Object.assign(context.context.rawData, nestedData);
            console.log(`Stored raw data for ${contextSubject}:`, context.context.rawData);
            
            // values가 있는 경우 실제 데이터로 업데이트
            if (context.context.values && context.context.values.length > 0) {
              console.log(`Updating values for nestedObject ${contextSubject} with actual data`);
              context.context.values.forEach((valueContext: any) => {
                const valueSubject = getContextSubject(valueContext);
                const actualValue = nestedData[valueSubject];
                console.log(`Updating ${valueSubject} with:`, actualValue);
                
                if (valueContext.type === 'input' && actualValue !== undefined) {
                  valueContext.context.model.value = String(actualValue);
                } else if (valueContext.type === 'nestedObject' && actualValue && typeof actualValue === 'object') {
                  // nestedObject의 경우 재귀적으로 업데이트
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
                  // nestedObjectArray의 경우 배열 데이터로 업데이트
                  console.log(`Updating nestedObjectArray ${valueSubject} with ${actualValue.length} items`);
                  // 여기서는 실제 데이터가 있다는 것만 확인하고, 실제 렌더링은 스키마 기반으로 함
                }
              });
            }
          }
        }
      } else if (context.type === 'nestedObjectArray') {
        // nestedObjectArray인 경우 데이터 매핑
        const arrayData = savedData[contextSubject];
        if (arrayData && Array.isArray(arrayData)) {
          console.log(`Mapping data for nestedObjectArray ${contextSubject}:`, arrayData);
          
          // 각 배열 아이템을 nestedObject로 변환
          const mappedItems = arrayData.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // 객체의 각 속성을 적절한 context로 변환
              const itemContexts = Object.keys(item).map(key => {
                const value = item[key];
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  // object 타입인 경우 nestedObject로 처리
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
                  // string 등 기타 타입은 input으로 처리
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
        // input인 경우 직접 값 설정
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
   * TaskComponentData가 없을 때 fallback 처리
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
    
    // formContext를 순회하며 데이터 매핑
    formContext.value.forEach(context => {
      const contextSubject = getContextSubject(context);
      console.log(`Processing context (fallback): ${contextSubject}, type: ${context.type}`);
      
      if (context.type === 'nestedObject') {
        // nestedObject인 경우 데이터 매핑
        const nestedData = savedData[contextSubject];
        if (nestedData !== undefined) {
          console.log(`Mapping data for nestedObject ${contextSubject} (fallback):`, nestedData);
          
          // 빈 객체인 경우 rawData로 저장
          if (typeof nestedData === 'object' && nestedData !== null && !Array.isArray(nestedData)) {
            if (!context.context.rawData) {
              context.context.rawData = {};
            }
            Object.assign(context.context.rawData, nestedData);
            console.log(`Stored raw data for ${contextSubject} (fallback):`, context.context.rawData);
          }
        }
      } else if (context.type === 'nestedObjectArray') {
        // nestedObjectArray인 경우 데이터 매핑
        const arrayData = savedData[contextSubject];
        if (arrayData && Array.isArray(arrayData)) {
          console.log(`Mapping data for nestedObjectArray ${contextSubject} (fallback):`, arrayData);
          
          // 각 배열 아이템을 nestedObject로 변환
          const mappedItems = arrayData.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // 객체의 각 속성을 적절한 context로 변환
              const itemContexts = Object.keys(item).map(key => {
                const value = item[key];
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  // object 타입인 경우 nestedObject로 처리
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
                  // string 등 기타 타입은 input으로 처리
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
        // input인 경우 직접 값 설정
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
   * 데이터를 폼 컨텍스트에 매핑 (최적화된 버전)
   */
  function mapDataToFormContextOptimized(
    formContext: FormContext[], 
    data: any, 
    schema: Record<string, any>,
  createAccordionSlotFn?: any,
  depth: number = 0
  ): void {
  // 무한루프 방지: 최대 깊이 제한
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
    
    // FormContext가 비어있고 스키마가 있는 경우 - 스키마에서 FormContext 생성
    if (formContext.length === 0 && schema && Object.keys(schema).length > 0) {
      console.log(`⚠️ FormContext is empty but schema exists. Creating FormContext from schema...`);
      console.log(`Schema properties:`, Object.keys(schema));
      
      // 스키마의 각 속성에 대해 FormContext 생성
      Object.entries(schema).forEach(([key, fieldSchema]: [string, any]) => {
        console.log(`Creating FormContext for ${key}:`, fieldSchema);
        
        if (fieldSchema.type === 'string' || fieldSchema.type === 'integer' || fieldSchema.type === 'boolean') {
          // 기본 타입 - input으로 생성
          const inputContext = createInputContext(
            key,
            data[key] || '',
            fieldSchema.required || false,
            fieldSchema.description || ''
          );
          // title이 제대로 설정되었는지 확인
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
          // 객체 타입 - nestedObject로 생성
          let nestedValues: FormContext[] = [];
          
          // fieldSchema.properties가 있는 경우 재귀적으로 파싱
          if (fieldSchema.properties) {
            console.log(`    🔍 Parsing properties for nestedObject ${key}:`, fieldSchema.properties);
            console.log(`    🔍 Data for ${key}:`, data[key]);
            // fieldSchema 전체를 스키마로 전달 (properties가 포함된 전체 스키마)
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
          // title이 제대로 설정되었는지 확인
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
          // 배열 타입 - nestedObjectArray로 생성
          const arrayContext = {
            type: 'nestedObjectArray' as const,
            context: {
              title: key,
              values: [] as FormContext[],
              isRequired: fieldSchema.required || false,
              description: fieldSchema.description || ''
            }
          };
          // title이 제대로 설정되었는지 확인
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
      
      // 생성된 FormContext에 실제 데이터 매핑
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
          
          // 배열 아이템들 처리
          console.log(`🔍 Starting forEach loop for ${data[fieldName].length} items`);
          data[fieldName].forEach((item: any, itemIndex: number) => {
            console.log(`  📋 Processing array item[${itemIndex}]:`, item);
            console.log(`  🔍 Item type: ${typeof item}, isObject: ${typeof item === 'object'}, isNull: ${item === null}`);
            
            // item의 실제 타입 분석
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
              itemType: itemType, // 실제 item의 타입 추가
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
    
        // 각 FormContext 항목에 데이터 매핑
        formContext.forEach((context, index) => {
          console.log(`Processing FormContext[${index}]:`, context);
          console.log(`  Context type: ${context.type}`);
          console.log(`  Context title: ${(context.context as any)?.title}`);
          console.log(`  Context has values: ${!!(context.context as any)?.values}`);
          console.log(`  Context values length: ${(context.context as any)?.values?.length || 0}`);
          
          if (context.type === 'input' && context.context?.model) {
            // Input 타입 - 직접 값 할당
            const fieldName = (context.context as any).title;
            console.log(`  Processing input field: ${fieldName}`);
            if (data[fieldName] !== undefined) {
              context.context.model.value = data[fieldName];
              console.log(`✅ Mapped input ${fieldName}:`, data[fieldName]);
            }
          } else if (context.type === 'nestedObject' && context.context?.values) {
            // NestedObject 타입 - 재귀적으로 매핑
            const fieldName = (context.context as any).title;
            console.log(`  Processing nested object field: ${fieldName}`);
            if (data[fieldName] && typeof data[fieldName] === 'object') {
              console.log(`🔄 Mapping nested object ${fieldName}:`, data[fieldName]);
              // 해당 필드의 데이터만 전달
              const fieldData = data[fieldName];
              const fieldSchema = schema[fieldName]?.properties || {};
              mapDataToFormContextOptimized(context.context.values, fieldData, fieldSchema, createAccordionSlotFn, depth + 1);
            }
          } else if ((context.type === 'nestedObjectArray' || context.type === 'basicObjectArray' || context.type === 'accordion') && context.context?.values) {
            // NestedObjectArray/BasicObjectArray/Accordion 타입 - 배열 아이템들 매핑
            const fieldName = (context.context as any).title;
            console.log(`  Processing array field: ${fieldName}`);
            if (Array.isArray(data[fieldName])) {
              console.log(`🔄 Mapping array ${fieldName} with ${data[fieldName].length} items:`, data[fieldName]);
          
          // 기존 values 초기화
          (context.context as any).values = [];
          
          // 각 배열 아이템에 대해 처리
          data[fieldName].forEach((item: any, itemIndex: number) => {
            console.log(`  Processing array item[${itemIndex}]:`, item);
            
            // nestedObjectArrayItem 컨텍스트 생성
            const itemContext = {
              type: 'nestedObjectArrayItem' as const,
              context: {
                subject: `Item ${itemIndex + 1}`,
                values: [] as FormContext[],
                isRequired: false
              }
            };
            
            // 아이템의 properties를 분석하여 values 생성
            if (typeof item === 'object' && item !== null) {
              // 해당 아이템의 데이터와 스키마만 전달하여 재귀 호출
              const itemSchema = schema[fieldName]?.items?.properties || {};
              console.log(`  🔍 Processing item with schema:`, itemSchema);
              console.log(`  🔍 Item data:`, JSON.stringify(item, null, 2));
              
              // 재귀적으로 아이템의 properties 처리
              mapDataToFormContextOptimized(itemContext.context.values, item, itemSchema, createAccordionSlotFn, depth + 1);
              
              console.log(`  ✅ Item processing completed. Values length: ${itemContext.context.values.length}`);
            } else {
              // 기본값 아이템
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
   * 컨텍스트가 존재하도록 보장
   */
  function ensureContextsExist(
    formContext: FormContext[], 
    schema: Record<string, any>,
    createAccordionSlotFn?: any
  ): void {
    // TODO: 구현 필요
  }

  /**
   * 기존 데이터를 기반으로 JSON Schema 생성
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
   * 아코디언 슬롯 생성
   */
  function createAccordionSlot(data: any, index: number, schema: JsonSchema): any {
    // TODO: 구현 필요
  }

  /**
   * 폼 데이터를 원본 객체로 변환
   */
  function convertFormToObject(): any {
    // TODO: 구현 필요
  }

  /**
   * 중첩 객체를 데이터로 변환
   */
  function convertNestedObjectToData(nestedObject: NestedObjectContext): any {
    // TODO: 구현 필요
  }

  /**
   * 아코디언 슬롯을 데이터로 변환
   */
  function convertAccordionSlotToData(slot: any): any {
    // TODO: 구현 필요
  }

  /**
   * 배열 요소 추가
   */
  function addArrayElement(arrayIndex: number): void {
    // TODO: 구현 필요
  }

  /**
   * 배열 요소 삭제
   */
  function deleteArrayElement(arrayIndex: number, slotIndex: number): void {
    // TODO: 구현 필요
  }

  /**
   * 엔티티 추가
   */
  function addEntity(target: any): void {
    // TODO: 구현 필요
  }

  /**
   * 엔티티 삭제
   */
  function deleteEntity(target: any, index: number): void {
    // TODO: 구현 필요
  }

  /**
   * 폼 모델을 Step Properties로 변환
   */
  function convertFormModelToStepProperties(): object {
    console.log('convertFormModelToStepProperties called');
    return convertFormToObject();
  }

  /**
   * 파라미터 모델을 Step Properties로 변환
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
   * 기존 값 로드
   */
  function loadExistingValues(schema: JsonSchema, existingData: any): void {
    // TODO: 구현 필요
  }

  /**
   * 최초 실행 여부와 데이터 존재 여부를 판단하여 적절한 초기화 수행
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

    // 1. 최초 실행 여부 판단
    const isFirstTime = !formContext.value.length;
    console.log('Is First Time:', isFirstTime);

    // 2. 데이터 존재 여부 판단
    const hasTaskData = taskData && Object.keys(taskData).length > 0;
    console.log('Has Task Data:', hasTaskData);

    // 3. Task Component Data 추출
    const taskComponentData = extractTaskComponentData(stepProperties, workflowStore);
    console.log('Extracted Task Component Data:', JSON.stringify(taskComponentData, null, 2));

    // 4. Path Params와 Query Params 값 설정
    if (taskData.path_params && Object.keys(taskData.path_params).length > 0) {
      console.log('🔧 Setting path_params values from taskData:', taskData.path_params);
      if (!paramsContext.value) {
        paramsContext.value = {};
      }
      
      // 스키마 정보가 있는 경우 values에 값 설정
      if (paramsContext.value.pathParams && paramsContext.value.pathParams.values) {
        paramsContext.value.pathParams.values.forEach((context: any) => {
          const key = (context.context as any).title;
          if (taskData.path_params[key] !== undefined) {
            context.context.model.value = taskData.path_params[key];
          }
        });
        console.log('✅ Path params values set in schema contexts');
      } else {
        // 스키마 정보가 없는 경우 직접 값 설정 (fallback)
        (paramsContext.value as any).path_params = taskData.path_params;
        console.log('✅ Path params values set directly (fallback)');
      }
    }
    
    if (taskData.query_params && Object.keys(taskData.query_params).length > 0) {
      console.log('🔧 Setting query_params values from taskData:', taskData.query_params);
      if (!paramsContext.value) {
        paramsContext.value = {};
      }
      
      // 스키마 정보가 있는 경우 values에 값 설정
      if (paramsContext.value.queryParams && paramsContext.value.queryParams.values) {
        paramsContext.value.queryParams.values.forEach((context: any) => {
          const key = (context.context as any).title;
          if (taskData.query_params[key] !== undefined) {
            context.context.model.value = taskData.query_params[key];
          }
        });
        console.log('✅ Query params values set in schema contexts');
      } else {
        // 스키마 정보가 없는 경우 직접 값 설정 (fallback)
        (paramsContext.value as any).query_params = taskData.query_params;
        console.log('✅ Query params values set directly (fallback)');
      }
    }

    // 5. 적절한 초기화 방식 선택
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
   * Task Component Data 추출
   */
  function extractTaskComponentData(stepProperties: any, workflowStore?: any): any {
    console.log('=== extractTaskComponentData START ===');
    //console.log('Step Properties:', JSON.stringify(stepProperties, null, 2));
    console.log('ℹ️ Using only list-task-component data from stepProperties');

    // 1. step.properties.originalData에서 list-task-component 응답 구조 추출 (우선순위 1)
    if (stepProperties.originalData) {
      console.log('🔍 OriginalData found:', stepProperties.originalData);
      
      // originalData.data가 있는 경우
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
      
      // originalData 자체에 path_params, query_params가 있는 경우
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

    // 2. workflowStore 제거 - list-task-component에서만 데이터 사용
    console.log('ℹ️ Skipping workflowStore - using only list-task-component data');

    // 3. workflowStore.taskComponents 제거 - list-task-component에서만 데이터 사용
    console.log('ℹ️ Skipping workflowStore.taskComponents - using only list-task-component data');

    // 4. step.properties.model에서 직접 추출 (우선순위 4)
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

    // 2. step.properties.model에서 직접 추출 (우선순위 2)
    if (stepProperties.model && Object.keys(stepProperties.model).length > 0) {
      const extractedData = {
        body_params: stepProperties.model,
        path_params: stepProperties.path_params || {},
        query_params: stepProperties.query_params || {}
      };
      console.log('✅ Using step.properties.model as taskComponentData:', extractedData);
      return extractedData;
    }

    // 3. workflowStore에서 task component 찾기 (우선순위 3)
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
   * 데이터로부터 스키마 추론
   */
  function inferSchemaFromData(data: any, depth: number = 0): any {
    console.log(`inferSchemaFromData START (depth: ${depth})`);
    
    const schema: any = {};
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        console.log(`Processing field: ${key} (depth: ${depth})`);
        
        if (Array.isArray(value)) {
          // Array 타입 - 범용 처리
          schema[key] = {
            type: 'array',
            items: value.length > 0 ? inferSchemaFromData(value[0], depth + 1) : { type: 'string' }
          };
          console.log(`✅ Array field ${key} inferred (depth: ${depth})`);
        } else if (typeof value === 'object' && value !== null) {
          // Object 타입 - 범용 처리
          schema[key] = {
            type: 'object',
            properties: inferSchemaFromData(value, depth + 1)
          };
          console.log(`✅ Object field ${key} inferred (depth: ${depth})`);
        } else if (typeof value === 'string') {
          // String 타입
          schema[key] = {
            type: 'string',
            example: value
          };
          console.log(`✅ String field ${key} inferred`);
        } else if (typeof value === 'number') {
          // Number 타입
          schema[key] = {
            type: 'number',
            example: value
          };
          console.log(`✅ Number field ${key} inferred`);
        } else if (typeof value === 'boolean') {
          // Boolean 타입
          schema[key] = {
            type: 'boolean',
            example: value
          };
          console.log(`✅ Boolean field ${key} inferred`);
        } else {
          // 기타 타입
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
   * 스키마와 데이터를 모두 사용한 초기화
   */
  function initializeWithSchemaAndData(taskComponentData: any, taskData: any): void {
    console.log('=== initializeWithSchemaAndData START ===');
    console.log('TaskComponentData:', JSON.stringify(taskComponentData, null, 2));
    console.log('TaskData:', JSON.stringify(taskData, null, 2));
    
    try {
      // 1. Body Params 스키마 기반으로 폼 컨텍스트 생성
      const bodyParamsSchema = taskComponentData?.body_params?.properties || {};
      console.log('Body params schema:', JSON.stringify(bodyParamsSchema, null, 2));
      
      // targetSoftwareModel 스키마 확인
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
        
        // targetSoftwareModel이 없는 경우, 하드코딩된 스키마 사용
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
          
          // bodyParamsSchema를 하드코딩된 스키마로 교체
          Object.assign(bodyParamsSchema, hardcodedSchema);
          console.log('✅ Applied hardcoded targetSoftwareModel schema');
        }
      }
      
      if (Object.keys(bodyParamsSchema).length > 0) {
        // Case 1: 스키마가 있는 경우
        console.log('✅ Case 1: Using existing body_params schema');
        
        // taskData에서 body_params 데이터 추출
        let bodyParamsData = taskData?.request_body || taskData?.body_params || {};
        console.log('Body params data for context creation:', JSON.stringify(bodyParamsData, null, 2));
        
        // request_body가 객체인 경우 그대로 사용, 문자열인 경우 파싱
        if (typeof bodyParamsData === 'string') {
          try {
            bodyParamsData = JSON.parse(bodyParamsData);
            console.log('✅ Parsed request_body JSON:', JSON.stringify(bodyParamsData, null, 2));
          } catch (error) {
            console.log('⚠️ Failed to parse request_body JSON:', error);
            bodyParamsData = {};
          }
        }
        
        // targetSoftwareModel이 있는지 확인
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
        
        // 데이터 매핑 수행
        console.log('=== Calling mapDataToFormContextOptimized ===');
        console.log('formContext.value length:', formContext.value.length);
        console.log('bodyParamsData:', bodyParamsData);
        console.log('bodyParamsSchema:', bodyParamsSchema);
        mapDataToFormContextOptimized(formContext.value, bodyParamsData, bodyParamsSchema, undefined, 0);
        console.log('✅ Data mapping completed');
        console.log('Form context length after mapping:', formContext.value.length);
      } else {
        // Case 2: 스키마가 없는 경우 - request_body를 파싱하여 스키마 추론
        console.log('⚠️ Case 2: No body_params schema found, inferring from request_body');
        
        let bodyParamsData = {};
        try {
          // request_body가 JSON 문자열인 경우 파싱
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

      // 2. Path Params 처리
      const pathParamsSchema = taskComponentData?.path_params;
      if (pathParamsSchema && Object.keys(pathParamsSchema).length > 0) {
        const pathParamsContexts = parsePathParams(pathParamsSchema);
        if (pathParamsContexts.length > 0) {
          // paramsContext에 path_params 저장
          if (!paramsContext.value) {
            paramsContext.value = {};
          }
          paramsContext.value.pathParams = {
            values: pathParamsContexts
          };
          console.log('✅ Path params context created');
        }
      }

      // 3. Query Params 처리
      const queryParamsSchema = taskComponentData?.query_params;
      if (queryParamsSchema && Object.keys(queryParamsSchema).length > 0) {
        const queryParamsContexts = parseQueryParams(queryParamsSchema);
        if (queryParamsContexts.length > 0) {
          // paramsContext에 query_params 저장
          if (!paramsContext.value) {
            paramsContext.value = {};
          }
          paramsContext.value.queryParams = {
            values: queryParamsContexts
          };
          console.log('✅ Query params context created');
        }
      }

      // 4. 데이터 매핑
      const parsedTaskData = typeof taskData === 'string' ? JSON.parse(taskData) : taskData;
      populateFormWithTaskComponentData(parsedTaskData, taskComponentData);
      
      console.log('✅ Schema and data initialization completed');
      } catch (error) {
      console.error('Error in initializeWithSchemaAndData:', error);
    }
  }

  /**
   * 데이터만 사용한 초기화
   */
  function initializeWithDataOnly(taskData: any): void {
    console.log('=== initializeWithDataOnly START ===');
    
    try {
      const parsedTaskData = typeof taskData === 'string' ? JSON.parse(taskData) : taskData;
      
      // 데이터에서 스키마 생성
      const generatedSchema = generateSchemaFromData(parsedTaskData);
      console.log('Generated schema from data:', generatedSchema);
      
      // 생성된 스키마로 폼 컨텍스트 생성
      formContext.value = parseJsonSchema(generatedSchema);
      
      // 기존 데이터로 폼 채우기
      populateFormWithExistingData(parsedTaskData, '');
      
      console.log('✅ Data-only initialization completed');
    } catch (error) {
      console.error('Error in initializeWithDataOnly:', error);
    }
  }

  /**
   * 스키마만 사용한 초기화
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
   * 기존 컨텍스트에 데이터 매핑
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
      // TODO: contextCreators에서 import 필요
    },
    createArrayContext: () => {
      // TODO: contextCreators에서 import 필요
    },
    createInputContext: () => {
      // TODO: contextCreators에서 import 필요
    },
    createSelectContext: () => {
      // TODO: contextCreators에서 import 필요
    },
    createJsonInputContext: () => {
      // TODO: contextCreators에서 import 필요
    },
    createUnknownTypeContext: () => {
      // TODO: contextCreators에서 import 필요
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
