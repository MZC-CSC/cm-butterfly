<template>
  <!-- Form Tree structure -->
  <div class="form-tree-container">
    <div
      v-for="node in flattenedNodes"
      :key="node.id"
      class="form-tree-node"
      :class="{ 'hierarchical': node.type === 'object' || node.type === 'array' }"
      :style="getNodeStyle(node)"
      v-show="isNodeVisible(node)"
    >
      <!-- Subject Row -->
      <DataRow
        v-if="getFieldLabel(node) === 'subject'"
        row-type="subject"
        :label="getFieldLabel(node)"
        :value="formatValue(node.value)"
        @update="updateFieldValue(node, $event)"
      />

      <!-- String Array Field (needed_packages pattern) -->
      <StringArrayField
        v-else-if="node.type === 'array' && isNestedObjectStringArrayType(node)"
        :subject="getStringArraySubject(node)"
        :items="getNestedObjectStringArrayItems(node)"
        @update-items="handleStringArrayUpdate(node, $event)"
        @add-item="handleStringArrayAddItem(node, $event)"
        @delete-item="handleStringArrayDeleteItem(node, $event)"
      />

      <!-- Values Row (Array) -->
      <DataRow
        v-else-if="node.type === 'array'"
        row-type="values"
        :label="node.label"
        :item-count="getItemCountNumber(node)"
        :expanded="node.expanded"
        :show-add-button="true"
        @toggle="toggleNode(node)"
        @add-item="addArrayItem(node)"
      />

      <!-- Input Field (Object with type=input and context with 2 properties) -->
      <InputField
        v-else-if="node.type === 'object' && isInputType(node)"
        :title="getInputFieldData(node).title"
        :model-value="getInputFieldData(node).modelValue"
        :is-valid="getInputFieldData(node).isValid"
        @update:model-value="updateInputField(node, $event)"
        @blur="handleInputBlur(node, $event)"
      />

      <!-- Properties Row (Object) -->
      <DataRow
        v-else-if="node.type === 'object'"
        row-type="values"
        :label="node.label"
        :item-count="getItemCountNumber(node)"
        :expanded="node.expanded"
        :show-add-button="false"
        @toggle="toggleNode(node)"
      />

      <!-- Primitive field -->
      <DataRow
        v-else-if="node.type === 'primitive'"
        row-type="properties"
        :label="getFieldLabel(node)"
        :value="formatValue(node.value)"
        :deletable="isDeletable(node)"
        @update="updateFieldValue(node, $event)"
        @delete="deleteField(node)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, watch } from 'vue';
import { TreeNode, jsonToTree, filterTreeNodes, toggleTreeNode, flattenTreeNodes } from '@/shared/utils/jsonToTable';
import DataRow from './components/DataRow.vue';
import InputField from './components/InputField.vue';
import StringArrayField from './components/StringArrayField.vue';

