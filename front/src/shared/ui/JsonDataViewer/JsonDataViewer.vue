<template>
  <div class="json-data-viewer">
    <!-- Tab header -->
    <div class="tab-header">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      <!-- Table view -->
      <div v-if="activeTab === 'table'" class="tab-panel">
        <JsonDataTable
          :json-data="jsonData"
          :use-migration-format="useMigrationFormat"
          :table-titles="tableTitles"
        />
      </div>

      <!-- Tree view -->
      <div v-if="activeTab === 'tree'" class="tab-panel">
        <JsonDataTree
          :json-data="jsonData"
          :show-search="true"
          :show-values="true"
          :max-depth="maxDepth"
          @node-click="handleNodeClick"
        />
      </div>

      <!-- Raw JSON view -->
      <div v-if="activeTab === 'raw'" class="tab-panel">
        <div class="raw-json-container">
          <div class="raw-json-header">
            <button
              class="copy-button"
              @click="copyToClipboard"
              :disabled="!rawJsonString"
            >
              📋 Copy
            </button>
            <button
              class="format-button"
              @click="toggleFormat"
            >
              {{ isFormatted ? 'Minify' : 'Format' }}
            </button>
          </div>
          <pre class="raw-json-content">{{ rawJsonString }}</pre>
        </div>
      </div>
    </div>

    <!-- Node click info modal -->
    <div v-if="selectedNode" class="node-info-modal" @click="closeNodeInfo">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Node Info</h3>
          <button class="close-button" @click="closeNodeInfo">×</button>
        </div>
        <div class="modal-body">
          <div class="info-item">
            <label>Path:</label>
            <span>{{ selectedNode.path }}</span>
          </div>
          <div class="info-item">
            <label>Type:</label>
            <span>{{ selectedNode.type }}</span>
          </div>
          <div class="info-item">
            <label>Label:</label>
            <span>{{ selectedNode.label }}</span>
          </div>
          <div v-if="selectedNode.value !== undefined" class="info-item">
            <label>Value:</label>
            <pre class="value-content">{{ formatNodeValue(selectedNode.value) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed } from 'vue';
import JsonDataTable from '@/shared/ui/Table/JsonDataTable.vue';
import JsonDataTree from '@/shared/ui/Tree/JsonDataTree.vue';
import { TreeNode } from '@/shared/utils/jsonToTable';

export default defineComponent({
  name: 'JsonDataViewer',
  components: {
    JsonDataTable,
    JsonDataTree
  },
  props: {
    jsonData: {
      type: [String, Object] as PropType<string | object>,
      required: true
    },
    useMigrationFormat: {
      type: Boolean,
      default: false
    },
    tableTitles: {
      type: Array as PropType<string[]>,
      default: () => []
    },
    maxDepth: {
      type: Number,
      default: 10
    },
    availableViews: {
      type: Array as PropType<string[]>,
      default: () => ['table', 'tree', 'raw']
    }
  },
  setup(props) {
    const activeTab = ref('table');
    const selectedNode = ref<TreeNode | null>(null);
    const isFormatted = ref(true);

    // Available tabs
    const tabs = computed(() => {
      const allTabs = [
        { key: 'table', label: 'Table', icon: '📊' },
        { key: 'tree', label: 'Tree', icon: '🌳' },
        { key: 'raw', label: 'JSON', icon: '📄' }
      ];
      
      return allTabs.filter(tab => props.availableViews.includes(tab.key));
    });

    // Raw JSON string
    const rawJsonString = computed(() => {
      try {
        const data = typeof props.jsonData === 'string' ? JSON.parse(props.jsonData) : props.jsonData;
        return isFormatted.value 
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(data);
      } catch (error) {
        return 'JSON parse error: ' + (error as Error).message;
      }
    });

    // Handle node click
    const handleNodeClick = (node: TreeNode) => {
      selectedNode.value = node;
    };

    // Close the node info modal
    const closeNodeInfo = () => {
      selectedNode.value = null;
    };

    // Toggle JSON formatting
    const toggleFormat = () => {
      isFormatted.value = !isFormatted.value;
    };

    // Copy to clipboard
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(rawJsonString.value);
        // Success notification (use a toast notification in the real project)
        console.log('Copied to clipboard.');
      } catch (error) {
        console.error('Copy failed:', error);
      }
    };

    // Format the node value
    const formatNodeValue = (value: any) => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    };

    return {
      activeTab,
      selectedNode,
      isFormatted,
      tabs,
      rawJsonString,
      handleNodeClick,
      closeNodeInfo,
      toggleFormat,
      copyToClipboard,
      formatNodeValue
    };
  }
});
</script>

<style scoped>
.json-data-viewer {
  @apply w-full h-full bg-white rounded-lg shadow-sm border border-gray-200;
}

.tab-header {
  @apply flex border-b border-gray-200;
  background-color: #f9fafb;
}

.tab-button {
  @apply flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors;
}

.tab-button.active {
  @apply text-blue-600 bg-white border-b-2 border-blue-600;
}

.tab-icon {
  @apply mr-2 text-base;
}

.tab-label {
  @apply font-medium;
}

.tab-content {
  @apply h-full;
}

.tab-panel {
  @apply h-full overflow-auto;
}

.raw-json-container {
  @apply h-full flex flex-col;
}

.raw-json-header {
  @apply flex justify-end gap-2 p-4 border-b border-gray-200;
  background-color: #f9fafb;
}

.copy-button,
.format-button {
  @apply px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors;
  border-radius: 4px;
}

.copy-button:disabled {
  @apply bg-gray-400 cursor-not-allowed;
}

.raw-json-content {
  @apply flex-1 p-4 text-sm overflow-auto;
  background-color: #f9fafb;
  font-family: 'Inconsolata', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.node-info-modal {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-hidden;
}

.modal-header {
  @apply flex justify-between items-center p-4 border-b border-gray-200;
}

.modal-header h3 {
  @apply text-lg font-semibold text-gray-800;
}

.close-button {
  @apply text-2xl text-gray-400 hover:text-gray-600 cursor-pointer;
}

.modal-body {
  @apply p-4 overflow-auto;
}

.info-item {
  @apply mb-3;
}

.info-item label {
  @apply block text-sm font-medium text-gray-600 mb-1;
}

.info-item span {
  @apply text-sm text-gray-800;
}

.value-content {
  @apply p-2 text-xs overflow-auto max-h-32;
  background-color: #f3f4f6;
  font-family: 'Inconsolata', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
