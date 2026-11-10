<script setup lang="ts">
import DisabledReason from '@/shared/ui/DisabledReason/DisabledReason.vue';
import { PDefinitionTable, PButton, PStatus } from '@cloudforet-test/mirinae';
import {
  computed,
  onBeforeMount,
  reactive,
  ref,
  watch,
  watchEffect,
} from 'vue';
import type { ISourceConnectionOutcome } from '@/entities/sourceService/model/types';
import {
  groupTypeOf,
  isCspSourceGroup,
  SOURCE_GROUP_TYPE_LABEL,
  SourceGroupType,
} from '@/entities/sourceService/model/types';
import CreateObjectStorageSourceModelModal from '@/widgets/models/createObjectStorageSourceModel/ui/CreateObjectStorageSourceModelModal.vue';
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
  // Grows when connections are added or changed (e.g. from Scan Buckets), so the collect
  // buttons are worked out again from the new connection list.
  connectionsVersion?: number;
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

/*
  Group collect buttons follow the connections the group holds (internal review 2026-11-05):
  a button is offered for each kind of connection in the group, and is locked only when the
  group has no connection that button can collect. A mix of kinds does not lock it - which
  connections a group request covers is cm-honeybee's to decide (cm-honeybee#85), and an
  error it returns is shown as is.

  Collect Infra / Collect SW reach servers through the cm-honeybee agent (SSH): on-premise
  servers, and cloud VMs registered with SSH. Collect Object Storage covers the buckets of a
  cloud source service. fs, db and minio groups hold data sources the console does not
  collect yet.
*/
const groupType = computed(() =>
  groupTypeOf(sourceServiceStore.getServiceById(props.selectedServiceId)?.type),
);
const isCspService = computed(() =>
  isCspSourceGroup(
    sourceServiceStore.getServiceById(props.selectedServiceId)?.type,
  ),
);
const isServerGroup = computed(
  () =>
    groupType.value === SourceGroupType.OnPremise ||
    groupType.value === SourceGroupType.Csp,
);
const connectionKinds = ref({
  vms: [] as string[],
  sshVms: [] as string[],
  buckets: [] as string[],
  others: 0,
});
const unsupportedGroupHint = computed(
  () =>
    `This is a ${
      SOURCE_GROUP_TYPE_LABEL[groupType.value] ?? groupType.value
    } source service. The console does not collect this type yet.`,
);
const agentCollectHint = computed(() => {
  if (!isServerGroup.value) return unsupportedGroupHint.value;
  const k = connectionKinds.value;
  if (k.vms.length === 0) {
    return 'No server (VM) connection in this source service.';
  }
  if (isCspService.value && k.sshVms.length === 0) {
    return 'No VM connection with SSH access. A cloud VM is collected through the agent only when it is registered with SSH.';
  }
  return '';
});
const agentCollectDisabled = computed(() => !!agentCollectHint.value);
const objectStorageHint = computed(() => {
  if (!isCspService.value) {
    return isServerGroup.value
      ? 'Object storage is collected from a cloud source service.'
      : unsupportedGroupHint.value;
  }
  return connectionKinds.value.buckets.length === 0
    ? 'No object storage connection in this source service. Add buckets from Detail > Scan Buckets or Connections.'
    : '';
});
const objectStorageCollectOpen = ref(false);

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

/*
  A hover cannot be scrolled.

  Moving the pointer off the status closes the layer, and the gap between the two is
  enough to close it on the way - so anything that does not fit is unreachable. With two
  servers that never showed; with ten it hides most of what the reader came for.

  So the hover only summarises, and the detail is opened from a button of its own:

    - two or fewer     each connection, as before - it fits
    - more than that   how many answered and how many did not
    - either way       a line pointing at the button

  The button sits next to Refresh rather than on the status itself. A status that opens
  something when clicked gives no sign that it does; a button says what it is.
*/
const HOVER_LIMIT = 2;

/** Everything opened at once, kept open until the reader closes it. */
const statusDialogOpen = ref(false);

function outcomesOf(data: any): ISourceConnectionOutcome[] {
  return (data?.outcomes ?? []) as ISourceConnectionOutcome[];
}

function isReachable(o: ISourceConnectionOutcome): boolean {
  return o.connectionStatus === 'success' && o.agentStatus === 'success';
}

function failedOnly(data: any): ISourceConnectionOutcome[] {
  return outcomesOf(data).filter(o => !isReachable(o));
}

/** Few enough to read at a glance; beyond that the hover only counts them. */
function hoverShown(data: any): ISourceConnectionOutcome[] {
  const all = outcomesOf(data);
  return all.length <= HOVER_LIMIT ? all : [];
}

