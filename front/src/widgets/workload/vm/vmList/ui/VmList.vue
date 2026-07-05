<script setup lang="ts">
import {
  PButton,
  PSelectCard,
  PToolbox,
  PDataLoader,
  PButtonTab,
} from '@cloudforet-test/mirinae';
import { useVmListModel } from '@/widgets/workload/vm/vmList/model';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import SuccessfullyLoadConfigModal from '@/features/workload/successfullyModal/ui/SuccessfullyLoadConfigModal.vue';
import LoadConfig from '@/features/workload/actionLoadConfig/ui/LoadConfig.vue';
import { showErrorMessage } from '@/shared/utils';
import { IVm } from '@/entities/mci/model';
import VmInformation from '@/widgets/workload/vm/vmInformation/ui/VmInformation.vue';
import VmEvaluatePerf from '@/widgets/workload/vm/vmEvaluatePerf/ui/VmEvaluatePerf.vue';
import ScenarioTemplateManagerModal from '@/widgets/workload/vm/scenarioTemplate/ui/ScenarioTemplateManagerModal.vue';
import { useGetLastLoadTestState, useStopLoadTest } from '@/entities/vm/api/api';
import { useGetMciInfo } from '@/entities/mci/api';

interface IProps {
  nsId: string;
  mciId: string;
  selectedVmId?: string;
}

const props = defineProps<IProps>();
const emit = defineEmits(['selectCard']);
const resLoadStatus = useGetLastLoadTestState(null);
const resGetMci = useGetMciInfo(null);
const selectedVm = ref<IVm | null>(null);
const loadConfigRef = ref();

// 부하테스트 진행 상태 폴링(FR-M7-WL-003-07). cm-ant 상태: on_processing→on_fetching→successed/test_failed.
const LOADTEST_TERMINAL_STATUS = ['successed', 'test_failed'];
const LOADTEST_STATUS_LABEL: Record<string, string> = {
  on_processing: 'Running',
  on_fetching: 'Collecting results',
  successed: 'Completed',
  test_failed: 'Failed',
};
// Evaluate Perf 헤더(Load Config 옆)에 노출할 현재 부하테스트 상태 라벨. 폴링 시마다 갱신.
const currentLoadTestStatusLabel = computed(() => {
  const status = (resLoadStatus as any).data?.value?.responseData?.result
    ?.executionStatus as string | undefined;
  return status ? LOADTEST_STATUS_LABEL[status] ?? status : '';
});
// 관리(중단)용 loadTestKey.
const currentLoadTestKey = computed(
  () =>
    ((resLoadStatus as any).data?.value?.responseData?.result
      ?.loadTestKey as string) ?? '',
);

const resStopLoadTest = useStopLoadTest(null);
function handleStopLoadTest() {
  const key = currentLoadTestKey.value;
  if (!key) return;
  resStopLoadTest
    .execute({ request: { loadTestKey: key } })
    .then(() => setVmLoadTestResult())
    .catch(e => showErrorMessage('error', e.errorMsg?.value ?? 'Stop failed'));
}
let loadStatusPollTimer: ReturnType<typeof setTimeout> | null = null;
// 완료 감지 시 결과 컴포넌트(집계·결과·리소스)를 강제 재조회하기 위한 key.
const loadTestResultKey = ref(0);

function stopLoadStatusPolling() {
  if (loadStatusPollTimer) {
    clearTimeout(loadStatusPollTimer);
    loadStatusPollTimer = null;
  }
}
const { mciStore, initToolBoxTableModel, vmListTableModel, setMci } =
  useVmListModel();

const modalState = reactive({
  loadConfigRequest: {
    open: false,
    context: {
      scenarioName: '',
    },
  },
  loadConfigSuccess: {
    open: false,
  },
  templateManagerRequest: {
    open: false,
  },
});
const vmDetailTabState = reactive({
  activeTab: 'information',
  tabs: [
    {
      name: 'information',
      label: 'Information',
    },
    {
      name: 'connection',
      label: 'Connection',
    },
    {
      name: 'monitoring',
      label: 'Monitoring',
    },
    {
      name: 'evaluatePerf',
      label: 'Evaluate Perf',
    },
    {
      name: 'estimateCost',
      label: 'Estimate Cost',
    },
  ],
});

watch(
  () => props.mciId,
  async () => {
    await handleMciIdChange();
  },
  { immediate: true },
);

