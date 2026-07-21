<script setup lang="ts">
import { PButton, PTooltip } from '@cloudforet-test/mirinae';
import { computed, Ref } from 'vue';
import { ILoadTestExecutionStep } from '@/entities/mci/model';
import LoadTestEvaluationMetric from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestEvaluationMetric.vue';
import LoadTestResourceMetric from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestResourceMetric.vue';
import LoadTestAggregationTable from '@/widgets/workload/vm/vmEvaluatePerf/ui/LoadTestAggregationTable.vue';
import LoadTestProgress from '@/widgets/workload/vm/loadTestProgress/ui/LoadTestProgress.vue';

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
  // 세분화 단계 진행(cm-ant FR-007-08 steps[]). 구버전 cm-ant면 빈 배열.
  loadTestSteps?: ILoadTestExecutionStep[];
  // 진행률 바용 예상 총 소요(초) — cm-ant totalExpectedExecutionSecond.
  loadTestExpectedSeconds?: number;
  // While a run is in progress, block re-opening Load Config (no second run over the first).
  isLoadTestRunning?: boolean;
  // Turn on the live indicator in the progress display while the poll is running.
  isLoadTestPolling?: boolean;
}

const props = defineProps<IProps>();
// 관리 액션은 상태별 문맥 버튼(모달 없음): 진행 중=Stop / 완료·실패=Re-run(마지막 설정으로 재실행).
const emit = defineEmits([
  'openLoadconfig',
  'openTemplateManager',
  'stopLoadTest',
  'reRun',
]);

// Load Config while a run is in progress would start a second run over the first. Guard the
// handler as well as disabling the button — mirinae's disabled is a class only and leaves the
// click reaching the element (DESIGN-MIRINAE §1.6), so a visual-only guard would not hold.
function handleOpenLoadconfig() {
  if (props.isLoadTestRunning) return;
  emit('openLoadconfig');
}

const isLoadTestRunning = computed(() =>
  ['Running', 'Collecting results'].includes(props.loadTestStatus ?? ''),
);
const hasLoadTest = computed(() => !!props.loadTestStatus);
const isLoadTestFailed = computed(() => props.loadTestStatus === 'Failed');
// 결과(차트·집계)는 성공(Completed)일 때만 노출. 실패/진행 중엔 결과 조회를 하지 않는다.
const isLoadTestCompleted = computed(() => props.loadTestStatus === 'Completed');

// The in-progress detail (two-line message, progress bar, full step list) is drawn by the
// shared LoadTestProgress. This component keeps only the status badge (hover detail) and the
// result / failed / empty branches.

// 단계(steps[]) 표현 매핑 — cm-ant ExecutionStep/StepStatus.
const STEP_LABEL: Record<string, string> = {
  generator_install: 'Generator install',
  agent_install: 'Agent install',
  jmx_prepare: 'JMX prepare',
  jmeter_run: 'JMeter run',
  result_fetch: 'Result fetch',
};
const STEP_MARK: Record<string, string> = {
  ok: '[OK]',
  running: '[..]',
  failed: '[X]',
  pending: '[ ]',
  skipped: '[-]',
};
const stepLabel = (name: string) => STEP_LABEL[name] ?? name;

const steps = computed<ILoadTestExecutionStep[]>(() => props.loadTestSteps ?? []);
const hasSteps = computed(() => steps.value.length > 0);
// 현재 단계 = 진행 중(running)인 단계, 없으면 마지막 실패 단계.
const currentStep = computed(() => {
  const list = steps.value;
  return (
    list.find(s => s.status === 'running') ??
    [...list].reverse().find(s => s.status === 'failed') ??
    null
  );
});

// 배지 라벨: 기존 상태 라벨에 진행 중 현재 단계를 조합("Running · JMeter run").
// 길면 배지가 줄바꿈되도록 CSS 처리(잘리지 않음).
const badgeLabel = computed(() => {
  const base = props.loadTestStatus ?? '';
  if (isLoadTestRunning.value && currentStep.value) {
    return `${base} · ${stepLabel(currentStep.value.name)}`;
  }
  return base;
});

