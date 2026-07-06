<script setup lang="ts">
import { PButton, PTooltip } from '@cloudforet-test/mirinae';
import { computed, Ref } from 'vue';
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
  // 경량 상태 hover용 상세(현행 API가 주는 범위) — 전체 시작/종료 시각·실패 메시지.
  loadTestStartAt?: string;
  loadTestFinishAt?: string;
  loadTestFailureMessage?: string;
}

const props = defineProps<IProps>();
// 관리 액션은 상태별 문맥 버튼(모달 없음): 진행 중=Stop / 완료·실패=Re-run(마지막 설정으로 재실행).
const emit = defineEmits([
  'openLoadconfig',
  'openTemplateManager',
  'stopLoadTest',
  'reRun',
]);

const isLoadTestRunning = computed(() =>
  ['Running', 'Collecting results'].includes(props.loadTestStatus ?? ''),
);
const hasLoadTest = computed(() => !!props.loadTestStatus);
const isLoadTestFailed = computed(() => props.loadTestStatus === 'Failed');

// 상태 배지 hover 상세(짧은 라벨은 인라인, 긴 실패 메시지·시각은 hover로).
const statusTooltip = computed(() => {
  const lines: string[] = [];
  if (props.loadTestStartAt) lines.push(`Started: ${props.loadTestStartAt}`);
  if (props.loadTestFinishAt) lines.push(`Finished: ${props.loadTestFinishAt}`);
  if (props.loadTestFailureMessage) {
    lines.push(`Error: ${props.loadTestFailureMessage}`);
  }
  return lines.join('\n');
});
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
        <!-- 상태별 문맥 버튼: 진행 중=Stop / 완료·실패=Re-run / 미실행=없음 -->
        <p-button
          v-if="isLoadTestRunning"
          data-testid="vm-load-stop"
          style-type="negative-secondary"
          icon-left="ic_close"
          @click="emit('stopLoadTest')"
        >
          Stop
        </p-button>
        <p-button
          v-else-if="hasLoadTest"
          data-testid="vm-load-rerun"
          style-type="tertiary"
          icon-left="ic_refresh"
          @click="emit('reRun')"
        >
          Re-run
        </p-button>
        <!-- 짧은 상태 라벨 + hover 상세(시각·실패 메시지) -->
        <p-tooltip
          v-if="hasLoadTest"
          :contents="statusTooltip"
          position="bottom"
        >
          <span
            class="load-test-status-badge"
            :class="{ running: isLoadTestRunning, failed: isLoadTestFailed }"
            data-testid="vm-load-test-status"
          >
            {{ props.loadTestStatus }}
          </span>
        </p-tooltip>
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

.load-test-status-badge.failed {
  background-color: #fff0f0;
  color: #e03131;
}

.chart {
  @apply border-gray-200 border;
  height: 500px;
  border-radius: 4px 0px 0px 0px;
}
</style>
