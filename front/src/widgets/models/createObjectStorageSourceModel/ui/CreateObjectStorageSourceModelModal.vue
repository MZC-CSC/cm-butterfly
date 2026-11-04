<script setup lang="ts">
import { i18n } from '@/app/i18n';
import {
  PButton,
  PButtonModal,
  PFieldGroup,
  PSelectDropdown,
  PTextInput,
  PTextarea,
  PSpinner,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, ref } from 'vue';
import { useGetSourceServiceList } from '@/entities/sourceService/api';
import { isCspSourceGroup } from '@/entities/sourceService/model/types';
import { useGetSourceConnectionList } from '@/entities/sourceConnection/api';
import { saveSourceModel } from '@/entities/objectStorage/api';
import type {
  IArtifact,
  ISourceBucket,
  ISourceObjectStorage,
} from '@/entities/objectStorage/model/types';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Builds an object storage source model from buckets registered in a cloud source
 * service (cm-honeybee). The source account's credential stays with cm-honeybee; the
 * console only picks the bucket connections it already has.
 *
 * cm-honeybee 0.6.3 looks a bucket up but does not collect its settings (versioning,
 * CORS, encryption, access), so they are confirmed here before the model is saved.
 * The recommendation keeps or turns off each setting depending on the target cloud.
 */
interface IProps {
  // Opened from a bucket connection: that source service and bucket start selected.
  initialGroupId?: string;
  initialBucket?: string;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal', 'saved']);

interface IGroupItem {
  name: string;
  label: string;
  provider: string;
  region: string;
}
interface IBucketRow extends ISourceBucket {
  connectionName: string;
  manual: boolean;
  selected: boolean;
  corsOrigins: string;
  corsMethods: string;
}

const resGroups = useGetSourceServiceList();
const resConnections = useGetSourceConnectionList(null);

const groups = ref<IGroupItem[]>([]);
const buckets = ref<IBucketRow[]>([]);
const state = reactive({
  groupId: '',
  loadingBuckets: false,
  name: '',
  description: '',
  saving: false,
  // Kept for the disabled manual entry; enabled once cm-honeybee verifies a typed-in bucket.
  manualName: '',
});

const accessItems = [
  { name: '', label: '-' },
  { name: 'frequent', label: 'frequent' },
  { name: 'infrequent', label: 'infrequent' },
  { name: 'archive', label: 'archive' },
];

const selectedGroup = computed(
  () => groups.value.find(g => g.name === state.groupId) ?? null,
);
const selectedBuckets = computed(() => buckets.value.filter(b => b.selected));
const canSave = computed(
  () =>
    !!state.name.trim() && selectedBuckets.value.length > 0 && !state.saving,
);

onMounted(async () => {
  try {
    const { data } = await resGroups.execute();
    const list = (data.responseData as any)?.source_group ?? [];
    groups.value = list
      .filter((g: any) => isCspSourceGroup(g.type))
      .map((g: any) => ({
        name: g.id,
        label: `${g.name} (${g.provider_name ?? '-'} / ${
          g.region_name ?? '-'
        })`,
        provider: g.provider_name ?? '',
        region: g.region_name ?? '',
      }));
    if (props.initialGroupId) {
      await selectGroup(props.initialGroupId);
      const row = buckets.value.find(b => b.bucketName === props.initialBucket);
      if (row) row.selected = true;
    }
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.errorMsg?.value || 'Could not load the source services.',
    );
  }
});

async function selectGroup(id: string) {
  state.groupId = id;
  buckets.value = [];
  state.loadingBuckets = true;
  try {
    const { data } = await resConnections.execute({
      pathParams: { sgId: id },
    } as any);
    const connections = (data.responseData as any)?.connection_info ?? [];
    buckets.value = connections
      .filter((c: any) => c.resource_type === 'object_storage')
      .map((c: any) => ({
        ...newRow(c.resource_id, false),
        connectionName: c.name,
      }));
    if (!state.name && selectedGroup.value) {
      state.name = `os-src-${selectedGroup.value.provider}-${Date.now()
        .toString()
        .slice(-6)}`;
    }
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.errorMsg?.value || 'Could not load the bucket connections.',
    );
  } finally {
    state.loadingBuckets = false;
  }
}

function newRow(bucketName: string, manual: boolean): IBucketRow {
  return {
    bucketName,
    connectionName: '',
    manual,
    selected: manual,
    versioningEnabled: false,
    corsEnabled: false,
    encryptionEnabled: false,
    isPublic: false,
    accessFrequency: '',
    corsOrigins: '*',
    corsMethods: 'GET',
  };
}

function splitList(value: string) {
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function toSourceBucket(row: IBucketRow): ISourceBucket {
  const bucket: ISourceBucket = {
    bucketName: row.bucketName,
    versioningEnabled: row.versioningEnabled,
    corsEnabled: row.corsEnabled,
    encryptionEnabled: row.encryptionEnabled,
    isPublic: row.isPublic,
  };
  if (row.accessFrequency) bucket.accessFrequency = row.accessFrequency;
  if (row.corsEnabled) {
    bucket.corsRule = [
      {
        allowedOrigin: splitList(row.corsOrigins),
        allowedMethod: splitList(row.corsMethods),
      },
    ];
  }
  return bucket;
}

async function handleSave() {
  if (!selectedGroup.value) return;
  state.saving = true;
  const payload: ISourceObjectStorage = {
    description: state.description,
    sourceCloud: {
      csp: selectedGroup.value.provider,
      region: selectedGroup.value.region,
    },
    sourceObjectStorages: selectedBuckets.value.map(toSourceBucket),
  };
  try {
    const saved: IArtifact<ISourceObjectStorage> = await saveSourceModel(
      state.name.trim(),
      state.description,
      payload,
      selectedGroup.value.name,
    );
    showSuccessMessage('success', 'Source model saved');
    emit('saved', saved);
    emit('update:close-modal', false);
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.message || 'Could not save the source model.',
    );
  } finally {
    state.saving = false;
  }
}
</script>