watch(
  () => props.selectedVmId,
  newVmId => {
    if (newVmId && mciStore.getMciById(props.mciId)) {
      const vm = mciStore
        .getMciById(props.mciId)
        ?.vm.find(vm => vm.id === newVmId);
      if (vm) {
        selectedVm.value = vm;
        // Update selectIndex to match the selected VM
        const vmIndex = vmListTableModel.tableState.displayItems.findIndex(
          item => (item as any).originalData.id === newVmId,
        );
        if (vmIndex !== -1) {
          vmListTableModel.tableState.selectIndex = [vmIndex];
        }
        setVmLoadTestResult();
      }
    } else {
      selectedVm.value = null;
      vmListTableModel.tableState.selectIndex = [];
    }
  },
  { immediate: true },
);

onMounted(() => {
  initToolBoxTableModel();
});

onBeforeUnmount(() => {
  stopLoadStatusPolling();
});

async function getMciInfo() {
  return resGetMci
    .execute({
      pathParams: {
        nsId: props.nsId,
        infraId: props.mciId,
      },
    })
    .then(res => {
      if (res.data.responseData) {
        mciStore.setMci(res.data.responseData);
      }
    })
    .catch(e => {
      showErrorMessage(e, e.errorMsg.value);
    });
}

async function handleMciIdChange() {
  vmListTableModel.tableState.loading = true;
  await getMciInfo();
  setMci(props.mciId);
  vmListTableModel.tableState.selectIndex = [];
  selectedVm.value = null;
  vmListTableModel.tableState.loading = false;
}

function setVmLoadTestResult() {
  if (selectedVm.value === null) return;
  // 다른 노드로 전환/재조회 시 이전 폴링 중단
  stopLoadStatusPolling();
  const targetVmId = selectedVm.value.id;

  resLoadStatus
    .execute({
      request: {
        nsId: props.nsId,
        infraId: props.mciId,
        nodeId: targetVmId,
      },
    })
    .then(res => {
      // 선택 노드가 그새 바뀌었으면 무시
      if (selectedVm.value?.id !== targetVmId) return;
      if (res.data.responseData) {
        const result = res.data.responseData.result;
        mciStore.assignLastLoadTestStateToVm(props.mciId, targetVmId, result);

        const status = result?.executionStatus;
        if (status && !LOADTEST_TERMINAL_STATUS.includes(status)) {
          // 진행 중(on_processing/on_fetching) → 주기 폴링으로 상태 갱신
          loadStatusPollTimer = setTimeout(() => setVmLoadTestResult(), 5000);
        } else if (status && LOADTEST_TERMINAL_STATUS.includes(status)) {
          // 완료/실패 → 폴링 종료 + 결과 컴포넌트 재조회
          stopLoadStatusPolling();
          loadTestResultKey.value += 1;
        }
      }
    })
    .catch(e => {
      showErrorMessage(e, e.errorMsg.value);
    });
}

function handleCardClick(value: any) {
  if (value && value.name) {
    emit('selectCard', value.originalData.id);
    selectedVm.value = value.originalData;
    setVmLoadTestResult();
  } else {
    selectedVm.value = null;
  }
}

function handleLoadStatus() {
  modalState.loadConfigRequest.open = true;
  modalState.loadConfigSuccess.open = false;
}

function handleTemplateManager() {
  modalState.templateManagerRequest.open = true;
}
function handleLoadConfigRequestClose() {
  modalState.loadConfigRequest.open = false;
}

function handleLoadConfigRequestSuccess(e: string) {
  modalState.loadConfigRequest.open = false;
  modalState.loadConfigSuccess.open = true;
  modalState.loadConfigRequest.context.scenarioName = e;
}

function handleLoadConfigSuccessClose() {
  modalState.loadConfigSuccess.open = false;
  setVmLoadTestResult();
}

function handleTemplateManagerOpen() {
  modalState.templateManagerRequest.open = true;
}

function handleTemplateManagerClose() {
  modalState.templateManagerRequest.open = false;
}
</script>

