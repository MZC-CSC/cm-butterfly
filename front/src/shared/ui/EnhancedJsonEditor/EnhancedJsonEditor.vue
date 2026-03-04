<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  JSONEditor,
  Mode,
  type Content,
  type OnChangeStatus,
  type JSONEditorPropsOptional,
} from 'vanilla-jsoneditor';
import JsonPropertyGrid from './JsonPropertyGrid.vue';

interface Props {
  /** JSON data - string or object */
  modelValue?: string | object;
  /** Editor mode: 'tree' | 'text' | 'table' */
  mode?: 'tree' | 'text' | 'table';
  /** Read-only mode */
  readOnly?: boolean;
  /** Main menu bar visible */
  mainMenuBar?: boolean;
  /** Navigation bar visible */
  navigationBar?: boolean;
  /** Status bar visible */
  statusBar?: boolean;
  /** Editor height */
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  mode: 'tree',
  readOnly: false,
  mainMenuBar: true,
  navigationBar: true,
  statusBar: true,
  height: '100%',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:mode', value: string): void;
  (e: 'change', value: { content: Content; previousContent: Content; changeStatus: OnChangeStatus }): void;
  (e: 'error', value: Error): void;
}>();

const editorRef = ref<HTMLElement | null>(null);
let editorInstance: JSONEditor | null = null;
const currentMode = ref<Mode>(props.mode as Mode);
const showPropertyGrid = ref(props.mode === 'table');
const hasError = ref(false);
const errorMessage = ref('');

// Convert incoming modelValue to Content
function toContent(value: string | object | undefined): Content {
  if (value === undefined || value === null || value === '') {
    return { json: {} };
  }
  if (typeof value === 'string') {
    try {
      return { json: JSON.parse(value) };
    } catch {
      return { text: value };
    }
  }
  return { json: value };
}

// Convert Content back to string for emit
function contentToString(content: Content): string {
  if ('json' in content && content.json !== undefined) {
    return JSON.stringify(content.json, null, 2);
  }
  if ('text' in content && content.text !== undefined) {
    return content.text;
  }
  return '';
}

function initEditor() {
  if (!editorRef.value) return;

  const editorProps: JSONEditorPropsOptional = {
    content: toContent(props.modelValue),
    mode: currentMode.value === Mode.table ? Mode.tree : currentMode.value,
    readOnly: props.readOnly,
    mainMenuBar: props.mainMenuBar,
    navigationBar: props.navigationBar,
    statusBar: props.statusBar,
    onChange: (content: Content, previousContent: Content, changeStatus: OnChangeStatus) => {
      if (props.readOnly) return;
      hasError.value = false;
      errorMessage.value = '';
      const strValue = contentToString(content);
      emit('update:modelValue', strValue);
      emit('change', { content, previousContent, changeStatus });
    },
    onChangeMode: (mode: Mode) => {
      currentMode.value = mode;
      // When user clicks "table" in vanilla-jsoneditor menu, show Property Grid instead
      if (mode === Mode.table) {
        showPropertyGrid.value = true;
        // Switch vanilla-jsoneditor back to tree (so it's ready when user switches back)
        nextTick(() => {
          if (editorInstance) {
            editorInstance.updateProps({ mode: Mode.tree });
          }
        });
      } else {
        showPropertyGrid.value = false;
      }
      emit('update:mode', mode);
    },
    onError: (err: Error) => {
      hasError.value = true;
      errorMessage.value = err.message;
      emit('error', err);
    },
  };

  editorInstance = new JSONEditor({
    target: editorRef.value,
    props: editorProps,
  });
}

onMounted(() => {
  nextTick(() => {
    initEditor();
  });
});

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }
});

// Watch for external modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (!editorInstance) return;
    try {
      const newContent = toContent(newValue);
      editorInstance.update(newContent);
    } catch (err) {
      console.warn('Failed to update editor content:', err);
    }
  },
);

// Watch for readOnly changes
watch(
  () => props.readOnly,
  (newReadOnly) => {
    if (!editorInstance) return;
    editorInstance.updateProps({ readOnly: newReadOnly });
  },
);

function handlePropertyGridUpdate(value: string) {
  emit('update:modelValue', value);
  // Also sync to vanilla-jsoneditor
  if (editorInstance) {
    try {
      editorInstance.update(toContent(value));
    } catch {
      // ignore
    }
  }
}

function switchToEditor() {
  showPropertyGrid.value = false;
  currentMode.value = Mode.tree;
}

// Expose methods for parent component
defineExpose({
  getEditor: () => editorInstance,
  refresh: () => {
    if (!editorInstance) return;
    editorInstance.update(toContent(props.modelValue));
  },
  expandAll: () => {
    if (!editorInstance) return;
    editorInstance.expand(() => true);
  },
  collapseAll: () => {
    if (!editorInstance) return;
    editorInstance.expand(() => false);
  },
});
</script>

<template>
  <div class="enhanced-json-editor" :style="{ height }">
    <!-- Property Grid view (replaces vanilla-jsoneditor table mode) -->
    <div v-if="showPropertyGrid" class="property-grid-wrapper">
      <div class="pg-header">
        <span class="pg-header-title">Property Grid</span>
        <button class="pg-back-btn" @click="switchToEditor">
          ← Back to Tree / Code
        </button>
      </div>
      <JsonPropertyGrid
        :data="modelValue"
        :read-only="readOnly"
        @update:data="handlePropertyGridUpdate"
      />
    </div>

    <!-- vanilla-jsoneditor (tree / text modes) -->
    <div v-show="!showPropertyGrid" ref="editorRef" class="editor-container" />

    <!-- Error indicator -->
    <div v-if="hasError && !showPropertyGrid" class="error-bar">
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped lang="postcss">
.enhanced-json-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background-color: #ffffff;
}

.editor-container {
  flex: 1;
  overflow: auto;
  min-height: 200px;

  /* vanilla-jsoneditor style overrides */
  :deep(.jse-main) {
    border: none !important;
    min-height: 200px;
  }

  :deep(.jse-theme-default) {
    --jse-theme-color: #6366f1;
    --jse-theme-color-highlight: #e0e7ff;
  }

  :deep(.jse-menu) {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :deep(.jse-contents) {
    border: none !important;
  }
}

.property-grid-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.pg-header-title {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}

.pg-back-btn {
  padding: 3px 10px;
  font-size: 11px;
  color: #6366f1;
  background: #ffffff;
  border: 1px solid #c7d2fe;
  border-radius: 3px;
  cursor: pointer;

  &:hover {
    background: #eef2ff;
  }
}

.error-bar {
  padding: 4px 12px;
  font-size: 11px;
  color: #dc2626;
  background-color: #fef2f2;
  border-top: 1px solid #fecaca;
}
</style>