<template>
  <p-button-modal
    :visible="true"
    header-title="Create Object Storage Source Model"
    size="lg"
    :disabled="!canSave"
    :loading="state.saving"
    @confirm="handleSave"
    @cancel="emit('update:close-modal', false)"
    @close="emit('update:close-modal', false)"
  >
    <template #body>
      <div class="os-create" data-testid="os-source-create-body">
        <p class="note">
          Pick a cloud source service and the buckets registered in it (Source
          Services &gt; Connections). The account credential stays with the
          source service.
        </p>
        <p-field-group label="Source Service" required>
          <p-select-dropdown
            :menu="groups"
            :selected="state.groupId"
            placeholder="Select a cloud source service"
            use-fixed-menu-style
            data-testid="os-source-create-group"
            @select="selectGroup"
          />
        </p-field-group>
        <div v-if="state.loadingBuckets" class="loading">
          <p-spinner size="md" />
          <span>Loading the bucket connections...</span>
        </div>
        <p
          v-else-if="state.groupId && !buckets.length"
          class="note"
          data-testid="os-source-create-empty"
        >
          This source service has no bucket connections. Add them in Source
          Services (Detail &gt; Scan Buckets, or Connections &gt; Add / Edit),
          or enter a bucket below.
        </p>
        <table
          v-else-if="buckets.length"
          class="table"
          data-testid="os-source-create-buckets"
        >
          <thead>
            <tr>
              <th />
              <th>Bucket</th>
              <th>Versioning</th>
              <th>Encryption</th>
              <th>Public</th>
              <th>Access</th>
              <th>CORS (origins / methods)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in buckets"
              :key="b.bucketName"
              :data-testid="`os-source-create-bucket-${b.bucketName}`"
              :data-selected="b.selected"
            >
              <td>
                <input
                  v-model="b.selected"
                  type="checkbox"
                  :data-testid="`os-source-create-pick-${b.bucketName}`"
                />
              </td>
              <td>
                {{ b.bucketName }}
                <span v-if="b.manual" class="tag">entered</span>
              </td>
              <td>
                <input
                  v-model="b.versioningEnabled"
                  type="checkbox"
                  :data-testid="`os-source-create-versioning-${b.bucketName}`"
                />
              </td>
              <td>
                <input v-model="b.encryptionEnabled" type="checkbox" />
              </td>
              <td><input v-model="b.isPublic" type="checkbox" /></td>
              <td>
                <select v-model="b.accessFrequency" class="native-select">
                  <option
                    v-for="a in accessItems"
                    :key="a.name"
                    :value="a.name"
                  >
                    {{ a.label }}
                  </option>
                </select>
              </td>
              <td class="cors">
                <input v-model="b.corsEnabled" type="checkbox" />
                <input
                  v-model="b.corsOrigins"
                  class="native-input"
                  :disabled="!b.corsEnabled"
                />
                <input
                  v-model="b.corsMethods"
                  class="native-input"
                  :disabled="!b.corsEnabled"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="state.groupId" class="manual-row">
          <p-field-group label="Add a bucket that is not listed">
            <p-text-input
              v-model="state.manualName"
              disabled
              placeholder="bucket name"
              data-testid="os-source-create-manual-name"
            />
          </p-field-group>
          <p-button
            style-type="tertiary"
            icon-left="ic_plus"
            disabled
            data-testid="os-source-create-manual-add"
          >
            Add
          </p-button>
        </div>
        <p
          v-if="state.groupId"
          class="note"
          data-testid="os-source-create-manual-note"
        >
          A source model is made from buckets registered in the source service.
          Entering a bucket by hand is not available yet, because cm-honeybee
          does not check that a typed-in bucket exists.
        </p>
        <p v-if="buckets.length" class="note">
          The source service does not collect these settings yet. Set them as
          the source bucket has them; the recommendation turns off what the
          target cloud does not support.
        </p>
        <p-field-group label="Model Name" required>
          <p-text-input
            v-model="state.name"
            data-testid="os-source-create-name"
          />
        </p-field-group>
        <p-field-group label="Description">
          <p-textarea
            v-model="state.description"
            data-testid="os-source-create-description"
          />
        </p-field-group>
        <p class="note" data-testid="os-source-create-count">
          {{ selectedBuckets.length }} bucket(s) selected.
        </p>
      </div>
    </template>
    <template #close-button>
      <span>{{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}</span>
    </template>
    <template #confirm-button>
      <span data-testid="os-source-create-save">{{
        i18n.t('COMPONENT.BUTTON_MODAL.SAVE')
      }}</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.os-create {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.manual-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}
.manual-row :deep(.p-field-group) {
  margin-bottom: 0;
}
.tag {
  margin-left: 0.375rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.table {
  width: 100%;
  font-size: 0.875rem;
  border: 1px solid #e5e7eb;
  border-collapse: collapse;
}
.table th,
.table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
  vertical-align: middle;
}
.table tbody tr[data-selected='true'] {
  background: #e8f0fe;
}
.cors {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.native-input,
.native-select {
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.8125rem;
}
.native-input {
  width: 6rem;
}
.native-input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
}
</style>
