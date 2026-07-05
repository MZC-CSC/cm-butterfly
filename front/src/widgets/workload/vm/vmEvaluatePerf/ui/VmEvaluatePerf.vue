<script setup lang="ts">
import { PButton, PButtonModal } from '@cloudforet-test/mirinae';
import { computed, ref, Ref } from 'vue';
import LoadTestEvaluationMetric from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestEvaluationMetric.vue';
import LoadTestResourceMetric from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestResourceMetric.vue';
import LoadTestAggregationTable from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestAggregationTable.vue';

interface IProps {
  mciId: string;
  nsId: string;
  vmId: string;
  loading: Ref<boolean>;
  // 현재/마지막 부하테스트 상태 라벨(Running/Collecting results/Completed/Failed). 비어 있으면 미실행.
  loadTestStatus?: string;
}

const props = defineProps<IProps>();
const emit = defineEmits([
  'openLoadconfig',
  'openTemplateManager',
  'checkLoadStatus',
  'stopLoadTest',
]);

// 진행 중(실행/수집)인지 여부 — 배지 색/문구용.
const isLoadTestRunning = computed(() =>
  ['Running', 'Collecting results'].includes(props.loadTestStatus ?? ''),
);

// Load Manage 관리 모달
const manageModalOpen = ref(false);
function openManageModal() {
  emit('checkLoadStatus'); // 열 때 최신 상태 재조회
  manageModalOpen.value = true;
}
function handleManageRefresh() {
  emit('checkLoadStatus');
}
function handleManageStop() {
  emit('stopLoadTest');
}
function handleManageRerun() {
  manageModalOpen.value = false;
  emit('openLoadconfig');
}
</script>

<template>
  <div class="vm-evaluate-perf-widget">
    <div class="widget-tab-section-header">
      <p>Evaluate Performance Result</p>
      <h5>
        You can save and manage scenario templates in advance. Save frequently
        used configurations as templates for reuse.
      </h5>
      <div class="flex gap-1.5">
        <p-button
          data-testid="vm-scenario-templates-open"
          style-type="tertiary"
          icon-left="ic_service_bookmark"
          @click="emit('openTemplateManager')"
        >
          Scenario Templates
        </p-button>
      </div>
      <h5>
        when you complete the load configuration, you will see the result data.
        Please configure the load.
      </h5>
      <div class="flex gap-1.5 items-center">
        <p-button
          data-testid="vm-load-config-open"
          style-type="secondary"
          icon-left="ic_settings"
          @click="emit('openLoadconfig')"
        >
          Load Config
        </p-button>
        <p-button
          data-testid="vm-load-manage"
          style-type="tertiary"
          icon-left="ic_settings-filled"
          :disabled="!props.loadTestStatus"
          @click="openManageModal"
        >
          Load Manage
        </p-button>
        <span
          v-if="props.loadTestStatus"
          class="load-test-status-badge"
          :class="{ running: isLoadTestRunning }"
          data-testid="vm-load-test-status"
        >
          Load Test: {{ props.loadTestStatus }}
        </span>
      </div>
    </div>
    <!-- 결과 영역: 부하측정이 없으면 안내(그래프 숨김), 진행 중이면 로딩, 완료면 결과 표시 -->
    <div
      v-if="!props.loadTestStatus"
      class="load-test-empty"
      data-testid="load-test-empty"
    >
      No load test has been run for this server yet.<br />
      Use <strong>Load Config</strong> to start a load test — the results will
      appear here.
    </div>
    <div
      v-else-if="isLoadTestRunning"
      class="load-test-empty"
      data-testid="load-test-progress"
    >
      Load test in progress ({{ props.loadTestStatus }})…<br />
      The results will appear here once it finishes.
    </div>
    <div v-else class="flex flex-col gap-4">
      <div class="font-bold text-2xl" data-testid="load-test-aggregation-table">
        Aggregation Table
        <LoadTestAggregationTable
          :mci-id="props.mciId"
          :ns-id="props.nsId"
          :vm-id="props.vmId"
        />
      </div>
      <div class="chart w-full" data-testid="load-test-result-metric">
        <div class="font-bold text-2xl">Result metric</div>
        <div class="h-[calc(100%-2rem)]">
          <LoadTestEvaluationMetric
            :mci-id="props.mciId"
            :ns-id="props.nsId"
            :vm-id="props.vmId"
          />
        </div>
      </div>
      <div
        class="chart w-full font-bold text-2xl"
        data-testid="load-test-resource-metric"
      >
        <div class="font-bold text-2xl">Resource Metric</div>
        <div class="h-[calc(100%-2rem)]">
          <LoadTestResourceMetric
            :mci-id="props.mciId"
            :ns-id="props.nsId"
            :vm-id="props.vmId"
          />
        </div>
      </div>
    </div>

    <PButtonModal
      data-testid="load-manage-modal"
      :visible="manageModalOpen"
      size="sm"
      header-title="Load Test Management"
      @confirm="manageModalOpen = false"
      @cancel="manageModalOpen = false"
      @close="manageModalOpen = false"
      @update:visible="v => (manageModalOpen = v)"
    >
      <template #body>
        <div class="load-manage-body">
        <p>
          Current status:
          <strong>{{ props.loadTestStatus || '—' }}</strong>
        </p>
        <div class="load-manage-actions">
          <p-button
            style-type="tertiary"
            icon-left="ic_refresh"
            data-testid="load-manage-refresh"
            @click="handleManageRefresh"
          >
            Refresh Status
          </p-button>
          <p-button
            v-if="isLoadTestRunning"
            style-type="negative-secondary"
            data-testid="load-manage-stop"
            @click="handleManageStop"
          >
            Stop
          </p-button>
          <p-button
            style-type="secondary"
            icon-left="ic_settings"
            data-testid="load-manage-rerun"
            @click="handleManageRerun"
          >
            Re-run
          </p-button>
        </div>
        </div>
      </template>
    </PButtonModal>
  </div>
</template>

<style scoped lang="postcss">
.vm-evaluate-perf-widget {
  .widget-tab-section-header {
    padding: 18px 0 18px 0;
    display: flex;
    flex-direction: column;
    p {
      @apply text-display-lg;
      font-weight: 700;
    }

    h5 {
      font-size: 14px;
      font-weight: 400;
      line-height: 17.5px;
      text-align: left;
      margin: 16px 0 8px 0;
    }
  }
}

.load-manage-body {
  padding: 8px 4px;
  font-size: 14px;
}

.load-manage-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.load-test-empty {
  padding: 48px 16px;
  text-align: center;
  color: #868e96;
  font-size: 14px;
  line-height: 1.6;
  border: 1px dashed #dee2e6;
  border-radius: 4px;
}

.load-test-status-badge {
  font-size: 13px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 4px;
  background-color: #f1f3f5;
  color: #495057;
  white-space: nowrap;
}

.load-test-status-badge.running {
  background-color: #e7f5ff;
  color: #1971c2;
}

.chart {
  @apply border-gray-200 border;
  height: 500px;
  border-radius: 4px 0px 0px 0px;
}
</style>
