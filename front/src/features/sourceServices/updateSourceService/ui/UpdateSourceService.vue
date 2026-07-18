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
import { DOC_LINKS, openDocLink } from '@/shared/constants/docLinks';
import { useSourceServiceStore } from '@/shared/libs';
import { storeToRefs } from 'pinia';
import { showErrorMessage, toErrorMessage } from '@/shared/utils';
import {
  validateConnection,
  findDuplicateNameIndexes,
  CONNECTION_LIMIT_PER_GROUP,
  DEFAULT_SSH_PORT,
} from '@/shared/utils/connectionValidation';
import {
  useParseTabularImport,
  type ITabularImportRow,
} from '@/entities/sourceConnection/api/tabularImport';

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
  'update:import-blocked',
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

const handleOpenImportGuide = () => {
  openDocLink(DOC_LINKS.sourceConnectionBulkImport);
};

const handleImportSourceConnection = () => {
  fileInputRef.value?.click();
};

// 파싱은 서버가 한다. 따옴표 안 쉼표·값 안의 줄바꿈·BOM 을 규격대로 처리하고
// Excel 도 같은 형태로 돌려주므로, 화면은 받은 행에 검증만 얹는다.
const parseImport = useParseTabularImport();

interface PreviewRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
}

const previewRows = ref<PreviewRow[]>([]);
const previewFileErrors = ref<string[]>([]);
const importedFileName = ref<string>('');
const isParsing = ref<boolean>(false);

const hasPreview = computed(() => previewRows.value.length > 0);
const invalidRowCount = computed(
  () => previewRows.value.filter(row => row.errors.length > 0).length,
);
const isPreviewValid = computed(
  () =>
    hasPreview.value &&
    invalidRowCount.value === 0 &&
    previewFileErrors.value.length === 0,
);

const clearPreview = () => {
  previewRows.value = [];
  previewFileErrors.value = [];
  importedFileName.value = '';
  sourceConnectionStore.editConnections = [];
};

const readFile = (file: File): Promise<{ text?: string; base64?: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));

    // Excel 은 바이너리라 base64 로 싣는다. CSV 는 텍스트 그대로 보낸다.
    if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
      reader.onload = e => {
        const result = String(e.target?.result ?? '');
        resolve({ base64: result.split(',')[1] ?? '' });
      };
      reader.readAsDataURL(file);
      return;
    }
    reader.onload = e => resolve({ text: String(e.target?.result ?? '') });
    reader.readAsText(file);
  });

// 파일 하나가 그룹 상한을 넘기면 등록 자체가 거부되므로 미리 알린다.
const buildPreview = (rows: ITabularImportRow[], fileErrors: string[]) => {
  const fields = rows.map(row => ({
    ...row.data,
    ssh_port: row.data.ssh_port || DEFAULT_SSH_PORT,
  }));
  const duplicates = findDuplicateNameIndexes(fields);

  previewRows.value = rows.map((row, idx) => {
    const errors = validateConnection(fields[idx]);
    if (duplicates.has(idx)) {
      errors.push('Duplicate name in this file. Names are case-insensitive.');
    }
    return { index: row.index, data: fields[idx], errors };
  });

  previewFileErrors.value = [...fileErrors];
  if (rows.length > CONNECTION_LIMIT_PER_GROUP) {
    previewFileErrors.value.push(
      `A source group can hold up to ${CONNECTION_LIMIT_PER_GROUP} connections. This file has ${rows.length}.`,
    );
  }

  // 문제가 남아 있으면 등록 대상으로 넘기지 않는다.
  sourceConnectionStore.editConnections = isPreviewValid.value
    ? previewRows.value.map(row => ({ ...row.data }))
    : [];
};

// 임포트한 파일에 문제가 남아 있으면 등록을 막아야 한다. 막지 않으면 등록 대상이
// 비워진 채로 진행돼 연결 없는 그룹이 조용히 만들어진다.
const isImportBlocked = computed(
  () => hasPreview.value && !isPreviewValid.value,
);

watchEffect(() => {
  emit('update:import-blocked', isImportBlocked.value);
});

const invalidRows = computed(() =>
  previewRows.value.filter(row => row.errors.length > 0),
);

