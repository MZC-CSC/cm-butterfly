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
  useGetSoftwareInfoRefined,
  useGetSoftwareInfoSourceGroupRefined,
  useGetInfraInfoSourceGroupRefined,
} from '@/entities/sourceConnection/api';
import { useGetInfraSourceGroupInfraRefine } from '@/entities/sourceService/api';
import { useAuth } from '@/features/auth/model/useAuth.ts';
import { getGroupRefinedBuckets } from '@/entities/objectStorage/api';

interface iProps {
  collectData: any;
  sgId: string;
  dataType?: 'infra' | 'software' | 'objectStorage';
  dataSource?: 'sourceGroup' | 'connection'; // distinguishes the origin of the Software data
}

const props = defineProps<iProps>();

const emit = defineEmits(['update:is-meta-viewer-opened']);

const isConverted = ref<boolean>(false);
const isSaveModal = ref<boolean>(false);

const convertedData = ref<any>(null);
// The model as the conversion returned it, kept apart from the editable copy above: it is
// saved as the source model, while the shown (possibly edited) model becomes the planning model.
const originalData = ref<any>(null);

// Prefer the dataType prop, and only fall back to inferring from collectData when it is absent
const isSoftwareData = computed(() => {
  // Prefer the dataType prop when it is explicitly passed
  if (props.dataType === 'software') {
    console.log('Software detected by dataType prop');
    return true;
  }
  if (props.dataType === 'infra' || props.dataType === 'objectStorage') {
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
    const softwareKeywords = [
      'software',
      'installedPackages',
      'packages',
      'applications',
      'programs',
      'sw',
    ];
    const hasSoftwareKeywords = keys.some(key =>
      softwareKeywords.some(keyword => key.toLowerCase().includes(keyword)),
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
  if (props.dataType === 'objectStorage') {
    return handleConvertObjectStorage();
  }
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
  if (props.dataType === 'objectStorage') {
    return `${baseTitle} - Object Storage`;
  }
  if (isSoftwareData.value) {
    return `${baseTitle} - Software`;
  } else {
    return `${baseTitle} - Infra`;
  }
});

const auth = useAuth();
const getInfraInfoRefined = useGetInfraSourceGroupInfraRefine(props.sgId);
const getInfraInfoSourceGroupRefined = useGetInfraInfoSourceGroupRefined(
  props.sgId,
);
const getSoftwareInfoRefined = useGetSoftwareInfoRefined(props.sgId, null);
const getSoftwareInfoSourceGroupRefined = useGetSoftwareInfoSourceGroupRefined(
  props.sgId,
);
const handleSave = () => {
  isSaveModal.value = true;
};

// Saving makes two models one after the other (the source model, then the planning model that
// names it as its parent), so the viewer stays open until both are stored. Closing it at once let
// a following navigation drop the second request and leave the source model alone.
const isSaving = ref(false);

const handleMetaViewer = async e => {
  isSaveModal.value = false;
  isSaving.value = true;
  const category =
    props.dataType === 'objectStorage'
      ? 'objectStorage'
      : isSoftwareData.value
        ? 'software'
        : 'infra';
  await saveCollectedModels({
    category,
    // The collected source group is where the migration lineage starts.
    sourceGroupId: props.sgId,
    userId: auth.getUser().id,
    name: e.name,
    description: e.description,
    original: originalData.value ?? convertedData.value,
    edited: convertedData.value,
  })
    .then(() => {
      emit('update:is-meta-viewer-opened');
      showSuccessMessage(
        'success',
        `Saved the collected source model and the planning model "${e.name}"`,
      );
    })
    .catch(err => {
      showErrorMessage('error', describeModelError(err).message);
    })
    .finally(() => {
      isSaving.value = false;
    });
};

// Every collected bucket of the group, in the shape of the source model.
const isConvertingObjectStorage = ref(false);
function handleConvertObjectStorage(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () => {
    isConvertingObjectStorage.value = true;
    return getGroupRefinedBuckets(props.sgId)
      .then(res => {
        isConverted.value = true;
        convertedData.value = res.data.responseData;
        originalData.value = JSON.parse(
          JSON.stringify(res.data.responseData ?? null),
        );
        return res;
      })
      .finally(() => {
        isConvertingObjectStorage.value = false;
      });
  };
}

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

function handleConvertInfraSourceGroup(): (
  payload?: any,
  config?: any,
) => Promise<AxiosResponse<any> | void> {
  return () =>
    getInfraInfoSourceGroupRefined.execute().then(res => {
      isConverted.value = true;
      console.log('Infra Source Group API Response:', res.data.responseData);
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
      console.log('Software API Response:', res.data.responseData);
      convertedData.value = res.data.responseData;
      originalData.value = JSON.parse(
        JSON.stringify(res.data.responseData ?? null),
      );
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
            getInfraInfoSourceGroupRefined.isLoading.value ||
            getSoftwareInfoRefined.isLoading.value ||
            getSoftwareInfoSourceGroupRefined.isLoading.value ||
            isConvertingObjectStorage
          "
          @update:convertedJSON="convertedData = $event"
        />
      </template>
      <template #buttons>
        <p-button
          data-testid="source-refine-cancel"
          style-type="tertiary"
          @click="emit('update:is-meta-viewer-opened')"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button
          data-testid="source-refine-save"
          :disabled="!isConverted || isSaving"
          :loading="isSaving"
          @click="handleSave"
        >
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
