<script setup lang="ts">
import { computed, reactive, ref, watch, watchEffect } from 'vue';
import { PButton, PButtonTab, PTab } from '@cloudforet-test/mirinae';
import SourceServiceList from '@/widgets/source/sourceServices/sourceServiceList/ui/SourceServiceList.vue';
import SourceServiceDetail from '@/widgets/source/sourceServices/sourceServiceDetail/ui/SourceServiceDetail.vue';
import SourceConnectionList from '@/widgets/source/sourceConnections/sourceConnectionList/ui/SourceConnectionList.vue';
import SourceInformation from '@/widgets/source/sourceConnections/sourceConnectionDetail/information/ui/SourceInformation.vue';
import SourceInfraCollect from '@/widgets/source/sourceConnections/sourceConnectionDetail/infraCollect/ui/SourceInfraCollect.vue';
import SourceSoftwareCollect from '@/widgets/source/sourceConnections/sourceConnectionDetail/softwareCollect/ui/SourceSoftwareCollect.vue';
import CspBucketScan from '@/widgets/source/sourceServices/cspBucketScan/ui/CspBucketScan.vue';
import SourceBucketCollect from '@/widgets/source/sourceConnections/sourceConnectionDetail/bucketCollect/ui/SourceBucketCollect.vue';
import SourceConnectionModal from '@/widgets/source/sourceConnections/sourceConnectionModal/ui/SourceConnectionModal.vue';
import { useSidebar } from '@/shared/libs/store/sidebar';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router/composables';
import MetaViewer from '@/widgets/source/sourceConnections/sourceConnectionDetail/metaViewer/ui/MetaViewer.vue';
import { useSourceInfraCollectModel } from '@/widgets/source/sourceConnections/sourceConnectionDetail/infraCollect/model/sourceInfraCollectModel';
import EditSourceConnectionModal from '@/widgets/source/sourceConnections/sourceConnectionModal/ui/EditSourceConnectionModal.vue';
import { showSuccessMessage } from '@/shared/utils';
import AddSourceServiceModal from '@/features/sourceServices/addSourceServiceModal/ui/AddSourceServiceModal.vue';
import EditSourceServiceModal from '@/features/sourceServices/editSourceServiceModal/ui/EditSourceServiceModal.vue';
import { GuidedStepBanner } from '@/features/guidedSetup';
import CspConnectionModal from '@/widgets/source/sourceConnections/cspConnectionModal/ui/CspConnectionModal.vue';
import CspConnectionEditModal from '@/widgets/source/sourceConnections/cspConnectionModal/ui/CspConnectionEditModal.vue';
import { useSourceServiceStore } from '@/entities/sourceService/model/stores';
import { isCspSourceGroup } from '@/entities/sourceService/model/types';

const sourceConnectionName = ref<string>('');
const multiSelectedConnectionIds = ref<string[]>([]);
const isServiceEditBtnClicked = ref<boolean>(false);
const infraData = ref<string>();
const softwareData = ref<string>();
const selectedServiceId = ref<string>('');
const selectedConnectionId = ref<string>('');

const { sourceConnectionStore } = useSourceInfraCollectModel();

const sidebar = useSidebar();
const sourceServiceStore = useSourceServiceStore();

// A CSP source group adds connections by picking resources from the cloud account,
// so its Add/Edit opens a different modal from the SSH connection form.
const selectedService = computed(() =>
  sourceServiceStore.getServiceById(selectedServiceId.value),
);
const isCspSelected = computed(() =>
  isCspSourceGroup(selectedService.value?.type),
);

const { isCollapsed, isGnbToolboxShown } = storeToRefs(sidebar);

// One page, two menus: Source Services (on-premise servers over SSH) and Cloud Sources
// (cloud accounts read with their credential). The route says which.
const route = useRoute();
const sourceKind = computed<'onprem' | 'csp'>(() =>
  route.meta?.sourceKind === 'csp' ? 'csp' : 'onprem',
);
// Layout classes keep the original name so existing styles apply to both menus.
const pageClass = 'Source Services';
const pageName = computed(() =>
  sourceKind.value === 'csp' ? 'Cloud Sources' : 'Source Services',
);

