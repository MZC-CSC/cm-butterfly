<script setup lang="ts">
import CreateForm from '@/widgets/layout/createForm/ui/CreateForm.vue';
import { PButton } from '@cloudforet-test/mirinae';
import { i18n } from '@/app/i18n';
import { SimpleEditForm } from '@/widgets/layout';
import { ref, computed } from 'vue';
import { AxiosResponse } from 'axios';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useCreateOnpremmodel, useCreateSourceSoftwareModel } from '@/entities';
import JsonViewer from '@/features/sourceServices/jsonViewer/ui/JsonViewer.vue';
import { useGetSoftwareInfoRefined, useGetSoftwareInfoSourceGroupRefined, useGetInfraInfoSourceGroupRefined } from '@/entities/sourceConnection/api';
import { useGetInfraSourceGroupInfraRefine } from '@/entities/sourceService/api';
import { useAuth } from '@/features/auth/model/useAuth.ts';

interface iProps {
  collectData: any;
  sgId: string;
  dataType?: 'infra' | 'software';
  dataSource?: 'sourceGroup' | 'connection'; // distinguishes the origin of the Software data
}

const props = defineProps<iProps>();

const emit = defineEmits(['update:is-meta-viewer-opened']);

const isConverted = ref<boolean>(false);
const isSaveModal = ref<boolean>(false);

const convertedData = ref<any>(null);

// Prefer the dataType prop, and only fall back to inferring from collectData when it is absent
const isSoftwareData = computed(() => {
  // Prefer the dataType prop when it is explicitly passed
  if (props.dataType === 'software') {
    console.log('Software detected by dataType prop');
    return true;
  }
  if (props.dataType === 'infra') {
    console.log('Infra detected by dataType prop');
    return false;
  }
  
  // When dataType is absent, infer from the content of collectData
  console.log('collectData:', props.collectData);
  console.log('collectData type:', typeof props.collectData);
  
  if (!props.collectData) return false;
  
  // Various ways to check whether this is Software data
  if (typeof props.collectData === 'object') {
    // 1. Check whether software-related keys exist
    if (props.collectData.software || props.collectData.installedPackages) {
      console.log('Software detected by software/installedPackages keys');
      return true;
    }
    
    // 2. When collectData is a string and can be parsed as JSON
    if (typeof props.collectData === 'string') {
      try {
        const parsed = JSON.parse(props.collectData);
        if (parsed.software || parsed.installedPackages) {
          console.log('Software detected by parsed JSON');
          return true;
        }
      } catch (e) {
        // Ignore on JSON parse failure
      }
    }
    
    // 3. Inspect the keys of collectData for any software-related key
    const keys = Object.keys(props.collectData);
    console.log('collectData keys:', keys);
    
    // Check software-related keys more broadly
    const softwareKeywords = ['software', 'installedPackages', 'packages', 'applications', 'programs', 'sw'];
    const hasSoftwareKeywords = keys.some(key => 
      softwareKeywords.some(keyword => key.toLowerCase().includes(keyword))
    );
    
    if (hasSoftwareKeywords) {
      console.log('Software detected by keyword matching');
      return true;
    }
  }
  
  console.log('Infra detected (default)');
  return false;
});

// Pick the appropriate conversion function based on the data type
const getConvertFunction = computed(() => {
  if (isSoftwareData.value) {
    // Call a different API depending on the origin of the Software data
    if (props.dataSource === 'sourceGroup') {
      return handleConvertSoftwareSourceGroup();
    } else {
      // connection or default (treated as connection when dataSource is absent)
      return handleConvertSoftware();
    }
  }
  // Call a different API depending on the origin of the Infra data
  if (props.dataSource === 'sourceGroup') {
    return handleConvertInfraSourceGroup();
  }
  // connection or default (treated as connection when dataSource is absent)
  return handleConvertInfra();
});

// Build the title dynamically based on the data type
const modalTitle = computed(() => {
  const baseTitle = 'Source Group Connection Viewer';
  if (isSoftwareData.value) {
    return `${baseTitle} - Software`;
  } else {
    return `${baseTitle} - Infra`;
  }
});

