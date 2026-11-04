<script setup lang="ts">
import { PButton, PButtonModal, PTab } from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  deleteObjectStorageModel,
  listObjectStorageModels,
} from '@/entities/objectStorage/api';
import {
  IArtifact,
  IRecommendedObjectStorage,
  ISourceObjectStorage,
  OBJECT_STORAGE_SCHEMA,
} from '@/entities/objectStorage/model/types';
import CreateObjectStorageSourceModelModal from '@/widgets/models/createObjectStorageSourceModel/ui/CreateObjectStorageSourceModelModal.vue';
import RecommendedObjectStorageModel from '@/widgets/models/recommendedObjectStorageModel/ui/RecommendedObjectStorageModel.vue';
import MigrateObjectStorageModal from '@/widgets/models/migrateObjectStorage/ui/MigrateObjectStorageModal.vue';
import ObjectStorageModelView from '@/widgets/models/objectStorageModelView/ui/ObjectStorageModelView.vue';
import {
  formatDate,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';

/**
 * Object storage source and target models, and the steps between them: create a source
 * model from buckets registered in a cloud source service, take a recommendation as a
 * target model, then create the buckets from the target model.
 *
 * This is its own menu because cm-damselfly, which keeps the infra and software models,
 * has no object storage model yet; these models are kept in cm-beetle's artifact store.
 * Once cm-damselfly keeps them, they move into Source Models / Target Models.
 */
type SourceModel = IArtifact<ISourceObjectStorage>;
type TargetModel = IArtifact<IRecommendedObjectStorage>;

const tabState = reactive({
  activeTab: 'source',
  tabs: [
    { name: 'source', label: 'Source' },
    { name: 'target', label: 'Target' },
  ],
});

const sources = ref<SourceModel[]>([]);
const targets = ref<TargetModel[]>([]);
const state = reactive({
  loading: false,
  selectedSourceId: '',
  selectedTargetId: '',
  createOpen: false,
  recommendOpen: false,
  migrateOpen: false,
  viewArtifact: null as any,
  deleteTarget: null as null | { id: string; name: string },
  deleting: false,
  targetSaved: false,
});

const selectedSource = computed(
  () => sources.value.find(m => m.id === state.selectedSourceId) ?? null,
);
const selectedTarget = computed(
  () => targets.value.find(m => m.id === state.selectedTargetId) ?? null,
);

function errorText(e: unknown, fallback: string) {
  return (e as any)?.message || fallback;
}

function sourceName(id?: string) {
  if (!id) return '-';
  return sources.value.find(m => m.id === id)?.name ?? id;
}

async function load() {
  state.loading = true;
  try {
    const [s, t] = await Promise.all([
      listObjectStorageModels<ISourceObjectStorage>(
        OBJECT_STORAGE_SCHEMA.SOURCE,
      ),
      listObjectStorageModels<IRecommendedObjectStorage>(
        OBJECT_STORAGE_SCHEMA.TARGET,
      ),
    ]);
    sources.value = s ?? [];
    targets.value = t ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not load the models.'));
  } finally {
    state.loading = false;
  }
}

function onSourceSaved(model: SourceModel) {
  load().then(() => (state.selectedSourceId = model?.id ?? ''));
}

function onTargetSaved(model: TargetModel) {
  state.targetSaved = true;
  load().then(() => {
    state.selectedTargetId = model?.id ?? '';
  });
}

// After a target model is saved, closing the recommendation moves on to it.
function closeRecommend() {
  state.recommendOpen = false;
  if (state.targetSaved) tabState.activeTab = 'target';
  state.targetSaved = false;
}

async function handleDelete() {
  if (!state.deleteTarget) return;
  state.deleting = true;
  try {
    await deleteObjectStorageModel(state.deleteTarget.id);
    showSuccessMessage('success', 'Model deleted');
    if (state.selectedSourceId === state.deleteTarget.id)
      state.selectedSourceId = '';
    if (state.selectedTargetId === state.deleteTarget.id)
      state.selectedTargetId = '';
    state.deleteTarget = null;
    await load();
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not delete the model.'));
  } finally {
    state.deleting = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="os-models page" data-testid="os-models-page">
    <header class="page-header">
      <p data-testid="os-models-header">Object Storage Models</p>
    </header>
    <p class="intro">
      Buckets are migrated the same way as servers: a source model from the
      buckets registered in a cloud source service, a recommended target model,
      then the buckets are created from the target model and managed under
      Workload Operations &gt; Object Storages.
    </p>

    <p-tab v-model="tabState.activeTab" :tabs="tabState.tabs">
      <!-- Source models -->
      <template #source>
        <section class="step" data-testid="os-models-source">
          <div class="row">
            <p-button
              style-type="primary"
              icon-left="ic_plus_bold"
              data-testid="os-models-source-create"
              @click="state.createOpen = true"
            >
              Create Source Model
            </p-button>
            <p-button
              style-type="tertiary"
              icon-left="ic_refresh"
              :loading="state.loading"
              data-testid="os-models-refresh"
              @click="load"
            >
              Refresh
            </p-button>
          </div>
          <table class="table" data-testid="os-models-source-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th>Source cloud</th>
                <th>Buckets</th>
                <th>Description</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in sources"
                :key="m.id"
                :data-testid="`os-models-source-${m.name}`"
                :data-id="m.id"
                :data-selected="m.id === state.selectedSourceId"
                @click="state.selectedSourceId = m.id"
              >
                <td>{{ m.name }}</td>
                <td>{{ m.id }}</td>
                <td>
                  {{ m.payload?.sourceCloud?.csp || '-' }} /
                  {{ m.payload?.sourceCloud?.region || '-' }}
                </td>
                <td>{{ m.payload?.sourceObjectStorages?.length ?? 0 }}</td>
                <td>{{ m.description || '-' }}</td>
                <td>{{ m.createTime ? formatDate(m.createTime) : '-' }}</td>
              </tr>
              <tr v-if="!sources.length && !state.loading">
                <td colspan="6" class="hint">
                  No source models yet. Create one from the buckets of a cloud
                  source service.
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="selectedSource"
            class="detail"
            data-testid="os-models-source-detail"
          >
            <div class="row">
              <p class="subtitle">{{ selectedSource.name }}</p>
              <p-button
                style-type="secondary"
                data-testid="os-models-source-recommend"
                @click="state.recommendOpen = true"
              >
                Recommend Target
              </p-button>
              <p-button
                style-type="tertiary"
                data-testid="os-models-source-view"
                @click="state.viewArtifact = selectedSource"
              >
                View JSON
              </p-button>
              <p-button
                style-type="negative-secondary"
                data-testid="os-models-source-delete"
                @click="
                  state.deleteTarget = {
                    id: selectedSource.id,
                    name: selectedSource.name,
                  }
                "
              >
                Delete
              </p-button>
            </div>
            <p class="hint">
              Source service {{ selectedSource.sourceGroupId || '-' }} · A
              source model is the original and is not edited; change the target
              bucket names and settings in the recommendation.
            </p>
            <table class="table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Versioning</th>
                  <th>Encryption</th>
                  <th>Public</th>
                  <th>Access</th>
                  <th>CORS</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in selectedSource.payload?.sourceObjectStorages ??
                  []"
                  :key="b.bucketName"
                >
                  <td>{{ b.bucketName }}</td>
                  <td>{{ b.versioningEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.encryptionEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.isPublic ? 'yes' : 'no' }}</td>
                  <td>{{ b.accessFrequency || '-' }}</td>
                  <td>{{ b.corsEnabled ? 'on' : 'off' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- Target models -->
      <template #target>
        <section class="step" data-testid="os-models-target">
          <div class="row">
            <p-button
              style-type="tertiary"
              icon-left="ic_refresh"
              :loading="state.loading"
              @click="load"
            >
              Refresh
            </p-button>
          </div>
          <table class="table" data-testid="os-models-target-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th>Target cloud</th>
                <th>Buckets</th>
                <th>From source model</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in targets"
                :key="m.id"
                :data-testid="`os-models-target-${m.name}`"
                :data-id="m.id"
                :data-source-model-id="m.lineage?.sourceModelId"
                :data-selected="m.id === state.selectedTargetId"
                @click="state.selectedTargetId = m.id"
              >
                <td>{{ m.name }}</td>
                <td>{{ m.id }}</td>
                <td>
                  {{ m.payload?.targetCloud?.csp }} /
                  {{ m.payload?.targetCloud?.region }}
                </td>
                <td>{{ m.payload?.targetObjectStorages?.length ?? 0 }}</td>
                <td>{{ sourceName(m.lineage?.sourceModelId) }}</td>
                <td>{{ m.createTime ? formatDate(m.createTime) : '-' }}</td>
              </tr>
              <tr v-if="!targets.length && !state.loading">
                <td colspan="6" class="hint">
                  No target models yet. Recommend one from a source model.
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="selectedTarget"
            class="detail"
            data-testid="os-models-target-detail"
          >
            <div class="row">
              <p class="subtitle">{{ selectedTarget.name }}</p>
              <p-button
                style-type="primary"
                data-testid="os-models-target-migrate"
                @click="state.migrateOpen = true"
              >
                Migrate Buckets
              </p-button>
              <p-button
                style-type="tertiary"
                data-testid="os-models-target-view"
                @click="state.viewArtifact = selectedTarget"
              >
                View JSON
              </p-button>
              <p-button
                style-type="negative-secondary"
                data-testid="os-models-target-delete"
                @click="
                  state.deleteTarget = {
                    id: selectedTarget.id,
                    name: selectedTarget.name,
                  }
                "
              >
                Delete
              </p-button>
            </div>
            <ul
              v-if="selectedTarget.payload?.warnings?.length"
              class="warnings"
            >
              <li v-for="(w, i) in selectedTarget.payload.warnings" :key="i">
                {{ w }}
              </li>
            </ul>
            <table class="table">
              <thead>
                <tr>
                  <th>Source bucket</th>
                  <th>Target bucket name</th>
                  <th>Versioning</th>
                  <th>CORS</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in selectedTarget.payload?.targetObjectStorages ??
                  []"
                  :key="b.sourceBucketName"
                >
                  <td>{{ b.sourceBucketName }}</td>
                  <td>{{ b.bucketName }}</td>
                  <td>{{ b.versioningEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.corsEnabled ? 'on' : 'off' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </p-tab>

    <div class="relative z-70">
      <create-object-storage-source-model-modal
        v-if="state.createOpen"
        @saved="onSourceSaved"
        @update:close-modal="state.createOpen = false"
      />
      <recommended-object-storage-model
        v-if="state.recommendOpen && selectedSource"
        :source="selectedSource"
        @saved="onTargetSaved"
        @update:close-modal="closeRecommend"
      />
      <migrate-object-storage-modal
        v-if="state.migrateOpen && selectedTarget"
        :target="selectedTarget"
        @update:close-modal="state.migrateOpen = false"
      />
      <object-storage-model-view
        v-if="state.viewArtifact"
        :artifact="state.viewArtifact"
        @update:close-modal="state.viewArtifact = null"
      />
      <p-button-modal
        v-if="state.deleteTarget"
        :visible="true"
        size="sm"
        backdrop
        theme-color="alert"
        :header-title="`Delete ${state.deleteTarget.name}?`"
        :loading="state.deleting"
        @confirm="handleDelete"
        @cancel="state.deleteTarget = null"
        @close="state.deleteTarget = null"
      >
        <template #body>
          <p class="hint">
            Deletes the model only. Buckets already created stay in the target
            cloud.
          </p>
        </template>
        <template #confirm-button>
          <span data-testid="os-models-delete-confirm">Delete</span>
        </template>
      </p-button-modal>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.os-models {
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
  margin-right: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  background: #fff;
}
.table {
  width: 100%;
  font-size: 0.875rem;
  border: 1px solid #e5e7eb;
  border-collapse: collapse;
  background: #fff;
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
</style>
