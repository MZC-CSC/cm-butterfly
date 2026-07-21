<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { ILoadTestExecutionStep } from '@/entities/mci/model';

/**
 * Shared load-test progress display.
 *
 * The same progress needs to appear in three places — the Evaluate Perf tab, the Information
 * tab, and the Load Config popup — so the rendering lives here rather than being copied.
 *
 * This is display only. It polls nothing and owns no timer. The live data (status, steps,
 * elapsed) is passed in by the owner (VmList), and whether polling is alive is passed as
 * `isPolling` so the bar can show it is still updating rather than stuck.
 *
 * Layout (user-specified):
 *   above the bar   — two lines: line 1 the current stage (bold), line 2 the live detail
 *   the bar         — elapsed ratio, with a live indicator while polling
 *   below the bar   — every step, laid out without a scrollbar; errors in red
 */

interface IProps {
  statusLabel?: string;
  steps?: ILoadTestExecutionStep[];
  startAt?: string;
  expectedSeconds?: number;
  failureMessage?: string;
  isPolling?: boolean;
  // 'full' = message + bar + steps · 'compact' = message + bar · 'steps' = step list only
  variant?: 'full' | 'compact' | 'steps';
}

const props = withDefaults(defineProps<IProps>(), { variant: 'full' });

const isRunning = computed(() =>
  ['Running', 'Collecting results'].includes(props.statusLabel ?? ''),
);
const isCompleted = computed(() => props.statusLabel === 'Completed');

// A one-second cosmetic tick so the elapsed bar advances smoothly. This is not polling —
// it never fetches; it only re-reads the clock while a run is active.
const nowMs = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;
const stopTick = () => {
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
};
watch(
  isRunning,
  running => {
    if (running) {
      nowMs.value = Date.now();
      if (!tick) tick = setInterval(() => (nowMs.value = Date.now()), 1000);
    } else {
      stopTick();
    }
  },
  { immediate: true },
);
onBeforeUnmount(stopTick);

const STEP_LABEL: Record<string, string> = {
  generator_install: 'Generator install',
  agent_install: 'Agent install',
  jmx_prepare: 'JMX prepare',
  jmeter_run: 'JMeter run',
  result_fetch: 'Result fetch',
};
const stepLabel = (name: string) => STEP_LABEL[name] ?? name;

const steps = computed<ILoadTestExecutionStep[]>(() => props.steps ?? []);

// The step currently running, else the last failed one — drives the two-line summary.
const currentStep = computed(
  () =>
    steps.value.find(s => s.status === 'running') ??
    [...steps.value].reverse().find(s => s.status === 'failed') ??
    null,
);

// Line 1: status + current stage. Line 2: that stage's live message/detail.
const primaryLine = computed(() => {
  const base = props.statusLabel ?? '';
  if (isRunning.value && currentStep.value) {
    return `${base} · ${stepLabel(currentStep.value.name)}`;
  }
  return base;
});
const secondaryLine = computed(() => {
  const s = currentStep.value;
  if (!s) return '';
  return s.detail || s.message || '';
});

// Percent from startAt + expected seconds. Completed = 100. Unknown expected = null
// (indeterminate bar). While running, capped 2..95 so it never reads 100 before it ends.
const progressPercent = computed<number | null>(() => {
  if (isCompleted.value) return 100;
  if (!isRunning.value) return 0;
  const start = props.startAt ? Date.parse(props.startAt) : NaN;
  const expectedMs = (props.expectedSeconds ?? 0) * 1000;
  if (!start || Number.isNaN(start) || expectedMs <= 0) return null;
  const pct = ((nowMs.value - start) / expectedMs) * 100;
  return Math.max(2, Math.min(95, Math.round(pct)));
});

const stepStateClass = (status: string) => ({
  'is-ok': status === 'ok',
  'is-running': status === 'running',
  'is-failed': status === 'failed',
  'is-pending': status === 'pending',
  'is-skipped': status === 'skipped',
});
const STEP_MARK: Record<string, string> = {
  ok: '✓',
  running: '⟳',
  failed: '✗',
  pending: '○',
  skipped: '–',
};
const stepMark = (status: string) => STEP_MARK[status] ?? '○';
</script>

