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
import { collectBucket, getRefinedBucket } from '@/entities/objectStorage/api';
import type {
  ISourceBucket,
  ISourceObjectStorage,
} from '@/entities/objectStorage/model/types';
import {
  createObjectStorageModel,
  describeModelError,
} from '@/entities/migrationModel';
import { useAuth } from '@/features/auth/model/useAuth.ts';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { formatBytes } from '@/widgets/models/objectStorageBuckets/model/format';

/**
 * Builds an object storage source model from buckets registered in a cloud source service.
 *
 * The buckets are not described by hand: each picked bucket connection is collected by
 * cm-honeybee with the credential kept on the source service, and its refined answer
 * (versioning, encryption, size, object count, tags) becomes the bucket of the model. A bucket
 * that cannot be collected stays failed with cm-honeybee's message and is not saved with
 * guessed settings. The model is stored in cm-damselfly as a source model of the source service
 * it came from; edits are made later on a planning model.
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
type CollectStatus = '' | 'collecting' | 'collected' | 'failed';
interface IBucketRow {
  connectionId: string;
  connectionName: string;
  bucketName: string;
  selected: boolean;
  status: CollectStatus;
  message: string;
  bucket: ISourceBucket | null;
  sourceCloud: ISourceObjectStorage['sourceCloud'] | null;
}

const auth = useAuth();
const resGroups = useGetSourceServiceList();
const resConnections = useGetSourceConnectionList(null);

const groups = ref<IGroupItem[]>([]);
const buckets = ref<IBucketRow[]>([]);
const state = reactive({
  groupId: '',
  loadingBuckets: false,
  collecting: false,
  name: '',
  description: '',
  saving: false,
});

const selectedGroup = computed(
  () => groups.value.find(g => g.name === state.groupId) ?? null,
);
const selectedBuckets = computed(() => buckets.value.filter(b => b.selected));
const collectedBuckets = computed(() =>
  selectedBuckets.value.filter(b => b.status === 'collected'),
);
// Every picked bucket has to be collected; a failed one is unpicked or collected again.
const canSave = computed(
  () =>
    !!state.name.trim() &&
    selectedBuckets.value.length > 0 &&
    collectedBuckets.value.length === selectedBuckets.value.length &&
    !state.collecting &&
    !state.saving,
);

function errorText(e: unknown, fallback: string) {
  const body = (e as any)?.response?.data?.responseData;
  return (
    body?.error ||
    body?.message ||
    (e as any)?.response?.data?.status?.message ||
    (e as any)?.message ||
    fallback
  );
}

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
      if (row) {
        row.selected = true;
        await handleCollect();
      }
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
        connectionId: c.id,
        connectionName: c.name,
        bucketName: c.resource_id,
        selected: false,
        status: '' as CollectStatus,
        message: '',
        bucket: null,
        sourceCloud: null,
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

async function collectRow(row: IBucketRow) {
  row.status = 'collecting';
  row.message = '';
  row.bucket = null;
  try {
    await collectBucket(state.groupId, row.connectionId);
    const refined = await getRefinedBucket(state.groupId, row.connectionId);
    const bucket = refined.sourceObjectStorages.find(
      b => b.bucketName === row.bucketName,
    );
    if (!bucket) {
      throw new Error(
        `The source service did not return bucket ${row.bucketName}.`,
      );
    }
    row.bucket = bucket;
    row.sourceCloud = refined.sourceCloud ?? null;
    row.status = 'collected';
  } catch (e) {
    row.status = 'failed';
    row.message = errorText(e, 'Could not collect the bucket.');
  }
}

async function handleCollect() {
  // mirinae shows a disabled button by class only, so the guard is here.
  if (state.collecting || !selectedBuckets.value.length) return;
  state.collecting = true;
  try {
    await Promise.all(
      selectedBuckets.value
        .filter(b => b.status !== 'collected')
        .map(collectRow),
    );
  } finally {
    state.collecting = false;
  }
}

async function handleSave() {
  if (!canSave.value || !selectedGroup.value) return;
  state.saving = true;
  // The cloud cm-honeybee reports for the buckets; the source service's own as the fallback
  // only when the refined answer carries none.
  const sourceCloud = collectedBuckets.value.find(b => b.sourceCloud)
    ?.sourceCloud ?? {
    csp: selectedGroup.value.provider,
    region: selectedGroup.value.region,
  };
  const sourceObjectStorageModel: ISourceObjectStorage = {
    description: state.description,
    sourceCloud,
    sourceObjectStorages: collectedBuckets.value.map(b => b.bucket!),
  };
  try {
    const res = await createObjectStorageModel('source', {
      userModelName: state.name.trim(),
      description: state.description,
      userId: auth.getUser().id,
      userModelVersion: 'v0.1',
      isInitUserModel: true,
      lineage: { sourceGroupId: selectedGroup.value.name },
      sourceObjectStorageModel,
    });
    showSuccessMessage('success', 'Source model saved');
    emit('saved', res.data?.responseData);
    emit('update:close-modal', false);
  } catch (e) {
    showErrorMessage('failed', describeModelError(e).message);
  } finally {
    state.saving = false;
  }
}

function onOff(value?: boolean) {
  return value ? 'on' : 'off';
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
          Services &gt; Connections), then collect them. The source service
          reads each bucket's settings from the source account with its own
          credential.
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
          Services (Detail &gt; Scan Buckets, or Connections &gt; Add / Edit).
        </p>
        <template v-else-if="buckets.length">
          <table class="table" data-testid="os-source-create-buckets">
            <thead>
              <tr>
                <th />
                <th>Bucket</th>
                <th>Collect</th>
                <th>Versioning</th>
                <th>Encryption</th>
                <th>Size</th>
                <th>Objects</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in buckets"
                :key="b.connectionId"
                :data-testid="`os-source-create-bucket-${b.bucketName}`"
                :data-selected="b.selected"
                :data-status="b.status"
              >
                <td>
                  <input
                    v-model="b.selected"
                    type="checkbox"
                    :data-testid="`os-source-create-pick-${b.bucketName}`"
                  />
                </td>
                <td>{{ b.bucketName }}</td>
                <td
                  :data-testid="`os-source-create-status-${b.bucketName}`"
                  :data-status="b.status"
                  :class="['status', `status--${b.status || 'none'}`]"
                >
                  <p-spinner v-if="b.status === 'collecting'" size="sm" />
                  <span v-else-if="b.status === 'collected'">Collected</span>
                  <span v-else-if="b.status === 'failed'" :title="b.message">
                    Failed: {{ b.message }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td :data-testid="`os-source-create-versioning-${b.bucketName}`">
                  {{ b.bucket ? onOff(b.bucket.versioningEnabled) : '-' }}
                </td>
                <td>{{ b.bucket ? onOff(b.bucket.encryptionEnabled) : '-' }}</td>
                <td>
                  {{ b.bucket ? formatBytes(b.bucket.totalSizeBytes) : '-' }}
                </td>
                <td>{{ b.bucket ? b.bucket.objectCount ?? '-' : '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="row">
            <p-button
              style-type="secondary"
              icon-left="ic_refresh"
              :disabled="!selectedBuckets.length || state.collecting"
              :loading="state.collecting"
              data-testid="os-source-create-collect"
              @click="handleCollect"
            >
              Collect Selected
            </p-button>
            <span class="note" data-testid="os-source-create-count">
              {{ collectedBuckets.length }} of
              {{ selectedBuckets.length }} selected bucket(s) collected.
            </span>
          </div>
        </template>
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
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
.status--collected {
  color: #15803d;
}
.status--failed {
  color: #dc2626;
}
</style>