export default defineComponent({
  name: 'JsonDataFormTree',
  components: {
    DataRow,
    InputField,
    StringArrayField
  },
  props: {
    jsonData: {
      type: [Object, Array, String] as PropType<any>,
      required: true
    },
    showValues: {
      type: Boolean,
      default: true
    },
    maxDepth: {
      type: Number,
      default: 20
    },
    currentDepth: {
      type: Number,
      default: 0
    },
  },
  emits: ['node-click', 'field-update', 'array-item-add', 'field-delete', 'string-array-patterns-found'],
  setup(props, { emit }) {
    const treeNodes = ref<TreeNode[]>([]);

    // Convert JSON data into a Tree
    const initializeTree = () => {
      if (Array.isArray(props.jsonData) && props.jsonData.length > 0 && 'id' in props.jsonData[0]) {
        // Already a TreeNode array
        treeNodes.value = props.jsonData as TreeNode[];
      } else {
        // Convert JSON data into a Tree
        const data = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData;
        treeNodes.value = jsonToTree(data, {
          maxDepth: props.maxDepth + 1,
          showArrayIndices: true,
          showPrimitiveValues: props.showValues,
          rootLabel: 'Root'
        });
      }
    };

    // Flatten all nodes
    const flattenedNodes = computed(() => {
      return flattenTreeNodes(treeNodes.value);
    });

    // Check whether the node should be shown (whether its parents are expanded)
    const isNodeVisible = (node: TreeNode): boolean => {
      // The root node is always shown
      if (node.level === 0) return true;
      
      // Find the parent nodes and check they are all expanded
      const pathParts = node.path.split('.');
      let currentPath = '';
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
        const parentNode = findNodeByPath(treeNodes.value, currentPath);
        if (!parentNode || !parentNode.expanded) {
          return false;
        }
      }
      
      return true;
    };

    // Find a node by path
    const findNodeByPath = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNodeByPath(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    // Toggle a node
    const toggleNode = (node: TreeNode) => {
      treeNodes.value = toggleTreeNode(treeNodes.value, node.id);
    };

    // Handle a node click
    const handleNodeClick = (node: TreeNode) => {
      emit('node-click', node);
    };

    // Get the field label
    const getFieldLabel = (node: TreeNode): string => {
      const pathParts = node.path.split('.');
      return pathParts[pathParts.length - 1];
    };

    // Get the item count
    const getItemCount = (node: TreeNode): string => {
      if (node.type === 'array') {
        return `${node.children?.length || 0} items`;
      } else if (node.type === 'object') {
        return `${node.children?.length || 0} properties`;
      }
      return '';
    };

    // Get the item count as a number
    const getItemCountNumber = (node: TreeNode): number => {
      return node.children?.length || 0;
    };

    // Format the value
    const formatValue = (value: any): string => {
      if (value === null) return '';
      if (value === undefined) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value.toString();
      if (typeof value === 'number') return value.toString();
      return JSON.stringify(value);
    };

    // Update the field value
    const updateFieldValue = (node: TreeNode, event: Event) => {
      emit('field-update', { node, event });
    };

    // Update the Input field's model.value
    const updateInputField = (node: TreeNode, value: any) => {
      if (node.type === 'object' && node.children) {
        const contextNode = node.children.find(child => getFieldLabel(child) === 'context');
        if (contextNode && contextNode.children) {
          const modelNode = contextNode.children.find(child => getFieldLabel(child) === 'model');
          if (modelNode && modelNode.children) {
            const valueNode = modelNode.children.find(child => getFieldLabel(child) === 'value');
            if (valueNode) {
              emit('field-update', { node: valueNode, value });
            }
          }
        }
      }
    };

    // Handle Input field blur
    const handleInputBlur = (node: TreeNode, event: Event) => {
      if (node.type === 'object' && node.children) {
        const contextNode = node.children.find(child => getFieldLabel(child) === 'context');
        if (contextNode && contextNode.children) {
          const modelNode = contextNode.children.find(child => getFieldLabel(child) === 'model');
          if (modelNode && modelNode.children) {
            const valueNode = modelNode.children.find(child => getFieldLabel(child) === 'value');
            if (valueNode) {
              emit('field-update', { node: valueNode, event });
            }
          }
        }
      }
    };

    // Update a nestedObject string array item
    const updateNestedObjectStringArrayItem = (node: TreeNode, index: number, value: string) => {
      if (node.type === 'array' && node.children && node.children[index]) {
        const itemNode = node.children[index];
        
        // For a nestedObject, split and update the values
        if (itemNode.type === 'object' && itemNode.children) {
          const typeNode = itemNode.children.find(c => getFieldLabel(c) === 'type');
          if (typeNode && formatValue(typeNode.value) === 'nestedObject') {
            const contextNode = itemNode.children.find(c => getFieldLabel(c) === 'context');
            if (contextNode && contextNode.children) {
              const valuesNode = contextNode.children.find(c => getFieldLabel(c) === 'values');
              if (valuesNode && valuesNode.children) {
                // Split the string into individual characters and update the values
                const characters = value.split('');
                valuesNode.children.forEach((charNode, charIndex) => {
                  if (charIndex < characters.length) {
                    // For an input-type object, update model.value
                    if (charNode.type === 'object' && charNode.children) {
                      const inputTypeNode = charNode.children.find(c => getFieldLabel(c) === 'type');
                      if (inputTypeNode && formatValue(inputTypeNode.value) === 'input') {
                        const inputContextNode = charNode.children.find(c => getFieldLabel(c) === 'context');
                        if (inputContextNode && inputContextNode.children) {
                          const modelNode = inputContextNode.children.find(c => getFieldLabel(c) === 'model');
                          if (modelNode && modelNode.children) {
                            const valueNode = modelNode.children.find(c => getFieldLabel(c) === 'value');
                            if (valueNode) {
                              emit('field-update', { node: valueNode, value: characters[charIndex] });
                            }
                          }
                        }
                      }
                    } else {
                      // General case
                      emit('field-update', { node: charNode, value: characters[charIndex] });
                    }
                  }
                });
                return;
              }
            }
          }
        }
        
        // General case
        emit('field-update', { node: itemNode, value });
      }
    };

    // Handle nestedObject string array input
    const handleNestedObjectStringArrayInput = (node: TreeNode, index: number, event: Event) => {
      const target = event.target as HTMLInputElement;
      updateNestedObjectStringArrayItem(node, index, target.value);
    };

    // StringArrayField event handlers
    const handleStringArrayUpdate = (node: TreeNode, items: Array<{ index: number; value: string }>) => {
      // Update each item
      items.forEach(item => {
        updateNestedObjectStringArrayItem(node, item.index, item.value);
      });
    };

    const handleStringArrayAddItem = (node: TreeNode, newItem: { index: number; value: string }) => {
      // Logic to add a new item to the array
      emit('array-item-add', node);
    };

    const handleStringArrayDeleteItem = (node: TreeNode, index: number) => {
      // Logic to delete an item
      if (node.type === 'array' && node.children && node.children[index]) {
        const itemNode = node.children[index];
        emit('field-delete', itemNode);
      }
    };

    // Add an array item
    const addArrayItem = (node: TreeNode) => {
      emit('array-item-add', node);
    };

    // Whether the field can be deleted
    const isDeletable = (node: TreeNode): boolean => {
      // Not root level, and either an array index or an object property
      return node.level > 0 && (node.path.includes('[') || node.path.includes('.'));
    };

    // Function that finds string[] patterns - scans all arrays for string[]-shaped patterns and returns the list of subjects
    const findStringArrayPatterns = (node: TreeNode): string[] => {
      const patterns: string[] = [];
      
      function traverse(currentNode: TreeNode) {
        if (currentNode.type === 'array' && currentNode.children) {
          // Check whether the array's first item is a nestedObject
          const firstItem = currentNode.children[0];
          if (firstItem && firstItem.type === 'object' && firstItem.children) {
            const typeNode = firstItem.children.find(c => getFieldLabel(c) === 'type');
            if (typeNode && formatValue(typeNode.value) === 'nestedObject') {
              const contextNode = firstItem.children.find(c => getFieldLabel(c) === 'context');
              if (contextNode && contextNode.children) {
                const subjectNode = contextNode.children.find(c => getFieldLabel(c) === 'subject');
                const valuesNode = contextNode.children.find(c => getFieldLabel(c) === 'values');
                
                if (subjectNode && valuesNode && valuesNode.type === 'array' && valuesNode.children) {
                  // Check whether the first entry in values is an input type
                  const firstValueItem = valuesNode.children[0];
                  if (firstValueItem && firstValueItem.type === 'object' && firstValueItem.children) {
                    const inputTypeNode = firstValueItem.children.find(c => getFieldLabel(c) === 'type');
                    if (inputTypeNode && formatValue(inputTypeNode.value) === 'input') {
                      // string[] pattern found
                      const subject = formatValue(subjectNode.value);
                      if (subject && !patterns.includes(subject)) {
                        patterns.push(subject);
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // Recursively traverse child nodes as well
        if (currentNode.children) {
          currentNode.children.forEach(child => traverse(child));
        }
      }
      
      traverse(node);
      return patterns;
    };

    // Check whether it is a nestedObject string array type (an array whose item is a nestedObject and whose values are an array of input types)
    const isNestedObjectStringArrayType = (node: TreeNode): boolean => {
      if (node.type === 'array' && node.children) {
        // Check whether the first item is a nestedObject
        const firstItem = node.children[0];
        if (firstItem && firstItem.type === 'object' && firstItem.children) {
          const typeNode = firstItem.children.find(c => getFieldLabel(c) === 'type');
          if (typeNode && formatValue(typeNode.value) === 'nestedObject') {
            const contextNode = firstItem.children.find(c => getFieldLabel(c) === 'context');
            if (contextNode && contextNode.children) {
              const valuesNode = contextNode.children.find(c => getFieldLabel(c) === 'values');
              if (valuesNode && valuesNode.type === 'array' && valuesNode.children) {
                // Check whether the first entry in values is an input type
                const firstValueItem = valuesNode.children[0];
                if (firstValueItem && firstValueItem.type === 'object' && firstValueItem.children) {
                  const inputTypeNode = firstValueItem.children.find(c => getFieldLabel(c) === 'type');
                  if (inputTypeNode && formatValue(inputTypeNode.value) === 'input') {
                    return true;
                  }
                }
              }
            }
          }
        }
      }
      return false;
    };

    // Check whether it is an Input type (context has exactly 2 properties)
    const isInputType = (node: TreeNode): boolean => {
      if (node.type === 'object' && node.children) {
        const typeNode = node.children.find(child => getFieldLabel(child) === 'type');
        if (typeNode && formatValue(typeNode.value) === 'input') {
          // Check whether context has 2 properties (title, model)
          const contextNode = node.children.find(child => getFieldLabel(child) === 'context');
          if (contextNode && contextNode.children && contextNode.children.length === 2) {
            const hasTitle = contextNode.children.some(child => getFieldLabel(child) === 'title');
            const hasModel = contextNode.children.some(child => getFieldLabel(child) === 'model');
            return hasTitle && hasModel;
          }
        }
      }
      return false;
    };

    // Function to get a string array's subject
    const getStringArraySubject = (node: TreeNode): string => {
      if (node.type === 'array' && node.children && node.children.length > 0) {
        const firstItem = node.children[0];
        if (firstItem && firstItem.type === 'object' && firstItem.children) {
          const typeNode = firstItem.children.find(c => getFieldLabel(c) === 'type');
          if (typeNode && formatValue(typeNode.value) === 'nestedObject') {
            const contextNode = firstItem.children.find(c => getFieldLabel(c) === 'context');
            if (contextNode && contextNode.children) {
              const subjectNode = contextNode.children.find(c => getFieldLabel(c) === 'subject');
              if (subjectNode) {
                return formatValue(subjectNode.value);
              }
            }
          }
        }
      }
      return 'Array';
    };

    // Function that processes each entry of a nestedObject string array
    const getNestedObjectStringArrayItems = (node: TreeNode): Array<{ index: number; value: string }> => {
      if (node.type === 'array' && node.children) {
        return node.children.map((child, index) => {
          // For a nestedObject, combine the values and process them
          if (child.type === 'object' && child.children) {
            const typeNode = child.children.find(c => getFieldLabel(c) === 'type');
            if (typeNode && formatValue(typeNode.value) === 'nestedObject') {
              const contextNode = child.children.find(c => getFieldLabel(c) === 'context');
              if (contextNode && contextNode.children) {
                const valuesNode = contextNode.children.find(c => getFieldLabel(c) === 'values');
                if (valuesNode && valuesNode.children) {
                  // Extract model.value from each entry in values and join them
                  const combinedValue = valuesNode.children
                    .map(v => {
                      // For an input-type object, extract model.value
                      if (v.type === 'object' && v.children) {
                        const inputTypeNode = v.children.find(c => getFieldLabel(c) === 'type');
                        if (inputTypeNode && formatValue(inputTypeNode.value) === 'input') {
                          const inputContextNode = v.children.find(c => getFieldLabel(c) === 'context');
                          if (inputContextNode && inputContextNode.children) {
                            const modelNode = inputContextNode.children.find(c => getFieldLabel(c) === 'model');
                            if (modelNode && modelNode.children) {
                              const valueNode = modelNode.children.find(c => getFieldLabel(c) === 'value');
                              if (valueNode) {
                                return formatValue(valueNode.value);
                              }
                            }
                          }
                        }
                      }
                      // General case
                      return formatValue(v.value);
                    })
                    .join('');
                  return { index, value: combinedValue };
                }
              }
            }
          }
          // General case
          return {
            index,
            value: formatValue(child.value)
          };
        });
      }
      return [];
    };

    // Get the Input field's title and model.value
    const getInputFieldData = (node: TreeNode): { title: string; modelValue: string; isValid: boolean } => {
      if (node.type === 'object' && node.children) {
        const contextNode = node.children.find(child => getFieldLabel(child) === 'context');
        if (contextNode && contextNode.children) {
          const titleNode = contextNode.children.find(child => getFieldLabel(child) === 'title');
          const modelNode = contextNode.children.find(child => getFieldLabel(child) === 'model');
          
          let modelValue = '';
          let isValid = true;
          
          if (modelNode && modelNode.children) {
            const valueNode = modelNode.children.find(child => getFieldLabel(child) === 'value');
            const isValidNode = modelNode.children.find(child => getFieldLabel(child) === 'isValid');
            
            if (valueNode) {
              modelValue = formatValue(valueNode.value);
            }
            if (isValidNode) {
              isValid = formatValue(isValidNode.value) === 'true';
            }
          }
          
          return {
            title: titleNode ? formatValue(titleNode.value) : '',
            modelValue,
            isValid
          };
        }
      }
      return { title: '', modelValue: '', isValid: true };
    };

    // Delete the field
    const deleteField = (node: TreeNode) => {
      emit('field-delete', node);
    };

    // Compute the node style
    const getNodeStyle = (node: TreeNode) => {
      // All nodes use the same width (indentation removed)
      return {};
    };

    // Initialize
    initializeTree();

    // Watch for props changes
    watch(() => props.jsonData, initializeTree, { deep: true });

    // Whenever treeNodes changes, find patterns and pass them to the parent
    watch(treeNodes, (newTreeNodes) => {
      if (newTreeNodes && newTreeNodes.length > 0) {
        const patterns = findStringArrayPatterns(newTreeNodes[0]);
        emit('string-array-patterns-found', patterns);
      }
    }, { immediate: true });

    return {
      flattenedNodes,
      isNodeVisible,
      getNodeStyle,
      toggleNode,
      handleNodeClick,
      getFieldLabel,
      getItemCount,
      getItemCountNumber,
      formatValue,
      updateFieldValue,
      updateInputField,
      handleInputBlur,
      updateNestedObjectStringArrayItem,
      handleNestedObjectStringArrayInput,
      addArrayItem,
      isDeletable,
      deleteField,
      findStringArrayPatterns,
      isNestedObjectStringArrayType,
      getStringArraySubject,
      getNestedObjectStringArrayItems,
      handleStringArrayUpdate,
      handleStringArrayAddItem,
      handleStringArrayDeleteItem,
      isInputType,
      getInputFieldData
    };
  }
});

</script>

<style scoped lang="postcss">
.form-tree-container {
  @apply w-full;
  overflow-y: auto;
  max-height: 500px;
}

.form-tree-node {
  @apply w-full;
}

.nested-object-string-array-container {
  @apply w-full;
}

.field-group {
  display: flex;
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
  flex-shrink: 0;
}

.field-content-box {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 310px;
  height: 44px;
  padding: 6px 16px 6px 16px;
  flex-shrink: 0;
}

.field-input {
  @apply w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500;
  border-radius: 4px;
}
</style>