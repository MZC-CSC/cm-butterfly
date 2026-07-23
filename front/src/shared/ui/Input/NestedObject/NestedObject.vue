<script setup lang="ts">
import { PTextInput } from '@cloudforet-test/mirinae';

// Field type definition matching the FormContext structure
interface Field {
  type: 'input' | 'array' | 'nestedObject' | 'nestedObjectArray' | 'nestedObjectArrayItem' | 'stringArray' | 'integerArray' | 'booleanArray' | 'basicArray' | 'basicObjectArray' | 'mixedArray' | 'emptyArray' | 'unknownArray' | 'unknownType';
  context: {
    title?: string;
    subject?: string;
    model?: {
      value: any;
      isValid?: boolean;
      onBlur?: () => void;
    };
    values?: Field[];
  };
}

interface IProps {
  subject: string;
  fields: Field[];
  rawData?: any;
}

const props = defineProps<IProps>();

// Handle empty-object input
const handleEmptyObjectInput = (value: string) => {
  console.log('Empty object input:', value);
  // TODO: pass the value up to the parent component
};

// Get the raw data value
const getRawDataValue = () => {
  // When fields is empty and rawData is present
  if (props.fields.length === 0 && props.rawData) {
    if (typeof props.rawData === 'object') {
      return JSON.stringify(props.rawData, null, 2);
    }
    return String(props.rawData);
  }
  return '';
};
</script>

