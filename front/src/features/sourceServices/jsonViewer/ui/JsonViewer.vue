<script setup lang="ts">
import { i18n } from '@/app/i18n';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { PI, PSpinner, PPaneLayout } from '@cloudforet-test/mirinae';
import { computed, ref, watch, nextTick } from 'vue';
import { AxiosResponse } from 'axios';

interface iProps {
  formData: any;
  promiseFunc: (payload?: any, config?: any) => Promise<AxiosResponse<any> | void>;
  convertedJSON: any;
  loading: boolean;
}

const props = defineProps<iProps>();
const emit = defineEmits(['update:is-converted', 'update:convertedJSON']);

// Editor refs
const metaEditorRef = ref<InstanceType<typeof EnhancedJsonEditor> | null>(null);
const modelEditorRef = ref<InstanceType<typeof EnhancedJsonEditor> | null>(null);

// formData를 JSON string으로 변환
const metaDataString = computed(() => {
  if (!props.formData) return '{}';
  if (typeof props.formData === 'string') return props.formData;
  if (typeof props.formData === 'object') {
    try {
      return JSON.stringify(props.formData, null, 2);
    } catch (e) {
      console.error('Failed to stringify formData:', e);
      return '{}';
    }
  }
  return '{}';
});

// convertedJSON을 JSON string으로 변환
const modelDataString = computed(() => {
  console.log('[JsonViewer] modelDataString computed, convertedJSON:', props.convertedJSON, 'type:', typeof props.convertedJSON);

  if (!props.convertedJSON) {
    console.log('[JsonViewer] convertedJSON is falsy, returning "{}"');
    return '{}';
  }

  if (typeof props.convertedJSON === 'string') {
    console.log('[JsonViewer] convertedJSON is string:', props.convertedJSON.substring(0, 50));
    return props.convertedJSON;
  }

  if (typeof props.convertedJSON === 'object') {
    try {
      const result = JSON.stringify(props.convertedJSON, null, 2);
      console.log('[JsonViewer] Stringified convertedJSON:', result.substring(0, 100));
      return result;
    } catch (e) {
      console.error('[JsonViewer] Failed to stringify convertedJSON:', e);
      return '{}';
    }
  }

  console.log('[JsonViewer] Fallback, returning "{}"');
  return '{}';
});

// Watch for Meta data changes and expand all
watch(() => props.formData, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    console.log('Meta data changed, expanding...');
    setTimeout(() => {
      metaEditorRef.value?.expandAll();
    }, 300);
  }
}, { immediate: true, deep: true });

// Watch for Model data changes and expand all
watch(() => props.convertedJSON, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    console.log('Model data changed, expanding...');
    setTimeout(() => {
      modelEditorRef.value?.expandAll();
    }, 300);
  }
}, { immediate: true, deep: true });

function handleConvertJson() {
  props.promiseFunc().then(res => {
    emit('update:is-converted', res);
    // Convert 완료 후 우측 에디터 전체 확장 (현재 모드 유지)
    setTimeout(() => {
      console.log('Convert completed, expanding Model...');
      modelEditorRef.value?.expandAll();
    }, 500);
  });
}

// Model 수정 시 부모에 전달
function handleModelUpdate(value: string) {
  console.log('[JsonViewer] handleModelUpdate called, value:', JSON.stringify(value).substring(0, 100));

  // 빈 문자열이나 공백만 있는 경우 빈 객체로 처리
  const trimmedValue = value.trim();
  if (!trimmedValue || trimmedValue === '') {
    console.log('[JsonViewer] Empty value detected, emitting empty object {}');
    emit('update:convertedJSON', {});
    return;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    console.log('[JsonViewer] Valid JSON parsed, emitting to parent');
    emit('update:convertedJSON', parsed);
  } catch (e) {
    console.warn('[JsonViewer] Invalid JSON, not updating parent:', e);
    // 잘못된 JSON은 부모에 전달하지 않음
  }
}
</script>

<template>
  <div class="json-viewer-layout">
    <!-- 좌측: Meta (읽기 전용) -->
    <p-pane-layout class="json-editor-pane">
      <p class="editor-title">Meta (data)</p>
      <div class="editor-wrapper">
        <EnhancedJsonEditor
          ref="metaEditorRef"
          :model-value="metaDataString"
          :read-only="true"
          :mode="'tree'"
          :main-menu-bar="true"
          :navigation-bar="true"
          :status-bar="false"
          height="600px"
          file-name="source-metadata"
        />
      </div>
    </p-pane-layout>

    <!-- 중앙: 변환 버튼 -->
    <button data-testid="source-refine-convert" class="convert-btn" @click="handleConvertJson">
      <div class="flex flex-row">
        <p-i
          class="icon"
          name="ic_arrow-right"
          color="white"
          width="1rem"
          height="1rem"
        />
        <p>{{ i18n.t('COMPONENT.BUTTON_MODAL.CONVERT') }}</p>
      </div>
      <p-spinner v-if="loading" class="spinner" size="md" />
    </button>

    <!-- 우측: Model (편집 가능) -->
    <p-pane-layout class="json-editor-pane">
      <p class="editor-title">Model</p>
      <div class="editor-wrapper">
        <EnhancedJsonEditor
          ref="modelEditorRef"
          :model-value="modelDataString"
          :read-only="false"
          :mode="'tree'"
          :main-menu-bar="true"
          :navigation-bar="true"
          :status-bar="false"
          height="600px"
          file-name="source-model"
          @update:modelValue="handleModelUpdate"
        />
      </div>
    </p-pane-layout>
  </div>
</template>

<style scoped lang="postcss">
.json-viewer-layout {
  @apply flex justify-center;
  width: 100%;
  min-width: 600px;
  max-width: 100%;
  overflow-x: auto;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    min-width: 300px;
  }

  .json-editor-pane {
    overflow-y: auto;
    overflow-x: auto;
    min-width: 300px;
    max-width: 100%;
    width: 100%;
    border-bottom: 1px solid #dddddf;

    .editor-title {
      font-size: 0.75rem;
      color: #6b7280;
      font-weight: 700;
      background-color: #F7F7F7;
      padding: 0.25rem 0.75rem;
      border-radius: 6px 0;
    }

    .editor-wrapper {
      background-color: white;
      padding: 0.5rem;
      width: 100%;
      min-width: 280px;
      min-height: 400px;
    }
  }

  .convert-btn {
    @apply flex flex-col justify-center items-center rounded-[4px] text-[#fff] bg-violet-400;
    font-size: 14px;
    padding: 0 24px;
    position: relative;
    min-width: 80px;
    margin: 0 8px;

    @media (max-width: 768px) {
      margin: 8px 0;
      min-width: 120px;
    }

    .spinner {
      @apply pl-[8px];
      position: absolute;
      top: 450px;

      @media (max-width: 768px) {
        top: 60px;
      }
    }

    .no-spinner {
      @apply w-[8px] h-[8px];
      position: absolute;
    }
  }

  .convert-btn:hover {
    @apply bg-violet-500;
  }

  .convert-btn:focus {
    @apply bg-violet-400;
  }

  .disable-btn {
    @apply bg-gray-300;
    cursor: not-allowed;
  }

  .icon {
    @apply mt-[2px] mr-[0.25rem];
  }
}
</style>
