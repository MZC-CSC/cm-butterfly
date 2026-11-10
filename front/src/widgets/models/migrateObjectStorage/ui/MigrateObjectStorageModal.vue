<script setup lang="ts">
import { i18n } from '@/app/i18n';
import {
  PButtonModal,
  PFieldGroup,
  PTextInput,
  PSpinner,
} from '@cloudforet-test/mirinae';
import { computed, reactive } from 'vue';
import { useRouter } from 'vue-router/composables';
import { migrateObjectStorage } from '@/entities/objectStorage/api';
import type { IObjectStorageModel } from '@/entities/objectStorage/model/types';
import { beetleLineageOf } from '@/entities/migrationModel';
import { useGetBeetleRequest } from '@/entities/mci/api';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';
import { WORKLOAD_OPERATIONS_ROUTE } from '@/app/providers/router/routes/constants';
import { showSuccessMessage } from '@/shared/utils';

/**
 * Creates the buckets of an object storage target model in the target cloud
 * (cm-beetle MigrateObjectStorage). Object storage migration ends here: cm-cicada has no
 * bucket task, so the console starts it directly from the target model and follows the
 * request until cm-beetle reports the outcome. The migrated buckets are then managed under
 * Workload Operations > Object Storages, which is also where a later data migration picks its
 * destination.
 *
 * The request carries the target model's lineage as the infra migration does. cm-beetle 0.6.4
 * does not read it for buckets yet, so the created buckets do not carry it until it does.
 */
interface IProps {
  target: IObjectStorageModel;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal']);

const router = useRouter();
const nsId = DEFAULT_NAMESPACE;
const storage = computed(() => props.target?.targetObjectStorageModel);

const state = reactive({
  nameSeed: '',
  running: false,
  status: '' as '' | 'Handling' | 'Success' | 'Error',
  message: '',
  reqId: '',
});

// The prefix becomes part of each bucket name, so it follows bucket naming. cm-beetle
// rejects one that does not start with a letter or digit only after the request is sent.
const SEED_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const seedError = computed(() => {
  const seed = state.nameSeed.trim();
  if (!seed || SEED_PATTERN.test(seed)) return '';
  return 'Use lowercase letters, digits and hyphens, starting with a letter or digit. It becomes part of the bucket name.';
});

// cm-beetle answers a rejected request with { success: false, error: "..." }.
function errorText(e: unknown, fallback: string) {
  return (
    (e as any)?.response?.data?.responseData?.error ||
    (e as any)?.response?.data?.responseData?.message ||
    (e as any)?.message ||
    fallback
  );
}

function newRequestId() {
  return `bf-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// cm-beetle keeps the request record after the 202, so the outcome is read from it.
async function pollRequest(reqId: string) {
  const res = useGetBeetleRequest(reqId);
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const { data } = await res.execute();
      const body: any = data.responseData;
      const details = body?.data ?? body;
      const status = details?.status as string | undefined;
      if (status === 'Success' || status === 'Error') {
        state.status = status;
        state.message = details?.errorResponse ?? '';
        return;
      }
      state.status = 'Handling';
    } catch (e) {
      state.status = 'Error';
      state.message = errorText(e, 'Could not read the request status.');
      return;
    }
  }
}

async function handleMigrate() {
  if (!storage.value || seedError.value) return;
  state.running = true;
  state.status = 'Handling';
  state.message = '';
  state.reqId = newRequestId();
  try {
    await migrateObjectStorage(
      nsId,
      storage.value,
      state.reqId,
      state.nameSeed.trim() || undefined,
      beetleLineageOf(props.target) as Record<string, string>,
    );
    await pollRequest(state.reqId);
    if (state.status === 'Success')
      showSuccessMessage('success', 'Buckets created');
  } catch (e) {
    state.status = 'Error';
    state.message = errorText(e, 'Migration request failed.');
  } finally {
    state.running = false;
  }
}

function goToObjectStorages() {
  emit('update:close-modal', false);
  router.push({ name: WORKLOAD_OPERATIONS_ROUTE.OBJECT_STORAGES._NAME });
}
</script>

<template>
  <p-button-modal
    :visible="true"
    header-title="Migrate Object Storage"
    size="md"
    :disabled="state.running || state.status === 'Success' || !!seedError"
    :loading="state.running"
    @confirm="handleMigrate"
    @cancel="emit('update:close-modal', false)"
    @close="emit('update:close-modal', false)"
  >
    <template #body>
      <div class="os-migrate" data-testid="os-migrate-body">
        <p class="note">
          Creates
          {{ storage?.targetObjectStorages?.length ?? 0 }} bucket(s) in
          {{ storage?.targetCloud?.csp }} /
          {{ storage?.targetCloud?.region }} (namespace {{ nsId }}).
          The objects inside the buckets are moved by a data migration, which is
          not part of this step.
        </p>
        <ul class="buckets">
          <li
            v-for="b in storage?.targetObjectStorages ?? []"
            :key="b.sourceBucketName"
          >
            {{ b.sourceBucketName }} -> {{ b.bucketName }}
            <span class="flags"
              >versioning {{ b.versioningEnabled ? 'on' : 'off' }}</span
            >
          </li>
        </ul>
        <p-field-group label="Name prefix">
          <p-text-input
            v-model="state.nameSeed"
            :invalid="!!seedError"
            data-testid="os-migrate-name-seed"
            placeholder="e.g. mig"
          />
          <p
            v-if="seedError"
            class="seed-error"
            data-testid="os-migrate-name-seed-error"
          >
            {{ seedError }}
          </p>
        </p-field-group>
        <p
          class="status"
          :data-status="state.status"
          data-testid="os-migrate-status"
        >
          <template v-if="state.status">
            <p-spinner v-if="state.status === 'Handling'" size="sm" />
            {{ state.status }}
            <span v-if="state.message">: {{ state.message }}</span>
            <span class="req">request {{ state.reqId }}</span>
          </template>
        </p>
        <p class="next">
          <button
            v-if="state.status === 'Success'"
            type="button"
            class="link"
            data-testid="os-migrate-go-workloads"
            @click="goToObjectStorages"
          >
            View in Workload Operations > Object Storages ->
          </button>
        </p>
      </div>
    </template>
    <template #close-button>
      <span data-testid="os-migrate-cancel">{{
        i18n.t('COMPONENT.BUTTON_MODAL.CANCEL')
      }}</span>
    </template>
    <template #confirm-button>
      <span data-testid="os-migrate-start">Create Buckets</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.os-migrate {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.buckets {
  font-size: 0.875rem;
  list-style: disc;
  padding-left: 1.25rem;
}
.flags {
  margin-left: 0.5rem;
  color: #6b7280;
}
.status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}
.status[data-status='Success'] {
  color: #15803d;
}
.status[data-status='Error'] {
  color: #dc2626;
}
.seed-error {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #dc2626;
}
.req {
  font-size: 0.75rem;
  color: #9ca3af;
}
.link {
  color: #1d4ed8;
  font-size: 0.875rem;
}
</style>
