<script setup lang="ts">
import { i18n } from '@/app/i18n';
import {
  PButtonModal,
  PButton,
  PFieldGroup,
  PSelectDropdown,
  PTextInput,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, ref } from 'vue';
import { useGetProviderList } from '@/entities/provider/api';
import RegionSelect from '@/entities/provider/ui/RegionSelect.vue';
import {
  getObjectStorageSupport,
  recommendObjectStorage,
} from '@/entities/objectStorage/api';
import type {
  IObjectStorageModel,
  IRecommendedObjectStorage,
  ObjectStorageSupport,
} from '@/entities/objectStorage/model/types';
import {
  beetleLineageOf,
  createObjectStorageModel,
  describeModelError,
  targetLineageFrom,
} from '@/entities/migrationModel';
import { useAuth } from '@/features/auth/model/useAuth.ts';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Recommends target buckets for an object storage planning model (cm-beetle
 * RecommendObjectStorage) and saves the result in cm-damselfly as a target model whose parent
 * is that planning model. Same place in the flow as the infra recommendation: a source model is
 * read-only and recommendations start from a planning model.
 *
 * The request carries the lineage as the infra recommendation does. cm-beetle 0.6.4 does not
 * read it for object storage yet, so for now the lineage is kept by cm-damselfly alone.
 */
interface IProps {
  source: IObjectStorageModel;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal', 'saved']);

const auth = useAuth();
const sourceModel = computed(() => props.source);
const sourceStorage = computed(
  () => sourceModel.value?.sourceObjectStorageModel,
);
const sourceBuckets = computed(
  () => sourceStorage.value?.sourceObjectStorages ?? [],
);

const resProviders = useGetProviderList();
const support = ref<ObjectStorageSupport>({});
// Providers with a registered target account that cb-tumblebug also lists as having
// object storage. A provider outside that list cannot create a bucket.
const providerItems = computed(() =>
  (resProviders.data.value?.responseData?.output ?? [])
    .filter(p => !!support.value[p])
    .map(p => ({ name: p, label: p })),
);

const target = reactive({ csp: '', region: '', modelName: '' });
const recommended = ref<IRecommendedObjectStorage | null>(null);
const state = reactive({ recommending: false, saving: false, saved: false });
const targetSupport = computed(() => support.value[target.csp] ?? null);

function errorText(e: unknown, fallback: string) {
  return (
    (e as any)?.response?.data?.responseData?.message ||
    (e as any)?.message ||
    fallback
  );
}

onMounted(() => {
  resProviders.execute().catch(() => undefined);
  getObjectStorageSupport()
    .then(s => (support.value = s ?? {}))
    .catch(e =>
      showErrorMessage('failed', errorText(e, 'Could not read CSP support.')),
    );
});

async function handleRecommend() {
  // mirinae shows a disabled button by class only, so the guard is here.
  if (!sourceStorage.value || !target.csp || !target.region) return;
  state.recommending = true;
  recommended.value = null;
  try {
    recommended.value = await recommendObjectStorage(
      sourceStorage.value,
      target.csp,
      target.region,
      beetleLineageOf(sourceModel.value) as Record<string, string>,
    );
    if (!target.modelName) {
      target.modelName = `os-tgt-${target.csp}-${Date.now()
        .toString()
        .slice(-6)}`;
    }
  } catch (e) {
    showErrorMessage('failed', errorText(e, 'Recommendation failed.'));
  } finally {
    state.recommending = false;
  }
}

async function handleSave() {
  if (!recommended.value || !sourceModel.value) return;
  let lineageReq;
  try {
    lineageReq = targetLineageFrom(sourceModel.value);
  } catch (e: any) {
    showErrorMessage('failed', e.message);
    return;
  }
  state.saving = true;
  try {
    const res = await createObjectStorageModel('target', {
      userModelName: target.modelName.trim(),
      description: recommended.value.description ?? '',
      userId: auth.getUser().id,
      userModelVersion: 'v0.1',
      isInitUserModel: false,
      targetObjectStorageModel: recommended.value,
      ...lineageReq,
    });
    state.saved = true;
    showSuccessMessage('success', 'Target model saved');
    emit('saved', res.data?.responseData);
  } catch (e) {
    showErrorMessage('failed', describeModelError(e).message);
  } finally {
    state.saving = false;
  }
}

function handleClose() {
  emit('update:close-modal', false);
}
</script>

<template>
  <p-button-modal
    :visible="true"
    header-title="Recommended Object Storage"
    size="lg"
    :disabled="!recommended || !target.modelName.trim() || state.saved"
    :loading="state.saving"
    @confirm="handleSave"
    @cancel="handleClose"
    @close="handleClose"
  >
    <template #body>
      <div class="os-recommend" data-testid="os-recommend-body">
        <p class="note">
          Planning model: <b>{{ sourceModel?.userModelName }}</b> ({{
            sourceStorage?.sourceCloud?.csp
          }}
          / {{ sourceStorage?.sourceCloud?.region }}) ·
          {{ sourceBuckets.length }} bucket(s)
        </p>
        <div class="form-row">
          <p-field-group label="Target Provider" required>
            <p-select-dropdown
              :menu="providerItems"
              :selected.sync="target.csp"
              placeholder="Select a provider"
              use-fixed-menu-style
              data-testid="os-recommend-provider"
              @select="v => (target.csp = v)"
            />
          </p-field-group>
          <p-field-group label="Target Region" required>
            <region-select
              v-model="target.region"
              :provider="target.csp"
              testid="os-recommend-region"
            />
          </p-field-group>
          <p-button
            style-type="secondary"
            icon-left="ic_search"
            :disabled="!target.csp || !target.region"
            :loading="state.recommending"
            data-testid="os-recommend-run"
            @click="handleRecommend"
          >
            Recommend
          </p-button>
        </div>
        <p class="note" data-testid="os-recommend-support">
          {{
            targetSupport
              ? `${target.csp} supports per bucket: CORS ${
                  targetSupport.cors ? 'yes' : 'no'
                }, versioning ${
                  targetSupport.versioning ? 'yes' : 'no'
                }. Settings it does not support are turned off.`
              : 'Choose a target provider and region.'
          }}
        </p>