<template>
  <div class="load-test-progress" data-testid="load-test-progress">
    <!-- two-line summary above the bar (not in 'steps' mode, which is the finished step list) -->
    <p
      v-if="variant !== 'steps'"
      class="lt-primary"
      data-testid="load-test-progress-primary"
    >
      {{ primaryLine }}
    </p>
    <p
      v-if="variant !== 'steps' && secondaryLine"
      class="lt-secondary"
      data-testid="load-test-progress-secondary"
    >
      {{ secondaryLine }}
    </p>

    <!-- the bar, with a live indicator while polling -->
    <div v-if="variant !== 'steps'" class="lt-bar-row">
      <div class="lt-bar" data-testid="load-test-progress-bar">
        <div
          class="lt-fill"
          :class="{ indeterminate: progressPercent === null }"
          :style="progressPercent !== null ? { width: progressPercent + '%' } : {}"
        ></div>
      </div>
      <span
        v-if="progressPercent !== null"
        class="lt-pct"
        data-testid="load-test-progress-pct"
        >{{ progressPercent }}%</span
      >
      <!-- shows the value is live: spinning while polling, so a bar stuck at 60% reads as
           "still checking" rather than "gave up". Stops when polling stops. -->
      <span
        v-if="isPolling"
        class="lt-live"
        data-testid="load-test-progress-live"
        title="Checking…"
      ></span>
    </div>

    <!-- every step below the bar, no scrollbar; errors in red -->
    <ul
      v-if="(variant === 'full' || variant === 'steps') && steps.length"
      class="lt-steps"
      data-testid="load-test-progress-steps"
    >
      <li
        v-for="s in steps"
        :key="s.name"
        class="lt-step"
        :class="stepStateClass(s.status)"
        :data-testid="`load-test-step-${s.name}`"
      >
        <span class="lt-step-mark">{{ stepMark(s.status) }}</span>
        <span class="lt-step-label">{{ stepLabel(s.name) }}</span>
        <span v-if="s.message" class="lt-step-msg">— {{ s.message }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="postcss">
.load-test-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.lt-primary {
  font-size: 13px;
  font-weight: 700;
  color: #343a40;
  word-break: break-word;
}

.lt-secondary {
  font-size: 12px;
  font-weight: 400;
  color: #495057;
  word-break: break-word;
}

.lt-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lt-bar {
  flex: 1;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 999px;
  overflow: hidden;
}

.lt-fill {
  height: 100%;
  background-color: #1971c2;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.lt-fill.indeterminate {
  width: 35%;
  animation: lt-indeterminate 1.4s ease-in-out infinite;
}

@keyframes lt-indeterminate {
  0% {
    margin-left: -35%;
  }
  100% {
    margin-left: 100%;
  }
}

.lt-pct {
  font-size: 12px;
  color: #1971c2;
  font-weight: 600;
  min-width: 34px;
  text-align: right;
}

/* live indicator — a small spinner shown only while polling */
.lt-live {
  width: 12px;
  height: 12px;
  border: 2px solid #adb5bd;
  border-top-color: transparent;
  border-radius: 50%;
  animation: lt-spin 0.8s linear infinite;
}

@keyframes lt-spin {
  to {
    transform: rotate(360deg);
  }
}

.lt-steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  list-style: none;
  padding: 0;
}

.lt-step {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #495057;
  word-break: break-word;
}

.lt-step-mark {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.lt-step.is-ok .lt-step-mark {
  color: #2f9e44;
}
.lt-step.is-running {
  font-weight: 600;
}
.lt-step.is-running .lt-step-mark {
  color: #1971c2;
}
/* errors in red (user-specified) */
.lt-step.is-failed,
.lt-step.is-failed .lt-step-mark {
  color: #e03131;
}
.lt-step.is-pending,
.lt-step.is-skipped {
  color: #adb5bd;
}
</style>
