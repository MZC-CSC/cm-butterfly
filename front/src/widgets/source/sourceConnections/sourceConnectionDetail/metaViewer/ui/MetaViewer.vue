<script setup lang="ts">
import CreateForm from '@/widgets/layout/createForm/ui/CreateForm.vue';
import { PButton } from '@cloudforet-test/mirinae';
import { i18n } from '@/app/i18n';
import { SimpleEditForm } from '@/widgets/layout';
import { ref, computed } from 'vue';
import { AxiosResponse } from 'axios';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import {
  describeModelError,
  saveCollectedModels,
} from '@/entities/migrationModel';
import JsonViewer from '@/features/sourceServices/jsonViewer/ui/JsonViewer.vue';
import {
  useGetInfraInfoRefined,
  useGetSoftwareInfoRefined,
} from '@/entities/sourceConnection/api';
import { useAuth } from '@/features/auth/model/useAuth.ts';

interface iProps {
  collectData: string | undefined;
  sourceConnectionName: string;
  sgId: string;
  connId: string;
  dataType?: 'infra' | 'software';
}

const props = defineProps<iProps>();

const emit = defineEmits(['update:is-meta-viewer-opened']);

const isConverted = ref<boolean>(false);
const isSaveModal = ref<boolean>(false);

const convertedData = ref();
// The model as the conversion returned it, kept apart from the editable copy above: it is
// saved as the source model, while the shown (possibly edited) model becomes the planning model.
const originalData = ref<any>(null);

const auth = useAuth();
const getInfraInfoRefined = useGetInfraInfoRefined(props.sgId, props.connId);
const getSoftwareInfoRefined = useGetSoftwareInfoRefined(
  props.sgId,
  props.connId,
);

// pick the appropriate conversion function based on the data type
const getConvertFunction = computed(() => {
  // pick the conversion function based on the dataType prop
  if (props.dataType === 'software') {
    return handleConvertSoftware();
  }

  // use the Infra conversion function by default
  return handleConvertInfra();
});

// dynamically build the title based on dataType
const modalTitle = computed(() => {
  const baseTitle = 'Source Connection Viewer';
  if (props.dataType === 'software') {
    return `${baseTitle} - Software`;
  } else if (props.dataType === 'infra') {
    return `${baseTitle} - Infra`;
  }
  return baseTitle;
});

const handleSave = () => {
  isSaveModal.value = true;
};

const handleMetaViewer = e => {
  isSaveModal.value = false;
  const category = props.dataType === 'software' ? 'software' : 'infra';
  saveCollectedModels({
    category,
    // The collected source group is where the migration lineage starts.
    sourceGroupId: props.sgId,
    userId: auth.getUser().id,
    name: e.name,
    description: e.description,
    original: originalData.value ?? convertedData.value,
    edited: convertedData.value,
  })
    .then(({ derived }) => {
      if (category === 'infra') {
        showSuccessMessage(
          'success',
          `Saved the collected source model and the planning model "${e.name}"`,
        );
      } else {
        showSuccessMessage(
          'success',
          derived
            ? `Saved the collected source model and the edited model "${e.name}"`
            : `Saved the source model "${e.name}"`,
        );
      }
    })
    .catch(err => {
      showErrorMessage('error', describeModelError(err).message);
    });

  emit('update:is-meta-viewer-opened');
};

function handleConvertInfra(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () =>
    getInfraInfoRefined.execute().then(res => {
      isConverted.value = true;
      convertedData.value = res.data.responseData;
      originalData.value = JSON.parse(
        JSON.stringify(res.data.responseData ?? null),
      );
      return res;
    });
}

function handleConvertSoftware(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () =>
    getSoftwareInfoRefined.execute().then(res => {
      isConverted.value = true;
      console.log('MetaViewer Software API Response:', res.data.responseData);
      convertedData.value = res.data.responseData;
      originalData.value = JSON.parse(
        JSON.stringify(res.data.responseData ?? null),
      );
      return res;
    });
}
</script>

<template>
  <div class="page-modal-layout">
    <create-form
      :title="modalTitle"
      :badge-title="sourceConnectionName"
      :need-widget-layout="true"
      @update:modal-state="emit('update:is-meta-viewer-opened', false)"
    >
      <template #add-info>
        <json-viewer
          :form-data="collectData"
          :convertedJSON="convertedData"
          :promiseFunc="getConvertFunction"
          :loading="
            getInfraInfoRefined.isLoading.value ||
            getSoftwareInfoRefined.isLoading.value
          "
        />
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          @click="emit('update:is-meta-viewer-opened')"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button :disabled="!isConverted" @click="handleSave">
          {{ i18n.t('COMPONENT.BUTTON_MODAL.SAVE') }}
        </p-button>
      </template>
    </create-form>
    <simple-edit-form
      v-if="isSaveModal"
      name=""
      header-title="Save Source Model2"
      name-label="Name"
      name-placeholder="Source Service name"
      @update:close-modal="isSaveModal = false"
      @update:save-modal="e => handleMetaViewer(e)"
    />
    <!-- <save-source-model-modal
      v-if="isSaveModal"
      header-title="Save Source Model"
      name-label="Source Service name"
      @update:save-modal="handleMetaViewer"
    /> -->
  </div>
</template>
