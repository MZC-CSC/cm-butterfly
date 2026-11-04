<script setup lang="ts">
import {
  PButton,
  PFieldGroup,
  PSelectDropdown,
  PTab,
  PTextInput,
  PButtonModal,
  PSpinner,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, ref } from 'vue';
import { useGetProviderList } from '@/entities/provider/api';
import {
  deleteMigratedBucket,
  deleteObjectStorageModel,
  getObjectStorageSupport,
  inspectSourceBuckets,
  listBucketObjects,
  listMigratedBuckets,
  listObjectStorageModels,
  migrateObjectStorage,
  recommendObjectStorage,
  saveSourceModel,
  saveTargetModel,
  scanSourceBuckets,
} from '@/entities/objectStorage/api';
import {
  IArtifact,
  IMigratedBucket,
  IObjectStorageAccessRequest,
  IRecommendedObjectStorage,
  IScannedBucket,
  ISourceObjectStorage,
  OBJECT_STORAGE_SCHEMA,
  ObjectStorageSupport,
} from '@/entities/objectStorage/model/types';
import { useGetBeetleRequest } from '@/entities/mci/api';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Migrated buckets, plus cm-beetle's own four-step flow kept for testing.
 *
 * The console's flow collects a bucket from a cloud source service and takes it through
 * the source and target models. The three "cm-beetle direct" tabs below follow cm-beetle's
 * console instead (read the account with typed-in keys, recommend, create) and are kept so
 * that cm-beetle can be exercised on its own. The objects inside a bucket are a data
 * migration (cm-centipede) and are not moved here.
 */

const tabState = reactive({
  activeTab: 'migrated',
  tabs: [
    { name: 'migrated', label: 'Migrated Buckets' },
    { name: 'source', label: 'cm-beetle direct (test) 1. Source Buckets' },
    { name: 'target', label: '2. Target Recommendation' },
    { name: 'migrate', label: '3. Migration' },
  ],
});

const nsId = DEFAULT_NAMESPACE;
const resProviders = useGetProviderList();
const providerItems = computed(() =>
  (resProviders.data.value?.responseData?.output ?? []).map(p => ({
    name: p,
    label: p,
  })),
);

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

// ── 1. Source buckets ────────────────────────────────────────────────────────
// The credential is used for this read only and is not stored by the console.
const access = reactive({
  csp: '',
  region: '',
  accessKey: '',
  secretKey: '',
  tenantId: '',
  subscriptionId: '',
});
const scanned = ref<IScannedBucket[]>([]);
const selectedBuckets = ref<string[]>([]);
const inspected = ref<ISourceObjectStorage | null>(null);
const sourceState = reactive({
  scanning: false,
  inspecting: false,
  saving: false,
  modelName: '',
});

const isAzure = computed(() => access.csp === 'azure');

function accessRequest(): IObjectStorageAccessRequest {
  const req: IObjectStorageAccessRequest = {
    csp: access.csp,
    region: access.region.trim(),
    accessKeyId: access.accessKey,
    secretAccessKey: access.secretKey,
  };
  if (isAzure.value) {
    req.tenantId = access.tenantId;
    req.subscriptionId = access.subscriptionId;
  }
  return req;
}

const canScan = computed(
  () =>
    !!access.csp &&
    !!access.region.trim() &&
    !!access.accessKey &&
    !!access.secretKey,
);

async function handleScan() {
  sourceState.scanning = true;
  scanned.value = [];
  selectedBuckets.value = [];
  inspected.value = null;
  try {
    scanned.value = (await scanSourceBuckets(accessRequest())) ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not scan the account.'));
  } finally {
    sourceState.scanning = false;
  }
}

function toggleBucket(name: string) {
  const i = selectedBuckets.value.indexOf(name);
  if (i >= 0) selectedBuckets.value.splice(i, 1);
  else selectedBuckets.value.push(name);
}

async function handleInspect() {
  sourceState.inspecting = true;
  inspected.value = null;
  try {
    inspected.value = await inspectSourceBuckets(
      accessRequest(),
      selectedBuckets.value,
    );
    if (!sourceState.modelName) {
      sourceState.modelName = `os-src-${access.csp}-${Date.now()
        .toString()
        .slice(-6)}`;
    }
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not inspect the buckets.'));
  } finally {
    sourceState.inspecting = false;
  }
}

