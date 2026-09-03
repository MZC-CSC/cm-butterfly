<script setup lang="ts">
import { useMciDetailModel } from '@/widgets/workload/mci/mciDetail/model';
import { onBeforeMount, watch } from 'vue';
import { PBadge, PDefinitionTable } from '@cloudforet-test/mirinae';

interface IProps {
  selectedMciId: string;
  nsId?: string;
}

const props = defineProps<IProps>();
const mciDetailModel = useMciDetailModel();

onBeforeMount(() => {
  mciDetailModel.initTable();
  mciDetailModel.tableModel.tableState.loading = false;
});

watch(
  props,
  nv => {
    mciDetailModel.setNsId(nv.nsId ?? '');
    mciDetailModel.setMciId(nv.selectedMciId);
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p-definition-table
      data-testid="mci-detail-table"
      :fields="mciDetailModel.tableModel.tableState.fields"
      :data="mciDetailModel.tableModel.tableState.data"
      :loading="mciDetailModel.tableModel.tableState.loading"
    >
      <template #data-nsId="{ data }">
        <span data-testid="infra-info-nsid">{{ data }}</span>
      </template>
      <template #data-id="{ data }">
        <span data-testid="infra-info-id">{{ data }}</span>
      </template>
      <template #data-provider="{ data }">
        <p-badge
          v-for="(provider, index) in data"
          :key="index"
          :background-color="provider.color"
          class="mr-1"
        >
          {{ provider.name }}
        </p-badge>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss"></style>
