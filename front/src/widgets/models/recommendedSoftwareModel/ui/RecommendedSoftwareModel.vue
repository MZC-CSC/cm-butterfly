<script setup lang="ts">
import { PButton, PI, PSpinner, PPaneLayout } from '@cloudforet-test/mirinae';
import { CreateForm, SimpleEditForm } from '@/widgets/layout';
import { computed, onMounted, ref, reactive, watch, nextTick } from 'vue';
import { useRecommendedSoftwareModel } from '@/widgets/models/recommendedSoftwareModel/model/useRecommendedSoftwareModel';
import { useSourceModelStore } from '@/entities';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { createTargetSoftwareModel } from '@/entities/targetModels/api';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useAuthStore } from '@/shared/libs/store/auth';

interface IProps {
  sourceModelName: string;
  sourceModelId: string;
}

const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal']);

const recommendSoftwareModel = useRecommendedSoftwareModel();
const sourceModelStore = useSourceModelStore();
const authStore = useAuthStore();
const resCreateTargetSoftwareModel = createTargetSoftwareModel(null);

// Editor refs
const sourceEditorRef = ref<any>(null);
const recommendedEditorRef = ref<any>(null);

// source model data
const sourceModel = computed(() =>
  sourceModelStore.getSourceModelById(props.sourceModelId),
);

// source software model data (for JSON display)
const sourceSoftwareModelData = computed(() => {
  if (sourceModel.value?.sourceSoftwareModel) {
    return sourceModel.value.sourceSoftwareModel;
  }
  return null;
});

// source model JSON string
const sourceSoftwareModelString = computed(() => {
  if (!sourceSoftwareModelData.value) return '{}';
  try {
    return JSON.stringify(sourceSoftwareModelData.value, null, 2);
  } catch (e) {
    console.error('Failed to stringify source software model:', e);
    return '{}';
  }
});

// recommended model result data (for JSON display)
const recommendedModelData = ref<any>(null);

// recommended model JSON string
const recommendedModelString = computed(() => {
  if (!recommendedModelData.value) return '{}';
  try {
    return JSON.stringify(recommendedModelData.value, null, 2);
  } catch (e) {
    console.error('Failed to stringify recommended model:', e);
    return '{}';
  }
});

// loading state
const isLoading = ref(false);

// Save TargetModel modal state
const saveTargetModelModal = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

onMounted(() => {
  recommendSoftwareModel.initToolBoxTableModel();
});

// Watch for source model changes and expand all
watch(
  sourceSoftwareModelData,
  newVal => {
    if (newVal) {
      console.log('Source model data changed, expanding...');
      setTimeout(() => {
        sourceEditorRef.value?.expandAll();
      }, 300);
    }
  },
  { immediate: true, deep: true },
);

// Watch for recommended model changes and expand all
watch(
  recommendedModelData,
  newVal => {
    if (newVal) {
      console.log('Recommended model data changed, expanding...');
      setTimeout(() => {
        recommendedEditorRef.value?.expandAll();
      }, 300);
    }
  },
  { immediate: true, deep: true },
);

/**
 * Keep the failure reason on screen. The toast disappears after 5 seconds, but where the user
 * is waiting for the result is the right-hand result panel. If the reason isn't left there, it just looks like "an empty screen".
 */
const loadErrorReason = ref<string | null>(null);

/**
 * Extract the failure reason the backend gave. It arrives in two forms:
 *  - HTTP error → execute() rejects with `{ error, errorMsg, status }` (ref)
 *  - error status carried in the body → thrown as an Error below
 */
