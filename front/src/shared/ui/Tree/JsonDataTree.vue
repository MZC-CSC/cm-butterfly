<template>
  <div class="json-data-tree">
    <!-- Search input -->
    <div v-if="showSearch" class="search-container mb-4">
      <input
        v-model="searchTerm"
        type="text"
        placeholder="Search..."
        class="search-input"
        @input="handleSearch"
      />
    </div>

    <!-- Tree structure -->
    <div class="tree-container">
      <div
        v-for="node in flattenedNodes"
        :key="node.id"
        class="tree-node"
        :style="{ paddingLeft: `${node.level * 20 + 8}px` }"
        v-show="isNodeVisible(node)"
      >
        <div class="node-content" @click="toggleNode(node)">
          <!-- Expand/collapse icon -->
          <span
            v-if="node.children && node.children.length > 0"
            class="expand-icon"
            :class="{ expanded: node.expanded }"
          >
            ▶
          </span>
          <span v-else class="expand-icon-placeholder"></span>

          <!-- Node type icon -->
          <span class="node-type-icon" :class="getNodeTypeClass(node.type)">
            {{ getNodeTypeIcon(node.type) }}
          </span>

          <!-- Node label -->
          <span class="node-label" :class="getNodeLabelClass(node)">
            {{ node.label }}
          </span>

          <!-- Node value (for primitive types) -->
          <span v-if="node.type === 'primitive' && showValues" class="node-value">
            {{ formatValue(node.value) }}
          </span>
        </div>

      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, watch } from 'vue';
import { TreeNode, jsonToTree, filterTreeNodes, toggleTreeNode, flattenTreeNodes } from '@/shared/utils/jsonToTable';

export default defineComponent({
  name: 'JsonDataTree',
  props: {
    jsonData: {
      type: [String, Object, Array] as PropType<string | object | TreeNode[]>,
      required: true
    },
    showSearch: {
      type: Boolean,
      default: true
    },
    showValues: {
      type: Boolean,
      default: true
    },
    maxDepth: {
      type: Number,
      default: 10
    },
    currentDepth: {
      type: Number,
      default: 0
    },
    searchTerm: {
      type: String,
      default: ''
    }
  },
  emits: ['node-click'],
  setup(props, { emit }) {
    const searchTerm = ref(props.searchTerm);
    const treeNodes = ref<TreeNode[]>([]);

    // Convert JSON data into a tree
    const initializeTree = () => {
      if (Array.isArray(props.jsonData) && props.jsonData.length > 0 && 'id' in props.jsonData[0]) {
        // Already a TreeNode array
        treeNodes.value = props.jsonData as TreeNode[];
      } else {
        // Convert JSON data into a tree
        const data = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData;
        treeNodes.value = jsonToTree(data, {
          maxDepth: props.maxDepth + 1, // +1 to align with JsonDataTree's currentDepth
          showArrayIndices: true,
          showPrimitiveValues: props.showValues,
          rootLabel: 'Root'
        });
      }
    };

    // Flatten all nodes
    const flattenedNodes = computed(() => {
      if (searchTerm.value.trim()) {
        const filteredNodes = filterTreeNodes(treeNodes.value, searchTerm.value);
        return flattenTreeNodes(filteredNodes);
      }
      return flattenTreeNodes(treeNodes.value);
    });

    // Determine whether a node should be shown (i.e. whether its parents are expanded)
    const isNodeVisible = (node: TreeNode): boolean => {
      // The root node is always shown
      if (node.level === 0) return true;

      // Walk up the parent nodes and check that all of them are expanded
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

    // Find a node by its path
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

    // Handle search
    const handleSearch = () => {
      // Search is handled automatically in the computed
    };

    // Handle node click
    const handleNodeClick = (node: TreeNode) => {
      emit('node-click', node);
    };

    // CSS class per node type
    const getNodeTypeClass = (type: string) => {
      return `node-type-${type}`;
    };

    // Icon per node type
    const getNodeTypeIcon = (type: string) => {
      switch (type) {
        case 'object': return '📁';
        case 'array': return '📋';
        case 'primitive': return '📄';
        default: return '❓';
      }
    };

    // Node label CSS class
    const getNodeLabelClass = (node: TreeNode) => {
      return {
        'node-label-object': node.type === 'object',
        'node-label-array': node.type === 'array',
        'node-label-primitive': node.type === 'primitive'
      };
    };

    // Format a value
    const formatValue = (value: any) => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') return `"${value}"`;
      if (typeof value === 'boolean') return value.toString();
      if (typeof value === 'number') return value.toString();
      return JSON.stringify(value);
    };

    // Check whether the search term should be highlighted
    const isHighlighted = (label: string): boolean => {
      if (!searchTerm.value.trim()) return false;
      return label.toLowerCase().includes(searchTerm.value.toLowerCase());
    };

    // Initialize
    initializeTree();

    // Watch for prop changes
    watch(() => props.jsonData, initializeTree, { deep: true });

    return {
      searchTerm,
      flattenedNodes,
      isNodeVisible,
      isHighlighted,
      toggleNode,
      handleSearch,
      handleNodeClick,
      getNodeTypeClass,
      getNodeTypeIcon,
      getNodeLabelClass,
      formatValue
    };
  }
});
</script>

<style scoped>
.json-data-tree {
  @apply text-sm;
  font-family: 'Inconsolata', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
}

.search-container {
  @apply mb-4;
}

.search-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.tree-container {
  @apply space-y-1 overflow-x-auto overflow-y-auto;
  min-width: 100%;
  max-height: 500px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

/* Scrollbar style for Webkit browsers */
.tree-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tree-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.tree-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.tree-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.tree-node {
  @apply relative;
}

.node-content {
  @apply flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer transition-colors;
  border-radius: 4px;
  min-width: max-content;
  white-space: nowrap;
}

.expand-icon {
  @apply w-4 h-4 flex items-center justify-center text-gray-500 transition-transform duration-200;
}

.expand-icon.expanded {
  @apply transform rotate-90;
}

.expand-icon-placeholder {
  @apply w-4 h-4;
}

.node-type-icon {
  @apply mr-2 text-sm;
}

.node-type-object {
  @apply text-blue-600;
}

.node-type-array {
  @apply text-green-600;
}

.node-type-primitive {
  @apply text-gray-600;
}

.node-label {
  @apply flex-1 font-medium;
}

.node-label-object {
  @apply text-blue-800;
}

.node-label-array {
  @apply text-green-800;
}

.node-label-primitive {
  @apply text-gray-800;
}

.node-value {
  @apply ml-2 text-gray-600 italic;
}

.children-container {
  @apply ml-4;
}

/* Hover effect */
.node-content:hover {
  background-color: #eff6ff;
}

/* Selected node */
.node-content.selected {
  @apply border-l-4 border-blue-500;
  background-color: #dbeafe;
}

/* Search highlight */
.node-label.highlighted {
  background-color: #fef08a;
}
</style>
