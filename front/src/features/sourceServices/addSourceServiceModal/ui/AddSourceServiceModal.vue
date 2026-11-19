<script setup lang="ts">
import { i18n } from '@/app/i18n';
import { PButtonModal, PRadio, PRadioGroup } from '@cloudforet-test/mirinae';
import CspSourceGroupForm from '@/features/sourceServices/cspSourceGroupForm/ui/CspSourceGroupForm.vue';
import DataSourceGroupForm from '@/features/sourceServices/dataSourceGroupForm/ui/DataSourceGroupForm.vue';
import type {
  ICspSourceGroupRequest,
  SourceGroupTypeValue,
} from '@/entities/sourceService/model/types';
import { computed, reactive, ref, watchEffect } from 'vue';
import { UpdateSourceService } from '@/features/sourceServices';
import { useRegisterSourceGroup } from '@/entities/sourceService/api';
import { showSuccessMessage, showErrorMessage } from '@/shared/utils';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';
import { useSourceServiceStore } from '@/shared/libs';
import { storeToRefs } from 'pinia';

const sourceConnectionStore = useSourceConnectionStore();
const sourceServicesStore = useSourceServiceStore();

const { sourceServiceInfo } = storeToRefs(sourceServicesStore);

interface Props {
  trigger?: boolean;
  // Set by the menu the window is opened from; the type choice is then not shown.
  fixedType?: SourceGroupTypeValue;
}

const props = defineProps<Props>();

const emit = defineEmits([
  'update:isModalOpened',
  'update:is-connection-modal-opened',
  'update:trigger',
]);

const isDisabled = ref<boolean>(false);
// Don't allow registration while the imported file still has unresolved issues.
const isImportBlocked = ref<boolean>(false);

const registerSourceGroup = useRegisterSourceGroup<{ request: any }, any>(null);

const state = reactive({
  sourceServiceName: '',
  description: '',
});

// The group type is chosen here and fixes which connections the group takes (cm-honeybee
// 0.6.4): on-premise groups are reached over SSH; a CSP group is the customer's cloud account,
// read through its API with the credential entered here; fs, db and minio groups hold data
// sources of their own kind.
const sourceType = ref<SourceGroupTypeValue>(props.fixedType ?? 'onprem');
const cspRequest = ref<ICspSourceGroupRequest | null>(null);
const dataSourceRequest = ref<Record<string, any> | null>(null);
const isDataSourceType = computed(() =>
  ['fs', 'db', 'minio'].includes(sourceType.value),
);

const sourceTypeOptions = [
  { value: 'onprem', label: 'On-premise (SSH)' },
  { value: 'csp', label: 'Cloud (CSP account)' },
  { value: 'fs', label: 'File system' },
  { value: 'db', label: 'DBMS' },
  { value: 'minio', label: 'MinIO' },
];

watchEffect(() => {
  if (sourceType.value === 'csp') {
    isDisabled.value = !!cspRequest.value;
    return;
  }
  if (isDataSourceType.value) {
    isDisabled.value = !!dataSourceRequest.value;
    return;
  }
  isDisabled.value =
    !!state.sourceServiceName &&
    state.sourceServiceName.length > 0 &&
    !isImportBlocked.value;
});

const handleCspRequest = (value: ICspSourceGroupRequest | null) => {
  cspRequest.value = value;
};

const registerCspGroup = async () => {
  const request = isDataSourceType.value
    ? dataSourceRequest.value
    : cspRequest.value;
  if (!request) return;
  try {
    const { data } = await registerSourceGroup.execute({
      request,
    });
    if (data.status && data.status.code === 200) {
      showSuccessMessage('success', 'Register Success');
      emit('update:trigger');
      emit('update:isModalOpened', false);
    }
  } catch (error) {
    showErrorMessage(
      'failed',
      (error as any).errorMsg?.value || 'Service Registering Failed',
    );
  }
};

const handleImportBlocked = (blocked: boolean) => {
  isImportBlocked.value = blocked;
};

const handleSourceServiceInfo = (value: any) => {
  state.sourceServiceName = value.sourceServiceName;
  state.description = value.description;
};

// Only prompt again when the toggle is on to add connections but none were actually added.
// If the toggle is off, the intent to register just the group is already clear.
const isConfirmNoConnectionOpen = ref<boolean>(false);

