<script setup lang="ts">
import { PButton, PStatus } from '@cloudforet-test/mirinae';
import { computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router/composables';
import { useCollectInfra } from '@/entities/sourceConnection/api';
import { MODEL_ROUTE } from '@/app/providers/router/routes/constants';
import { formatDate, showErrorMessage, toErrorMessage } from '@/shared/utils';

/**
 * Collect step for a bucket connection of a cloud source service.
 *
 * Collecting asks cm-honeybee to look the bucket up in the source account (import-infra
 * runs the CSP lookup for every resource type), which confirms the bucket is there. The
 * source model is made from the registered buckets in Models > Object Storage Models.
 *
 * cm-honeybee 0.6.3 stores the looked-up bucket but its data endpoint reads it back
 * empty, and it does not collect the bucket's settings, so this tab shows only whether
 * the bucket was found.
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
});

// A different connection starts from nothing collected.
watch(
  () => props.connectionId,
  () => {
    state.status = '';
    state.message = '';
    state.collectedAt = '';
  },
);

const statusView = computed(() => {
  if (state.status === 'success')
    return { theme: 'green', text: 'Found in the source account' };
  if (state.status === 'failed') return { theme: 'red', text: 'Failed' };
  return { theme: 'gray', text: 'Not collected' };
});

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

function goToModels() {
  router.push({ name: MODEL_ROUTE.OBJECT_STORAGE_MODELS._NAME });
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
      <dd>
        <button
          type="button"
          class="link"
          data-testid="bucket-collect-go-models"
          @click="goToModels"
        >
          Create it in Object Storage Models ->
        </button>
      </dd>
    </dl>
    <p v-if="state.message" class="error" data-testid="bucket-collect-error">
      {{ state.message }}
    </p>
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
.error {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #dc2626;
}
</style>
