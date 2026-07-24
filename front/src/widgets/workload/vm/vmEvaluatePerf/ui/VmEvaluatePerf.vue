<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
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
  // Current/last load-test status label (Running / Collecting results / Completed / Failed).
  // Empty means no run yet.
  loadTestStatus?: string;
  loadTestStartAt?: string;
  loadTestFinishAt?: string;
  loadTestFailureMessage?: string;
  // Fine-grained tree progress (cm-ant FR-007-08 steps[]). Empty on older cm-ant.
  loadTestSteps?: ILoadTestExecutionStep[];
  // Expected total duration (seconds) for the progress bar — cm-ant totalExpectedExecutionSecond.
  loadTestExpectedSeconds?: number;
  // While a run is in progress, block re-opening Load Config (no second run over the first).
  isLoadTestRunning?: boolean;
  // Turn on the live indicator in the progress display while the poll is running.
  isLoadTestPolling?: boolean;
}

const props = defineProps<IProps>();
// Management actions are status-aware context buttons (no modal): running = Stop,
// completed/failed = Re-run (re-runs with the last settings).
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

// Stopping a run kills the JMeter process on the load generator, so it only means anything while
// JMeter is actually running. Asked earlier, cm-ant fails in two different ways and both reached
// the screen as a bare 400: before the generator exists it cannot find the install record, and
// once it exists but the load has not started the kill command matches no process and comes back
// with a non-zero exit. The phases before the load run — pre-check, generator install, agent
// install, test plan — are short and end on their own, so the button waits for the load run.
//
// An older cm-ant reports no steps at all; there is nothing to base the decision on, so the
// button stays available rather than being permanently disabled.
const canStopLoadTest = computed(() => {
  const steps = props.loadTestSteps ?? [];
  if (!steps.length) return true;
  return steps.some(s => s.name === 'jmeter_run' && s.status === 'running');
});

// Same guard as Load Config: mirinae's disabled is a class only and the click still reaches the
// element (DESIGN-MIRINAE §1.6), so the handler has to hold the rule too.
function handleStopLoadTest() {
  if (!canStopLoadTest.value) return;
  emit('stopLoadTest');
}
const hasLoadTest = computed(() => !!props.loadTestStatus);
const isLoadTestFailed = computed(() => props.loadTestStatus === 'Failed');
// Results (charts / aggregation) show only on success. Nothing is fetched while running/failed.
const isLoadTestCompleted = computed(() => props.loadTestStatus === 'Completed');

// The in-progress detail (two-line summary, bar, full tree), the header badge and the failed
// step list are all drawn by the shared LoadTestProgress — this component only decides which
// branch to show and keeps the result / failed / empty layout.
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
        <!-- status-aware context button: running = Stop / completed·failed = Re-run / none = hidden -->
        <p-button
          v-if="isLoadTestRunning"
          data-testid="vm-load-stop"
          style-type="negative-secondary"
          icon-left="ic_close"
          :disabled="!canStopLoadTest"
          :title="
            canStopLoadTest
              ? undefined
              : 'Available once the load run has started'
          "
          @click="handleStopLoadTest"
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
        <!-- short status label + the step tree on hover (drawn by the shared component) -->
        <load-test-progress
          v-if="hasLoadTest"
          variant="badge"
          :status-label="props.loadTestStatus"
          :steps="props.loadTestSteps"
          :start-at="props.loadTestStartAt"
          :finish-at="props.loadTestFinishAt"
          :failure-message="props.loadTestFailureMessage"
        />
      </div>
    </div>
    <!-- Result area: no run → guidance (charts hidden); running → progress; completed → results -->
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
      class="load-test-failed-panel"
      data-testid="load-test-failed"
    >
      <!-- error message first, in red; then the processed steps below in normal, left-aligned text -->
      <p class="failed-headline">
        The load test failed, so there are no results to show.
      </p>
      <p v-if="props.loadTestFailureMessage" class="failed-reason">
        {{ props.loadTestFailureMessage }}
      </p>
      <div
        v-if="props.loadTestSteps && props.loadTestSteps.length"
        class="failed-steps"
      >
        <LoadTestProgress
          variant="steps"
          :status-label="props.loadTestStatus"
          :steps="props.loadTestSteps"
        />
      </div>
      <p class="failed-hint">
        Check the target server and load generator, then start again with
        <strong>Re-run</strong>.
      </p>
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

/* In-progress panel: shared LoadTestProgress + a hint line. */
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

/* Failed panel — left-aligned (the processed steps must not be centred like an error line). */
.load-test-failed-panel {
  padding: 20px 16px;
  border: 1px solid #ffc9c9;
  border-radius: 4px;
  text-align: left;
}

.failed-headline {
  font-size: 14px;
  font-weight: 600;
  color: #e03131;
}

.failed-reason {
  margin-top: 6px;
  font-size: 13px;
  color: #c92a2a;
  word-break: break-word;
  white-space: pre-wrap;
}

.failed-steps {
  margin: 12px 0;
}

.failed-hint {
  margin-top: 10px;
  font-size: 13px;
  color: #868e96;
}

.chart {
  @apply border-gray-200 border;
  height: 500px;
  border-radius: 4px 0px 0px 0px;
}
</style>
