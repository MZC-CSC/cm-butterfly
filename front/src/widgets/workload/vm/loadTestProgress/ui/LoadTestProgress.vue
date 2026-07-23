<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue';
import { PTooltip } from '@cloudforet-test/mirinae';
import { ILoadTestExecutionStep } from '@/entities/mci/model';

/**
 * Shared load-test progress display — the single place that knows how a run is shown.
 *
 * cm-ant returns steps[] already shaped as a tree: the top level is the phases
 * and each phase carries its sub-steps in `children`. Everything derived from that — labels,
 * the current running leaf, the whole-process percentage, the hover tooltip — lives here so
 * the Evaluate Perf tab, the Information tab and the Load Config popup all render from one
 * implementation. Consumers only pass the raw state and pick a `variant`.
 *
 * This is display only. It polls nothing and owns no timer that fetches; the live data
 * (status, steps, elapsed) is passed in by the owner (VmList), and `isPolling` says whether
 * the poll is alive so the bar can show it is still updating rather than stuck.
 *
 * Variants:
 *   full    — two-line summary + bar + full phase/sub-step tree   (Evaluate Perf running panel)
 *   compact — fixed-height bar row only, no changing text lines    (popup / Information cell while running)
 *   steps   — the phase/sub-step tree only                         (failed panel)
 *   badge   — status chip (failed = red) with the tree on hover    (Evaluate Perf header / Information cell when terminal)
 */

interface IProps {
  statusLabel?: string;
  steps?: ILoadTestExecutionStep[];
  startAt?: string;
  finishAt?: string;
  expectedSeconds?: number;
  failureMessage?: string;
  isPolling?: boolean;
  variant?: 'full' | 'compact' | 'steps' | 'badge';
}

const props = withDefaults(defineProps<IProps>(), { variant: 'full' });

const isRunning = computed(() =>
  ['Running', 'Collecting results'].includes(props.statusLabel ?? ''),
);
const isCompleted = computed(() => props.statusLabel === 'Completed');
const isFailed = computed(() => props.statusLabel === 'Failed');

const steps = computed<ILoadTestExecutionStep[]>(() => props.steps ?? []);

// A one-second cosmetic tick so the bar advances smoothly between 5s polls. Not polling —
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

// Keep the running phase in view as it advances, so on a narrow screen (a long step list with
// a scrollbar) the eye does not have to hunt for where the work is. Scrolls only when the
// running phase *changes*, not every poll, and only within the full panel — so it moves once
// per phase rather than jittering, and never in the compact cell or badge. block:'nearest'
// leaves it alone when the row is already visible.
const rootEl = ref<HTMLElement | null>(null);
const runningPhaseName = computed(
  () => steps.value.find(p => p.status === 'running')?.name ?? '',
);
watch(runningPhaseName, async name => {
  if (props.variant !== 'full' || !name) return;
  await nextTick();
  const el = rootEl.value?.querySelector(
    '[data-running-phase="true"]',
  ) as HTMLElement | null;
  el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
});