const mainTabState = reactive({
  activeTab: 'detail',
  tabs: [
    {
      name: 'detail',
      label: 'Detail',
    },
    {
      name: 'connections',
      label: 'Connections',
    },
  ],
});

// A bucket connection has no servers to collect: it is collected and saved as a source
// model from its own tab, and the infra/software tabs do not apply to it.
const selectedConnection = computed(() =>
  sourceConnectionStore.getConnectionById(selectedConnectionId.value),
);
const isBucketConnection = computed(
  () => selectedConnection.value?.resource_type === 'object_storage',
);
const serverConnectionTabs = [
  { name: 'information', label: 'Information' },
  { name: 'infraCollect', label: 'Infra Collect' },
  { name: 'softwareCollect', label: 'Software Collect' },
];
// A bucket has no host, port or credential of its own: its information tab shows the
// bucket and the collect step instead of the server fields.
const bucketConnectionTabs = [{ name: 'information', label: 'Information' }];
const sourceConnectionDetailTabState = reactive({
  activeTab: 'information',
  tabs: computed(() =>
    isBucketConnection.value ? bucketConnectionTabs : serverConnectionTabs,
  ),
});
watch(isBucketConnection, () => {
  sourceConnectionDetailTabState.activeTab = 'information';
});

// Setting trigger to true causes it to update.
const modalStates = reactive({
  addServiceGroup: {
    open: false,
    category: 'add',
    confirm() {
      modalStates.addServiceGroup.open = false;
    },
    trigger: false,
    updateTrigger() {
      modalStates.addServiceGroup.trigger = false;
    },
  },

  addSourceConnection: {
    open: false,
    category: 'add',
    trigger: false,
    confirm() {
      modalStates.addSourceConnection.open = false;
    },
    updateTrigger() {
      modalStates.addSourceConnection.trigger = false;
    },
  },
  addInfraMetaViewer: {
    open: false,
    confirm() {
      modalStates.addInfraMetaViewer.open = false;
    },
  },
  addSoftwareMetaViewer: {
    open: false,
    confirm() {
      modalStates.addSoftwareMetaViewer.open = false;
    },
  },
});

watchEffect(() => {
  infraData.value = sourceConnectionStore.getConnectionById(
    selectedConnectionId.value,
  )?.infraData;
  softwareData.value = sourceConnectionStore.getConnectionById(
    selectedConnectionId.value,
  )?.softwareData;
});

const handleSourceGroupEdit = () => {
  modalStates.addServiceGroup.open = true;
  isServiceEditBtnClicked.value = true;
};

function handleClickServiceId(id: string) {
  selectedServiceId.value = id;
  selectedConnectionId.value = '';
}

function handleGroupModal(value: boolean) {
  modalStates.addServiceGroup.open = value;
}

// Detail > Object Storage opens the same Add Cloud Resources window as Connections,
// started on buckets.
const cspInitialResourceType = ref<'object_storage' | undefined>(undefined);
// Add / Edit with a connection selected edits it; otherwise (or from Discover) it adds.
const cspAddMode = ref(false);
const cspEditing = computed(
  () =>
    !!selectedConnectionId.value &&
    !cspInitialResourceType.value &&
    !cspAddMode.value,
);
function openBucketScan() {
  cspInitialResourceType.value = 'object_storage';
  handleConnectionModal(true);
}
function switchToCspAdd() {
  cspAddMode.value = true;
}

function handleConnectionModal(value: boolean) {
  if (!value) {
    cspInitialResourceType.value = undefined;
    cspAddMode.value = false;
  }
  modalStates.addSourceConnection.open = value;
  isCollapsed.value = value;
  isGnbToolboxShown.value = !value;
}

function handleNewConnectionModal(value: boolean) {
  modalStates.addServiceGroup.open = !value;
  modalStates.addSourceConnection.open = value;
  isCollapsed.value = value;
  isGnbToolboxShown.value = !value;
}

const data = computed(() => {
  const connection = sourceConnectionStore.getConnectionById(
    selectedConnectionId.value,
  );
  return connection?.softwareData || null;
});
</script>