async function handleSaveSource() {
  if (!inspected.value) return;
  sourceState.saving = true;
  try {
    const saved = await saveSourceModel(
      sourceState.modelName.trim(),
      inspected.value.description ?? '',
      inspected.value,
    );
    showSuccessMessage('success', 'Source model saved');
    await loadSourceModels();
    selectedSourceModelId.value = saved?.id ?? '';
    tabState.activeTab = 'target';
  } catch (e) {
    showErrorMessage(
      'failed',
      errorText(e, 'Could not save the source model.'),
    );
  } finally {
    sourceState.saving = false;
  }
}

// ── 2. Target recommendation ─────────────────────────────────────────────────
const sourceModels = ref<IArtifact<ISourceObjectStorage>[]>([]);
const selectedSourceModelId = ref('');
const support = ref<ObjectStorageSupport>({});
const target = reactive({ csp: '', region: '', modelName: '' });
const recommended = ref<IRecommendedObjectStorage | null>(null);
const targetState = reactive({ recommending: false, saving: false });

const selectedSourceModel = computed(
  () =>
    sourceModels.value.find(m => m.id === selectedSourceModelId.value) ?? null,
);
const targetSupport = computed(() => support.value[target.csp] ?? null);

async function loadSourceModels() {
  try {
    sourceModels.value =
      (await listObjectStorageModels<ISourceObjectStorage>(
        OBJECT_STORAGE_SCHEMA.SOURCE,
      )) ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not load source models.'));
  }
}

async function handleRecommend() {
  if (!selectedSourceModel.value) return;
  targetState.recommending = true;
  recommended.value = null;
  try {
    recommended.value = await recommendObjectStorage(
      selectedSourceModel.value.payload,
      target.csp,
      target.region.trim(),
    );
    if (!target.modelName) {
      target.modelName = `os-tgt-${target.csp}-${Date.now()
        .toString()
        .slice(-6)}`;
    }
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Recommendation failed.'));
  } finally {
    targetState.recommending = false;
  }
}

async function handleSaveTarget() {
  if (!recommended.value || !selectedSourceModel.value) return;
  targetState.saving = true;
  try {
    const saved = await saveTargetModel(
      target.modelName.trim(),
      recommended.value.description ?? '',
      recommended.value,
      selectedSourceModel.value.id,
    );
    showSuccessMessage('success', 'Target model saved');
    await loadTargetModels();
    selectedTargetModelId.value = saved?.id ?? '';
    tabState.activeTab = 'migrate';
  } catch (e) {
    showErrorMessage(
      'failed',
      errorText(e, 'Could not save the target model.'),
    );
  } finally {
    targetState.saving = false;
  }
}

// ── 3. Migration ─────────────────────────────────────────────────────────────
const targetModels = ref<IArtifact<IRecommendedObjectStorage>[]>([]);
const selectedTargetModelId = ref('');
const migrateState = reactive({
  nameSeed: '',
  running: false,
  status: '' as '' | 'Handling' | 'Success' | 'Error',
  message: '',
  reqId: '',
});
const selectedTargetModel = computed(
  () =>
    targetModels.value.find(m => m.id === selectedTargetModelId.value) ?? null,
);

async function loadTargetModels() {
  try {
    targetModels.value =
      (await listObjectStorageModels<IRecommendedObjectStorage>(
        OBJECT_STORAGE_SCHEMA.TARGET,
      )) ?? [];
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not load target models.'));
  }
}