// ── Step identity ─────────────────────────────────────────────────────────────
// The label is the step's *identity* (a stable row title); the message is its live result.
const PHASE_ORDER = [
  'precheck',
  'generator_install',
  'agent_install',
  'jmx_prepare',
  'jmeter_run',
  'result_fetch',
];
const PHASE_LABEL: Record<string, string> = {
  precheck: 'Pre-check',
  generator_install: 'Load generator install',
  agent_install: 'Metric agent install',
  jmx_prepare: 'Test plan',
  jmeter_run: 'Load run',
  result_fetch: 'Collect results',
};
const SUB_LABEL: Record<string, string> = {
  'precheck.target_exists': 'Target exists',
  'precheck.target_running': 'Target running',
  'precheck.target_reachable': 'Target reachable',
  'precheck.metric_port_open': 'Metric port open',
  'precheck.remote_command': 'Remote command',
  'generator_install.lookup': 'Look up generator',
  'generator_install.verify_alive': 'Verify alive',
  'generator_install.reachable': 'Reachable',
  'generator_install.provision': 'Provision',
  'generator_install.install': 'Install',
  'generator_install.verify_install': 'Verify install',
  'agent_install.install': 'Install',
  'agent_install.process_up': 'Process up',
  'agent_install.port_reachable': 'Port reachable',
  'jmx_prepare.generate': 'Generate plan',
  'jmx_prepare.transfer': 'Transfer plan',
  'jmeter_run.start': 'Start',
  'jmeter_run.ramp_up': 'Ramp up',
  'jmeter_run.hold': 'Hold',
  'jmeter_run.exit': 'Exit',
  'result_fetch.file_result': 'Result file',
  'result_fetch.file_cpu': 'CPU metrics',
  'result_fetch.file_memory': 'Memory metrics',
  'result_fetch.file_disk': 'Disk metrics',
  'result_fetch.file_network': 'Network metrics',
  'result_fetch.persist': 'Persist',
};
// Sub-step count per phase, a stable denominator for progress. Only these phases report
// sub-steps; generator_install/jmx_prepare/jmeter_run/result_fetch record at the phase level
// only, so they have no children and are scored by phase status (see childCompletion).
const PHASE_SUBCOUNT: Record<string, number> = {
  precheck: 5,
  agent_install: 3,
};
// The load run is the bulk of the wall-clock time; the checks and installs around it are quick.
// Weighting the phases keeps a stuck pre-check near the start of the bar instead of near the end.
const PHASE_WEIGHT: Record<string, number> = {
  precheck: 1,
  generator_install: 4,
  agent_install: 2,
  jmx_prepare: 1,
  jmeter_run: 8,
  result_fetch: 2,
};

const prettify = (s: string) =>
  s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const stepLabel = (name: string) =>
  SUB_LABEL[name] ??
  PHASE_LABEL[name] ??
  prettify(name.includes('.') ? name.split('.').pop() ?? name : name);

const isTerminal = (s: string) => s === 'ok' || s === 'failed' || s === 'skipped';
const isDone = (s: string) => s === 'ok' || s === 'skipped';

// ── Current leaf (drives the live two-line summary) ─────────────────────────────
// The running *phase* carries a static message ("Checking the environment"); the text that
// actually moves is on the running *sub-step*. Drilling to the deepest running node is what
// keeps the second line changing instead of frozen.
const currentLeaf = computed(() => {
  const phases = steps.value;
  const runningPhase = phases.find(p => p.status === 'running');
  if (runningPhase) {
    const child = (runningPhase.children ?? []).find(c => c.status === 'running');
    return { phase: runningPhase, leaf: child ?? runningPhase };
  }
  const failedPhase = [...phases].reverse().find(p => p.status === 'failed');
  if (failedPhase) {
    const child = [...(failedPhase.children ?? [])]
      .reverse()
      .find(c => c.status === 'failed');
    return { phase: failedPhase, leaf: child ?? failedPhase };
  }
  return null;
});

// Line 1: status + where it is now ("Running · Pre-check › Metric port open").
const primaryLine = computed(() => {
  const base = props.statusLabel ?? '';
  // On failure, naming the sub-step ("Failed · Pre-check › Target reachable") reads as if that
  // check passed. Say only which phase failed ("Pre-check Failed"); the failing step and its
  // cause are in the step list / tooltip below.
  if (isFailed.value) {
    const failedPhase = [...steps.value].reverse().find(p => p.status === 'failed');
    return failedPhase ? `${stepLabel(failedPhase.name)} Failed` : base;
  }
  const cur = currentLeaf.value;
  if (!cur) return base;
  let where = stepLabel(cur.phase.name);
  if (cur.leaf !== cur.phase) where += ` › ${stepLabel(cur.leaf.name)}`;
  return base ? `${base} · ${where}` : where;
});
// Line 2: that leaf's live message.
const secondaryLine = computed(
  () => currentLeaf.value?.leaf.message ?? currentLeaf.value?.leaf.detail ?? '',
);

