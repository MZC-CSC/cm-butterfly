<script setup lang="ts">
import { PDefinitionTable, PButton, PStatus } from '@cloudforet-test/mirinae';
import { onBeforeMount, reactive, ref, watch, watchEffect } from 'vue';
import { useSourceServiceDetailModel } from '@/widgets/source/sourceServices/sourceServiceDetail/model/sourceServiceDetailModel';
import {
  useGetInfraSourceGroup,
  useGetInfraInfoSourceGroup,
  useGetSoftwareInfoSourceGroup,
  useGetSourceService,
} from '@/entities/sourceService/api';
import { showErrorMessage } from '@/shared/utils';
import {
  useRefreshSourceGroupConnectionInfoStatus,
  useCollectSWSourceGroup,
  useGetSourceConnectionList,
} from '@/entities/sourceConnection/api';
import SourceServiceRefineModal from '@/features/sourceServices/sourceServiceRefinedModal/ui/sourceServiceRefineModal.vue';

interface IProps {
  selectedServiceId: string;
}

const props = defineProps<IProps>();

const emit = defineEmits([
  'update:source-connection-name',
  'update:custom-view-json-modal',
]);

const {
  sourceServiceStore,
  initTable,
  tableModel,
  setServiceId,
  loadSourceServiceData,
} = useSourceServiceDetailModel();

const refreshSourceGroupConnectionInfoStatus =
  useRefreshSourceGroupConnectionInfoStatus(null);
const getSourceService = useGetSourceService(null);
const getSourceConnectionList = useGetSourceConnectionList(null);
const resGetInfraSourceGroup = useGetInfraSourceGroup(null);
const resGetInfraInfoSourceGroup = useGetInfraInfoSourceGroup(null);
const infraModel = ref<any>(null);

// Software-related state
const softwareModel = ref<any>(null);
const resCollectSWSourceGroup = useCollectSWSourceGroup(null);
const resGetSoftwareInfoSourceGroup = useGetSoftwareInfoSourceGroup(null);

/*
  Where to draw the explanation.

  Positioned against the viewport rather than the cell: the definition table clips its
  cells, so a layer anchored inside one is cut down to a sliver. The coordinates are
  taken from the status when it is pointed at or focused.
*/
const statusDetailAt = ref<{ top: number; left: number } | null>(null);

function openStatusDetail(event: Event) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  const box = el.getBoundingClientRect();
  statusDetailAt.value = { top: box.bottom + 6, left: box.left };
}

function closeStatusDetail() {
  statusDetailAt.value = null;
}

const modalState = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

// Software modal state
const softwareModalState = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

onBeforeMount(() => {
  initTable();
});

watch(
  props,
  () => {
    setServiceId(props.selectedServiceId);
    // Selecting a service is a fair moment to ask why its status is what it is;
    // waiting for a refresh would leave the explanation empty until then.
    if (props.selectedServiceId) loadConnectionOutcomes();
  },
  { immediate: true },
);

watchEffect(() => {
  const serviceName = sourceServiceStore.getServiceById(
    props.selectedServiceId,
  )?.name;
  if (serviceName) {
    emit('update:source-connection-name', serviceName);
  }
});

function getSourceGroupInfras() {
  // Collect the infra (import-infra-source-group), then show its structured
  // JSON form (get-infra-info-source-group) in the viewer's left "Meta" pane.
  resGetInfraSourceGroup
    .execute({
      pathParams: {
        sgId: props.selectedServiceId,
      },
    })
    .then(res => {
      if (!res.data.responseData) return undefined;
      sourceServiceStore.mappinginfraModel(
        props.selectedServiceId,
        res.data.responseData,
      );
      loadSourceServiceData(props.selectedServiceId);
      return resGetInfraInfoSourceGroup.execute({
        pathParams: {
          sgId: props.selectedServiceId,
        },
      });
    })
    .then(infoRes => {
      if (infoRes && infoRes.data.responseData) {
        infraModel.value = infoRes.data.responseData;
        // Automatically open the modal after fetching the data
        modalState.open = true;
      }
    })
    .catch(e => {
      console.error('Failed to get source group infras:', e);
      infraModel.value = null;
    });
}

