<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
import { CreateForm, SimpleEditForm } from '@/widgets/layout';
import { i18n } from '@/app/i18n';
import { computed, reactive, ref, watch } from 'vue';
import type { IObjectStorageModel } from '@/entities/objectStorage/model/types';
import {
  createObjectStorageModel,
  describeModelError,
  modelStageOf,
  planningLineageFrom,
  siblingTargetLineageOf,
} from '@/entities/migrationModel';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useAuth } from '@/features/auth/model/useAuth.ts';

/**
 * Views an object storage model as JSON and saves an edited copy, never over the original:
 * - a source model is the read-only record of what was collected, so its edit becomes a
 *   planning model derived from it, and a planning model's edit another planning model under
 *   the same source (planningLineageFrom);
 * - a target model's edit becomes another target model under the same planning model
 *   (siblingTargetLineageOf).
 * The same rules as the infra models; cm-damselfly derives the upstream lineage from the parent.
 */
interface IProps {
  model: IObjectStorageModel;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal', 'update:trigger']);

const auth = useAuth();
const code = ref('');
const saveForm = reactive({ open: false });

const stage = computed(() => {
  try {
    return modelStageOf(props.model);
  } catch {
    return null;
  }
});
const isTarget = computed(() => stage.value === 'target');

const title = computed(() => {
  if (stage.value === 'target')
    return 'Custom & View Target Model - Object Storage';
  if (stage.value === 'planning')
    return 'Custom & View Planning Model - Object Storage';
  return 'View & Save as Planning Model - Object Storage';
});
const saveTitle = computed(() =>
  isTarget.value ? 'Save as a new Target model' : 'Save as a new Planning model',
);

watch(
  () => props.model,
  model => {
    const body = isTarget.value
      ? model?.targetObjectStorageModel
      : model?.sourceObjectStorageModel;
    code.value = body ? JSON.stringify(body, null, 2) : '';
  },
  { immediate: true },
);

function close() {
  emit('update:close-modal', false);
}

function parsedBody(): Record<string, any> | null {
  try {
    return JSON.parse(code.value);
  } catch (e: any) {
    showErrorMessage('error', `The JSON is not valid: ${e.message}`);
    return null;
  }
}

function openSave() {
  if (parsedBody()) saveForm.open = true;
}

async function handleSave(e: { name: string; description: string }) {
  const body = parsedBody();
  if (!body) return;
  let lineageReq;
  try {
    lineageReq = isTarget.value
      ? siblingTargetLineageOf(props.model)
      : planningLineageFrom(props.model);
  } catch (err: any) {
    showErrorMessage('error', err.message);
    return;
  }
  const request: Record<string, any> = {
    userModelName: e.name,
    description: e.description,
    userId: auth.getUser().id,
    userModelVersion: props.model.userModelVersion || 'v0.1',
    isInitUserModel: false,
    ...lineageReq,
  };
  if (isTarget.value) request.targetObjectStorageModel = body;
  else request.sourceObjectStorageModel = body;
  try {
    await createObjectStorageModel(
      isTarget.value ? 'target' : 'planning',
      request,
    );
    showSuccessMessage(
      'success',
      isTarget.value
        ? 'Successfully created target model'
        : 'Successfully created planning model',
    );
    saveForm.open = false;
    emit('update:trigger');
    close();
  } catch (err) {
    showErrorMessage('error', describeModelError(err).message);
  }
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      :badge-title="model.userModelName"
      :need-widget-layout="true"
      :title="title"
      first-title="JSON Viewer"
      @update:modal-state="close"
    >
      <template #add-info>
        <div class="editor" data-testid="os-custom-view-editor">
          <EnhancedJsonEditor
            :model-value="code"
            :read-only="false"
            :mode="'tree'"
            :main-menu-bar="true"
            :navigation-bar="true"
            :status-bar="true"
            height="600px"
            file-name="object-storage-model"
            @update:modelValue="v => (code = v)"
          />
        </div>
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          data-testid="os-custom-view-cancel"
          @click="close"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button data-testid="create-form-save" @click="openSave">
          {{ i18n.t('COMPONENT.BUTTON_MODAL.SAVE') }}
        </p-button>
      </template>
    </create-form>
    <simple-edit-form
      v-if="saveForm.open"
      :header-title="saveTitle"
      name=""
      name-label="Model Name"
      name-placeholder="Model Name"
      @update:save-modal="handleSave"
      @update:close-modal="saveForm.open = false"
    />
  </div>
</template>

<style scoped lang="postcss">
.editor {
  width: 100%;
  min-height: 500px;
  padding: 0.5rem;
}
</style>