// ── Whole-process progress (weighted by phase, not by wall-clock) ───────────────
const phasesByName = computed(
  () => new Map(steps.value.map(p => [p.name, p])),
);
const laterPhaseStarted = (name: string) => {
  const i = PHASE_ORDER.indexOf(name);
  if (i < 0) return false;
  return PHASE_ORDER.slice(i + 1).some(n => {
    const p = phasesByName.value.get(n);
    return !!p && p.status !== 'pending';
  });
};
const childCompletion = (node: ILoadTestExecutionStep, name: string) => {
  const denom = PHASE_SUBCOUNT[name] ?? (node.children?.length || 1);
  const done = (node.children ?? []).filter(c => isDone(c.status)).length;
  return Math.min(1, done / denom);
};
const phaseCompletion = (name: string) => {
  const node = phasesByName.value.get(name);
  if (!node) return laterPhaseStarted(name) ? 1 : 0;
  const st = node.status;
  if (isDone(st)) return 1;
  if (st === 'pending') return laterPhaseStarted(name) ? 1 : 0;
  const childRatio = childCompletion(node, name);
  if (st === 'failed') return childRatio; // partial, wherever it died
  // running
  if (name === 'jmeter_run' && (props.expectedSeconds ?? 0) > 0) {
    const el = node.elapsedSec ?? 0;
    return Math.max(0.05, Math.min(0.95, el / (props.expectedSeconds as number)));
  }
  return Math.max(0.05, Math.min(0.9, childRatio));
};

const progressPercent = computed<number | null>(() => {
  if (isCompleted.value) return 100;
  if (!isRunning.value && !isFailed.value) return 0;

  // Preferred: weighted phase model over the real tree.
  if (steps.value.length) {
    let total = 0;
    let acc = 0;
    for (const name of PHASE_ORDER) {
      const w = PHASE_WEIGHT[name];
      total += w;
      acc += w * phaseCompletion(name);
    }
    const pct = Math.round((acc / total) * 100);
    if (isFailed.value) return Math.min(99, Math.max(1, pct));
    return Math.max(1, Math.min(95, pct));
  }

  // Fallback for older cm-ant that sends no steps: time against the expected total.
  if (isFailed.value) return null;
  const start = props.startAt ? Date.parse(props.startAt) : NaN;
  const expectedMs = (props.expectedSeconds ?? 0) * 1000;
  if (!start || Number.isNaN(start) || expectedMs <= 0) return null;
  const pct = ((nowMs.value - start) / expectedMs) * 100;
  return Math.max(2, Math.min(95, Math.round(pct)));
});

// ── Marks + tooltip ─────────────────────────────────────────────────────────────
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
const elapsedText = (n?: number) => (n && n > 0 ? ` (${n}s)` : '');

// A small bar on the phase that is running *now* — one bar that moves down the list with the
// work. Determinate where cm-ant reports sub-steps (pre-check, metric agent install, collect
// results) or elapsed vs expected (the load run); an indeterminate "working" bar where a phase
// reports nothing under it (generator install, test plan). Nothing on done/pending phases —
// their ✓ / ○ already says it — so only ever one bar is on screen.
interface PhaseBar {
  pct: number | null; // null = indeterminate
}
const phaseBar = (phase: ILoadTestExecutionStep): PhaseBar | null => {
  if (phase.status !== 'running') return null;
  const name = phase.name;
  if (PHASE_SUBCOUNT[name] || (phase.children && phase.children.length)) {
    return { pct: Math.max(2, Math.round(childCompletion(phase, name) * 100)) };
  }
  if (name === 'jmeter_run' && (props.expectedSeconds ?? 0) > 0) {
    const p = Math.min(
      99,
      Math.round(((phase.elapsedSec ?? 0) / (props.expectedSeconds as number)) * 100),
    );
    return { pct: Math.max(2, p) };
  }
  return { pct: null };
};
const phaseBars = computed<Record<string, PhaseBar | null>>(() => {
  const m: Record<string, PhaseBar | null> = {};
  for (const p of steps.value) m[p.name] = phaseBar(p);
  return m;
});
// Template helpers — a Vue template expression cannot use the TS non-null assertion (`!`), so
// the null handling lives here. hasBar gates the markup; barPct returns the width (null = the
// indeterminate sweep).
const hasBar = (name: string) => phaseBars.value[name] != null;
const barPct = (name: string): number | null => {
  const b = phaseBars.value[name];
  return b ? b.pct : null;
};

