<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
import { CreateForm } from '@/widgets/layout';
import { i18n } from '@/app/i18n';
import { SimpleEditForm } from '@/widgets/layout';
import { reactive, ref, watch, computed } from 'vue';
import { ISourceModelResponse, useSourceModelStore } from '@/entities';
import {
  createInfraModel,
  createSoftwareModel,
  describeModelError,
  modelCategoryOf,
  modelStageOf,
  planningLineageFrom,
} from '@/entities/migrationModel';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useAuth } from '@/features/auth/model/useAuth.ts';

interface iProps {
  sourceModelName: string;
  sourceModelId: string;
}

const props = defineProps<iProps>();
const emit = defineEmits(['update:close-modal', 'update:trigger']);

const modalState = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

const auth = useAuth();
const sourceModelStore = useSourceModelStore();
const targetModel = ref<ISourceModelResponse | undefined>(undefined);
const serverCode = ref<string>('');

// cm-damselfly's modelType decides the category; the model name or migrationType is not used.
const isSoftwareModel = computed(() => {
  if (!targetModel.value) return false;
  try {
    return modelCategoryOf(targetModel.value) === 'software';
  } catch {
    return false;
  }
});

const isPlanningModel = computed(() => {
  if (!targetModel.value) return false;
  try {
    return modelStageOf(targetModel.value) === 'planning';
  } catch {
    return false;
  }
});

// A source model is read-only: what is edited here is always saved as a new model, never over it.
const modalTitle = computed(() => {
  const kind = isSoftwareModel.value ? 'Software' : 'Infra';
  return isPlanningModel.value
    ? `Custom & View Planning Model - ${kind}`
    : `Custom & View Source Model - ${kind}`;
});

const saveFormTitle = computed(() =>
  isSoftwareModel.value
    ? 'Save new custom Source model'
    : 'Save as a new Planning model',
);

watch(
  () => props.sourceModelId,
  () => {
    targetModel.value = sourceModelStore.getSourceModelById(
      props.sourceModelId,
    );

    // Log output for debugging
    console.log('=== CustomViewSourceModel Debug Info ===');
    console.log('targetModel.value:', targetModel.value);
    console.log(
      'isSoftwareModel (from targetModel):',
      targetModel.value?.isSoftwareModel,
    );
    console.log('migrationType:', targetModel.value?.migrationType);
    console.log('computed isSoftwareModel:', isSoftwareModel.value);
    console.log('onpremiseInfraModel:', targetModel.value?.onpremiseInfraModel);
    console.log('sourceSoftwareModel:', targetModel.value?.sourceSoftwareModel);
    console.log(
      'connection_info_list:',
      targetModel.value?.connection_info_list,
    );
    console.log(
      'connection_info_list type:',
      typeof targetModel.value?.connection_info_list,
    );
    console.log(
      'connection_info_list length:',
      targetModel.value?.connection_info_list?.length,
    );
    console.log('=====================================');

    // Handle the data differently depending on migrationType
    if (isSoftwareModel.value) {
      // For a Software model
      if (targetModel.value?.sourceSoftwareModel) {
        try {
          serverCode.value = JSON.stringify(
            targetModel.value.sourceSoftwareModel,
            null,
            2,
          );
        } catch (error) {
          console.error('Failed to stringify software data:', error);
          serverCode.value = '';
        }
      } else {
        serverCode.value = '';
        console.warn('Source software model data is not available');
      }
    } else {
      // For an Infra model (existing logic)
      const nodes = targetModel.value?.onpremiseInfraModel?.nodes;
      if (nodes) {
        try {
          serverCode.value = JSON.stringify(nodes, null, 2);
        } catch (error) {
          console.error('Failed to stringify nodes data:', error);
          serverCode.value = '';
        }
      } else {
        serverCode.value = '';
        console.warn('Source model or onpremiseInfraModel is not available');
      }
    }
  },
  { immediate: true },
);

function handleModal() {
  emit('update:close-modal', false);
}

function handleSave() {
  modalState.open = true;
}