function newRequestId() {
  return `bf-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function pollRequest(reqId: string) {
  const res = useGetBeetleRequest(reqId);
  // cm-beetle keeps the request record after the call returns, so the outcome is read
  // from it rather than from the 202 that only says the request was taken.
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const { data } = await res.execute();
      const body: any = data.responseData;
      const details = body?.data ?? body;
      const status = details?.status as string | undefined;
      if (status === 'Success' || status === 'Error') {
        migrateState.status = status;
        migrateState.message = details?.errorResponse ?? '';
        return;
      }
      migrateState.status = 'Handling';
    } catch (e) {
      migrateState.status = 'Error';
      migrateState.message = errorText(e, 'Could not read the request status.');
      return;
    }
  }
}

async function handleMigrate() {
  if (!selectedTargetModel.value) return;
  migrateState.running = true;
  migrateState.status = 'Handling';
  migrateState.message = '';
  migrateState.reqId = newRequestId();
  try {
    await migrateObjectStorage(
      nsId,
      selectedTargetModel.value.payload,
      migrateState.reqId,
      migrateState.nameSeed.trim() || undefined,
    );
    await pollRequest(migrateState.reqId);
    if (migrateState.status === 'Success') {
      showSuccessMessage('success', 'Buckets created');
      await loadMigrated();
    }
  } catch (e) {
    migrateState.status = 'Error';
    migrateState.message = errorText(e, 'Migration request failed.');
  } finally {
    migrateState.running = false;
  }
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

async function handleDeleteModel(id: string) {
  try {
    await deleteObjectStorageModel(id);
    await Promise.all([loadSourceModels(), loadTargetModels()]);
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Could not delete the model.'));
  }
}

onMounted(async () => {
  resProviders.execute().catch(() => undefined);
  getObjectStorageSupport()
    .then(s => (support.value = s ?? {}))
    .catch(() => undefined);
  await Promise.all([loadSourceModels(), loadTargetModels(), loadMigrated()]);
});
</script>

<template>
  <div class="object-storages page" data-testid="object-storages-page">
    <header class="page-header">
      <p data-testid="object-storages-header">Object Storages</p>
    </header>
    <p class="intro">
      Buckets migrated into the target cloud. The tabs marked cm-beetle direct
      follow cm-beetle's own console (account keys typed in here) and are kept
      for testing cm-beetle on its own. The objects inside a bucket are moved by
      a data migration, which is not part of this screen.
    </p>

    <p-tab v-model="tabState.activeTab" :tabs="tabState.tabs">
      <!-- 1. Source buckets -->
      <template #source>
        <section class="step" data-testid="os-step-source">
          <p class="hint">
            Read the buckets of the account to migrate from. The access key is
            used for this read only and is not stored.
          </p>
          <div class="form-grid">
            <p-field-group label="Provider" required>
              <p-select-dropdown
                :menu="providerItems"
                :selected.sync="access.csp"
                placeholder="Select a provider"
                data-testid="os-source-provider"
                @select="v => (access.csp = v)"
              />
            </p-field-group>
            <p-field-group label="Region" required>
              <p-text-input
                v-model="access.region"
                data-testid="os-source-region"
                placeholder="e.g. ap-northeast-2"
              />
            </p-field-group>
            <p-field-group label="Access Key" required>
              <p-text-input
                v-model="access.accessKey"
                type="password"
                data-testid="os-source-access-key"
              />
            </p-field-group>
            <p-field-group label="Secret Key" required>
              <p-text-input
                v-model="access.secretKey"
                type="password"
                data-testid="os-source-secret-key"
              />
            </p-field-group>
            <template v-if="isAzure">
              <p-field-group label="Tenant ID" required>
                <p-text-input
                  v-model="access.tenantId"
                  data-testid="os-source-tenant-id"
                />
              </p-field-group>
              <p-field-group label="Subscription ID" required>
                <p-text-input
                  v-model="access.subscriptionId"
                  data-testid="os-source-subscription-id"
                />
              </p-field-group>
            </template>
          </div>
          <div class="row">
            <p-button
              style-type="secondary"
              icon-left="ic_search"
              :disabled="!canScan"
              :loading="sourceState.scanning"
              data-testid="os-source-scan"
              @click="handleScan"
            >
              Scan Buckets
            </p-button>
          </div>

          <table
            v-if="scanned.length"
            class="table"
            data-testid="os-source-bucket-table"
          >
            <thead>
              <tr>
                <th />
                <th>Bucket</th>
                <th>Region</th>
                <th>Size</th>
                <th>Objects</th>
                <th>Versioning</th>
                <th>Encryption</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in scanned"
                :key="b.bucketName"
                :data-testid="`os-source-bucket-${b.bucketName}`"
                :data-selected="selectedBuckets.includes(b.bucketName)"
                @click="toggleBucket(b.bucketName)"
              >
                <td>
                  <input
                    type="checkbox"
                    :checked="selectedBuckets.includes(b.bucketName)"
                  />
                </td>
                <td>{{ b.bucketName }}</td>
                <td>{{ b.region || '-' }}</td>
                <td>{{ formatBytes(b.sizeBytes) }}</td>
                <td>{{ b.objectCount ?? '-' }}</td>
                <td>{{ b.versioningEnabled ? 'on' : 'off' }}</td>
                <td>{{ b.encryptionType || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <p
            v-else-if="!sourceState.scanning && canScan"
            class="hint"
            data-testid="os-source-empty"
          >
            Scan the account to list its buckets.
          </p>

          <div v-if="scanned.length" class="row">
            <p-button
              style-type="secondary"
              :disabled="!selectedBuckets.length"
              :loading="sourceState.inspecting"
              data-testid="os-source-inspect"
              @click="handleInspect"
            >
              Inspect {{ selectedBuckets.length }} bucket(s)
            </p-button>
          </div>

          <div
            v-if="inspected"
            class="result"
            data-testid="os-source-inspected"
          >
            <p class="subtitle">Source model</p>
            <table class="table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Size</th>
                  <th>Objects</th>
                  <th>Versioning</th>
                  <th>Encryption</th>
                  <th>CORS</th>
                  <th>Public</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in inspected.sourceObjectStorages"
                  :key="b.bucketName"
                  :data-testid="`os-source-inspected-${b.bucketName}`"
                >
                  <td>{{ b.bucketName }}</td>
                  <td>{{ formatBytes(b.totalSizeBytes) }}</td>
                  <td>{{ b.objectCount ?? '-' }}</td>
                  <td>{{ b.versioningEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.encryptionEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.corsEnabled ? 'on' : 'off' }}</td>
                  <td>{{ b.isPublic ? 'yes' : 'no' }}</td>
                  <td>{{ b.accessFrequency || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="row">
              <p-field-group label="Source model name" required>
                <p-text-input
                  v-model="sourceState.modelName"
                  data-testid="os-source-model-name"
                />
              </p-field-group>
              <p-button
                style-type="primary"
                :disabled="!sourceState.modelName.trim()"
                :loading="sourceState.saving"
                data-testid="os-source-save"
                @click="handleSaveSource"
              >
                Save Source Model
              </p-button>
            </div>
          </div>
        </section>
      </template>

      <!-- 2. Target recommendation -->
      <template #target>
        <section class="step" data-testid="os-step-target">
          <p class="subtitle">Source models</p>
          <table class="table" data-testid="os-source-model-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Source</th>
                <th>Buckets</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in sourceModels"
                :key="m.id"
                :data-testid="`os-source-model-${m.name}`"
                :data-selected="m.id === selectedSourceModelId"
                @click="selectedSourceModelId = m.id"
              >
                <td>
                  <input
                    type="radio"
                    :checked="m.id === selectedSourceModelId"
                  />
                </td>
                <td>{{ m.name }}</td>
                <td>
                  {{ m.payload?.sourceCloud?.csp }} /
                  {{ m.payload?.sourceCloud?.region }}
                </td>
                <td>{{ m.payload?.sourceObjectStorages?.length ?? 0 }}</td>
                <td>{{ m.createTime }}</td>
                <td>
                  <button
                    type="button"
                    class="link danger"
                    :data-testid="`os-source-model-delete-${m.name}`"
                    @click.stop="handleDeleteModel(m.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              <tr v-if="!sourceModels.length">
                <td colspan="6" class="hint">No source models yet.</td>
              </tr>
            </tbody>
          </table>

          <div class="form-grid">
            <p-field-group label="Target provider" required>
              <p-select-dropdown
                :menu="providerItems"
                :selected.sync="target.csp"
                placeholder="Select a provider"
                data-testid="os-target-provider"
                @select="v => (target.csp = v)"
              />
            </p-field-group>
            <p-field-group label="Target region" required>
              <p-text-input
                v-model="target.region"
                data-testid="os-target-region"
                placeholder="e.g. ap-northeast-2"
              />
            </p-field-group>
          </div>
          <p v-if="targetSupport" class="hint" data-testid="os-target-support">
            {{ target.csp }} supports per bucket — CORS:
            {{ targetSupport.cors ? 'yes' : 'no' }}, versioning:
            {{ targetSupport.versioning ? 'yes' : 'no' }}. Settings it does not
            support are turned off in the recommendation.
          </p>
          <div class="row">
            <p-button
              style-type="secondary"
              :disabled="
                !selectedSourceModel || !target.csp || !target.region.trim()
              "
              :loading="targetState.recommending"
              data-testid="os-target-recommend"
              @click="handleRecommend"
            >
              Recommend
            </p-button>
          </div>

          <div
            v-if="recommended"
            class="result"
            data-testid="os-target-recommended"
          >
            <p class="subtitle">
              Target model ({{ recommended.targetCloud.csp }} /
              {{ recommended.targetCloud.region }})
            </p>
            <ul
              v-if="recommended.warnings && recommended.warnings.length"
              class="warnings"
              data-testid="os-target-warnings"
            >
              <li v-for="(w, i) in recommended.warnings" :key="i">{{ w }}</li>
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
                  v-for="(b, i) in recommended.targetObjectStorages"
                  :key="b.sourceBucketName"
                  :data-testid="`os-target-bucket-${b.sourceBucketName}`"
                >
                  <td>{{ b.sourceBucketName }}</td>
                  <td>
                    <p-text-input
                      v-model="recommended.targetObjectStorages[i].bucketName"
                      :data-testid="`os-target-bucket-name-${b.sourceBucketName}`"
                    />
                  </td>
                  <td>
                    <input
                      v-model="
                        recommended.targetObjectStorages[i].versioningEnabled
                      "
                      type="checkbox"
                      :disabled="targetSupport && !targetSupport.versioning"
                      :data-testid="`os-target-bucket-versioning-${b.sourceBucketName}`"
                    />
                  </td>
                  <td>{{ b.corsEnabled ? 'on' : 'off' }}</td>
                </tr>
              </tbody>
            </table>
            <p class="hint">
              The bucket name is the intended name. The target cloud requires
              globally unique names, so cb-tumblebug creates the actual bucket
              under a generated name.
            </p>
            <div class="row">
              <p-field-group label="Target model name" required>
                <p-text-input
                  v-model="target.modelName"
                  data-testid="os-target-model-name"
                />
              </p-field-group>
              <p-button
                style-type="primary"
                :disabled="!target.modelName.trim()"
                :loading="targetState.saving"
                data-testid="os-target-save"
                @click="handleSaveTarget"
              >
                Save Target Model
              </p-button>
            </div>
          </div>
        </section>
      </template>

      <!-- 3. Migration -->
      <template #migrate>
        <section class="step" data-testid="os-step-migrate">
          <p class="subtitle">Target models</p>
          <table class="table" data-testid="os-target-model-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Target</th>
                <th>Buckets</th>
                <th>From source model</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in targetModels"
                :key="m.id"
                :data-testid="`os-target-model-${m.name}`"
                :data-selected="m.id === selectedTargetModelId"
                @click="selectedTargetModelId = m.id"
              >
                <td>
                  <input
                    type="radio"
                    :checked="m.id === selectedTargetModelId"
                  />
                </td>
                <td>{{ m.name }}</td>
                <td>
                  {{ m.payload?.targetCloud?.csp }} /
                  {{ m.payload?.targetCloud?.region }}
                </td>
                <td>{{ m.payload?.targetObjectStorages?.length ?? 0 }}</td>
                <td>{{ m.lineage?.sourceModelId || '-' }}</td>
                <td>
                  <button
                    type="button"
                    class="link danger"
                    :data-testid="`os-target-model-delete-${m.name}`"
                    @click.stop="handleDeleteModel(m.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              <tr v-if="!targetModels.length">
                <td colspan="6" class="hint">No target models yet.</td>
              </tr>
            </tbody>
          </table>
          <div class="row">
            <p-field-group label="Name prefix (optional)">
              <p-text-input
                v-model="migrateState.nameSeed"
                data-testid="os-migrate-name-seed"
                placeholder="e.g. mig"
              />
            </p-field-group>
            <p-button
              style-type="primary"
              :disabled="!selectedTargetModel || migrateState.running"
              :loading="migrateState.running"
              data-testid="os-migrate-start"
              @click="handleMigrate"
            >
              Create Buckets
            </p-button>
          </div>
          <p
            v-if="migrateState.status"
            class="status"
            :data-status="migrateState.status"
            data-testid="os-migrate-status"
          >
            <p-spinner v-if="migrateState.status === 'Handling'" size="sm" />
            {{ migrateState.status }}
            <span v-if="migrateState.message">
              — {{ migrateState.message }}</span
            >
            <span class="req">request {{ migrateState.reqId }}</span>
          </p>
        </section>
      </template>

      <!-- Migrated buckets -->
      <template #migrated>
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
      </template>
    </p-tab>

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
