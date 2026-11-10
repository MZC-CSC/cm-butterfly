<script setup lang="ts">
import { PTab, PButton } from '@cloudforet-test/mirinae';
import { SourceModelList } from '@/widgets/models/sourceModels';
import { SourceModelDetail } from '@/widgets/models/sourceModels';
import { CustomViewSourceModel } from '@/widgets/models/sourceModels';
import { RecommendedInfraModel } from '@/widgets/models/sourceModels';
import { RecommendedSoftwareModel } from '@/widgets/models/recommendedSoftwareModel';
import { computed, reactive, ref } from 'vue';
import { SimpleEditForm } from '@/widgets/layout';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useSourceModelStore } from '@/entities';
import {
  describeModelError,
  isObjectStorageModel,
  modelStageOf,
  updateModelInfo,
} from '@/entities/migrationModel';
import { GuidedStepBanner } from '@/features/guidedSetup';
import CreateObjectStorageSourceModelModal from '@/widgets/models/createObjectStorageSourceModel/ui/CreateObjectStorageSourceModelModal.vue';
import RecommendedObjectStorageModel from '@/widgets/models/recommendedObjectStorageModel/ui/RecommendedObjectStorageModel.vue';
import CustomViewObjectStorageModel from '@/widgets/models/customViewObjectStorageModel/ui/CustomViewObjectStorageModel.vue';
import { ObjectStorageBuckets } from '@/widgets/models/objectStorageBuckets';
import type { IObjectStorageModel } from '@/entities/objectStorage/model/types';

const pageName = 'Source Models';

const selectedSourceModelId = ref<string>('');
const sourceModelName = ref<string>('');
const recommendedModelList = ref<string>('infra'); // added: recommended model list type
const sourceModelStore = useSourceModelStore();
const sourceModel = computed(() =>
  sourceModelStore.getSourceModelById(selectedSourceModelId.value),
);
// A source model is the read-only record of what was collected; only planning models are edited.
const isPlanningModel = computed(() => {
  if (!sourceModel.value) return false;
  try {
    return modelStageOf(sourceModel.value) === 'planning';
  } catch {
    return false;
  }
});
// Object storage models share this list; their detail adds the buckets and their own windows.
const isObjectStorage = computed(
  () => !!sourceModel.value && isObjectStorageModel(sourceModel.value),
);
// The source model store types its entries for infra and software; an object storage entry
// carries the object storage fields cm-damselfly returns.
const objectStorageModel = computed(
  () => sourceModel.value as unknown as IObjectStorageModel,
);
const createObjectStorageOpen = ref(false);

function handleObjectStorageSourceSaved() {
  modalState.editModelModal.trigger = true;
}

const mainTabState = reactive({
  activeTab: 'details',
  tabs: [
    {
      name: 'details',
      label: 'Details',
    },
  ],
});

const modalState = reactive({
  customViewJsonModal: {
    open: false,
    trigger: false,
  },
  editModelModal: {
    open: false,
    trigger: false,
    context: {
      name: '',
      description: '',
    },
    updateTrigger() {
      modalState.editModelModal.trigger = false;
    },
  },
  viewRecommendedListModal: { open: false, trigger: false },
});

function handleClickSourceModelId(data: { id: string; name: string }) {
  console.log(data);
  selectedSourceModelId.value = data.id;
  sourceModelName.value = data.name ?? '';
}

function handleJsonModal(value: boolean) {
  modalState.customViewJsonModal.open = value;
}

function handleRecommendedListModal(value: boolean) {
  modalState.viewRecommendedListModal.open = value;
}

function handleRecommendedModelList(value: string) {
  recommendedModelList.value = value;
}

function handleUpdateSourceModel(e) {
  modalState.editModelModal.open = false;
  modalState.editModelModal.context.name = e.name;
  modalState.editModelModal.context.description = e.description;
  if (!sourceModel.value) return;
  updateModelInfo(sourceModel.value, {
    userModelName: e.name,
    description: e.description,
  })
    .then(() => {
      showSuccessMessage('success', 'Successfully updated planning model');
      modalState.editModelModal.trigger = true;
    })
    .catch(err => {
      showErrorMessage('error', describeModelError(err).message);
    });
}
</script>