const auth = useAuth();
const createOnpremmodel = useCreateOnpremmodel(null);
const createSourceSoftwareModel = useCreateSourceSoftwareModel(null);
const getInfraInfoRefined = useGetInfraSourceGroupInfraRefine(props.sgId);
const getInfraInfoSourceGroupRefined = useGetInfraInfoSourceGroupRefined(props.sgId);
const getSoftwareInfoRefined = useGetSoftwareInfoRefined(props.sgId, null);
const getSoftwareInfoSourceGroupRefined = useGetSoftwareInfoSourceGroupRefined(props.sgId);
const handleSave = () => {
  isSaveModal.value = true;
};

const handleMetaViewer = e => {
  isSaveModal.value = false;
  console.log('isSoftwareData', isSoftwareData.value);
  if (isSoftwareData.value) {
    // For the Software type, call CreateSourceSoftwareModel
    console.log('Creating Source Software Model with data:', convertedData.value);
    
    // Extract the sourceSoftwareModel property from the API response
    const sourceSoftwareModelData = convertedData.value?.sourceSoftwareModel || convertedData.value;
    console.log('Extracted sourceSoftwareModel data:', sourceSoftwareModelData);
    
    createSourceSoftwareModel
      .execute({
        request: {
          description: e.description,
          isInitUserModel: true,
          sourceSoftwareModel: sourceSoftwareModelData,
          userId: auth.getUser().id,
          userModelName: e.name,
          userModelVersion: 'v0.1',
        },
      })
      .then(res => {
        showSuccessMessage('success', 'create Software Model');
      })
      .catch(e => {
        showErrorMessage('error', e.errorMsg);
      });
  } else {
    // For the Infra type, call the existing CreateOnpremmodel
    createOnpremmodel
      .execute({
        request: {
          ...convertedData.value,
          description: e.description,
          userModelName: e.name,
          isInitUserModel: true,
          userModelVersion: 'v0.1',
        },
      })
      .then(res => {
        showSuccessMessage('success', 'create Model');
      })
      .catch(e => {
        showErrorMessage('error', e.errorMsg);
      });
  }
  
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
      return res;
    });
}

function handleConvertInfraSourceGroup(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () =>
    getInfraInfoSourceGroupRefined.execute().then(res => {
      isConverted.value = true;
      console.log('Infra Source Group API Response:', res.data.responseData);
      convertedData.value = res.data.responseData;
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
      console.log('Software API Response:', res.data.responseData);
      convertedData.value = res.data.responseData;
      return res;
    });
}

function handleConvertSoftwareSourceGroup(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () =>
    getSoftwareInfoSourceGroupRefined.execute().then(res => {
      isConverted.value = true;
      console.log('Software Source Group API Response:', res.data.responseData);
      convertedData.value = res.data.responseData;
      return res;
    });
}
</script>

<template>
  <div class="page-modal-layout">
    <create-form
      :title="modalTitle"
      :need-widget-layout="true"
      @update:modal-state="emit('update:is-meta-viewer-opened', false)"
    >
      <template #add-info>
        <json-viewer
          :form-data="collectData"
          :convertedJSON="convertedData"
          :promiseFunc="getConvertFunction"
          :loading="getInfraInfoRefined.isLoading.value || getInfraInfoSourceGroupRefined.isLoading.value || getSoftwareInfoRefined.isLoading.value || getSoftwareInfoSourceGroupRefined.isLoading.value"
          @update:convertedJSON="convertedData = $event"
        />
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          @click="emit('update:is-meta-viewer-opened')"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button data-testid="source-refine-save" :disabled="!isConverted" @click="handleSave">
          {{ i18n.t('COMPONENT.BUTTON_MODAL.SAVE') }}
        </p-button>
      </template>
    </create-form>
    <simple-edit-form
      v-if="isSaveModal"
      name=""
      header-title="Save Source Model"
      name-label="Name"
      name-placeholder="Source Service name"
      @update:close-modal="isSaveModal = false"
      @update:save-modal="e => handleMetaViewer(e)"
    />
  </div>
</template>
