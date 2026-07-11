<script setup lang="ts">
import {
  PPaneLayout,
  PFieldGroup,
  PTextInput,
  PToggleButton,
  PDivider,
  PButton,
  PTextarea,
} from '@cloudforet-test/mirinae';
import { watchEffect, ref, reactive, computed, watch } from 'vue';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';
import { useSourceServiceStore } from '@/shared/libs';
import { storeToRefs } from 'pinia';
import { showErrorMessage } from '@/shared/utils';

const sourceConnectionStore = useSourceConnectionStore();
const sourceServiceStore = useSourceServiceStore();

const { sourceServiceInfo } = storeToRefs(sourceServiceStore);

interface iProps {
  sourceServiceName?: string;
  description?: string | null;
  isEdit: boolean;
  loading?: boolean;
}

const props = defineProps<iProps>();

const emit = defineEmits([
  'update:source-servie-info',
  'update:is-connection-modal-opened',
]);

const state = reactive({
  sourceServiceName: sourceServiceInfo.value.name,
  description: sourceServiceInfo.value.description as string | null | undefined,
});

const handleCheckSourceConnection = () => {
  sourceConnectionStore.setWithSourceConnection(
    !sourceConnectionStore.withSourceConnection,
  );
};

const handleLink = () => {
  emit('update:is-connection-modal-opened', true);
};

const handleDownloadTemplate = () => {
  const headers = [
    'name',
    'description',
    'ip_address',
    'ssh_port',
    'user',
    'password',
    'private_key',
  ];
  const csvContent = headers.join(',') + '\n';
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'source_connection_template.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const fileInputRef = ref<HTMLInputElement | null>(null);

const handleImportSourceConnection = () => {
  fileInputRef.value?.click();
};

const validateConnection = (
  connection: any,
  rowIndex: number,
): string | null => {
  // name 필수
  if (!connection.name) {
    return `Row ${rowIndex}: name is required`;
  }

  // ip_address 필수 및 포맷 검증 (4개 옥텟)
  if (!connection.ip_address) {
    return `Row ${rowIndex}: ip_address is required`;
  }
  const ipParts = connection.ip_address.split('.');
  if (
    ipParts.length !== 4 ||
    ipParts.some((part: string) => isNaN(Number(part)))
  ) {
    return `Row ${rowIndex}: ip_address format is invalid (expected: ###.###.###.###)`;
  }

  // ssh_port 필수 및 숫자 검증
  if (!connection.ssh_port || isNaN(Number(connection.ssh_port))) {
    return `Row ${rowIndex}: ssh_port is required and must be a number`;
  }

  // user 필수
  if (!connection.user) {
    return `Row ${rowIndex}: user is required`;
  }

  // password 또는 private_key 중 하나 필수
  if (!connection.password && !connection.private_key) {
    return `Row ${rowIndex}: password or private_key is required`;
  }

  return null;
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      showErrorMessage(
        'Import Failed',
        'CSV file must have at least one data row',
      );
      target.value = '';
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const connections: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const connection: any = {};

      headers.forEach((header, idx) => {
        connection[header] = values[idx] || '';
      });

      // ssh_port 기본값 설정
      if (!connection.ssh_port) {
        connection.ssh_port = '22';
      }

      // validation 체크
      const error = validateConnection(connection, i + 1);
      if (error) {
        showErrorMessage('Import Failed', error);
        target.value = '';
        return;
      }

      connections.push(connection);
    }

    // store에 저장
    sourceConnectionStore.editConnections = connections;

    // 파일 input 초기화
    target.value = '';
  };
  reader.readAsText(file);
};

const sourceConnectionNames = ref<string>('');

watchEffect(
  () => {
    sourceConnectionNames.value = '';
    sourceConnectionStore.editConnections.forEach(
      (sourceConnection, idx: number) => {
        if (sourceConnection.name.length > 0) {
          idx === sourceConnectionStore.editConnections.length - 1
            ? (sourceConnectionNames.value += sourceConnection.name)
            : (sourceConnectionNames.value += sourceConnection.name + ', ');
        }
      },
    );
  },
  { flush: 'post' },
);

watchEffect(
  () => {
    emit('update:source-servie-info', {
      sourceServiceName: state.sourceServiceName,
      description: state.description,
    });
  },
  { flush: 'post' },
);