function getSourceGroupSoftware() {
  // Collect the software (import-software-source-group), then show its
  // structured JSON form (get-software-info-source-group) in the pane.
  resCollectSWSourceGroup
    .execute({
      pathParams: {
        sgId: props.selectedServiceId,
      },
    })
    .then(res => {
      if (!res.data.responseData) return undefined;
      sourceServiceStore.mappingSoftwareModel(
        props.selectedServiceId,
        res.data.responseData,
      );
      loadSourceServiceData(props.selectedServiceId);
      return resGetSoftwareInfoSourceGroup.execute({
        pathParams: {
          sgId: props.selectedServiceId,
        },
      });
    })
    .then(infoRes => {
      if (infoRes && infoRes.data.responseData) {
        softwareModel.value = infoRes.data.responseData;
        // Automatically open the modal after fetching the data
        softwareModalState.open = true;
      }
    })
    .catch(e => {
      console.error('Failed to get source group software:', e);
      softwareModel.value = null;
    });
}

/**
 * What the server said about each connection, so that a failure can be explained.
 *
 * The aggregated status answers "can this be used"; this answers "why not". The two
 * failures it distinguishes are not the same problem: the machine refusing SSH is the
 * user's network or credentials, while the machine answering and then failing to take
 * the agent is something else again. The server separates them and explains each; the
 * console was showing neither.
 */
async function loadConnectionOutcomes() {
  try {
    const { data } = await getSourceConnectionList.execute({
      pathParams: { sgId: props.selectedServiceId },
    });
    const list = data.responseData?.connection_info ?? [];
    sourceServiceStore.mappingConnectionOutcomes(
      props.selectedServiceId,
      list.map((c: any) => ({
        name: c.name,
        ipAddress: c.ip_address,
        connectionStatus: c.connection_status,
        connectionMessage: c.connection_failed_message,
        agentStatus: c.agent_status,
        agentMessage: c.agent_failed_message,
      })),
    );
  } catch {
    // The aggregated status still stands on its own; the explanation is simply absent.
  }
}

/**
 * Re-probe the servers behind this source service and show what came back.
 *
 * The refresh call answers `success` once it has finished probing - it says the
 * refresh ran, not that the servers answered. So its message is used only as the
 * cue to read the state again; what is shown comes from the counts the server
 * reports for the connections themselves.
 */
async function handleSourceGroupStatusRefresh() {
  try {
    await refreshSourceGroupConnectionInfoStatus.execute({
      pathParams: {
        sgId: props.selectedServiceId,
      },
    });

    const { data } = await getSourceService.execute({
      pathParams: {
        sgId: props.selectedServiceId,
      },
    });

    sourceServiceStore.mappingSourceGroupStatus(
      props.selectedServiceId,
      data.responseData?.connection_info_status_count,
    );

    await loadConnectionOutcomes();
    loadSourceServiceData(props.selectedServiceId);
  } catch (err: any) {
    showErrorMessage('error', err.errorMsg?.value || 'Unknown error occurred');
  }
}

function handleJsonModal() {
  modalState.open = true;
}

function handleSoftwareModal() {
  softwareModalState.open = true;
}
</script>