function handleSaveModal(e) {
  modalState.context.name = e.name;
  modalState.context.description = e.description;

  if (isSoftwareModel.value) {
    // Save the Software model
    const softwareRequestBody = {
      description: e.description,
      isInitUserModel: false,
      sourceSoftwareModel: JSON.parse(serverCode.value),
      userId: auth.getUser().id,
      userModelName: e.name,
      userModelVersion: targetModel.value?.userModelVersion || 'v0.1',
    };

    console.log('Software request body:', softwareRequestBody);

    // cm-damselfly takes a software planning model in the *target* structure (targetSoftwareModel),
    // so an edited source software model cannot become one. Until that flow is settled it stays a
    // source model that keeps the source group of the original.
    const sourceGroupId = targetModel.value?.lineage?.sourceGroupId;
    createSoftwareModel('source', {
      ...softwareRequestBody,
      ...(sourceGroupId ? { lineage: { sourceGroupId } } : {}),
    })
      .then(() => {
        showSuccessMessage(
          'success',
          'Successfully created software source model',
        );
        emit('update:close-modal', false);
        emit('update:trigger');
        modalState.open = false;
      })
      .catch(err => {
        showErrorMessage('error', describeModelError(err).message);
      });
  } else {
    // Save the Infra model (existing logic)
    if (!targetModel.value?.onpremiseInfraModel) {
      showErrorMessage('error', 'Infra model data is not available');
      return;
    }

    const infraRequestBody = {
      description: e.description,
      userModelName: e.name,
      isInitUserModel: false,
      userModelVersion: targetModel.value?.userModelVersion || 'v0.1',
      // Only the nodes are edited here. Everything else is carried over as stored: rebuilding it
      // (e.g. defaulting the network lists to []) breaks once the model shape moves on - imdl
      // v0.1.20 takes ipv4Networks/ipv6Networks as objects and rejects arrays.
      onpremiseInfraModel: {
        ...targetModel.value.onpremiseInfraModel,
        nodes: JSON.parse(serverCode.value),
      },
    };

    console.log('Infra request body:', infraRequestBody);

    // An edited source model is saved as a planning model derived from it (source -> planning).
    // Editing a planning model again gives another planning model under the same source.
    let lineageReq;
    try {
      lineageReq = planningLineageFrom(targetModel.value);
    } catch (err: any) {
      showErrorMessage('error', err.message);
      return;
    }
    createInfraModel('onprem', 'planning', {
      ...infraRequestBody,
      ...lineageReq,
      userId: auth.getUser().id,
    })
      .then(() => {
        showSuccessMessage('success', 'Successfully created planning model');
        emit('update:close-modal', false);
        emit('update:trigger');
        modalState.open = false;
      })
      .catch(err => {
        showErrorMessage('error', describeModelError(err).message);
      });
  }
}

function handleCodeUpdate(value: string) {
  serverCode.value = value;
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      :badge-title="sourceModelName"
      :need-widget-layout="true"
      :title="modalTitle"
      first-title="JSON Viewer"
      @update:modal-state="handleModal"
    >
      <template #add-info>
        <div class="enhanced-editor-wrapper">
          <EnhancedJsonEditor
            :model-value="serverCode"
            :read-only="false"
            :mode="'tree'"
            :main-menu-bar="true"
            :navigation-bar="true"
            :status-bar="true"
            height="600px"
            file-name="source-model"
            @update:modelValue="handleCodeUpdate"
          />
        </div>
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          data-testid="source-custom-cancel"
          @click="handleModal"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button data-testid="create-form-save" @click="handleSave">
          {{ i18n.t('COMPONENT.BUTTON_MODAL.SAVE') }}
        </p-button>
      </template>
    </create-form>
    <simple-edit-form
      v-if="modalState.open"
      :header-title="saveFormTitle"
      name=""
      name-label="Model Name"
      name-placeholder="Model Name"
      @update:save-modal="handleSaveModal"
      @update:close-modal="modalState.open = false"
    />
  </div>
</template>

<style scoped lang="postcss">
.enhanced-editor-wrapper {
  width: 100%;
  min-height: 500px;
  padding: 0.5rem;
}
</style>