function hoverSummary(data: any): string {
  const all = outcomesOf(data);
  const failed = failedOnly(data).length;
  if (!all.length) return '';
  if (!failed) return `All ${all.length} connections answered.`;
  if (failed === all.length)
    return `None of the ${all.length} connections answered.`;
  return `${all.length - failed} of ${all.length} connections answered, ${failed} did not.`;
}

/** The detail is worth offering only once there is something to tell. */
const hasConnectionDetail = computed(
  () =>
    (
      sourceServiceStore.getServiceById(props.selectedServiceId)
        ?.connectionOutcomes ?? []
    ).length > 0,
);

const dialogOutcomes = computed<ISourceConnectionOutcome[]>(
  () =>
    sourceServiceStore.getServiceById(props.selectedServiceId)
      ?.connectionOutcomes ?? [],
);

function openStatusDetail(event: Event) {
  if (statusDialogOpen.value) return;
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  const box = el.getBoundingClientRect();
  statusDetailAt.value = { top: box.bottom + 6, left: box.left };
}

function closeStatusDetail() {
  statusDetailAt.value = null;
}

function openStatusDialog() {
  statusDetailAt.value = null;
  statusDialogOpen.value = true;
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
  if (agentCollectDisabled.value) return;
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
  if (agentCollectDisabled.value) return;
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
    const vms = list.filter((c: any) => (c.resource_type || 'vm') === 'vm');
    const buckets = list.filter(
      (c: any) => c.resource_type === 'object_storage',
    );
    connectionKinds.value = {
      vms: vms.map((c: any) => c.name),
      sshVms: vms.filter((c: any) => !!c.ip_address).map((c: any) => c.name),
      buckets: buckets.map((c: any) => c.resource_id),
      others: list.length - vms.length - buckets.length,
    };
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
    // The cell is assembled once from the store, so it has to be rebuilt now that there
    // is something to put in it - otherwise the detail only appears after a refresh.
    loadSourceServiceData(props.selectedServiceId);
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
        The status, and a glance at what is behind it.

        `data-status` carries the raw value, not the styled text, so a test can wait for the state
        itself rather than reading a label. Refresh has to report success here before Collect Infra
        and Collect SW do anything.

        The hover only summarises. It closes when the pointer leaves, and the gap on the
        way to it is enough to close it, so nothing that needs scrolling can live here.
        The detail is opened from a button instead.
      -->
      <template #data-status="{ data }">
        <span
          class="status-cell"
          tabindex="0"
          data-testid="source-group-status"
          :data-status="data.status"
          @mouseenter="openStatusDetail"
          @mouseleave="closeStatusDetail"
          @focus="openStatusDetail"
          @blur="closeStatusDetail"
        >
          <p-status :theme="data.color" :text="data.text" />

          <span
            v-if="statusDetailAt && outcomesOf(data).length"
            class="status-detail"
            :style="{
              top: `${statusDetailAt.top}px`,
              left: `${statusDetailAt.left}px`,
            }"
            data-testid="source-group-status-detail"
          >
            <span class="status-detail-summary">{{ hoverSummary(data) }}</span>

            <span
              v-for="outcome in hoverShown(data)"
              :key="outcome.name"
              class="status-detail-item"
            >
              <span class="status-detail-name"
                >{{ outcome.name }} ({{ outcome.ipAddress }})</span
              >
              <span class="status-detail-line">
                <span class="status-detail-label">Connection</span>
                <span
                  :class="`status-detail-value is-${outcome.connectionStatus}`"
                  >{{ outcome.connectionStatus }}</span
                >
              </span>
              <span
                v-if="outcome.connectionMessage"
                class="status-detail-message"
                >{{ outcome.connectionMessage }}</span
              >
              <span class="status-detail-line">
                <span class="status-detail-label">Agent</span>
                <span
                  :class="`status-detail-value is-${outcome.agentStatus}`"
                  >{{ outcome.agentStatus }}</span
                >
              </span>
              <span v-if="outcome.agentMessage" class="status-detail-message">{{
                outcome.agentMessage
              }}</span>
            </span>

            <span class="status-detail-hint"
              >Select View Messages for what each server reported</span
            >
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

      <!-- Always render the element: an empty slot makes PDefinitionTable fall back to its default (DESIGN-MIRINAE). -->
      <template #data-viewObjectStorage>
        <span data-testid="source-group-bucket-count">{{
          connectionKinds.buckets.length
            ? `${connectionKinds.buckets.length} bucket(s)`
            : ''
        }}</span>
      </template>

      <template #extra="{ name }">
        <div v-if="name === 'status'" class="status-actions">
          <!--
            Offered whenever there is something to report, which is as soon as the list
            has been read - not only after a refresh.
          -->
          <p-button
            v-if="hasConnectionDetail"
            data-testid="source-group-view-messages"
            style-type="tertiary"
            size="sm"
            @click="openStatusDialog"
          >
            View Messages
          </p-button>
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
        <div v-else-if="name === 'viewInfra'" class="collect-actions">
          <disabled-reason
            :reason="agentCollectDisabled ? agentCollectHint : ''"
            testid="source-group-collect-infra-trigger"
          >
            <p-button
              data-testid="source-group-collect-infra"
              style-type="tertiary"
              size="sm"
              :disabled="agentCollectDisabled"
              :loading="resGetInfraSourceGroup.isLoading.value"
              @click="getSourceGroupInfras"
            >
              Collect Infra
            </p-button>
          </disabled-reason>
        </div>
        <div v-else-if="name === 'viewObjectStorage'" class="collect-actions">
          <disabled-reason
            :reason="objectStorageHint"
            testid="source-group-collect-os-trigger"
          >
            <p-button
              data-testid="source-group-collect-os"
              style-type="tertiary"
              size="sm"
              :disabled="!!objectStorageHint"
              @click="
                () => {
                  if (!objectStorageHint) objectStorageCollectOpen = true;
                }
              "
            >
              Collect Object Storage
            </p-button>
          </disabled-reason>
        </div>
        <div v-else-if="name === 'viewSoftware'" class="collect-actions">
          <disabled-reason
            :reason="agentCollectDisabled ? agentCollectHint : ''"
            testid="source-group-collect-sw-trigger"
          >
            <p-button
              data-testid="source-group-collect-sw"
              style-type="tertiary"
              size="sm"
              :disabled="agentCollectDisabled"
              :loading="resCollectSWSourceGroup.isLoading.value"
              @click="getSourceGroupSoftware"
            >
              Collect SW
            </p-button>
          </disabled-reason>
        </div>
      </template>
    </p-definition-table>
    <!-- Collect Object Storage: the buckets of this source service are collected and saved as a
         source model in one go, as Collect Infra does for servers. -->
    <create-object-storage-source-model-modal
      v-if="objectStorageCollectOpen"
      :initial-group-id="props.selectedServiceId"
      select-all
      @update:close-modal="objectStorageCollectOpen = false"
    />
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

    <!--
      Everything, opened deliberately.

      A dialog rather than a bigger hover: it stays until it is closed, so a long list can
      be read and scrolled. Successes are kept - once the reader has asked for all of it,
      leaving some out would be the surprising thing.
    -->
    <div
      v-if="statusDialogOpen"
      class="status-dialog-backdrop"
      data-testid="source-group-status-dialog"
      @click.self="statusDialogOpen = false"
    >
      <div class="status-dialog" role="dialog" aria-modal="true">
        <div class="status-dialog-head">
          <span class="status-dialog-title">Connection status</span>
          <button
            type="button"
            class="status-dialog-close"
            data-testid="source-group-status-dialog-close"
            @click="statusDialogOpen = false"
          >
            &#10005;
          </button>
        </div>

        <div class="status-dialog-body">
          <div
            v-for="outcome in dialogOutcomes"
            :key="outcome.name"
            class="status-detail-item"
          >
            <span class="status-detail-name"
              >{{ outcome.name }} ({{ outcome.ipAddress }})</span
            >
            <span class="status-detail-line">
              <span class="status-detail-label">Connection</span>
              <span
                :class="`status-detail-value is-${outcome.connectionStatus}`"
                >{{ outcome.connectionStatus }}</span
              >
            </span>
            <span
              v-if="outcome.connectionMessage"
              class="status-detail-message"
              >{{ outcome.connectionMessage }}</span
            >
            <span class="status-detail-line">
              <span class="status-detail-label">Agent</span>
              <span :class="`status-detail-value is-${outcome.agentStatus}`">{{
                outcome.agentStatus
              }}</span>
            </span>
            <span v-if="outcome.agentMessage" class="status-detail-message">{{
              outcome.agentMessage
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.collect-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
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

.status-actions {
  display: flex;
  gap: 6px;
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

.status-detail-summary {
  font-weight: 600;
  color: #111827;
}

.status-detail-more,
.status-detail-hint {
  color: #6b7280;
}

.status-detail-hint {
  padding-top: 6px;
  border-top: 1px solid #e5e7eb;
}

/* Everything at once - stays until closed, so a long list can be read. */
.status-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / 40%);
}

.status-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(0 0 0 / 20%);
}

.status-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.status-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.status-dialog-close {
  border: 0;
  background: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
}

.status-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 16px;
  font-size: 12px;
  line-height: 1.5;
}
</style>
