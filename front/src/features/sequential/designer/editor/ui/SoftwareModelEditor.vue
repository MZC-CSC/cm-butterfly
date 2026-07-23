<script setup lang="ts">
import { PTextInput, PIconButton } from '@cloudforet-test/mirinae';
import { onBeforeMount, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue';
import { useGrasshopperTaskEditorModel } from '@/features/sequential/designer/editor/model/grasshopperTaskEditorModel';
import SequentialShortCut from '@/features/sequential/designer/shortcut/ui/SequentialShortCut.vue';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { Step } from '@/features/workflow/workflowEditor/model/types';

interface IProps {
  step: Step;
}

const props = defineProps<IProps>();
const emit = defineEmits([
  'saveComponentName',
  'saveContext',
  'saveFixedModel',
]);

const taskEditorModel = useGrasshopperTaskEditorModel();
const shortCutModel = ref({
  open: false,
  xPos: 0,
  yPos: 0,
  delete: {
    label: 'Delete',
    callback: function () {},
  },
});
const editorFormElement = ref(null);
const jsonEditorRef = ref(null);

// convert targetSoftwareModel to a JSON string
const softwareModelString = computed(() => {
  const targetModel = taskEditorModel.formContext.value?.find(
    ctx => ctx.type === 'targetSoftwareModel'
  );

  if (!targetModel || !targetModel.context) {
    return '{}';
  }

  try {
    return JSON.stringify(targetModel.context, null, 2);
  } catch (e) {
    console.error('Failed to stringify software model:', e);
    return '{}';
  }
});

// JSON Editor update handler
function handleModelUpdate(value: string) {
  try {
    const parsed = JSON.parse(value);
    const targetModelIndex = taskEditorModel.formContext.value?.findIndex(
      ctx => ctx.type === 'targetSoftwareModel'
    );

    if (targetModelIndex !== -1 && targetModelIndex !== undefined) {
      taskEditorModel.formContext.value[targetModelIndex].context = parsed;
    }
  } catch (e) {
    console.warn('Invalid JSON, not updating model:', e);
  }
}

// auto expand all
watch(
  () => taskEditorModel.formContext.value,
  () => {
    nextTick(() => {
      jsonEditorRef.value?.expandAll();
    });
  },
  { deep: true, immediate: true }
);

onBeforeMount(() => {
  // set softwareModel data
  if (props.step.properties.model) {
    console.log('SoftwareModelEditor - set Model:', props.step.properties.model);
    taskEditorModel.setGrasshopperBodyParamsContext(props.step.properties.model);
  }
  
  if (props.step.properties.fixedModel) {
    taskEditorModel.setParamsContext(props.step.properties.fixedModel);
  }

  taskEditorModel.setComponentName(props.step.name);

  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(
  taskEditorModel.componentNameModel,
  nv => {
    if (nv.context.model.value !== '') {
      emit('saveComponentName', nv.context.model.value);
    }
  },
  { deep: true },
);

watch(
  taskEditorModel.formContext,
  nv => {
    if (nv) {
      const convertedData = taskEditorModel.convertGrasshopperFormModelToStepProperties();
      emit('saveContext', convertedData);
    }
  },
  { deep: true },
);

watch(
  taskEditorModel.paramsContext,
  () => {
    emit(
      'saveFixedModel',
      taskEditorModel.convertParamsModelToStepProperties(),
    );
  },
  { deep: true },
);

function openShortCut(e) {
  shortCutModel.value.open = true;
  shortCutModel.value.xPos = e.offsetX + e.target.offsetLeft;
  shortCutModel.value.yPos = e.offsetY + e.target.offsetTop;
}

function closeShortCut() {
  shortCutModel.value.open = false;
}

function deleteEntity(e, index) {
  e.preventDefault();
  shortCutModel.value.delete.callback = () =>
    taskEditorModel.deleteEntity(index);
  openShortCut(e);
}

function deleteArrayElement(
  e: MouseEvent,
  targetArr: Array<any>,
  targetIndex: number,
) {
  e.preventDefault();
  shortCutModel.value.delete.callback = () =>
    taskEditorModel.deleteArrayElement(targetArr, targetIndex);
  openShortCut(e);
}

function handleClickOutside(event: MouseEvent) {
  const sequentialShortCutElement = document.querySelector(
    '.sequential-shortcut',
  );
  if (
    sequentialShortCutElement &&
    !sequentialShortCutElement.contains(event.target as Node)
  ) {
    closeShortCut();
  }
}


// Vue 2 compatible helper functions
function getFieldTitle(field: any) {
  try {
    if (field && field.context) {
      return field.context.title || field.context.subject || 'Field';
    }
    return 'Field';
  } catch (error) {
    console.error('getFieldTitle error:', error);
    return 'Field';
  }
}

function hasFieldModel(field: any) {
  try {
    return field && field.context && field.context.model;
  } catch (error) {
    console.error('hasFieldModel error:', error);
    return false;
  }
}

function getFieldModel(field: any) {
  try {
    if (field && field.context && field.context.model) {
      return field.context.model;
    }
    return { value: '', isValid: true, onBlur: () => {} };
  } catch (error) {
    console.error('getFieldModel error:', error);
    return { value: '', isValid: true, onBlur: () => {} };
  }
}

// switched to EnhancedJsonEditor; removed the now-unneeded JsonDataFormTree-related functions


</script>

<template>
  <div
    ref="editorFormElement"
    class="task-editor-form"
    @click.right="
      e => {
        e.preventDefault();
      }
    "
  >
    <!-- Component Name -->
    <div class="step-name-box w-full">
      <div class="subject-title border-bottom">Component Name</div>
      <div class="field-group flex border-bottom">
        <div class="field-title-box">
          {{ taskEditorModel.componentNameModel.value.context.title }}
        </div>
        <div class="field-content-box">
          <p-text-input
            v-model="
              taskEditorModel.componentNameModel.value.context.model.value
            "
            :size="'md'"
            block
            readonly
          ></p-text-input>
        </div>
      </div>
    </div>

    <!-- Params Context -->
    <div
      v-for="(currentParams, index) of taskEditorModel.paramsContext.value"
      :key="index"
    >
      <div class="params-box w-full h-full">
        <div v-if="currentParams.type === 'params'">
          <div v-if="currentParams.context.values.length > 0">
            <div class="subject-title border-bottom">
              {{ currentParams.context.subject }}
            </div>
            <div
              v-for="(entity, j) of currentParams.context.values"
              :key="j"
              class="field-group flex border-bottom"
            >
              <div v-if="entity.type === 'input'" class="field-title-box">
                {{ entity.context.title }}
              </div>
              <div class="field-content-box">
                <p-text-input
                  v-model="entity.context.model.value"
                  :size="'md'"
                  block
                  :invalid="!entity.context.model.isValid"
                  :readonly="entity.context.title === 'nsId'"
                  @blur="entity.context.model.onBlur"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Target Software Model top level -->
    <div
      v-for="(currentContext, index) of taskEditorModel.formContext.value"
      :key="index"
    >
      <!-- targetSoftwareModel display -->
      <div
        v-if="currentContext.type === 'targetSoftwareModel'"
        class="params-box w-full h-full"
      >
        <div class="subject-title border-bottom">
          {{ currentContext.context.subject || 'Target Software Model' }}
        </div>

        <!-- targetSoftwareModel is shown via EnhancedJsonEditor -->
        <div class="json-editor-wrapper">
          <EnhancedJsonEditor
            ref="jsonEditorRef"
            :model-value="softwareModelString"
            :mode="'tree'"
            :read-only="false"
            :main-menu-bar="true"
            :navigation-bar="true"
            :status-bar="false"
            height="600px"
            file-name="software-model"
            @update:modelValue="handleModelUpdate"
          />
        </div>
      </div>
    </div>

    <SequentialShortCut
      :open="shortCutModel.open"
      :x-pos="shortCutModel.xPos"
      :y-pos="shortCutModel.yPos"
      :items="[
        {
          label: shortCutModel.delete.label,
          callback: shortCutModel.delete.callback,
        },
      ]"
      @close="closeShortCut"
    />
  </div>
</template>

<style scoped lang="postcss">
.task-editor-form {
  position: relative;
  overflow: hidden;
  overflow-y: scroll;
  width: 100%;
  height: calc(100% - 20px);

  .field-group {
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
  }
}

.border-bottom {
  border-bottom: 1px solid;
  @apply border-gray-200;
}

.subject-title {
  @apply pr-[16px] pl-[16px] mt-[16px] h-[44px] flex justify-between items-center text-gray-500;
}

/* styles specific to Target Software Model */
.target-software-model-box {
  margin: 8px 0;
  padding: 8px;
  background-color: #f0f9ff;
  border-left: 3px solid #0ea5e9;
  border-radius: 4px;
}

/* styles specific to Migration List Accordion */
.migration-list-accordion {
  margin: 8px 0;
  padding: 8px;
  background-color: #f8fafc;
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
}

/* styles specific to Binaries Accordion */
.binaries-accordion {
  margin: 8px 0;
  padding: 8px;
  background-color: #f0fdf4;
  border-left: 3px solid #10b981;
  border-radius: 4px;
}

/* Binary Sub Item styles */
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

/* styles specific to Servers List */
.servers-list-section {
  margin: 8px 0;
  padding: 8px;
  background-color: #f0f9ff;
  border-left: 3px solid #0ea5e9;
  border-radius: 4px;
}

.server-item {
  margin: 8px 0;
  padding: 8px;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

:deep(.accordion-item) {
  border-color: transparent;
}

:deep(.accordion-content) {
  padding-left: 0;
}

:deep(.accordion-header) {
  border-color: transparent;
}

.accordion-box {
  .item-content.field-group {
    border-color: transparent;

    .field-title-box {
      padding-left: 40px;
    }
  }

  .field-content-box {
    padding-left: 10px;
  }

  .item-content.field-group:last-child {
    border-color: inherit;
  }
}

/* JSON Editor Wrapper */
.json-editor-wrapper {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 4px;
}
</style>