// 상태 배지 hover 상세 — 세분화 단계 진행(steps[]) + 시각 + 실패/진행 detail.
// 긴 내용은 tooltip이 wrap(잘리지 않음). steps 없으면(구버전 cm-ant) 경량 표현으로 폴백.
const statusTooltip = computed(() => {
  const lines: string[] = [];
  for (const s of steps.value) {
    const mark = STEP_MARK[s.status] ?? `[${s.status}]`;
    let line = `${mark} ${stepLabel(s.name)}`;
    if (s.message) line += ` — ${s.message}`;
    lines.push(line);
    // 진행 중·실패 단계는 상세(detail)까지 노출(원인·조치).
    if (s.detail && (s.status === 'running' || s.status === 'failed')) {
      lines.push(`      ${s.detail}`);
    }
  }
  if (lines.length) lines.push('');
  if (props.loadTestStartAt) lines.push(`Started: ${props.loadTestStartAt}`);
  if (props.loadTestFinishAt) lines.push(`Finished: ${props.loadTestFinishAt}`);
  // steps로 실패 detail을 못 준 경우(구버전 등)에만 failureMessage 폴백.
  if (props.loadTestFailureMessage && !hasSteps.value) {
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
          :disabled="props.isLoadTestRunning"
          @click="handleOpenLoadconfig"
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
          :options="{ classes: ['p-tooltip', 'load-test-step-tooltip'] }"
        >
          <span
            class="load-test-status-badge"
            :class="{ running: isLoadTestRunning, failed: isLoadTestFailed }"
            data-testid="vm-load-test-status"
          >
            {{ badgeLabel }}
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
      class="load-test-running-panel"
      data-testid="load-test-progress-panel"
    >
      <LoadTestProgress
        variant="full"
        :status-label="props.loadTestStatus"
        :steps="props.loadTestSteps"
        :start-at="props.loadTestStartAt"
        :expected-seconds="props.loadTestExpectedSeconds"
        :failure-message="props.loadTestFailureMessage"
        :is-polling="props.isLoadTestPolling"
      />
      <p class="load-test-running-hint">
        The results will appear here once it finishes.
      </p>
    </div>
    <div
      v-else-if="isLoadTestFailed"
      class="load-test-empty load-test-failed"
      data-testid="load-test-failed"
    >
      The load test failed, so there are no results to show.<br />
      <span v-if="props.loadTestFailureMessage" class="failure-detail">
        {{ props.loadTestFailureMessage }}<br />
      </span>
      <!-- Which steps ran before it failed, so it is clear how far it got. -->
      <div v-if="props.loadTestSteps && props.loadTestSteps.length" class="failed-steps">
        <LoadTestProgress
          variant="steps"
          :status-label="props.loadTestStatus"
          :steps="props.loadTestSteps"
        />
      </div>
      Check the target server and load generator, then start again with
      <strong>Re-run</strong>.
    </div>
    <div
      v-else-if="isLoadTestCompleted"
      class="flex flex-col gap-4"
      data-testid="load-test-results"
    >
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
  /* 상태+현재 단계 조합이 길어지면 잘리지 않고 줄바꿈되어 아래로 밀린다. */
  max-width: 340px;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
}

/* In-progress panel: shared LoadTestProgress + a hint line. The bar and steps are drawn by the shared component. */
.load-test-running-panel {
  padding: 24px 16px;
  border: 1px dashed #dee2e6;
  border-radius: 4px;
}

.load-test-running-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #868e96;
}

.load-test-status-badge.running {
  background-color: #e7f5ff;
  color: #1971c2;
}

.load-test-status-badge.failed {
  background-color: #fff0f0;
  color: #e03131;
}

.load-test-failed {
  border-color: #ffc9c9;
  color: #e03131;
}

.load-test-failed .failed-steps {
  display: inline-block;
  text-align: left;
  margin: 10px auto;
}

.load-test-failed .failure-detail {
  display: inline-block;
  margin: 6px 0;
  font-size: 13px;
  color: #c92a2a;
  word-break: break-word;
}

.chart {
  @apply border-gray-200 border;
  height: 500px;
  border-radius: 4px 0px 0px 0px;
}
</style>

<!-- 전역: 상태 hover tooltip은 긴 detail이 잘리지 않고 줄바꿈되게 한다.
     기본 .p-tooltip .tooltip-inner는 white-space: pre(줄바꿈 유지·wrap 안 함)라
     640px를 넘는 긴 줄이 잘린다 → pre-wrap + word-break로 오버라이드. -->
<style lang="postcss">
.p-tooltip.load-test-step-tooltip .tooltip-inner {
  max-width: 420px;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}
</style>