function toFailureReason(e: any): string | null {
  const fromRequest = e?.errorMsg?.value ?? e?.errorMsg;
  const reason = fromRequest ?? e?.message ?? null;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

async function handleGetMigrationList() {
  if (!sourceSoftwareModelData.value) {
    console.warn('Source software model data is not available');
    return;
  }

  isLoading.value = true;
  loadErrorReason.value = null;

  try {
    const response = await recommendSoftwareModel.getSoftwareMigrationListData(
      sourceSoftwareModelData.value,
    );

    // check the response's status.code to determine whether it's an error
    const statusCode = response?.data?.status?.code;
    if (statusCode && statusCode >= 400) {
      throw new Error(
        response.data.status?.message ||
          `The server returned status ${statusCode}.`,
      );
    }

    // store the API response data in recommendedModelData
    recommendedModelData.value =
      recommendSoftwareModel.tableModel.tableState.items[0]?.originalData ||
      null;
  } catch (error) {
    // Let a failure look like a failure. This used to fall back to dummy recommendations, so a dead
    // cm-grasshopper still rendered a plausible-looking result and the breakage went unnoticed.
    //
    // Also show the reason — cm-grasshopper re-queries source groups and connections at run time, so
    // a source model referencing a connection that existed at collection time but was deleted afterward legitimately fails with "not found".
    // Without the reason at that point, the user has no way to know what was missing.
    console.error('Failed to load software migration list:', error);
    recommendedModelData.value = null;
    loadErrorReason.value = toFailureReason(error);
    showErrorMessage(
      'Failed to load the software migration recommendations.',
      loadErrorReason.value ?? 'The server did not say why.',
    );
  } finally {
    isLoading.value = false;
  }
}

function handleCloseModal() {
  emit('update:close-modal', false);
}

// Save button click handler
function handleSaveTargetModel() {
  if (!recommendedModelData.value) {
    console.warn('No migration recommendations data to save');
    return;
  }

  saveTargetModelModal.open = true;
}

// Save modal close handler
function handleCloseSaveModal() {
  saveTargetModelModal.open = false;
}

// perform the actual save
function handleCreateTargetModel(e) {
  saveTargetModelModal.context.name = e.name;
  saveTargetModelModal.context.description = e.description;

  // get the isInitUserModel value from the Source Software Model
  const isInitUserModel =
    sourceSoftwareModelData.value?.isInitUserModel ?? false;
  const userId = authStore.id; // use the logged-in user's ID
  const userModelVersion = sourceModel.value?.userModelVersion ?? 'v0.1';

  const requestBody = {
    description: e.description,
    isInitUserModel: isInitUserModel,
    targetSoftwareModel: recommendedModelData.value.targetSoftwareModel,
    userId: userId,
    userModelVersion: userModelVersion,
    userModelName: e.name,
  };

  resCreateTargetSoftwareModel
    .execute({
      request: requestBody,
    })
    .then(res => {
      showSuccessMessage(
        'success',
        'Successfully created software target model',
      );
      saveTargetModelModal.open = false;
      emit('update:close-modal', false);
    })
    .catch(e => {
      showErrorMessage('error', e.errorMsg);
    });
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      data-testid="sw-recommend-modal"
      title="Software Migration Recommendation"
      :need-widget-layout="true"
      :badge-title="sourceModelName"
      first-title="Software Model Analysis"
      @update:modal-state="handleCloseModal"
    >
      <template #add-info>
        <div class="json-viewer-layout">
          <!-- Left: Source Model JSON Viewer -->
          <p-pane-layout class="json-editor-pane">
            <p class="editor-title">Source Software Model</p>
            <div class="editor-wrapper">
              <EnhancedJsonEditor
                ref="sourceEditorRef"
                :model-value="sourceSoftwareModelString"
                :read-only="true"
                :mode="'tree'"
                :main-menu-bar="true"
                :navigation-bar="true"
                :status-bar="false"
                height="600px"
                file-name="source-software-model"
              />
            </div>
          </p-pane-layout>

          <!-- Center: Recommend Model button -->
          <button
            class="convert-btn"
            data-testid="sw-recommend-get"
            :disabled="!sourceSoftwareModelData || isLoading"
            @click="handleGetMigrationList"
          >
            <div class="flex flex-row">
              <p-i
                class="icon"
                name="ic_arrow-right"
                color="white"
                width="1rem"
                height="1rem"
              />
              <p>Get Migration List</p>
            </div>
            <p-spinner v-if="isLoading" class="spinner" size="md" />
          </button>

          <!-- Right: Recommended Model result JSON Viewer -->
          <p-pane-layout class="json-editor-pane">
            <p class="editor-title">Migration Recommendations</p>
            <!--
              On failure, leave the reason here instead of an empty viewer. This is where the user
              waits for the result, and the toast disappears after 5 seconds, leaving no "why it's empty".
            -->
            <div
              v-if="loadErrorReason"
              class="recommend-error"
              data-testid="sw-recommend-error"
            >
              <p class="recommend-error__title">
                Could not load the migration recommendations.
              </p>
              <p
                class="recommend-error__reason"
                data-testid="sw-recommend-error-reason"
              >
                {{ loadErrorReason }}
              </p>
              <p class="recommend-error__hint">
                The recommendations are built from the source group and
                connection this model was collected from. If either no longer
                exists, collect the source again and retry.
              </p>
            </div>
            <div v-else class="editor-wrapper">
              <EnhancedJsonEditor
                ref="recommendedEditorRef"
                :model-value="recommendedModelString"
                :read-only="true"
                :mode="'tree'"
                :main-menu-bar="true"
                :navigation-bar="true"
                :status-bar="false"
                height="600px"
                file-name="recommended-software-model"
              />
            </div>
          </p-pane-layout>
        </div>
      </template>

      <template #buttons>
        <p-button style-type="tertiary" @click="handleCloseModal">
          Cancel
        </p-button>
        <p-button
          data-testid="sw-recommend-save-target"
          :disabled="!recommendedModelData"
          @click="handleSaveTargetModel"
        >
          Save
        </p-button>
      </template>
    </create-form>

    <!-- Save Software Migration as Target Model modal -->
    <simple-edit-form
      v-if="saveTargetModelModal.open"
      header-title="Save Software Migration as Target Model"
      :name="saveTargetModelModal.context.name"
      :description="saveTargetModelModal.context.description"
      name-label="Name"
      name-placeholder="Target Model Name"
      @update:save-modal="handleCreateTargetModel"
      @update:close-modal="handleCloseSaveModal"
    />
  </div>
</template>

<style scoped lang="postcss">
.page-modal-layout {
  min-width: 1200px;
}

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
    background-color: #f7f7f7;
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

  /* failure reason — occupies the same spot as the result viewer so it isn't an "empty screen" */
  .recommend-error {
    background-color: white;
    padding: 1.25rem;
    width: 100%;
    min-width: 280px;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .recommend-error__title {
    color: #b93c3c;
    font-weight: 700;
    font-size: 0.875rem;
  }

  /* show the server's message as-is — don't truncate even if it's long or contains identifiers */
  .recommend-error__reason {
    color: #3b3b3b;
    font-size: 0.8125rem;
    line-height: 1.5;
    word-break: break-word;
    background-color: #fdf3f3;
    border-radius: 0.25rem;
    padding: 0.625rem 0.75rem;
  }

  .recommend-error__hint {
    color: #6b6e78;
    font-size: 0.75rem;
    line-height: 1.5;
  }
}

.convert-btn {
  @apply flex flex-col justify-center items-center rounded-[4px] text-[#fff] bg-violet-400;
  font-size: 14px;
  padding: 0 24px;
  position: relative;
  min-width: 80px;
  margin: 0 8px;
  border: none;
  cursor: pointer;

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

  .icon {
    @apply mt-[2px] mr-[0.25rem];
  }
}

.convert-btn:hover {
  @apply bg-violet-500;
}

.convert-btn:focus {
  @apply bg-violet-400;
}

.convert-btn:disabled {
  @apply bg-gray-300;
  cursor: not-allowed;
}
</style>