        <template v-if="recommended">
          <ul
            v-if="recommended.warnings && recommended.warnings.length"
            class="warnings"
            data-testid="os-recommend-warnings"
          >
            <li v-for="(w, i) in recommended.warnings" :key="i">{{ w }}</li>
          </ul>
          <table class="table" data-testid="os-recommend-table">
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
                :data-testid="`os-recommend-bucket-${b.sourceBucketName}`"
              >
                <td>{{ b.sourceBucketName }}</td>
                <td>
                  <p-text-input
                    v-model="recommended.targetObjectStorages[i].bucketName"
                    :data-testid="`os-recommend-bucket-name-${b.sourceBucketName}`"
                  />
                </td>
                <td>
                  <input
                    v-model="
                      recommended.targetObjectStorages[i].versioningEnabled
                    "
                    type="checkbox"
                    :disabled="targetSupport && !targetSupport.versioning"
                  />
                </td>
                <td>{{ b.corsEnabled ? 'on' : 'off' }}</td>
              </tr>
            </tbody>
          </table>
          <p class="note">
            The bucket name is the intended name. Bucket names must be globally
            unique, so the bucket is created under a generated name.
          </p>
          <p-field-group label="Target Model Name" required>
            <p-text-input
              v-model="target.modelName"
              data-testid="os-recommend-model-name"
            />
          </p-field-group>
          <p class="saved" data-testid="os-recommend-saved">
            {{
              state.saved
                ? 'Saved. The target model is listed on Target Models.'
                : ''
            }}
          </p>
        </template>
      </div>
    </template>
    <template #close-button>
      <span data-testid="os-recommend-close">{{
        i18n.t('COMPONENT.BUTTON_MODAL.CANCEL')
      }}</span>
    </template>
    <template #confirm-button>
      <span data-testid="os-recommend-save">Save as a Target Model</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.os-recommend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: end;
  column-gap: 0.75rem;
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
.warnings {
  font-size: 0.875rem;
  color: #a16207;
  list-style: disc;
  padding-left: 1.25rem;
}
.saved {
  font-size: 0.875rem;
  color: #15803d;
}
.link {
  color: #1d4ed8;
  margin-left: 0.5rem;
}
</style>