<template>
  <div :class="`${pageName}-page page`">
    <header>
      <p>{{ pageName }}</p>
    </header>
    <!-- A target model is produced from a source model here - not on the Target Models list. -->
    <guided-step-banner step="target-model" />
    <div class="page-actions">
      <p-button
        style-type="secondary"
        icon-left="ic_plus_bold"
        data-testid="os-source-create-open"
        @click="createObjectStorageOpen = true"
      >
        Create Object Storage Source Model
      </p-button>
    </div>
    <section :class="`${pageName}-page-body`">
      <source-model-list
        :trigger="modalState.editModelModal.trigger"
        @select-row="handleClickSourceModelId"
        @update:trigger="modalState.editModelModal.updateTrigger"
      />
      <p v-if="!selectedSourceModelId" class="more-details">
        Select an item for more details.
      </p>
      <div v-if="selectedSourceModelId">
        <p-tab v-model="mainTabState.activeTab" :tabs="mainTabState.tabs">
          <template #details>
            <div class="tab-section-header">
              <p>
                {{
                  isPlanningModel
                    ? 'Planning Model Information'
                    : 'Source Model Information'
                }}
              </p>
              <p-button
                v-if="isPlanningModel"
                data-testid="source-detail-edit"
                style-type="tertiary"
                icon-left="ic_edit"
                @click="modalState.editModelModal.open = true"
              >
                Edit
              </p-button>
            </div>
            <source-model-detail
              :selected-source-model-id="selectedSourceModelId"
              @update:custom-view-json-modal="
                e => (modalState.customViewJsonModal.open = e)
              "
              @update:view-recommend-list-modal="handleRecommendedListModal"
              @update:recommended-model-list="handleRecommendedModelList"
            />
            <object-storage-buckets
              v-if="isObjectStorage && sourceModel"
              :model="objectStorageModel"
            />
          </template>
        </p-tab>
      </div>
    </section>
    <div class="relative z-60">
      <simple-edit-form
        v-if="modalState.editModelModal.open"
        header-title="Edit Model"
        name-label="Model Name"
        :name="sourceModelName"
        :description="sourceModel?.description ?? ''"
        :name-placeholder="'Model Name'"
        @update:save-modal="handleUpdateSourceModel"
        @update:close-modal="modalState.editModelModal.open = false"
        @update:trigger="modalState.editModelModal.trigger = true"
      />
    </div>
    <div class="relative z-70">
      <custom-view-object-storage-model
        v-if="modalState.customViewJsonModal.open && isObjectStorage"
        :model="objectStorageModel"
        @update:close-modal="handleJsonModal"
        @update:trigger="modalState.editModelModal.trigger = true"
      />
      <custom-view-source-model
        v-if="modalState.customViewJsonModal.open && !isObjectStorage"
        :source-model-name="sourceModelName"
        :source-model-id="selectedSourceModelId"
        @update:close-modal="handleJsonModal"
        @update:trigger="modalState.editModelModal.trigger = true"
      />
      <recommended-infra-model
        v-if="
          modalState.viewRecommendedListModal.open &&
          recommendedModelList === 'infra'
        "
        :source-model-name="sourceModelName"
        :source-model-id="selectedSourceModelId"
        @update:close-modal="handleRecommendedListModal"
      />
      <recommended-software-model
        v-if="
          modalState.viewRecommendedListModal.open &&
          recommendedModelList === 'software'
        "
        :source-model-name="sourceModelName"
        :source-model-id="selectedSourceModelId"
        @update:close-modal="handleRecommendedListModal"
      />
      <recommended-object-storage-model
        v-if="
          modalState.viewRecommendedListModal.open &&
          recommendedModelList === 'objectStorage' &&
          sourceModel
        "
        :source="objectStorageModel"
        @update:close-modal="handleRecommendedListModal"
      />
      <create-object-storage-source-model-modal
        v-if="createObjectStorageOpen"
        @saved="handleObjectStorageSourceSaved"
        @update:close-modal="createObjectStorageOpen = false"
      />
    </div>
  </div>
</template>

<style scoped lang="postcss">
.page-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}
</style>
