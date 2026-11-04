<script setup lang="ts">
import { PButton, PButtonModal, PTextInput } from '@cloudforet-test/mirinae';
import { onMounted, reactive, ref } from 'vue';
import {
  deleteMigratedBucket,
  listBucketObjects,
  listMigratedBuckets,
} from '@/entities/objectStorage/api';
import { IMigratedBucket } from '@/entities/objectStorage/model/types';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Buckets migrated into the target cloud from an object storage target model
 * (Models > Object Storage Models > Target > Migrate Buckets). The objects inside a bucket
 * are a data migration (cm-centipede) and are not moved here. cm-beetle's own direct flow,
 * kept for testing, is under System > Develop.
 */
const nsId = DEFAULT_NAMESPACE;

function errorText(e: unknown, fallback: string) {
  return (
    (e as any)?.response?.data?.responseData?.message ||
    (e as any)?.response?.data?.message ||
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

// ── Migrated buckets ─────────────────────────────────────────────────────────
const migrated = ref<IMigratedBucket[]>([]);
const migratedState = reactive({
  loading: false,
  objectsFor: '',
  objects: [] as any[],
  objectsLoading: false,
  deleteTarget: '',
  deleteConfirm: '',
  deleting: false,
});

async function loadMigrated() {
  migratedState.loading = true;
  try {
    migrated.value = (await listMigratedBuckets(nsId)) ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not list the buckets.'));
  } finally {
    migratedState.loading = false;
  }
}

async function handleShowObjects(osId: string) {
  migratedState.objectsFor = osId;
  migratedState.objects = [];
  migratedState.objectsLoading = true;
  try {
    const res = await listBucketObjects(nsId, osId);
    migratedState.objects = res?.objects ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not list the objects.'));
  } finally {
    migratedState.objectsLoading = false;
  }
}

async function handleDeleteBucket() {
  migratedState.deleting = true;
  try {
    await deleteMigratedBucket(nsId, migratedState.deleteTarget);
    showSuccessMessage('success', 'Bucket deleted');
    migratedState.deleteTarget = '';
    migratedState.deleteConfirm = '';
    await loadMigrated();
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not delete the bucket.'));
  } finally {
    migratedState.deleting = false;
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
      Buckets migrated into the target cloud from an object storage target
      model. The objects inside a bucket are moved by a data migration, which is
      not part of this screen.
    </p>
    <section class="step" data-testid="os-step-migrated">
      <div class="row">
        <p class="subtitle">Buckets in namespace {{ nsId }}</p>
        <p-button
          style-type="tertiary"
          icon-left="ic_refresh"
          :loading="migratedState.loading"
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
                @click="migratedState.deleteTarget = b.id"
              >
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!migrated.length && !migratedState.loading">
            <td colspan="5" class="hint">No buckets migrated yet.</td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="migratedState.objectsFor"
        class="result"
        data-testid="os-migrated-objects"
      >
        <p class="subtitle">Objects in {{ migratedState.objectsFor }}</p>
        <p v-if="migratedState.objectsLoading" class="hint">Loading...</p>
        <p v-else-if="!migratedState.objects.length" class="hint">
          The bucket is empty.
        </p>
        <ul v-else>
          <li v-for="o in migratedState.objects" :key="o.key || o.Key">
            {{ o.key || o.Key }} ({{ formatBytes(o.size ?? o.Size) }})
          </li>
        </ul>
      </div>
    </section>

    <p-button-modal
      v-if="migratedState.deleteTarget"
      :visible="!!migratedState.deleteTarget"
      size="sm"
      backdrop
      :header-title="`Delete ${migratedState.deleteTarget}?`"
      :disabled="migratedState.deleteConfirm !== migratedState.deleteTarget"
      :loading="migratedState.deleting"
      @confirm="handleDeleteBucket"
      @cancel="migratedState.deleteTarget = ''"
      @close="migratedState.deleteTarget = ''"
    >
      <template #body>
        <p class="hint">
          This deletes the bucket in the target cloud. Type its ID to confirm.
        </p>
        <p-text-input
          v-model="migratedState.deleteConfirm"
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
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1rem;
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
.table tbody tr {
  cursor: pointer;
}
.table tbody tr[data-selected='true'] {
  background: #e8f0fe;
}
.warnings {
  font-size: 0.875rem;
  color: #a16207;
  list-style: disc;
  padding-left: 1.25rem;
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
.status .req {
  font-size: 0.75rem;
  color: #9ca3af;
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
