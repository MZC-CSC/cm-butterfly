<script setup lang="ts">
import { PButton, PButtonModal, PTextInput } from '@cloudforet-test/mirinae';
import { onMounted, reactive, ref } from 'vue';
import {
  deleteMigratedBucket,
  listBucketObjects,
  listMigratedBuckets,
} from '@/entities/objectStorage/api';
import type { IMigratedBucket } from '@/entities/objectStorage/model/types';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Buckets that have been migrated into the target cloud — the object storage
 * counterpart of Infra Workloads.
 *
 * Getting here follows the same steps as servers: collect the bucket from a CSP source
 * service, save it as a source model, take the recommendation as a target model, then
 * migrate it from the target model. The objects inside a bucket are moved by a data
 * migration, which is not part of this screen.
 */
const nsId = DEFAULT_NAMESPACE;

function errorText(e: unknown, fallback: string) {
  return (
    (e as any)?.response?.data?.responseData?.message ||
    (e as any)?.message ||
    fallback
  );
}

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i ? 1 : 0)} ${units[i]}`;
}

const migrated = ref<IMigratedBucket[]>([]);
const state = reactive({
  loading: false,
  objectsFor: '',
  objects: [] as any[],
  objectsLoading: false,
  deleteTarget: '',
  deleteConfirm: '',
  deleting: false,
});

async function loadMigrated() {
  state.loading = true;
  try {
    migrated.value = (await listMigratedBuckets(nsId)) ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not list the buckets.'));
  } finally {
    state.loading = false;
  }
}

async function handleShowObjects(osId: string) {
  state.objectsFor = osId;
  state.objects = [];
  state.objectsLoading = true;
  try {
    const res = await listBucketObjects(nsId, osId);
    state.objects = res?.objects ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not list the objects.'));
  } finally {
    state.objectsLoading = false;
  }
}

async function handleDeleteBucket() {
  state.deleting = true;
  try {
    await deleteMigratedBucket(nsId, state.deleteTarget);
    showSuccessMessage('success', 'Bucket deleted');
    if (state.objectsFor === state.deleteTarget) state.objectsFor = '';
    state.deleteTarget = '';
    state.deleteConfirm = '';
    await loadMigrated();
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not delete the bucket.'));
  } finally {
    state.deleting = false;
  }
}

onMounted(loadMigrated);
</script>

<template>
  <div class="object-storages page" data-testid="object-storages-page">
    <header class="page-header">
      <p data-testid="object-storages-header">Object Storages</p>
    </header>
    <p class="intro">
      Buckets migrated into the target cloud. A bucket is migrated from its
      target model (Models > Target Models > Migrate Buckets), after it was
      collected from a cloud source service and recommended like a server.
    </p>

    <section class="step" data-testid="os-step-migrated">
      <div class="row">
        <p class="subtitle">Buckets in namespace {{ nsId }}</p>
        <p-button
          style-type="tertiary"
          icon-left="ic_refresh"
          :loading="state.loading"
          data-testid="os-migrated-refresh"
          @click="loadMigrated"
        >
          Refresh
        </p-button>
      </div>
      <table class="table" data-testid="os-migrated-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Bucket in the cloud</th>
            <th>Connection</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in migrated"
            :key="b.id"
            :data-testid="`os-migrated-${b.id}`"
            :data-status="b.status"
          >
            <td>{{ b.id }}</td>
            <td>{{ b.cspResourceName || '-' }}</td>
            <td>{{ b.connectionName || '-' }}</td>
            <td>{{ b.status || '-' }}</td>
            <td class="actions">
              <button
                type="button"
                class="link"
                :data-testid="`os-migrated-objects-${b.id}`"
                @click="handleShowObjects(b.id)"
              >
                Objects
              </button>
              <button
                type="button"
                class="link danger"
                :data-testid="`os-migrated-delete-${b.id}`"
                @click="state.deleteTarget = b.id"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!migrated.length && !state.loading">
            <td colspan="5" class="hint" data-testid="os-migrated-empty">
              No buckets migrated yet.
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="state.objectsFor"
        class="result"
        data-testid="os-migrated-objects"
      >
        <p class="subtitle">Objects in {{ state.objectsFor }}</p>
        <p v-if="state.objectsLoading" class="hint">Loading...</p>
        <p v-else-if="!state.objects.length" class="hint">
          The bucket is empty.
        </p>
        <ul v-else>
          <li v-for="o in state.objects" :key="o.key || o.Key">
            {{ o.key || o.Key }} ({{ formatBytes(o.size ?? o.Size) }})
          </li>
        </ul>
      </div>
    </section>

    <p-button-modal
      v-if="state.deleteTarget"
      :visible="!!state.deleteTarget"
      size="sm"
      backdrop
      :header-title="`Delete ${state.deleteTarget}?`"
      :disabled="state.deleteConfirm !== state.deleteTarget"
      :loading="state.deleting"
      @confirm="handleDeleteBucket"
      @cancel="state.deleteTarget = ''"
      @close="state.deleteTarget = ''"
    >
      <template #body>
        <p class="hint">
          This deletes the bucket in the target cloud. Type its ID to confirm.
        </p>
        <p-text-input
          v-model="state.deleteConfirm"
          data-testid="os-migrated-delete-confirm-input"
        />
      </template>
      <template #confirm-button>
        <span data-testid="os-migrated-delete-confirm">Delete</span>
      </template>
    </p-button-modal>
  </div>
</template>

<style scoped lang="postcss">
.object-storages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.page-header p {
  font-size: 1.5rem;
  font-weight: 700;
}
.intro,
.hint {
  font-size: 0.875rem;
  color: #6b7280;
}
.step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}
.subtitle {
  font-size: 1rem;
  font-weight: 700;
}
.row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
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
}
.link {
  color: #2563eb;
  font-size: 0.875rem;
  margin-right: 0.75rem;
}
.link.danger {
  color: #dc2626;
}
</style>