// 자격증명 값 자체는 화면에 내보내지 않는다. 어떤 방식인지만 알려 준다.
const describeAuth = (row: Record<string, string>) => {
  const methods: string[] = [];
  if (row.password) methods.push('Password');
  if (row.private_key) methods.push('Private key');
  return methods.length > 0 ? methods.join(' + ') : '—';
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  clearPreview();
  isParsing.value = true;

  try {
    const { text, base64 } = await readFile(file);
    const { data } = await parseImport.execute({
      fileName: file.name,
      content: text,
      contentBase64: base64,
    });

    // 파일 자체의 문제는 정상 응답에 실패 상태로 담겨 온다. 사용자가 고칠 수
    // 있는 내용이므로 그대로 보여준다.
    if (data?.status?.code !== 200) {
      showErrorMessage(
        'Import Failed',
        data?.status?.message || 'The file could not be read.',
      );
      return;
    }

    const result = data.responseData;
    importedFileName.value = file.name;
    buildPreview(result?.rows ?? [], result?.fileErrors ?? []);
  } catch (error) {
    showErrorMessage(
      'Import Failed',
      toErrorMessage(error, 'The file could not be read.'),
    );
  } finally {
    isParsing.value = false;
    target.value = '';
  }
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
          data-testid="source-import-template"
          :disabled="!isAddDisabled || loading"
          @click="handleDownloadTemplate"
        >
          Download Source Connection Template
        </p-button>
        <p-button
          style-type="tertiary"
          data-testid="source-import-file"
          :disabled="!isAddDisabled || loading"
          @click="handleImportSourceConnection"
        >
          Import Source Connection
        </p-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv,.xlsx,.xlsm"
          hidden
          data-testid="source-import-input"
          @change="handleFileChange"
        />
      </div>
      <p class="import-help" data-testid="source-import-help">
        The template is CSV. You can fill it in and upload it as CSV or Excel
        (.xlsx) — both work.
        <a
          href="#"
          data-testid="source-import-guide-link"
          @click.prevent="handleOpenImportGuide"
        >
          How to prepare the file
        </a>
      </p>
      <div
        v-if="isParsing"
        class="import-status"
        data-testid="source-import-parsing"
      >
        Reading the file…
      </div>

      <div
        v-else-if="hasPreview"
        class="import-preview"
        data-testid="source-import-preview"
      >
        <div class="preview-summary">
          <span>
            <strong data-testid="source-import-count">
              {{ previewRows.length }} connection(s)
            </strong>
            from {{ importedFileName }}
            <span
              v-if="invalidRowCount > 0"
              class="preview-invalid"
              data-testid="source-import-invalid-count"
            >
              — {{ invalidRowCount }} row(s) need attention
            </span>
          </span>
          <!-- 잘못된 파일을 올린 뒤 빠져나갈 길이 필요하다. 이것이 없으면
               그룹만 등록하려 해도 등록 버튼이 계속 막힌다. -->
          <button
            type="button"
            class="preview-clear"
            data-testid="source-import-clear"
            @click="clearPreview"
          >
            Remove
          </button>
        </div>

        <ul
          v-if="previewFileErrors.length > 0"
          class="preview-file-errors"
          data-testid="source-import-file-errors"
        >
          <li v-for="(message, i) in previewFileErrors" :key="i">
            {{ message }}
          </li>
        </ul>

        <div class="preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>IP Address</th>
                <th>Port</th>
                <th>User</th>
                <th>Auth</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in previewRows"
                :key="row.index"
                :class="{ 'row-invalid': row.errors.length > 0 }"
                :data-testid="`source-import-row-${row.index}`"
              >
                <td>{{ row.index }}</td>
                <td>{{ row.data.name }}</td>
                <td>{{ row.data.ip_address }}</td>
                <td>{{ row.data.ssh_port }}</td>
                <td>{{ row.data.user }}</td>
                <td>{{ describeAuth(row.data) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul
          v-if="invalidRowCount > 0"
          class="preview-row-errors"
          data-testid="source-import-row-errors"
        >
          <li v-for="row in invalidRows" :key="row.index">
            <strong>Row {{ row.index }}</strong>
            <span v-if="row.data.name"> ({{ row.data.name }})</span>:
            {{ row.errors.join(' ') }}
          </li>
        </ul>
      </div>

      <p-field-group
        v-else
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
    .import-status {
      @apply text-[0.8125rem] text-gray-600 py-[0.75rem];
    }
    .import-preview {
      @apply mt-[0.5rem];
      .preview-summary {
        @apply text-[0.8125rem] mb-[0.5rem];
      }
      .preview-invalid {
        @apply text-red-600;
      }
      .preview-file-errors,
      .preview-row-errors {
        @apply text-[0.75rem] text-red-600 mb-[0.5rem] list-disc pl-[1.25rem];
      }
      .preview-table-wrap {
        @apply max-h-[16rem] overflow-auto border border-[#DDDDDF] rounded-[0.25rem];
      }
      .preview-table {
        @apply w-full text-[0.75rem];
        th {
          @apply text-left bg-[#F7F7F7] px-[0.5rem] py-[0.375rem] sticky top-0;
        }
        td {
          @apply px-[0.5rem] py-[0.375rem] border-t border-[#EDEDEF];
        }
        .row-invalid td {
          @apply bg-[#FFF5F5];
        }
      }
    }
    .import-help {
      @apply text-[0.75rem] text-gray-600 mt-[0.5rem] mb-[0.5rem];
      a {
        @apply underline;
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