<template>
  <div class="p-4">
    <section class="vmList-container">
      <p-toolbox
        :page-size-changeable="false"
        :key-item-sets="vmListTableModel.querySearchState.keyItemSet"
        :value-handler-map="vmListTableModel.querySearchState.valueHandlerMap"
        :query-tag="vmListTableModel.querySearchState.queryTag"
        :total-count="vmListTableModel.tableState.tableCount"
        :page-size="vmListTableModel.tableOptions.pageSize"
        :search-type="vmListTableModel.tableOptions.searchType"
        :loading="
          vmListTableModel.tableState.loading || resLoadStatus.isLoading.value
        "
        @change="vmListTableModel.handleChange"
        @refresh="handleMciIdChange"
      >
        <template #left-area>
          <p-button
            style-type="tertiary"
            icon-left="ic_plus_bold"
            :disabled="true"
          >
            Add Server
          </p-button>
        </template>
      </p-toolbox>
      
      <!-- 로딩 중일 때 스피너 표시 -->
      <table-loading-spinner
        :loading="vmListTableModel.tableState.loading"
        message="Loading servers..."
      />
      
      <!-- 로딩 완료 후 카드 표시 -->
      <div v-if="!vmListTableModel.tableState.loading" class="vmList-content">
        <p-data-loader
          v-if="vmListTableModel.tableState.displayItems.length === 0"
          :data="false"
          :loading="false"
        />
        <template v-else>
          <p-select-card
            v-for="value in vmListTableModel.tableState.displayItems"
            :key="value.name"
            :value="value.name"
            :selected="selectedVm?.name"
            :multi-selectable="false"
            class="vmList-card"
            @click="() => handleCardClick(value)"
          >
            {{ value.name }}
          </p-select-card>
        </template>
      </div>
    </section>
    <section>
      <p-button-tab
        v-if="selectedVm?.id"
        v-model="vmDetailTabState.activeTab"
        :tabs="vmDetailTabState.tabs"
      >
        <template #information>
          <VmInformation
            :mci-id="props.mciId"
            :ns-id="props.nsId"
            :vm-id="selectedVm.id"
            :loading="resLoadStatus.isLoading"
            :lastloadtest-state-response="
              resLoadStatus.data.value?.responseData?.result
            "
            @openLoadconfig="handleLoadStatus"
            @openTemplateManager="handleTemplateManager"
          />
        </template>
        <template #connection>
          <p>to be..</p>
        </template>
        <template #monitoring>
          <p>to be..</p>
        </template>
        <template #evaluatePerf>
          <VmEvaluatePerf
            :key="loadTestResultKey"
            :loading="resLoadStatus.isLoading"
            :mci-id="props.mciId"
            :ns-id="props.nsId"
            :vm-id="selectedVm.id"
            :ip="selectedVm.publicIP"
            :load-test-status="currentLoadTestStatusLabel"
            @openLoadconfig="handleLoadStatus"
            @openTemplateManager="handleTemplateManagerOpen"
            @checkLoadStatus="setVmLoadTestResult"
            @stopLoadTest="handleStopLoadTest"
          />
        </template>
        <template #estimateCost>
          <p>to be..</p>
        </template>
      </p-button-tab>
    </section>

    <LoadConfig
      v-if="selectedVm"
      ref="loadConfigRef"
      :is-open="modalState.loadConfigRequest.open"
      :mci-id="props.mciId"
      :ns-id="props.nsId"
      :vm-id="selectedVm?.id ?? ''"
      :ip="selectedVm?.publicIP ?? ''"
      @success="handleLoadConfigRequestSuccess"
      @close="handleLoadConfigRequestClose"
    />
    <SuccessfullyLoadConfigModal
      :is-open="modalState.loadConfigSuccess.open"
      :scenario-name="modalState.loadConfigRequest.context.scenarioName"
      @close="handleLoadConfigSuccessClose"
    />
    <ScenarioTemplateManagerModal
      :is-open="modalState.templateManagerRequest.open"
      :ns-id="props.nsId"
      :mci-id="props.mciId"
      :vm-id="selectedVm?.id ?? ''"
      :ip="selectedVm?.publicIP ?? ''"
      @close="handleTemplateManagerClose"
    />
  </div>
</template>

<style scoped lang="postcss">
.vmList-container {
  @apply border-b border-gray-300;
}

.vmList-content {
  @apply w-full flex flex-wrap;
  max-height: 208px;
  padding-top: 10px;
  padding-bottom: 10px;
  overflow-y: auto;
}

.vmList-card {
  width: 18.75rem;
  margin: 0.25rem;
  padding: 0.5rem;
}

/* custom design-system component - p-select-card */
:deep(.p-select-card .marker) {
  display: none;
}
</style>
