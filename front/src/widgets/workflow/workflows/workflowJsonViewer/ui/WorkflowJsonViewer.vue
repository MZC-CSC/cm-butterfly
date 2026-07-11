<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
import { CreateForm } from '@/widgets/layout';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { ref, computed, watch, nextTick } from 'vue';
import { decodeBase64, encodeBase64 } from '@/shared/utils/base64';

interface iProps {
  title: string;
  name: string;
  json: object | null | undefined | any;
  schema: {
    json: boolean;
    properties: object;
  };
  readOnly: boolean;
}

const props = defineProps<iProps>();

const emit = defineEmits([
  'update:close-modal',
  'update:api',
  'update:trigger',
]);

// Decode base64 content for cicada_task_run_script tasks
// cicada_task_run_script 태스크의 content 필드를 base64로 디코딩
const decodedJson = computed(() => {
  if (!props.json || typeof props.json !== 'object') {
    return props.json;
  }

  const jsonCopy = JSON.parse(JSON.stringify(props.json));
  
  // Process task_groups
  if (jsonCopy.task_groups && Array.isArray(jsonCopy.task_groups)) {
    processTaskGroups(jsonCopy.task_groups);
  }
  
  return jsonCopy;
});

function processTaskGroups(taskGroups: any[]) {
  taskGroups.forEach((taskGroup: any) => {
    // Process tasks in the task group
    if (taskGroup.tasks && Array.isArray(taskGroup.tasks)) {
      taskGroup.tasks.forEach((task: any) => {
        // Check task.task_component (fixed identifier, not user-changeable)
        // task.task_component로 확인 (고정 식별자, 사용자 변경 불가)
        // cm-cicada type/spec 전환: request_body는 task.spec.request_body에 있음(레거시 task.request_body fallback)
        if (task.task_component === 'cicada_task_run_script') {
          const hasSpec = task.spec && task.spec.request_body != null;
          const rawRequestBody = hasSpec ? task.spec.request_body : task.request_body;
          if (rawRequestBody) {
            try {
              const requestBody = JSON.parse(rawRequestBody);
              if (requestBody.content) {
                console.log('🔓 Decoding content in JSON Viewer for task:', task.name);
                requestBody.content = decodeBase64(requestBody.content);
                const encoded = JSON.stringify(requestBody);
                if (hasSpec) task.spec.request_body = encoded;
                else task.request_body = encoded;
              }
            } catch (e) {
              console.error('Error decoding task request_body:', e);
            }
          }
        }
      });
    }
    
    // Recursively process nested task_groups
    if (taskGroup.task_groups && Array.isArray(taskGroup.task_groups)) {
      processTaskGroups(taskGroup.task_groups);
    }
  });
}

const updatedData = ref(decodedJson.value);
const isSaveAble = ref<boolean>(true);
const jsonEditorRef = ref(null);

// Watch for changes in decodedJson
watch(decodedJson, (newVal) => {
  updatedData.value = newVal;
}, { immediate: true });

// Convert updatedData to JSON string for EnhancedJsonEditor
const updatedDataString = computed(() => {
  if (!updatedData.value) {
    return '{}';
  }
  try {
    return JSON.stringify(updatedData.value, null, 2);
  } catch (e) {
    console.error('Failed to stringify workflow JSON:', e);
    return '{}';
  }
});

// Auto-expand JSON Editor when data changes
watch(() => updatedData.value, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    nextTick(() => {
      setTimeout(() => {
        jsonEditorRef.value?.expandAll();
      }, 300);
    });
  }
}, { immediate: true, deep: true });

function handleModal() {
  emit('update:close-modal', false);
}

function handleModelUpdate(value: string) {
  try {
    const parsed = JSON.parse(value);
    updatedData.value = parsed;
  } catch (e) {
    console.warn('Invalid JSON in WorkflowJsonViewer, not updating:', e);
  }
}

async function handleSave() {
  if (updatedData.value !== null) {
    // Re-encode content fields before saving
    // 저장 전에 content 필드를 다시 인코딩
    const dataToSave = JSON.parse(JSON.stringify(updatedData.value));
    
    if (dataToSave.task_groups && Array.isArray(dataToSave.task_groups)) {
      encodeTaskGroups(dataToSave.task_groups);
    }
    
    emit('update:close-modal', false);
    emit('update:api', dataToSave);
  }
}

function encodeTaskGroups(taskGroups: any[]) {
  taskGroups.forEach((taskGroup: any) => {
    // Process tasks in the task group
    if (taskGroup.tasks && Array.isArray(taskGroup.tasks)) {
      taskGroup.tasks.forEach((task: any) => {
        // Check task.task_component (fixed identifier, not user-changeable)
        // task.task_component로 확인 (고정 식별자, 사용자 변경 불가)
        // cm-cicada type/spec 전환: request_body는 task.spec.request_body에 있음(레거시 task.request_body fallback)
        if (task.task_component === 'cicada_task_run_script') {
          const hasSpec = task.spec && task.spec.request_body != null;
          const rawRequestBody = hasSpec ? task.spec.request_body : task.request_body;
          if (rawRequestBody) {
            try {
              const requestBody = JSON.parse(rawRequestBody);
              if (requestBody.content) {
                console.log('🔐 Encoding content in JSON Viewer for task:', task.name);
                requestBody.content = encodeBase64(requestBody.content);
                const encoded = JSON.stringify(requestBody);
                if (hasSpec) task.spec.request_body = encoded;
                else task.request_body = encoded;
              }
            } catch (e) {
              console.error('Error encoding task request_body:', e);
            }
          }
        }
      });
    }
    
    // Recursively process nested task_groups
    if (taskGroup.task_groups && Array.isArray(taskGroup.task_groups)) {
      encodeTaskGroups(taskGroup.task_groups);
    }
  });
}
</script>

<template>
  <create-form
    class="page-modal-layout"
    :badge-title="name"
    :title="title"
    :need-widget-layout="true"
    first-title="JSON Viewer"
    @update:modal-state="handleModal"
  >
    <template #add-info>
      <div data-testid="workflow-json-viewer" class="workflow-json-editor-wrapper">
        <div class="editor-title">Target Model</div>
        <EnhancedJsonEditor
          ref="jsonEditorRef"
          :model-value="updatedDataString"
          :mode="'tree'"
          :read-only="readOnly"
          :main-menu-bar="true"
          :navigation-bar="true"
          :status-bar="false"
          height="600px"
          @update:modelValue="handleModelUpdate"
        />
      </div>
    </template>
    <template v-if="!readOnly" #buttons>
      <p-button
        style-type="tertiary"
        @click="emit('update:close-modal', false)"
      >
        Cancel
      </p-button>
      <p-button @click="handleSave">Save</p-button>
    </template>
  </create-form>
</template>

<style scoped lang="postcss">
.workflow-json-editor-wrapper {
  width: 100%;

  .editor-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #1f2937;
  }
}
</style>