<template>
  <div>
    <p-definition-table
      :fields="tableModel.tableState.fields"
      :data="tableModel.tableState.data"
      :loading="
        tableModel.tableState.loading || resGetInfraSourceGroup.isLoading.value
      "
      :block="true"
    >
      <!--
        The status, and behind it what the server said.

        Hover rather than a permanent block: the answer to "can this be used" is one
        word and belongs on the line, while the answer to "why not" is several lines and
        only matters when the first one is bad. Focus opens it too, so it is not reachable
        by pointer alone.
      -->
      <template #data-status="{ data }">
        <span
          class="status-cell"
          tabindex="0"
          data-testid="source-group-status"
          @mouseenter="openStatusDetail"
          @mouseleave="closeStatusDetail"
          @focus="openStatusDetail"
          @blur="closeStatusDetail"
        >
          <p-status :theme="data.color" :text="data.text" />

          <span
            v-if="statusDetailAt && (data.outcomes || []).length"
            class="status-detail"
            :style="{ top: `${statusDetailAt.top}px`, left: `${statusDetailAt.left}px` }"
            data-testid="source-group-status-detail"
          >
            <span
              v-for="outcome in data.outcomes"
              :key="outcome.name"
              class="status-detail-item"
            >
              <span class="status-detail-name"
                >{{ outcome.name }} ({{ outcome.ipAddress }})</span
              >
              <span class="status-detail-line">
                <span class="status-detail-label">Connection</span>
                <span :class="`status-detail-value is-${outcome.connectionStatus}`"
                  >{{ outcome.connectionStatus }}</span
                >
              </span>
              <span v-if="outcome.connectionMessage" class="status-detail-message"
                >{{ outcome.connectionMessage }}</span
              >
              <span class="status-detail-line">
                <span class="status-detail-label">Agent</span>
                <span :class="`status-detail-value is-${outcome.agentStatus}`"
                  >{{ outcome.agentStatus }}</span
                >
              </span>
              <span v-if="outcome.agentMessage" class="status-detail-message"
                >{{ outcome.agentMessage }}</span
              >
            </span>
          </span>
        </span>
      </template>

      <template #data-viewInfra="{ data }">
        <p
          v-if="data.isShow"
          data-testid="source-group-view-infra-meta"
          class="text-blue-700 cursor-pointer"
          @click="handleJsonModal"
        >
          View Infra(Meta) -&gt;
        </p>
        <!-- keep the slot non-empty so PDefinitionTable does not fall back to dumping the raw cell object -->
        <span v-else />
      </template>

      <template #data-viewSoftware="{ data }">
        <p
          v-if="data.isShow"
          data-testid="source-group-view-sw-meta"
          class="text-blue-700 cursor-pointer"
          @click="handleSoftwareModal"
        >
          View Software(Meta) -&gt;
        </p>
        <!-- keep the slot non-empty so PDefinitionTable does not fall back to dumping the raw cell object -->
        <span v-else />
      </template>

      <template #extra="{ name }">
        <div v-if="name === 'status'">
          <p-button
            data-testid="source-group-refresh"
            style-type="tertiary"
            size="sm"
            :loading="refreshSourceGroupConnectionInfoStatus.isLoading.value"
            @click="handleSourceGroupStatusRefresh"
          >
            Refresh
          </p-button>
        </div>
        <div v-else-if="name === 'viewInfra'">
          <p-button
            data-testid="source-group-collect-infra"
            style-type="tertiary"
            size="sm"
            :loading="resGetInfraSourceGroup.isLoading.value"
            @click="getSourceGroupInfras"
          >
            Collect Infra
          </p-button>
        </div>
        <div v-else-if="name === 'viewSoftware'">
          <p-button
            data-testid="source-group-collect-sw"
            style-type="tertiary"
            size="sm"
            :loading="resCollectSWSourceGroup.isLoading.value"
            @click="getSourceGroupSoftware"
          >
            Collect SW
          </p-button>
        </div>
      </template>
    </p-definition-table>
    <SourceServiceRefineModal
      v-if="modalState.open"
      :sgId="props.selectedServiceId"
      :collect-data="infraModel"
      data-type="infra"
      data-source="sourceGroup"
      @update:is-meta-viewer-opened="modalState.open = false"
    />
    <SourceServiceRefineModal
      v-if="softwareModalState.open"
      :sgId="props.selectedServiceId"
      :collect-data="softwareModel"
      data-type="software"
      data-source="sourceGroup"
      @update:is-meta-viewer-opened="softwareModalState.open = false"
    />
  </div>
</template>

<style scoped lang="postcss">
/*
  The explanation behind the status.

  Plain markup and plain CSS on purpose - a new screen should not widen the mirinae
  surface, and a hover layer is small enough not to need one.
*/
.status-cell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.status-detail {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 320px;
  max-width: 520px;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 4px 14px rgb(0 0 0 / 12%);
  font-size: 12px;
  line-height: 1.5;
  white-space: normal;
}

.status-detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-detail-name {
  font-weight: 600;
  color: #111827;
}

.status-detail-line {
  display: flex;
  gap: 8px;
}

.status-detail-label {
  width: 76px;
  flex-shrink: 0;
  color: #6b7280;
}

.status-detail-value.is-success {
  color: #047857;
}

.status-detail-value.is-failed {
  color: #b91c1c;
}

/* The server's own words, kept as they came. */
.status-detail-message {
  padding-left: 84px;
  color: #6b7280;
  word-break: break-word;
}
</style>
