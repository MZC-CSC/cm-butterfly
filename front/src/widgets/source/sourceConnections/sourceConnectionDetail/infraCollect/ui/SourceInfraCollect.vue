<script setup lang="ts">
import DisabledReason from '@/shared/ui/DisabledReason/DisabledReason.vue';
import { PButton, PDefinitionTable, PStatus } from '@cloudforet-test/mirinae';
import { onBeforeMount, watch } from 'vue';
import { useSourceInfraCollectModel } from '@/widgets/source/sourceConnections/sourceConnectionDetail/infraCollect/model/sourceInfraCollectModel';
import {
  useCollectInfra,
  useGetInfraInfo,
} from '@/entities/sourceConnection/api';
import { showErrorMessage, toErrorMessage } from '@/shared/utils';

interface IProps {
  sourceGroupId: string | null;
  connectionId: string | null;
  metaViewerModalState: boolean;
  // Set when this connection cannot be collected through the agent (a cloud VM
  // registered without SSH access); the button is then disabled with this reason.
  collectDisabledReason?: string;
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
const resGetInfraInfo = useGetInfraInfo(null, null);

watch(
  () => props.connectionId,
  newValue => {
    setConnectionId(newValue);
  },
  { immediate: true },
);
onBeforeMount(() => {
  initTable();
});

function handleCollectInfra() {
  if (props.collectDisabledReason) return;
  // Collect the infra (import-infra), then load its structured JSON form
  // (get-infra-info) for the viewer's left "Meta" pane.
  resCollectInfra
    .execute({
      pathParams: {
        sgId: props.sourceGroupId,
        connId: props.connectionId,
      },
    })
    .then(res => {
      if (!res.data.responseData || !props.connectionId) return undefined;
      sourceConnectionStore.mapSourceConnectionCollectInfraResponse(
        res.data.responseData,
      );
      loadInfraCollectTableData(props.connectionId);
      return resGetInfraInfo.execute({
        pathParams: {
          sgId: props.sourceGroupId,
          connId: props.connectionId,
        },
      });
    })
    .then(infoRes => {
      if (infoRes && infoRes.data.responseData && props.connectionId) {
        sourceConnectionStore.setConnectionInfraModel(
          props.connectionId,
          infoRes.data.responseData,
        );
        loadInfraCollectTableData(props.connectionId);
      }
    })
    .catch(e => {
      showErrorMessage(
        'Error',
        toErrorMessage(
          e,
          'Failed to load collected infrastructure information.',
        ),
      );
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
          <disabled-reason
            :reason="collectDisabledReason || ''"
            testid="collect-infra-trigger"
          >
            <p-button
              data-testid="collect-infra"
              style-type="tertiary"
              size="sm"
              :loading="resCollectInfra.isLoading.value"
              :disabled="!!collectDisabledReason"
              @click="handleCollectInfra"
            >
              Collect Infra
            </p-button>
          </disabled-reason>
        </div>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss"></style>
