<script setup lang="ts">
import { PButton, PDefinitionTable, PStatus } from '@cloudforet-test/mirinae';
import { onBeforeMount, watch } from 'vue';
import { useSourceSoftwareCollectModel } from '@/widgets/source/sourceConnections/sourceConnectionDetail/softwareCollect/model/sourceSoftwareCollectModel';
import { useCollectSW, useGetSoftwareInfo } from '@/entities/sourceConnection/api';
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
  loadInfraSWTableData,
  sourceConnectionStore,
  setConnectionId,
  defineTableModel,
  initTable,
} = useSourceSoftwareCollectModel();

const resCollectSW = useCollectSW({
  sgId: null,
  connId: null,
});
const resGetSoftwareInfo = useGetSoftwareInfo(null, null);

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

function handleClickCollectSW() {
  // Collect the software (import-software), then load its structured JSON form
  // (get-software-info) for the viewer's left "Meta" pane.
  resCollectSW
    .execute({
      pathParams: {
        sgId: props.sourceGroupId,
        connId: props.connectionId,
      },
    })
    .then(res => {
      if (!res.data.responseData || !props.connectionId) return undefined;
      sourceConnectionStore.mapSourceConnectionCollectSWResponse(
        res.data.responseData,
      );
      loadInfraSWTableData(props.connectionId);
      return resGetSoftwareInfo.execute({
        pathParams: {
          sgId: props.sourceGroupId,
          connId: props.connectionId,
        },
      });
    })
    .then(infoRes => {
      if (infoRes && infoRes.data.responseData && props.connectionId) {
        sourceConnectionStore.setConnectionSoftwareModel(
          props.connectionId,
          infoRes.data.responseData,
        );
        loadInfraSWTableData(props.connectionId);
      }
    })
    .catch(e => {
      showErrorMessage('Error', toErrorMessage(e, 'Failed to load collected software information.'));
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
      <template #data-collectSwStatus="{ data }">
        <p-status :theme="data.color" :text="data.text" />
      </template>
      <template #data-viewSW="{ data }">
        <p
          data-testid="view-software-meta"
          class="text-blue-700 cursor-pointer"
          @click="emit('update:metaViewerModalState', true)"
        >
          {{ data ? 'View SW(Meta) ->' : null }}
        </p>
      </template>
      <template #extra="{ name }">
        <div v-if="name === 'collectSwStatus'">
          <p-button
            data-testid="collect-software"
            style-type="tertiary"
            size="sm"
            :loading="resCollectSW.isLoading.value"
            @click="handleClickCollectSW"
          >
            Collect SW
          </p-button>
        </div>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss"></style>