// Hover tooltip (badge variant): the tree as text, with the failing step's detail.
const TOOLTIP_MARK: Record<string, string> = {
  ok: '[OK]',
  running: '[..]',
  failed: '[X]',
  pending: '[ ]',
  skipped: '[-]',
};
const tooltipText = computed(() => {
  const lines: string[] = [];
  for (const p of steps.value) {
    const mark = TOOLTIP_MARK[p.status] ?? `[${p.status}]`;
    lines.push(`${mark} ${stepLabel(p.name)}${elapsedText(p.elapsedSec)}`);
    for (const c of p.children ?? []) {
      const cm = TOOLTIP_MARK[c.status] ?? `[${c.status}]`;
      let line = `    ${cm} ${stepLabel(c.name)}`;
      if (c.message) line += ` — ${c.message}`;
      lines.push(line);
      if (c.detail && (c.status === 'failed' || c.status === 'running')) {
        for (const d of c.detail.split('\n')) lines.push(`        ${d}`);
      }
    }
  }
  if (lines.length) lines.push('');
  if (props.startAt) lines.push(`Started: ${props.startAt}`);
  if (props.finishAt) lines.push(`Finished: ${props.finishAt}`);
  if (props.failureMessage && !steps.value.length) {
    lines.push(`Error: ${props.failureMessage}`);
  }
  return lines.join('\n');
});
const badgeLabel = computed(() => primaryLine.value || props.statusLabel || '');
const hasSteps = computed(() => steps.value.length > 0);
</script>

<template>
  <!-- badge: a status chip with the step tree on hover (Evaluate Perf header, Information terminal cell) -->
  <p-tooltip
    v-if="variant === 'badge'"
    :contents="tooltipText"
    position="bottom"
    :options="{ classes: ['p-tooltip', 'load-test-step-tooltip'] }"
  >
    <span
      class="lt-badge"
      :class="{ running: isRunning, failed: isFailed }"
      data-testid="load-test-status-badge"
    >
      {{ badgeLabel }}
    </span>
  </p-tooltip>

  <div v-else ref="rootEl" class="load-test-progress" data-testid="load-test-progress">
    <!-- two-line summary above the bar (full only — the live text is what makes compact jump) -->
    <template v-if="variant === 'full'">
      <p class="lt-primary" data-testid="load-test-progress-primary">
        {{ primaryLine }}
      </p>
      <p
        v-if="secondaryLine"
        class="lt-secondary"
        data-testid="load-test-progress-secondary"
      >
        {{ secondaryLine }}
      </p>
    </template>

    <!-- the bar. compact keeps a fixed height (single label line) so the cell never shakes. -->
    <template v-if="variant === 'full' || variant === 'compact'">
      <p
        v-if="variant === 'compact'"
        class="lt-compact-label"
        data-testid="load-test-progress-primary"
      >
        {{ primaryLine }}
      </p>
      <div class="lt-bar-row">
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
        <!-- live: spinning while polling, so a bar sitting at one value reads as "still
             checking" rather than "gave up". Stops when polling stops. -->
        <span
          v-if="isPolling"
          class="lt-live"
          data-testid="load-test-progress-live"
          title="Checking…"
        ></span>
      </div>
    </template>

    <!-- the phase / sub-step tree (full + steps). Left-aligned; failed steps in red with detail. -->
    <ul
      v-if="(variant === 'full' || variant === 'steps') && hasSteps"
      class="lt-steps"
      data-testid="load-test-progress-steps"
    >
      <li
        v-for="phase in steps"
        :key="phase.name"
        class="lt-phase"
        :data-testid="`load-test-step-${phase.name}`"
      >
        <div
          class="lt-row lt-parent"
          :class="stepStateClass(phase.status)"
          :data-running-phase="phase.status === 'running' ? 'true' : undefined"
        >
          <span class="lt-mark">{{ stepMark(phase.status) }}</span>
          <span class="lt-label">{{ stepLabel(phase.name) }}</span>
          <span class="lt-elapsed">{{ elapsedText(phase.elapsedSec) }}</span>
          <!-- one small bar that rides along with the running phase -->
          <template v-if="hasBar(phase.name)">
            <span
              class="lt-phase-bar"
              :class="{ indeterminate: barPct(phase.name) === null }"
              data-testid="load-test-phase-bar"
            >
              <span
                class="lt-phase-fill"
                :style="
                  barPct(phase.name) !== null
                    ? { width: barPct(phase.name) + '%' }
                    : {}
                "
              ></span>
            </span>
            <span v-if="barPct(phase.name) !== null" class="lt-phase-pct"
              >{{ barPct(phase.name) }}%</span
            >
          </template>
        </div>
        <ul v-if="phase.children && phase.children.length" class="lt-children">
          <li
            v-for="c in phase.children"
            :key="c.name"
            class="lt-row lt-child"
            :class="stepStateClass(c.status)"
            :data-testid="`load-test-step-${c.name}`"
          >
            <span class="lt-mark">{{ stepMark(c.status) }}</span>
            <span class="lt-label">{{ stepLabel(c.name) }}</span>
            <span class="lt-elapsed">{{ elapsedText(c.elapsedSec) }}</span>
            <span v-if="c.message" class="lt-msg">— {{ c.message }}</span>
            <!-- verbose cause for a failed step, wrapped, left-aligned -->
            <div
              v-if="c.detail && c.status === 'failed'"
              class="lt-detail"
              :data-testid="`load-test-step-detail-${c.name}`"
            >
              {{ c.detail }}
            </div>
          </li>
        </ul>
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