<template>
  <div :class="`${pageClass}-page page`">
    <header
      v-if="!modalStates.addSourceConnection.open"
      :class="`${pageClass}-page-header`"
    >
      <p data-testid="source-services-header">{{ pageName }}</p>
    </header>
    <!-- Three steps are done here: register the servers, collect from them, then save that as a source model. -->
    <!-- The guided steps walk through servers; they are not about cloud accounts. -->
    <template v-if="sourceKind === 'onprem'">
      <guided-step-banner step="source-service" />
      <guided-step-banner step="collect" />
      <guided-step-banner step="source-model" />
    </template>
    <section :class="`${pageClass}-page-body`">
      <SourceServiceList
        :source-kind="sourceKind"
        :add-modal-state="modalStates.addServiceGroup.open"
        :trigger="modalStates.addServiceGroup.trigger"
        @selectRow="handleClickServiceId"
        @update:addModalState="e => (modalStates.addServiceGroup.open = e)"
        @update:trigger="modalStates.addServiceGroup.updateTrigger"
        @update:title="e => (modalStates.addServiceGroup.category = e)"
        @update:connection-title="
          e => (modalStates.addSourceConnection.category = e)
        "
      />
      <p
        v-if="!selectedServiceId"
        class="flex justify-center text-gray-300 text-sm font-normal"
      >
        Select an item for more details.
      </p>
      <div v-if="selectedServiceId">
        <p-tab v-model="mainTabState.activeTab" :tabs="mainTabState.tabs">
          <template #detail>
            <div class="tab-section-header">
              <p>Source Service information</p>
              <p-button
                :style-type="'tertiary'"
                icon-left="ic_edit"
                @click="handleSourceGroupEdit"
              >
                Edit
              </p-button>
            </div>
            <SourceServiceDetail
              :selected-service-id="selectedServiceId"
              @update:source-connection-name="e => (sourceConnectionName = e)"
              @update:custom-view-json-modal="
                e => (modalStates.addInfraMetaViewer.open = e)
              "
            />
            <!-- A cloud source service also scans its account's buckets here. -->
            <CspBucketScan v-if="isCspSelected" @open-scan="openBucketScan" />
          </template>
          <template #connections>
            <div class="tab-section-header">
              <p>Source Connection</p>
            </div>
            <SourceConnectionList
              :trigger="modalStates.addSourceConnection.trigger"
              :selected-service-id="selectedServiceId"
              @selectRow="id => (selectedConnectionId = id)"
              @update:addModalState="handleConnectionModal"
              @update:trigger="modalStates.addSourceConnection.updateTrigger"
              @update:title="
                e => (modalStates.addSourceConnection.category = e)
              "
              @select:multi-row="e => (multiSelectedConnectionIds = e)"
            >
              <template v-if="selectedConnectionId" #sourceConnectionDetail>
                <!-- mirinae PButtonTab renders the tab buttons itself and takes no
                     attributes for them, so the anchors live on this wrapper and on
                     each panel. Tests assert the panel, not the button. -->
                <p-button-tab
                  v-model="sourceConnectionDetailTabState.activeTab"
                  data-testid="source-connection-detail"
                  :tabs="sourceConnectionDetailTabState.tabs"
                >
                  <template #information>
                    <div data-testid="source-connection-detail-information">
                      <SourceBucketCollect
                        v-if="isBucketConnection"
                        :source-group-id="selectedServiceId"
                        :connection-id="selectedConnectionId"
                        :connection-name="selectedConnection?.name ?? ''"
                        :description="selectedConnection?.description ?? ''"
                        :bucket-name="selectedConnection?.resource_id ?? ''"
                        :provider-name="selectedService?.providerName"
                        :region-name="selectedService?.regionName"
                      />
                      <SourceInformation
                        v-else
                        :connection-id="selectedConnectionId"
                      />
                    </div>
                  </template>
                  <template #infraCollect>
                    <div data-testid="source-connection-detail-infra-collect">
                      <SourceInfraCollect
                        :source-group-id="selectedServiceId"
                        :connection-id="selectedConnectionId"
                        :meta-viewer-modal-state="
                          modalStates.addInfraMetaViewer.open
                        "
                        @update:metaViewerModalState="
                          e => (modalStates.addInfraMetaViewer.open = e)
                        "
                      />
                    </div>
                  </template>
                  <template #softwareCollect>
                    <div
                      data-testid="source-connection-detail-software-collect"
                    >
                      <SourceSoftwareCollect
                        :source-group-id="selectedServiceId"
                        :connection-id="selectedConnectionId"
                        :meta-viewer-modal-state="
                          modalStates.addSoftwareMetaViewer.open
                        "
                        @update:metaViewerModalState="
                          e => (modalStates.addSoftwareMetaViewer.open = e)
                        "
                      />
                    </div>
                  </template>
                </p-button-tab>
              </template>
            </SourceConnectionList>
          </template>
        </p-tab>
      </div>
    </section>
    <div class="relative z-60">
      <add-source-service-modal
        :fixed-type="sourceKind"
        v-if="modalStates.addServiceGroup.open && !isServiceEditBtnClicked"
        @update:isModalOpened="() => (modalStates.addServiceGroup.open = false)"
        @update:is-connection-modal-opened="handleNewConnectionModal"
        @update:trigger="modalStates.addServiceGroup.trigger = true"
      />
      <edit-source-service-modal
        v-if="modalStates.addServiceGroup.open && isServiceEditBtnClicked"
        :selected-service-id="selectedServiceId"
        @update:is-service-modal-opened="
          e => {
            modalStates.addServiceGroup.open = e;
            isServiceEditBtnClicked = e;
          }
        "
        @update:trigger="
          () => {
            modalStates.addServiceGroup.trigger = true;
            showSuccessMessage('success', 'Edit Success');
          }
        "
      />
    </div>
    <div class="relative z-70">
      <csp-connection-edit-modal
        v-if="
          modalStates.addSourceConnection.open && isCspSelected && cspEditing
        "
        :source-service-id="selectedServiceId"
        :connection-id="selectedConnectionId"
        @update:is-modal-opened="handleConnectionModal"
        @update:trigger="modalStates.addSourceConnection.trigger = true"
        @add="switchToCspAdd"
      />
      <csp-connection-modal
        v-else-if="modalStates.addSourceConnection.open && isCspSelected"
        :source-service-id="selectedServiceId"
        :provider-name="selectedService?.providerName"
        :region-name="selectedService?.regionName"
        :initial-resource-type="cspInitialResourceType"
        @update:is-modal-opened="handleConnectionModal"
        @update:trigger="modalStates.addSourceConnection.trigger = true"
      />
      <source-connection-modal
        v-else-if="
          modalStates.addSourceConnection.open &&
          modalStates.addSourceConnection.category === 'add'
        "
        :selected-connection-id="selectedConnectionId"
        @update:is-connection-modal-opened="handleConnectionModal"
        @update:is-service-modal-opened="
          e => (modalStates.addServiceGroup.open = e)
        "
      />
      <edit-source-connection-modal
        v-else-if="
          modalStates.addSourceConnection.open &&
          modalStates.addSourceConnection.category === 'edit'
        "
        :source-service-id="selectedServiceId"
        :selected-connection-id="selectedConnectionId"
        :multi-selected-connection-ids="multiSelectedConnectionIds"
        @update:is-connection-modal-opened="handleConnectionModal"
        @update:is-service-modal-opened="
          e => (modalStates.addServiceGroup.open = e)
        "
        @update:trigger="modalStates.addSourceConnection.trigger = true"
      />

      <meta-viewer
        v-if="
          modalStates.addInfraMetaViewer.open &&
          sourceConnectionStore.getConnectionById(selectedConnectionId)
            ?.infraData
        "
        :collect-data="infraData"
        :source-connection-name="sourceConnectionName"
        :sg-id="selectedServiceId"
        :conn-id="selectedConnectionId"
        data-type="infra"
        @update:is-meta-viewer-opened="modalStates.addInfraMetaViewer.confirm()"
      />
      <meta-viewer
        v-else-if="modalStates.addSoftwareMetaViewer.open && data"
        :collect-data="softwareData"
        :source-connection-name="sourceConnectionName"
        :sg-id="selectedServiceId"
        :conn-id="selectedConnectionId"
        data-type="software"
        @update:is-meta-viewer-opened="
          modalStates.addSoftwareMetaViewer.confirm()
        "
      />
    </div>
  </div>
</template>
