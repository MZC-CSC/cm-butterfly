<script setup lang="ts">
import { PDefinitionTable } from '@cloudforet-test/mirinae';
import { useSourceModelDetailModel } from '@/widgets/models/sourceModels';
import { computed, onBeforeMount, ref, watch, watchEffect } from 'vue';
import {
  canRecommendFrom,
  modelCategoryOf,
  modelStageOf,
  ModelStage,
} from '@/entities/migrationModel';
import { showErrorMessage } from '@/shared/utils';
import DisabledReason from '@/shared/ui/DisabledReason/DisabledReason.vue';

interface iProps {
  selectedSourceModelId: string;
}

const props = defineProps<iProps>();

const emit = defineEmits([
  'update:custom-view-json-modal',
  'update:view-recommend-list-modal',
  'update:source-model-name',
  'update:source-model-description',
  'update:recommended-model-list',
]);

const { sourceModelStore, setSourceModelId, initTable, tableModel } =
  useSourceModelDetailModel();

const sourceModelName = ref<string | undefined>('');
const sourceModelDescription = ref<string | undefined>('');
const recommendedModelList = ref<string>('infra'); // Initialize as a string

const selectedModel = computed(() =>
  sourceModelStore.getSourceModelById(props.selectedSourceModelId),
);

/** null while the model is not loaded or carries no stage; the links are then not offered. */
const stage = computed<ModelStage | null>(() => {
  if (!selectedModel.value) return null;
  try {
    return modelStageOf(selectedModel.value);
  } catch {
    return null;
  }
});

/**
 * A source model is read-only: opening it shows what was collected, and saving creates a planning
 * model. Recommendation starts from a planning model (canRecommendFrom has the software exception).
 */
/** Shown on hover over the disabled recommend link; empty when it is enabled. */
const recommendDisabledReason = computed(() =>
  selectedModel.value && !recommendable.value ? RECOMMEND_DISABLED_REASON : '',
);

const customViewLabel = computed(() => {
  if (stage.value === 'planning') return 'Custom & View Planning Model';
  let software = false;
  try {
    software =
      !!selectedModel.value &&
      modelCategoryOf(selectedModel.value) === 'software';
  } catch {
    software = false;
  }
  // A software model has no planning stage in the console yet (canRecommendFrom).
  return software
    ? 'Custom & View Source Model'
    : 'View & Save as Planning Model';
});

const RECOMMEND_DISABLED_REASON =
  'A source model keeps what was collected and is read-only. Open it with "View & Save as Planning Model", save it as a planning model, and get recommendations from that planning model.';

const recommendable = computed(() => {
  if (!selectedModel.value) return false;
  try {
    return canRecommendFrom(selectedModel.value);
  } catch {
    return false;
  }
});

watchEffect(() => {
  sourceModelName.value = sourceModelStore.getSourceModelById(
    props.selectedSourceModelId,
  )?.id;
});

watchEffect(() => {
  sourceModelDescription.value = sourceModelStore.getSourceModelById(
    props.selectedSourceModelId,
  )?.description;
});

watch(
  sourceModelName,
  nv => {
    emit('update:source-model-name', nv);
  },
  { immediate: true },
);

watch(
  sourceModelDescription,
  nv => {
    emit('update:source-model-description', nv);
  },
  { immediate: true },
);

watch(
  props,
  () => {
    setSourceModelId(props.selectedSourceModelId);
  },
  { immediate: true },
);

onBeforeMount(() => {
  initTable();
});

function handleJsonModal() {
  // Log output for debugging
  const sourceModel = sourceModelStore.getSourceModelById(
    props.selectedSourceModelId,
  );
  // console.log('=== SourceModelDetail Debug Info ===');
  // console.log('selectedSourceModelId:', props.selectedSourceModelId);
  // console.log('sourceModel:', sourceModel);
  // console.log('sourceModelName:', sourceModelName.value);
  // console.log('connection_info_list:', sourceModel?.connection_info_list);
  // console.log('connection_info_list type:', typeof sourceModel?.connection_info_list);
  // console.log('connection_info_list length:', sourceModel?.connection_info_list?.length);
  // console.log('Full sourceModel structure:', JSON.stringify(sourceModel, null, 2));
  // console.log('==================================');

  emit('update:custom-view-json-modal', true);
  emit('update:source-model-name', sourceModelName.value);
}

function handleRecommendedList() {
  const sourceModel = sourceModelStore.getSourceModelById(
    props.selectedSourceModelId,
  );

  if (!sourceModel || !recommendable.value) return;
  // cm-damselfly's modelType decides it (OnPremiseModel | CloudModel | SoftwareModel |
  // objectStorageModel); the category names the recommendation window to open.
  try {
    recommendedModelList.value = modelCategoryOf(sourceModel);
  } catch (e: any) {
    showErrorMessage('error', e.message);
    return;
  }

  emit('update:view-recommend-list-modal', true);
  emit('update:source-model-name', sourceModelName.value);
  emit('update:recommended-model-list', recommendedModelList.value);
}
</script>

<template>
  <div
    data-testid="source-model-detail"
    :data-model-id="selectedSourceModelId"
    :data-stage="stage ?? ''"
  >
    <p-definition-table
      :fields="tableModel.tableState.fields"
      :data="tableModel.tableState.data"
      :loading="tableModel.tableState.loading"
      :block="true"
    >
      <!-- :disable-copy="true" -->
      <template #data-customAndViewJSON>
        <p
          class="link-button-text"
          data-testid="source-detail-custom-view"
          @click="handleJsonModal"
        >
          {{ customViewLabel }}
        </p>
        <!-- <p-button style-type="transparent" @click="handleJsonModal">
        </p-button> -->
      </template>
      <!-- Always render the element: an empty slot makes PDefinitionTable fall back to its default (DESIGN-MIRINAE). -->
      <template #data-stage="{ data }">
        <span data-testid="source-detail-stage">{{ data }}</span>
      </template>
      <template #data-parentSourceModel="{ data }">
        <span data-testid="source-detail-parent">{{ data }}</span>
      </template>
      <template #data-recommendModel>
        <!-- Kept visible but disabled on a source model; hovering explains why (DisabledReason). -->
        <disabled-reason
          :reason="recommendDisabledReason"
          testid="source-detail-recommend-reason"
        >
          <p
            :class="[
              'link-button-text',
              { 'link-button-text--disabled': !recommendable },
            ]"
            :aria-disabled="!recommendable"
            data-testid="source-detail-view-recommend"
            @click="handleRecommendedList"
          >
            View Recommended List
          </p>
        </disabled-reason>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss">
.link-button-text--disabled,
.link-button-text--disabled:hover {
  @apply text-gray-400;
  cursor: not-allowed;
}
</style>