<template>
  <div class="nested-object-box">
    <div class="subject-title border-bottom">
      {{ subject }}
    </div>
    <!-- For an empty object, show a 'property not defined' message and an input field -->
    <div v-if="fields.length === 0" class="field-group-vertical border-bottom">
      <!-- 'Property not defined' message -->
      <div class="no-properties-message">
        <div class="message-icon">⚠️</div>
        <div class="message-text">Property not defined</div>
      </div>
      
      <!-- Default input field -->
      <div class="field-group flex">
        <div class="field-row">
          <div class="field-title-box">
            Value
          </div>
          <div class="field-content-box">
            <p-text-input 
              :value="getRawDataValue()"
              placeholder="Enter object value (JSON format)"
              @input="handleEmptyObjectInput"
            />
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-for="(field, fieldIndex) of fields.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
      :key="fieldIndex"
      class="field-group-vertical border-bottom"
    >
      <!-- For an InputContext -->
      <div v-if="field.type === 'input'" class="field-group flex">
        <div class="field-row">
          <div class="field-title-box">
            {{ field.context.title }}
          </div>
          <div class="field-content-box">
            <p-text-input 
              v-if="field.context.model && field.context.model.value !== undefined" 
              v-model="field.context.model.value"
            />
            <p-text-input v-else />
          </div>
        </div>
      </div>
      
      <!-- For an ArrayContext -->
      <div v-else-if="field.type === 'array'" class="field-group-vertical">
        <div class="field-title-box">
          {{ field.context.subject }}
        </div>
        <div class="field-content-box">
          <div 
            v-for="(arrayItem, arrayIndex) of field.context.values" 
            :key="arrayIndex"
            class="array-item"
          >
            <div class="subject-title border-bottom">
              {{ arrayItem.context.subject }}
            </div>
            <div 
              v-for="(subField, subFieldIndex) of arrayItem.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
              :key="subFieldIndex"
              class="field-group-vertical border-bottom"
            >
              <!-- For an InputContext -->
              <div v-if="subField.type === 'input'" class="field-group flex">
                <div class="field-row">
                  <div class="field-title-box">
                    {{ subField.context.title }}
                  </div>
                  <div class="field-content-box">
                    <p-text-input 
                      v-if="subField.context.model && subField.context.model.value !== undefined" 
                      v-model="subField.context.model.value"
                    />
                    <p-text-input v-else />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- For a NestedObjectContext -->
      <div v-else-if="field.type === 'nestedObject'" class="field-group-vertical">
        <div class="field-title-box">
          {{ field.context.subject || field.context.title }}
        </div>
        <div class="field-content-box">
          <div 
            v-for="(nestedField, nestedIndex) of field.context.values" 
            :key="nestedIndex"
            class="nested-object-box"
          >
            <div class="subject-title border-bottom">
              {{ nestedField.context.subject || nestedField.context.title }}
            </div>
            <div 
              v-for="(subNestedField, subNestedIndex) of nestedField.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
              :key="subNestedIndex"
              class="field-group-vertical border-bottom"
            >
              <!-- For an InputContext -->
              <div v-if="subNestedField.type === 'input'" class="field-group flex">
                <div class="field-row">
                  <div class="field-title-box">
                    {{ subNestedField.context.title || subNestedField.context.subject }}
                  </div>
                  <div class="field-content-box">
                    <p-text-input 
                      v-if="subNestedField.context.model && subNestedField.context.model.value !== undefined" 
                      v-model="subNestedField.context.model.value"
                    />
                    <p-text-input v-else />
                  </div>
                </div>
              </div>
              
              <!-- For a NestedObjectContext (recursive) -->
              <div v-else-if="subNestedField.type === 'nestedObject'" class="field-group-vertical">
                <div class="field-title-box">
                  {{ subNestedField.context.subject || subNestedField.context.title }}
                </div>
                <div class="field-content-box">
                  <div 
                    v-for="(deepNestedField, deepNestedIndex) of subNestedField.context.values" 
                    :key="deepNestedIndex"
                    class="nested-object-box"
                  >
                    <div class="subject-title border-bottom">
                      {{ deepNestedField.context.subject || deepNestedField.context.title }}
                    </div>
                    <div 
                      v-for="(deepSubField, deepSubIndex) of deepNestedField.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
                      :key="deepSubIndex"
                      class="field-group-vertical border-bottom"
                    >
                      <!-- For an InputContext -->
                      <div v-if="deepSubField.type === 'input'" class="field-group flex">
                        <div class="field-row">
                          <div class="field-title-box">
                            {{ deepSubField.context.title || deepSubField.context.subject }}
                          </div>
                          <div class="field-content-box">
                            <p-text-input 
                              v-if="deepSubField.context.model && deepSubField.context.model.value !== undefined" 
                              v-model="deepSubField.context.model.value"
                            />
                            <p-text-input v-else />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- For a NestedObjectArrayContext -->
      <div v-else-if="field.type === 'nestedObjectArray'" class="field-group-vertical">
        <div class="field-title-box">
          {{ field.context.subject || field.context.title }}
        </div>
        <div class="field-content-box">
          <!-- For an empty array, show the template -->
          <div v-if="!field.context.values || field.context.values.length === 0" class="empty-array-message">
            <div class="message-icon">📝</div>
            <div class="message-text">Array is empty - properties will be shown when items are added</div>
          </div>
          
          <!-- Show the array items - simplified approach -->
          <div 
            v-for="(arrayItem, arrayIndex) of field.context.values" 
            :key="arrayIndex"
            class="array-item"
          >
            <!-- For the nestedObjectArrayItem type, show simplified properties -->
            <div v-if="arrayItem.type === 'nestedObjectArrayItem'">
              <div class="subject-title border-bottom">
                {{ arrayItem.context.subject }}
              </div>
              <div class="item-properties-summary">
                <div 
                  v-for="(itemField, itemFieldIndex) of arrayItem.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
                  :key="itemFieldIndex"
                  class="property-item"
                >
                  <!-- For a simple type (string, number, boolean) -->
                  <div v-if="itemField.type === 'input'" class="simple-property">
                    <span class="property-name">{{ itemField.context.title || itemField.context.subject }}:</span>
                    <span class="property-type">string</span>
                    <span class="property-value">({{ itemField.context.model?.value || 'empty' }})</span>
                  </div>
                  
                  <!-- For a complex type (object, array) - show only type and subject -->
                  <div v-else-if="itemField.type === 'nestedObject'" class="complex-property">
                    <span class="property-name">{{ itemField.context.subject || itemField.context.title }}:</span>
                    <span class="property-type">object</span>
                    <span class="property-subject">({{ itemField.context.subject || itemField.context.title }})</span>
                  </div>
                  
                  <!-- For an Array type -->
                  <div v-else-if="itemField.type === 'nestedObjectArray'" class="complex-property">
                    <span class="property-name">{{ itemField.context.subject || itemField.context.title }}:</span>
                    <span class="property-type">array</span>
                    <span class="property-subject">({{ itemField.context.subject || itemField.context.title }})</span>
                  </div>
                  
                  <!-- For any other type -->
                  <div v-else class="simple-property">
                    <span class="property-name">{{ itemField.context.title || itemField.context.subject }}:</span>
                    <span class="property-type">{{ itemField.type }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- For the legacy nestedObject type (backward compatibility) -->
            <div v-else>
              <div class="subject-title border-bottom">
                Item {{ arrayIndex + 1 }}
              </div>
              <div 
                v-for="(itemField, itemFieldIndex) of arrayItem.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
                :key="itemFieldIndex"
                class="field-group-vertical border-bottom"
              >
              <!-- For an InputContext -->
              <div v-if="itemField.type === 'input'" class="field-group flex">
                <div class="field-row">
                  <div class="field-title-box">
                    {{ itemField.context.title || itemField.context.subject }}
                  </div>
                  <div class="field-content-box">
                    <p-text-input 
                      v-if="itemField.context.model && itemField.context.model.value !== undefined" 
                      v-model="itemField.context.model.value"
                    />
                    <p-text-input v-else />
                  </div>
                </div>
              </div>
              
              <!-- For a NestedObjectContext -->
              <div v-else-if="itemField.type === 'nestedObject'" class="field-group-vertical">
                <div class="field-title-box">
                  {{ itemField.context.subject || itemField.context.title }}
                </div>
                <div class="field-content-box">
                  <div 
                    v-for="(nestedItemField, nestedItemIndex) of itemField.context.values" 
                    :key="nestedItemIndex"
                    class="nested-object-box"
                  >
                    <div class="subject-title border-bottom">
                      {{ nestedItemField.context.subject || nestedItemField.context.title }}
                    </div>
                    <div 
                      v-for="(subItemField, subItemIndex) of nestedItemField.context.values?.filter(f => f.context.title !== 'errors' && f.context.subject !== 'errors')" 
                      :key="subItemIndex"
                      class="field-group-vertical border-bottom"
                    >
                      <!-- For an InputContext -->
                      <div v-if="subItemField.type === 'input'" class="field-group flex">
                        <div class="field-row">
                          <div class="field-title-box">
                            {{ subItemField.context.title || subItemField.context.subject }}
                          </div>
                          <div class="field-content-box">
                            <p-text-input 
                              v-if="subItemField.context.model && subItemField.context.model.value !== undefined" 
                              v-model="subItemField.context.model.value"
                            />
                            <p-text-input v-else />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.nested-object-box {
  display: flex;
  flex-direction: column;
  
  .field-group {
    margin-left: 20px;
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

.array-item {
  margin-bottom: 15px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  background-color: #f9fafb;
  width: 100%;
}

.subject-title {
  @apply pr-[16px] pl-[16px] mt-[16px] h-[44px] text-gray-500;
}

.border-bottom {
  border-bottom: 1px solid;
  @apply border-gray-200;
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
  
  /* field-group inside field-group-vertical is laid out horizontally */
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

/* Force horizontal layout for field-group with the flex class */
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

/* Style for the 'property not defined' message */
.no-properties-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 8px 0;
  background-color: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  
  .message-icon {
    font-size: 16px;
    margin-right: 8px;
  }
  
  .message-text {
    font-size: 13px;
    color: #92400e;
    font-weight: 500;
  }
}

/* Style for the empty-array message */
.empty-array-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 8px 0;
  background-color: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  
  .message-icon {
    font-size: 16px;
    margin-right: 8px;
  }
  
  .message-text {
    font-size: 13px;
    color: #0c4a6e;
    font-weight: 500;
  }
}

/* Style for the simplified properties display */
.item-properties-summary {
  padding: 8px 0;
  
  .property-item {
    margin-bottom: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background-color: #f8fafc;
    
    &:hover {
      background-color: #f1f5f9;
    }
  }
  
  .simple-property {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .property-name {
      font-weight: 600;
      color: #374151;
      min-width: 120px;
    }
    
    .property-type {
      color: #059669;
      font-weight: 500;
      font-size: 12px;
      background-color: #d1fae5;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .property-value {
      color: #6b7280;
      font-size: 12px;
      font-style: italic;
    }
  }
  
  .complex-property {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .property-name {
      font-weight: 600;
      color: #374151;
      min-width: 120px;
    }
    
    .property-type {
      color: #7c3aed;
      font-weight: 500;
      font-size: 12px;
      background-color: #ede9fe;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .property-subject {
      color: #6b7280;
      font-size: 12px;
      font-style: italic;
    }
  }
}
</style>
