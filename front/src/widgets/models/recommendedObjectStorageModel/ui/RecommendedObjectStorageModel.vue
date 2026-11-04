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
import {
  getObjectStorageSupport,
  recommendObjectStorage,
  saveTargetModel,
} from '@/entities/objectStorage/api';
import type {
  IArtifact,
  IRecommendedObjectStorage,
  ISourceObjectStorage,
  ObjectStorageSupport,
} from '@/entities/objectStorage/model/types';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Recommends target buckets for an object storage source model and saves the result as a
 * target model (cm-beetle RecommendObjectStorage, then an artifact whose parent is the
 * source model). Same place in the flow as the infra and software recommendations.
 */
interface IProps {
  source: IArtifact<ISourceObjectStorage>;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal', 'saved']);

const sourceArtifact = computed(() => props.source);
const sourceBuckets = computed(
  () => sourceArtifact.value?.payload?.sourceObjectStorages ?? [],
);

const resProviders = useGetProviderList();
const providerItems = computed(() =>
  (resProviders.data.value?.responseData?.output ?? []).map(p => ({
    name: p,
    label: p,
  })),
);

const support = ref<ObjectStorageSupport>({});
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
  if (!sourceArtifact.value) return;
  state.recommending = true;
  recommended.value = null;
  try {
    recommended.value = await recommendObjectStorage(
      sourceArtifact.value.payload,
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
    state.recommending = false;
  }
}

async function handleSave() {
  if (!recommended.value || !sourceArtifact.value) return;
  state.saving = true;
  try {
    const saved = await saveTargetModel(
      target.modelName.trim(),
      recommended.value.description ?? '',
      recommended.value,
      sourceArtifact.value.id,
    );
    state.saved = true;
    showSuccessMessage('success', 'Target model saved');
    emit('saved', saved);
  } catch (e) {
    showErrorMessage(
      'failed',
      errorText(e, 'Could not save the target model.'),
    );
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
          Source model: <b>{{ sourceArtifact?.name }}</b> ({{
            sourceArtifact?.payload?.sourceCloud?.csp
          }}
          / {{ sourceArtifact?.payload?.sourceCloud?.region }}) ·
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
            <p-text-input
              v-model="target.region"
              data-testid="os-recommend-region"
              placeholder="e.g. ap-northeast-2"
            />
          </p-field-group>
          <p-button
            style-type="secondary"
            icon-left="ic_search"
            :disabled="!target.csp || !target.region.trim()"
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
                ? 'Saved. The target model is listed on the Target tab.'
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