const handleConfirm = async () => {
  if (sourceType.value === 'csp' || isDataSourceType.value) {
    await registerCspGroup();
    return;
  }
  if (
    sourceConnectionStore.withSourceConnection &&
    sourceConnectionStore.editConnections.length === 0
  ) {
    isConfirmNoConnectionOpen.value = true;
    return;
  }
  await registerGroup();
};

const handleConfirmNoConnection = async () => {
  isConfirmNoConnectionOpen.value = false;
  await registerGroup();
};

const registerGroup = async () => {
  console.log(
    '[AddSourceServiceModal] handleConfirm - BEFORE map, editConnections:',
    JSON.stringify(sourceConnectionStore.editConnections, null, 2),
  );

  sourceConnectionStore.editConnections.map(sourceConnection => {
    sourceConnection.ssh_port = String(sourceConnection.ssh_port);
  });

  const requestData = {
    name: state.sourceServiceName,
    description: state.description,
    connection_info: sourceConnectionStore.editConnections,
  };

  console.log(
    '[AddSourceServiceModal] handleConfirm - requestData:',
    JSON.stringify(requestData, null, 2),
  );

  try {
    const { data } = await registerSourceGroup.execute({
      request: requestData,
    });

    if (data.status && data.status.code === 200) {
      showSuccessMessage('success', 'Register Success');

      sourceServiceInfo.value = {
        name: '',
        description: '',
      };
      sourceConnectionStore.editConnections = [];
      sourceConnectionStore.withSourceConnection = false;

      emit('update:trigger');
      emit('update:isModalOpened', false);
    }
  } catch (error) {
    if (
      (error as any).errorMsg?.value ===
      'constraint failed: UNIQUE constraint failed: source_groups.name (2067)'
    ) {
      showErrorMessage('failed', 'Service Name Already Exists');
    } else {
      showErrorMessage(
        'failed',
        (error as any).errorMsg?.value || 'Service Registering Failed',
      );
    }
  }
};

const handleCancel = () => {
  sourceServiceInfo.value = {
    name: '',
    description: '',
  };
  sourceConnectionStore.editConnections = [];
  emit('update:isModalOpened', false);
  sourceConnectionStore.withSourceConnection = false;
};

const handleConnectionModal = (value: boolean) => {
  emit('update:is-connection-modal-opened', value);
};
</script>

<template>
  <div>
    <p-button-modal
      :visible="true"
      header-title="Add Source Service"
      size="md"
      :disabled="!isDisabled"
      :loading="registerSourceGroup.isLoading.value"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @close="handleCancel"
    >
      <template #body>
        <div
          v-if="!fixedType"
          class="source-type"
          data-testid="source-service-type"
        >
          <span class="source-type-label">Source Type</span>
          <p-radio-group>
            <p-radio
              v-for="option in sourceTypeOptions"
              :key="option.value"
              v-model="sourceType"
              :value="option.value"
              :data-testid="`source-service-type-${option.value}`"
            >
              <span>{{ option.label }}</span>
            </p-radio>
          </p-radio-group>
        </div>
        <csp-source-group-form
          v-if="sourceType === 'csp'"
          @update:value="handleCspRequest"
        />
        <data-source-group-form
          v-else-if="isDataSourceType"
          :group-type="sourceType"
          @update:value="v => (dataSourceRequest = v)"
        />
        <update-source-service
          v-else
          :is-edit="false"
          @update:import-blocked="handleImportBlocked"
          :loading="registerSourceGroup.isLoading.value"
          @update:is-connection-modal-opened="handleConnectionModal"
          @update:source-servie-info="handleSourceServiceInfo"
        />
      </template>
      <template #close-button>
        <span>{{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}</span>
      </template>
      <template #confirm-button>
        <span data-testid="source-service-confirm">{{
          i18n.t('COMPONENT.BUTTON_MODAL.ADD')
        }}</span>
      </template>
    </p-button-modal>

    <!-- Only shown when the toggle is on to add connections but none were added. -->
    <p-button-modal
      v-if="isConfirmNoConnectionOpen"
      :visible="isConfirmNoConnectionOpen"
      size="sm"
      backdrop
      header-title="Register the source service without any connection?"
      :hide-body="true"
      :hide-header-close-button="true"
      data-testid="source-service-no-connection-confirm"
      @confirm="handleConfirmNoConnection"
      @cancel="isConfirmNoConnectionOpen = false"
      @close="isConfirmNoConnectionOpen = false"
    />
  </div>
</template>

<style scoped lang="postcss">
.source-type {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1rem 0;
}
.source-type-label {
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
