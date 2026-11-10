<script setup lang="ts">
import { computed } from 'vue';
import type { IObjectStorageModel } from '@/entities/objectStorage/model/types';
import { formatBytes } from '@/widgets/models/objectStorageBuckets/model/format';

/**
 * The buckets of an object storage model, shown under the model detail on Source Models and
 * Target Models. A source or planning model lists the source buckets as collected; a target
 * model lists the buckets to create and the settings the target cloud could not keep.
 */
interface IProps {
  model: IObjectStorageModel;
}
const props = defineProps<IProps>();

const isTarget = computed(() => props.model.modelStage === 'target');
const source = computed(() => props.model.sourceObjectStorageModel);
const target = computed(() => props.model.targetObjectStorageModel);
const cloud = computed(() =>
  isTarget.value ? target.value?.targetCloud : source.value?.sourceCloud,
);

function onOff(value?: boolean) {
  return value ? 'on' : 'off';
}
</script>

<template>
  <section
    class="os-buckets"
    data-testid="os-model-buckets"
    :data-stage="model.modelStage"
  >
    <p class="title">
      Buckets
      <span class="cloud" data-testid="os-model-buckets-cloud">
        {{ cloud?.csp || '-' }} / {{ cloud?.region || '-' }}
      </span>
    </p>
    <template v-if="isTarget">
      <ul
        v-if="target?.warnings?.length"
        class="warnings"
        data-testid="os-model-buckets-warnings"
      >
        <li v-for="(w, i) in target.warnings" :key="i">{{ w }}</li>
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
            v-for="b in target?.targetObjectStorages ?? []"
            :key="b.sourceBucketName"
            :data-testid="`os-model-bucket-${b.sourceBucketName}`"
          >
            <td>{{ b.sourceBucketName }}</td>
            <td>{{ b.bucketName }}</td>
            <td>{{ onOff(b.versioningEnabled) }}</td>
            <td>{{ onOff(b.corsEnabled) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <table v-else class="table">
      <thead>
        <tr>
          <th>Bucket</th>
          <th>Versioning</th>
          <th>Encryption</th>
          <th>Public</th>
          <th>CORS</th>
          <th>Size</th>
          <th>Objects</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="b in source?.sourceObjectStorages ?? []"
          :key="b.bucketName"
          :data-testid="`os-model-bucket-${b.bucketName}`"
        >
          <td>{{ b.bucketName }}</td>
          <td>{{ onOff(b.versioningEnabled) }}</td>
          <td>{{ onOff(b.encryptionEnabled) }}</td>
          <td>{{ b.isPublic ? 'yes' : 'no' }}</td>
          <td>{{ onOff(b.corsEnabled) }}</td>
          <td>{{ formatBytes(b.totalSizeBytes) }}</td>
          <td>{{ b.objectCount ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped lang="postcss">
.os-buckets {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}
.title {
  font-size: 1rem;
  font-weight: 700;
}
.cloud {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  font-weight: 400;
  color: #6b7280;
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
.warnings {
  font-size: 0.875rem;
  color: #a16207;
  list-style: disc;
  padding-left: 1.25rem;
}
</style>