/* compact label: a single line, ellipsised, so its height never changes (no vertical shake) */
.lt-compact-label {
  font-size: 12px;
  font-weight: 600;
  color: #343a40;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  height: 17px;
}

.lt-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 16px;
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

.lt-live {
  width: 12px;
  height: 12px;
  border: 2px solid #adb5bd;
  border-top-color: transparent;
  border-radius: 50%;
  animation: lt-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes lt-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── the phase / sub-step tree ── */
.lt-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  list-style: none;
  padding: 0;
  text-align: left;
}

.lt-children {
  list-style: none;
  padding: 0;
  margin: 2px 0 4px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lt-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #495057;
  word-break: break-word;
}

.lt-parent {
  font-weight: 700;
  color: #343a40;
  font-size: 12.5px;
}

.lt-child {
  padding-left: 20px;
}

.lt-mark {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.lt-elapsed {
  color: #adb5bd;
  font-weight: 400;
}

.lt-msg {
  color: #868e96;
  font-weight: 400;
}

/* the small bar that rides with the running phase */
.lt-phase-bar {
  position: relative;
  display: inline-block;
  width: 96px;
  height: 6px;
  margin-left: 4px;
  border-radius: 999px;
  background-color: #d0ebff;
  overflow: hidden;
  vertical-align: middle;
  flex-shrink: 0;
}
.lt-phase-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 999px;
  background-color: #1971c2;
  transition: width 0.5s ease;
}
/* no measurable sub-progress → a segment sweeping left↔right ("working") */
.lt-phase-bar.indeterminate .lt-phase-fill {
  width: 40%;
  animation: lt-phase-sweep 1.1s ease-in-out infinite alternate;
}
@keyframes lt-phase-sweep {
  from {
    left: 0;
  }
  to {
    left: 60%;
  }
}
.lt-phase-pct {
  font-size: 11px;
  font-weight: 600;
  color: #1971c2;
}

/* status colours */
.lt-row.is-ok .lt-mark {
  color: #2f9e44;
}
.lt-row.is-running {
  font-weight: 600;
}
.lt-row.is-running .lt-mark,
.lt-row.is-running .lt-msg {
  color: #1971c2;
}
.lt-row.is-failed,
.lt-row.is-failed .lt-mark,
.lt-row.is-failed .lt-msg {
  color: #e03131;
}
.lt-row.is-pending,
.lt-row.is-skipped {
  color: #adb5bd;
}

/* verbose failure cause — normal weight, red, wrapped, left-aligned (never centred) */
.lt-detail {
  flex-basis: 100%;
  margin: 2px 0 2px 20px;
  padding: 6px 8px;
  font-size: 11.5px;
  font-weight: 400;
  color: #c92a2a;
  background-color: #fff5f5;
  border-left: 2px solid #ffc9c9;
  border-radius: 2px;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

/* ── badge chip ── */
.lt-badge {
  font-size: 13px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 4px;
  background-color: #f1f3f5;
  color: #495057;
  max-width: 340px;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
  cursor: default;
}
.lt-badge.running {
  background-color: #e7f5ff;
  color: #1971c2;
}
.lt-badge.failed {
  background-color: #fff0f0;
  color: #e03131;
}
</style>

<!-- global: keep the long, multi-line tooltip readable (default .tooltip-inner is white-space:pre
     and clips lines past 640px). pre-wrap + word-break lets the failure detail wrap. -->
<style lang="postcss">
.p-tooltip.load-test-step-tooltip .tooltip-inner {
  max-width: 460px;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}
</style>
