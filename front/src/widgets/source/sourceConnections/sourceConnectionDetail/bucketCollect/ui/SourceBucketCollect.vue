<script setup lang="ts">
import { PButton, PStatus } from '@cloudforet-test/mirinae';
import { computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router/composables';
import { collectBucket, getRefinedBucket } from '@/entities/objectStorage/api';
import type {
  ISourceBucket,
  ISourceObjectStorage,
} from '@/entities/objectStorage/model/types';
import { MODEL_ROUTE } from '@/app/providers/router/routes/constants';
import CreateObjectStorageSourceModelModal from '@/widgets/models/createObjectStorageSourceModel/ui/CreateObjectStorageSourceModelModal.vue';
import { formatBytes } from '@/widgets/models/objectStorageBuckets/model/format';
import { formatDate, showErrorMessage, toErrorMessage } from '@/shared/utils';

/**
 * Information of a bucket connection of a cloud source service. A bucket has no host,
 * port or credential of its own (the credential stays on the source service), so this
 * shows the bucket and its collect step in place of the server fields.
 *
 * Collect Object Storage asks cm-honeybee to read the bucket from the source account
 * (import-infra runs the CSP lookup for every resource type), shows what was collected
 * (versioning, encryption, size and object count; cm-honeybee 0.6.4+) and goes straight on to
 * the source model window with this bucket, as Collect Infra does for a server. Save as Source
 * Model opens that window again after it was closed. It is the same window Models > Source
 * Models uses for several buckets.
 */
interface IProps {
  sourceGroupId: string;
  connectionId: string;
  connectionName: string;
  description: string;
  bucketName: string;
  providerName?: string;
  regionName?: string;
}
const props = defineProps<IProps>();

const router = useRouter();

const state = reactive({
  status: '' as '' | 'success' | 'failed',
  message: '',
  collectedAt: '',
  saveOpen: false,
  savedModelName: '',
  bucket: null as ISourceBucket | null,
  sourceCloud: undefined as ISourceObjectStorage['sourceCloud'],
  // Off: a large bucket is collected quickly, without size and object count.
  countObjects: true,
  collecting: false,
});

// A different connection starts from nothing collected.
watch(
  () => props.connectionId,
  () => {
    state.status = '';
    state.message = '';
    state.collectedAt = '';
    state.savedModelName = '';
    state.bucket = null;
  },
);

const statusView = computed(() => {
  if (state.status === 'success') return { theme: 'green', text: 'Collected' };
  if (state.status === 'failed') return { theme: 'red', text: 'Failed' };
  return { theme: 'gray', text: 'Not collected' };
});

function refinedErrorText(e: any, fallback: string) {
  const body = e?.response?.data?.responseData;
  return body?.error || body?.message || toErrorMessage(e, fallback);
}

async function handleCollect() {
  if (state.collecting) return;
  state.collecting = true;
  try {
    await collectOnce();
  } finally {
    state.collecting = false;
  }
}

async function collectOnce() {
  state.message = '';
  state.bucket = null;
  try {
    await collectBucket(
      props.sourceGroupId,
      props.connectionId,
      state.countObjects,
    );
  } catch (e) {
    state.status = 'failed';
    state.message = toErrorMessage(e, 'Could not collect the bucket.');
    showErrorMessage('Error', state.message);
    return;
  }
  // Collected only when the refined answer has this bucket; nothing is filled in otherwise.
  try {
    const refined = await getRefinedBucket(
      props.sourceGroupId,
      props.connectionId,
    );
    const bucket = refined.sourceObjectStorages.find(
      b => b.bucketName === props.bucketName,
    );
    if (!bucket) {
      throw new Error(
        `The source service did not return bucket ${props.bucketName}.`,
      );
    }
    state.bucket = bucket;
    state.sourceCloud = refined.sourceCloud;
    state.status = 'success';
    state.collectedAt = formatDate(new Date().toISOString());
    state.saveOpen = true;
  } catch (e) {
    state.status = 'failed';
    state.message = refinedErrorText(e, 'Could not read the collected bucket.');
    showErrorMessage('Error', state.message);
  }
}

function onOff(value?: boolean) {
  return value ? 'on' : 'off';
}

function onSaved(model: any) {
  state.savedModelName = model?.userModelName ?? '';
}

function goToModels() {
  router.push({ name: MODEL_ROUTE.SOURCE_MODELS._NAME });
}
</script>

<template>
  <div class="bucket-collect" data-testid="bucket-collect">
    <dl class="rows">
      <dt>Name</dt>
      <dd>{{ connectionName }}</dd>
      <dt>Description</dt>
      <dd>{{ description || '-' }}</dd>
      <dt>Resource Type</dt>
      <dd>Object Storage (bucket)</dd>
      <dt>Bucket</dt>
      <dd data-testid="bucket-collect-name">{{ bucketName }}</dd>
      <dt>Source account</dt>
      <dd>{{ providerName || '-' }} / {{ regionName || '-' }}</dd>
      <dt>Collect Status</dt>
      <dd class="with-action">
        <span data-testid="bucket-collect-status" :data-status="state.status">
          <p-status :theme="statusView.theme" :text="statusView.text" />
        </span>
        <p-button
          data-testid="bucket-collect-run"
          style-type="tertiary"
          size="sm"
          :loading="state.collecting"
          @click="handleCollect"
        >
          Collect Object Storage
        </p-button>
        <label class="count-option">
          <input
            v-model="state.countObjects"
            type="checkbox"
            data-testid="bucket-collect-count-objects"
          />
          Count objects and size
        </label>
      </dd>
      <dt>Collected At</dt>
      <dd>{{ state.collectedAt || '-' }}</dd>
      <dt>Versioning</dt>
      <dd data-testid="bucket-collect-versioning">
        {{ state.bucket ? onOff(state.bucket.versioningEnabled) : '-' }}
      </dd>
      <dt>Encryption</dt>
      <dd data-testid="bucket-collect-encryption">
        {{ state.bucket ? onOff(state.bucket.encryptionEnabled) : '-' }}
      </dd>
      <dt>Size / Objects</dt>
      <dd data-testid="bucket-collect-size">
        {{
          state.bucket
            ? `${formatBytes(state.bucket.totalSizeBytes)} / ${
                state.bucket.objectCount ?? '-'
              }`
            : '-'
        }}
      </dd>
      <dt>Source Model</dt>
      <dd class="with-action">
        <span data-testid="bucket-collect-saved">
          <template v-if="state.savedModelName">
            Saved as {{ state.savedModelName }} ·
            <button
              type="button"
              class="link"
              data-testid="bucket-collect-go-models"
              @click="goToModels"
            >
              Source Models
            </button>
          </template>
          <template v-else>-</template>
        </span>
        <p-button
          data-testid="bucket-collect-save-model"
          style-type="tertiary"
          size="sm"
          :disabled="state.status !== 'success'"
          @click="state.saveOpen = true"
        >
          Save as Source Model
        </p-button>
      </dd>
    </dl>
    <p v-if="state.message" class="error" data-testid="bucket-collect-error">
      {{ state.message }}
    </p>

    <div class="relative z-70">
      <create-object-storage-source-model-modal
        v-if="state.saveOpen"
        :initial-group-id="sourceGroupId"
        :initial-bucket="bucketName"
        :initial-collected="
          state.bucket
            ? { bucket: state.bucket, sourceCloud: state.sourceCloud }
            : undefined
        "
        @saved="onSaved"
        @update:close-modal="state.saveOpen = false"
      />
    </div>
  </div>
</template>

<style scoped lang="postcss">
.bucket-collect {
  padding: 0.5rem 0;
}
.rows {
  display: grid;
  grid-template-columns: 12rem 1fr;
  font-size: 0.875rem;
  border-top: 1px solid #e5e7eb;
}
.rows dt,
.rows dd {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}
.rows dt {
  font-weight: 700;
  background: #f9fafb;
}
.count-option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
  font-size: 0.75rem;
}
.with-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.link {
  color: #1d4ed8;
}
.error {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #dc2626;
}
</style>
