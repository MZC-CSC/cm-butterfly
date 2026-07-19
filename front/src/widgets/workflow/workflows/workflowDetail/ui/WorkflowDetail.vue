<script setup lang="ts">
import { PDefinitionTable } from '@cloudforet-test/mirinae';
import { useWorkflowDetailModel } from '@/widgets/workflow/workflows/workflowDetail/model/workflowDetailModel';
import { onBeforeMount, watch, watchEffect } from 'vue';

interface iProps {
  selectedWorkflowId: string;
}

const props = defineProps<iProps>();

const emit = defineEmits(['update:workflow-name', 'update:workflow-json']);

const { workflowStore, initTable, tableModel, workflowId } =
  useWorkflowDetailModel();

onBeforeMount(() => {
  initTable();
});

watch(
  props,
  () => {
    workflowId.value = props.selectedWorkflowId;
  },
  { immediate: true },
);

watchEffect(() => {
  emit(
    'update:workflow-name',
    workflowStore.getWorkflowById(props.selectedWorkflowId)?.name,
  );
});

watchEffect(() => {
  emit(
    'update:workflow-json',
    workflowStore.getWorkflowById(workflowId.value)?.data,
  );
});
</script>

<template>
  <div>
    <p-definition-table
      :fields="tableModel.tableState.fields"
      :data="tableModel.tableState.data"
      :loading="tableModel.tableState.loading"
      block
    >
    </p-definition-table>
  </div>
</template>
