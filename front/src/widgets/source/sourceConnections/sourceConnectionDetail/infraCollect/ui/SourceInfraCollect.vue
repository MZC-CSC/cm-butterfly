<script setup lang="ts">
import { PButton, PDefinitionTable, PStatus } from '@cloudforet-test/mirinae';
import { onBeforeMount, watch } from 'vue';
import { useSourceInfraCollectModel } from '@/widgets/source/sourceConnections/sourceConnectionDetail/infraCollect/model/sourceInfraCollectModel';
import { useCollectInfra } from '@/entities/sourceConnection/api';
import { showErrorMessage,
  toErrorMessage,
} from '@/shared/utils';

interface IProps {
  sourceGroupId: string | null;
  connectionId: string | null;
  metaViewerModalState: boolean;
}

const props = defineProps<IProps>();
const emit = defineEmits(['update:metaViewerModalState']);

const {
  sourceConnectionStore,
  setConnectionId,
  defineTableModel,
  initTable,
  loadInfraCollectTableData,
} = useSourceInfraCollectModel();

const resCollectInfra = useCollectInfra({
  sgId: null,
  connId: null,
});

watch(
  () => props.connectionId,
  (newValue) => {
    setConnectionId(newValue);
  },
  { immediate: true },
);
onBeforeMount(() => {
  initTable();
});

function handleCollectInfra() {
  resCollectInfra
    .execute({
      pathParams: {
        sgId: props.sourceGroupId,
        connId: props.connectionId,
      },
    })
    .then(res => {
      if (res.data.responseData) {
        if (props.connectionId) {
          sourceConnectionStore.mapSourceConnectionCollectInfraResponse(
            res.data.responseData,
          );
          loadInfraCollectTableData(props.connectionId);
        }
      }
    })
    .catch(e => {
      showErrorMessage('Error', toErrorMessage(e, 'Failed to load collected infrastructure information.'));
    });
}
</script>

<template>
  <div>
    <p-definition-table
      :fields="defineTableModel.tableState.fields"
      :data="defineTableModel.tableState.data"
      :loading="defineTableModel.tableState.loading"
      block
    >
      <template #data-collectInfraStatus="{ data }">
        <p-status :theme="data.color" :text="data.text" />
      </template>
      <template #data-viewInfra="{ data }">
        <p
          data-testid="view-infra-meta"
          class="text-blue-700 cursor-pointer"
          @click="emit('update:metaViewerModalState', true)"
        >
          {{ data ? 'View Infra(Meta) ->' : null }}
        </p>
      </template>
      <template #extra="{ name }">
        <div v-if="name === 'collectInfraStatus'">
          <p-button
            data-testid="collect-infra"
            style-type="tertiary"
            size="sm"
            :loading="resCollectInfra.isLoading.value"
            @click="handleCollectInfra"
          >
            Collect Infra
          </p-button>
        </div>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss"></style>