watchEffect(() => {
  if (
    props.sourceServiceName ||
    (props.sourceServiceName && props.description)
  ) {
    state.sourceServiceName = props.sourceServiceName;
    state.description = props.description;
  }
});

const isAddDisabled = computed(
  () => sourceConnectionStore.withSourceConnection,
);

watchEffect(
  () => {
    sourceServiceInfo.value.name = state.sourceServiceName;
    sourceServiceInfo.value.description = state.description;
  },
  { flush: 'post' },
);

const isToggleDisabled = ref<boolean>(true);

watch(
  () => isToggleDisabled,
  () => {
    if (props.isEdit) {
      isToggleDisabled.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <p-pane-layout class="source-service-button-modal">
    <p-pane-layout class="layout">
      <p-field-group label="Source Service Name" invalid required>
        <p-text-input
          v-model="state.sourceServiceName"
          data-testid="source-service-name"
          placeholder="Source Service Name"
          :invalid="!state.sourceServiceName"
          :disabled="false"
        />
      </p-field-group>
      <p-field-group label="Description">
        <p-textarea
          v-if="state.description !== null"
          v-model="state.description"
          data-testid="source-service-description"
          :disabled="false"
        />
      </p-field-group>
    </p-pane-layout>
    <p-pane-layout class="layout">
      <div class="toggle">
        <p-toggle-button
          data-testid="source-service-with-connection"
          :value="sourceConnectionStore.withSourceConnection"
          :disabled="!isToggleDisabled || loading"
          @change-toggle="handleCheckSourceConnection"
        />
        <span>With Source Connection</span>
      </div>
      <p-divider />
      <p-button
        data-testid="source-service-go-add-connection"
        style-type="tertiary"
        :disabled="!isAddDisabled || loading"
        @click="handleLink"
      >
        Go add Source Connection
      </p-button>
      <div class="or-divider">
        <span>or</span>
      </div>
      <div class="import-buttons">
        <p-button
          style-type="tertiary"
          :disabled="!isAddDisabled || loading"
          @click="handleDownloadTemplate"
        >
          Download Source Connection Template
        </p-button>
        <p-button
          style-type="tertiary"
          :disabled="!isAddDisabled || loading"
          @click="handleImportSourceConnection"
        >
          Import Source Connection
        </p-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv"
          hidden
          @change="handleFileChange"
        />
      </div>
      <p-field-group
        class="source-connection-result"
        label="Source Connection"
        required
      >
        <p-text-input
          v-model="sourceConnectionNames"
          class="source-connection"
          :disabled="true"
        />
      </p-field-group>
    </p-pane-layout>
  </p-pane-layout>
</template>

<style scoped lang="postcss">
.link {
  font-weight: 400;
}
.link:hover {
  @apply text-blue-700;
  text-decoration: underline;
  cursor: pointer;
}
.source-service-button-modal {
  @apply flex flex-col gap-[1rem] bg-[#F7F7F7] p-[1rem] border-none;
  p {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    .optional {
      margin-left: 0.25rem;
      color: #898995;
      font-size: 0.75rem;
      font-weight: 400;
    }
  }
  .layout {
    @apply flex flex-col gap-[0.75rem] bg-[#FFF] rounded-[0.375rem] p-[0.75rem] border-none;
    .or-divider {
      @apply flex items-center gap-[0.5rem];
      span {
        color: #898995;
        font-size: 0.75rem;
      }
      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background-color: #e5e5e5;
      }
    }
    .import-buttons {
      @apply flex gap-[0.5rem];
      :deep(.p-button) {
        flex: 1;
      }
    }
    .input-container {
      @apply bg-[#F7F7F7];
    }
    .p-field-group {
      margin-bottom: 0;
    }
    .source-connection-result {
      margin-top: 2rem;
    }
    .toggle {
      /* @apply p-[0.75rem]; */
      @apply flex gap-[0.5rem];
      span {
        font-size: 0.875rem;
        font-weight: 700;
        line-height: 1.0938rem;
      }
    }
  }
}
:deep(.p-link) {
  font-size: 14px;
  /* font-weight: 400; */
}
:deep(.p-text-input) {
  width: 100%;
}
</style>
