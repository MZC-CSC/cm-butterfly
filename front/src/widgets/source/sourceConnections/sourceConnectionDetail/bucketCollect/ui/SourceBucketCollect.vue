<script setup lang="ts">
import { PButton, PStatus } from '@cloudforet-test/mirinae';
import { computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router/composables';
import { useCollectInfra } from '@/entities/sourceConnection/api';
import { saveSourceModel } from '@/entities/objectStorage/api';
import type { ISourceObjectStorage } from '@/entities/objectStorage/model/types';
import { MODEL_ROUTE } from '@/app/providers/router/routes/constants';
import { SimpleEditForm } from '@/widgets/layout';
import {
  formatDate,
  showErrorMessage,
  showSuccessMessage,
  toErrorMessage,
} from '@/shared/utils';

/**
 * Collect step for a bucket connection of a CSP source service.
 *
 * Collecting asks cm-honeybee to look the bucket up in the source account
 * (import-infra runs the CSP lookup for every resource type). The bucket is then saved
 * as a source model — the same step a server's collected infra takes — so that it can be
 * recommended and migrated from the model screens.
 *
 * The model is built from the connection (bucket name) and the source service (CSP and
 * region). cm-honeybee 0.6.3 stores the looked-up bucket but its data endpoint reads it
 * back empty, and the lookup carries nothing beyond the name and region anyway.
 */
interface IProps {
  sourceGroupId: string;
  connectionId: string;
  bucketName: string;
  providerName?: string;
  regionName?: string;
}
const props = defineProps<IProps>();

const router = useRouter();
const resCollect = useCollectInfra({ sgId: null, connId: null });

const state = reactive({
  status: '' as '' | 'success' | 'failed',
  message: '',
  collectedAt: '',
  saveOpen: false,
  saving: false,
  savedModelName: '',
});

// A different connection starts from nothing collected.
watch(
  () => props.connectionId,
  () => {
    state.status = '';
    state.message = '';
    state.collectedAt = '';
    state.savedModelName = '';
  },
);

const statusView = computed(() => {
  if (state.status === 'success')
    return { theme: 'green', text: 'Found in the source account' };
  if (state.status === 'failed') return { theme: 'red', text: 'Failed' };
  return { theme: 'gray', text: 'Not collected' };
});

const defaultModelName = computed(() =>
  `os-src-${props.bucketName}`.replace(/[^A-Za-z0-9-]/g, '-').slice(0, 50),
);

async function handleCollect() {
  state.message = '';
  try {
    await resCollect.execute({
      pathParams: { sgId: props.sourceGroupId, connId: props.connectionId },
    });
    state.status = 'success';
    state.collectedAt = formatDate(new Date().toISOString());
  } catch (e) {
    state.status = 'failed';
    state.message = toErrorMessage(e, 'Could not find the bucket.');
    showErrorMessage('Error', state.message);
  }
}

function sourceModelPayload(): ISourceObjectStorage {
  return {
    description: `Collected from source service ${props.sourceGroupId}`,
    sourceCloud: {
      csp: props.providerName ?? '',
      region: props.regionName ?? '',
    },
    sourceObjectStorages: [{ bucketName: props.bucketName }],
  };
}

async function handleSave(e: { name: string; description: string }) {
  state.saving = true;
  try {
    await saveSourceModel(
      e.name.trim(),
      e.description,
      sourceModelPayload(),
      props.sourceGroupId,
    );
    state.savedModelName = e.name.trim();
    state.saveOpen = false;
    showSuccessMessage('success', 'Source model saved');
  } catch (err) {
    showErrorMessage(
      'Error',
      toErrorMessage(err, 'Could not save the source model.'),
    );
  } finally {
    state.saving = false;
  }
}

function goToSourceModels() {
  router.push({ name: MODEL_ROUTE.SOURCE_MODELS._NAME });
}
</script>

<template>
  <div class="bucket-collect" data-testid="bucket-collect">
    <dl class="rows">
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
          :loading="resCollect.isLoading.value"
          @click="handleCollect"
        >
          Collect Bucket
        </p-button>
      </dd>
      <dt>Collected At</dt>
      <dd>{{ state.collectedAt || '-' }}</dd>
      <dt>Source Model</dt>
      <dd class="with-action">
        <span data-testid="bucket-collect-saved">
          {{ state.savedModelName ? `Saved as ${state.savedModelName}` : '-' }}
        </span>
        <p-button
          data-testid="bucket-collect-save-model"
          style-type="secondary"
          size="sm"
          :disabled="state.status !== 'success'"
          @click="state.saveOpen = true"
        >
          Save as Source Model
        </p-button>
        <button
          type="button"
          class="link"
          data-testid="bucket-collect-go-models"
          :class="{ hidden: !state.savedModelName }"
          @click="goToSourceModels"
        >
          Go to Source Models ->
        </button>
      </dd>
    </dl>
    <p v-if="state.message" class="error" data-testid="bucket-collect-error">
      {{ state.message }}
    </p>

    <div class="relative z-70">
      <simple-edit-form
        v-if="state.saveOpen"
        header-title="Save as Source Model"
        name-label="Model Name"
        name-placeholder="Model Name"
        :name="defaultModelName"
        description=""
        @update:save-modal="handleSave"
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
.with-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.link {
  color: #1d4ed8;
  font-size: 0.875rem;
}
.link.hidden {
  visibility: hidden;
}
.error {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #dc2626;
}
</style>
