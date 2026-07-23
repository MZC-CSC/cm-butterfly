<!-- src/widgets/credentials/credentialsDetail/ui/CredentialsDetail.vue -->
<script setup lang="ts">
import { onBeforeMount, watch } from 'vue';
import { useCredentialsDetailModel } from '@/widgets/credentials/credentialsDetail/model/credentialsDetailModel';
import { PDefinitionTable } from '@cloudforet-test/mirinae'; // PDefinitionTable import

interface IProps {
  selectedCredentialName: string | null;
}

const props = defineProps<IProps>();

const emit = defineEmits([
  'update:custom-view-json-modal',
  'update:view-recommend-list-modal',
  'update:credential-name',
  'update:credential-description',
  'update:recommended-credential-list',
]);

const { setCredentialName, initTable, tableModel } =
  useCredentialsDetailModel();

// Set the selected Credential Name
setCredentialName(props.selectedCredentialName);

// Initialize the table
onBeforeMount(() => {
  initTable();
});

// Set it whenever the selected Credential Name changes
watch(
  () => props.selectedCredentialName,
  newName => {
    console.log('Credential Name changed', newName);
    setCredentialName(newName); // used in the modal
  },
);

// JSON view handler
function handleJsonModal() {
  emit('update:custom-view-json-modal', true);
  emit('update:credential-name', tableModel.tableState.data.credentialName);
}

// Recommended model view handler (implement as needed)
function handleRecommendedList() {
  // Example: emit('update:view-recommend-list-modal', true);
  // Add logic as needed
}
</script>

<template>
  <div>
    <p-definition-table
      :fields="tableModel.tableState.fields"
      :data="tableModel.tableState.data"
      :loading="tableModel.tableState.loading"
      :block="true"
    >
      <template #data-customAndViewJSON="{ row }">
        <p class="link-button-text" @click="handleJsonModal">
          Custom & View JSON
        </p>
      </template>
      <template #data-recommendModel="{ row }">
        <p class="link-button-text" @click="handleRecommendedList">
          View Recommended List
        </p>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss">
.link-button-text {
  color: blue;
  cursor: pointer;
  text-decoration: underline;
}
</style>
