<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PBadge, PButton, PSelectDropdown } from '@cloudforet-test/mirinae';
import RunGraph from './RunGraph.vue';
import { graphPixelWidth } from '@/entities/workflow/lib/runGraph';
import { useWorkflowRunViewerModel } from '../model/workflowRunViewerModel';
import {
  taskStateBadgeType,
  taskStateLabel,
} from '@/entities/workflow/lib/taskState';

interface Props {
  workflowId: string | null;
  /** 비우면 가장 최근 실행을 연다 */
  runId?: string | null;
}

const props = defineProps<Props>();

// 복제본으로 에디터를 여는 것은 페이지의 일이다 (에디터 모달이 거기 있다)
const emit = defineEmits<{
  (e: 'edit-clone', clonedWorkflowId: string): void;
}>();

const {
  runs,
  selectedRunId,
  selectedRun,
  instances,
  selectedTaskId,
  selectedInstance,
  selectedNode,
  deletedTaskInstances,
  definitionChangedAfterRun,
  graph,
  isPolling,
  cloning,
  loadError,
  logText,
  logError,
  logLoading,
  selectedTryNumber,
  failureSummary,
  rerunTargets,
  rerunError,
  rerunPending,
  open,
  selectRun,
  selectTask,
  loadLog,
  previewRerun,
  confirmRerun,
  cancelRerun,
  cloneForEdit,
  runWorkflow,
} = useWorkflowRunViewerModel();

/**
 * 값을 바꿔 다시 돌리고 싶을 때 원본을 고치지 않는다.
 * 복제본을 만들어 그것을 편집한다 — 원본과 그 실행 이력은 그대로 남는다.
 */
async function cloneAndEdit() {
  const clonedId = await cloneForEdit();
  if (clonedId) emit('edit-clone', clonedId);
}

/**
 * 재실행 범위. 기준이 무엇인지 이름에 담는다.
 *
 * 'upstream'(이 태스크와 그 앞)은 뺐다. 이미 성공한 선행 태스크를 다시 돌리는 것은
 * 자원을 다시 만들 뿐이고, 정말 필요하면 *그 선행 태스크를 선택해* 'after'로 돌리면
 * 된다 — 같은 일을 두 갈래로 표현할 이유가 없다. (엔진은 여전히 지원한다.)
 */
const RERUN_SCOPES = [
  { key: 'only', label: 'This task only' },
  { key: 'after', label: 'This task and everything after it' },
] as const;

// 워크플로우 전체를 실행하는 것이므로 확인 없이 시작하지 않는다
const showRunConfirm = ref(false);

async function confirmRun() {
  showRunConfirm.value = false;
  await runWorkflow();
}

function downloadLog() {
  const blob = new Blob([logText.value], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${selectedNode.value?.name ?? 'task'}-try${selectedTryNumber.value ?? 1}.log`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** 태스크 단위 재실행 — 선택한 태스크가 기준이다 */
function requestRerun(scope: (typeof RERUN_SCOPES)[number]['key']) {
  const taskId = selectedTaskId.value;
  if (!taskId) return;

  previewRerun({
    dryRun: true,
    taskIds: [taskId],
    includeDownstream: scope === 'after',
    includeUpstream: false,
    onlyFailed: false,
    resetDagRuns: true,
  });
}

/**
 * 실행 단위 재실행 — 선택한 태스크와 무관하게 *이 실행 전체*의 실패분이 대상이다.
 * 태스크를 골라야 나오는 상세 패널이 아니라 실행 단위 동작들과 같은 자리에 둔다.
 *
 * 엔진은 대상 목록을 비워 보내면 거부하므로, 이 실행의 모든 태스크를 넘기고 실패한
 * 것만 고르게 한다. 그러면 실패한 태스크와 그것 때문에 막혀 있던 태스크가 잡힌다.
 */
function requestRerunFailed() {
  // 상태를 아직 못 받았으면 대상 목록이 비어 엔진이 거부한다. 그 전에는 누를 수 없다.
  if (!instances.value.length) return;

  previewRerun({
    dryRun: true,
    taskIds: instances.value.map(i => i.task_id),
    includeDownstream: false,
    includeUpstream: false,
    onlyFailed: true,
    resetDagRuns: true,
  });
}

const hasFailedTask = computed(() =>
  instances.value.some(i =>
    ['failed', 'upstream_failed'].includes((i.state ?? '').toLowerCase()),
  ),
);

/**
 * 확인 모달이 떠 있는 동안, 다시 돌 태스크를 그래프에서도 보여준다.
 * 목록만으로는 "어디가 다시 도는지"가 그림으로 안 들어온다.
 */
const rerunPreviewIds = computed(() =>
  rerunTargets.value ? rerunTargets.value.map(t => t.task_id) : null,
);

/** 재실행 대상 태스크가 어떤 컴포넌트를 쓰는지 함께 보여준다 — 무엇이 다시 도는지 판단 근거 */
function componentOf(taskId: string): string {
  return graph.value.nodes.find(n => n.id === taskId)?.taskComponent ?? '-';
}

const canShowLog = computed(
  () => !!selectedInstance.value && selectedInstance.value.try_number > 0,
);

const tryNumbers = computed(() => {
  const total = selectedInstance.value?.try_number ?? 0;
  return Array.from({ length: total }, (_, i) => i + 1);
});

const runOptions = computed(() =>
  [...runs.value]
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .map(run => ({
      name: run.workflow_run_id,
      label: `${run.start_date ?? run.execution_date} · ${taskStateLabel(run.state)}`,
    })),
);

/*
  그래프에 내주는 폭을 병렬 갈래 수로 정한다. 인프라·SW 마이그레이션처럼 태스크가
  한 줄로만 이어지는 워크플로우는 좁게 잡히므로 남는 폭이 상세 패널로 가고, 병렬이
  많으면 그래프가 넓게 자리를 잡는다. 폭이 모자라면 패널이 아래로 내려간다.
*/
const graphFlexBasis = computed(() => `${graphPixelWidth(graph.value)}px`);

/** 값이 JSON 문자열이면 읽기 좋게 펼친다 (cicada는 request_body를 문자열로 담는다) */
function formatParamValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

const selectedParams = computed(() => {
  const spec = selectedNode.value?.spec ?? {};
  return Object.entries(spec)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value: formatParamValue(value) }));
});

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${Math.round(seconds - m * 60)}s`;
}

watch(
  () => [props.workflowId, props.runId],
  async () => {
    if (props.workflowId) await open(props.workflowId, props.runId);
  },
  { immediate: true },
);

async function onRunChange(runId: string) {
  if (props.workflowId) await selectRun(props.workflowId, runId);
}
</script>

<template>
  <div class="run-viewer" data-testid="workflow-run-viewer">
    <div class="run-viewer__header">
      <!--
        왼쪽은 *지나간 실행을 고르는* 이력 선택이고, 오른쪽은 *새 실행을 시작하는*
        버튼이다. 성격이 정반대라 붙여 두면 "고른 실행을 다시 돌린다"로 읽힌다.
        (고른 실행을 다시 돌리는 것은 태스크 상세의 Re-run이다.)
      -->
      <div class="run-viewer__header-row">
        <div class="run-viewer__run-select">
          <span class="run-viewer__label">Run history</span>
          <p-select-dropdown
            data-testid="workflow-run-select"
            :menu="runOptions"
            :selected.sync="selectedRunId"
            class="run-viewer__dropdown"
            @select="onRunChange"
          />
          <p-badge
            v-if="selectedRun"
            data-testid="workflow-run-state"
            :badge-type="taskStateBadgeType(selectedRun.state)"
          >
            {{ taskStateLabel(selectedRun.state) }}
          </p-badge>
          <span v-if="isPolling" class="run-viewer__polling">
            Auto-refreshing · 3s
          </span>
        </div>

        <div class="run-viewer__actions">
          <!-- 실행 전체의 실패분을 다시 돌린다 — 선택한 태스크와 무관하다 -->
          <p-button
            data-testid="workflow-rerun-failed-btn"
            size="sm"
            style-type="tertiary"
            :disabled="!hasFailedTask || rerunPending"
            @click="requestRerunFailed"
          >
            Re-run failed tasks
          </p-button>
          <!--
            원본을 고치면 그 워크플로우의 과거 실행이 화면에서 엉뚱한 값으로 보이게
            된다. 값을 바꿔 돌리려면 복제본을 고친다.
          -->
          <p-button
            data-testid="workflow-clone-edit-btn"
            size="sm"
            style-type="tertiary"
            :disabled="cloning"
            @click="cloneAndEdit"
          >
            Clone &amp; Edit
          </p-button>
          <p-button
            data-testid="workflow-viewer-run-btn"
            size="sm"
            style-type="primary"
            :disabled="isPolling"
            @click="showRunConfirm = true"
          >
            Start new run
          </p-button>
        </div>
      </div>

      <div v-if="selectedRun" class="run-viewer__meta">
        Start {{ selectedRun.start_date || '-' }} · End
        {{ selectedRun.end_date || '-' }} · Duration
        {{ formatDuration(selectedRun.duration_date) }}
      </div>
    </div>

    <div
      v-if="loadError"
      class="run-viewer__error"
      data-testid="workflow-run-error"
    >
      Failed to load run status: {{ loadError }}
    </div>

    <!-- 재실행 요청이 실패하면 모달이 열리지 않는다. 그 실패를 여기서 드러낸다 -->
    <div
      v-if="rerunError && !rerunTargets"
      class="run-viewer__error"
      data-testid="workflow-rerun-error"
    >
      {{ rerunError }}
    </div>

    <div v-if="graph.warnings.length" class="run-viewer__warning">
      <div v-for="(warning, i) in graph.warnings" :key="i">
        ⚠ {{ warning }}
      </div>
    </div>

    <div class="run-viewer__body">
      <div
        class="run-viewer__graph"
        data-testid="workflow-run-graph"
        :style="{ flexBasis: graphFlexBasis }"
      >
        <div v-if="!graph.nodes.length" class="run-viewer__empty">
          No tasks to display.
        </div>
        <run-graph
          v-else
          :graph="graph"
          :instances="instances"
          :selected-task-id="selectedTaskId"
          :rerun-preview-ids="rerunPreviewIds"
          @select="selectTask"
        />
      </div>

      <aside class="run-viewer__panel" data-testid="workflow-run-task-detail">
        <template v-if="selectedNode">
          <h4 class="run-viewer__panel-title">{{ selectedNode.name }}</h4>
          <dl class="run-viewer__dl">
            <dt>State</dt>
            <dd>
              <p-badge
                data-testid="workflow-run-task-state"
                :badge-type="taskStateBadgeType(selectedInstance?.state)"
              >
                {{ taskStateLabel(selectedInstance?.state) }}
              </p-badge>
            </dd>
            <dt>Component</dt>
            <dd>{{ selectedNode.taskComponent }}</dd>
            <dt>Group</dt>
            <dd>{{ selectedNode.groupName }}</dd>
            <dt>Try</dt>
            <dd>{{ selectedInstance?.try_number ?? 0 }}</dd>
            <dt>Start</dt>
            <dd>{{ selectedInstance?.start_date || '-' }}</dd>
            <dt>End</dt>
            <dd>{{ selectedInstance?.end_date || '-' }}</dd>
            <dt>Duration</dt>
            <dd>{{ formatDuration(selectedInstance?.duration_date) }}</dd>
          </dl>

          <!-- 실패했으면 왜 실패했는지를 그 자리에서 -->
          <div
            v-if="canShowLog"
            class="run-viewer__logs"
            data-testid="workflow-run-logs"
          >
            <h5>Logs</h5>
            <div class="run-viewer__try-row">
              <p-button
                v-for="n in tryNumbers"
                :key="n"
                data-testid="workflow-run-log-try"
                :data-try="n"
                size="sm"
                :style-type="selectedTryNumber === n ? 'primary' : 'tertiary'"
                @click="loadLog(n)"
              >
                Try {{ n }}
              </p-button>
            </div>

            <p v-if="logLoading" class="run-viewer__hint">Loading…</p>
            <p v-else-if="logError" class="run-viewer__error">{{ logError }}</p>

            <template v-else-if="logText">
              <div v-if="failureSummary">
                <div class="run-viewer__param-key">
                  Failure (excerpt from log)
                </div>
                <pre
                  class="run-viewer__failure"
                  data-testid="workflow-run-failure"
                  >{{ failureSummary }}</pre
                >
              </div>
              <!-- 원인을 못 찾았으면 지어내지 않고 그렇게 말한다 -->
              <p
                v-else-if="selectedInstance?.state === 'failed'"
                class="run-viewer__hint"
              >
                No failure cause found in the log. Check the full log below.
              </p>
              <div class="run-viewer__try-row">
                <p-button
                  data-testid="workflow-run-log-download"
                  size="sm"
                  style-type="tertiary"
                  icon-left="ic_download"
                  @click="downloadLog"
                >
                  Download log
                </p-button>
              </div>
              <details class="run-viewer__log-details">
                <summary>Full log</summary>
                <pre class="run-viewer__log" data-testid="workflow-run-log">{{
                  logText
                }}</pre>
              </details>
            </template>
          </div>

          <div
            v-if="selectedRun"
            class="run-viewer__rerun"
            data-testid="workflow-rerun"
          >
            <h5>Re-run from this task</h5>
            <p class="run-viewer__hint">
              You will be shown exactly which tasks would run again, and asked
              to confirm, before anything is executed. To re-run every failed
              task in this run, use "Re-run failed tasks" above.
            </p>
            <div class="run-viewer__rerun-buttons">
              <p-button
                v-for="scope in RERUN_SCOPES"
                :key="scope.key"
                data-testid="workflow-rerun-scope"
                :data-scope="scope.key"
                size="sm"
                style-type="tertiary"
                :disabled="rerunPending"
                @click="requestRerun(scope.key)"
              >
                {{ scope.label }}
              </p-button>
            </div>
          </div>

          <div class="run-viewer__params" data-testid="workflow-run-params">
            <h5>Parameters</h5>
            <!--
              엔진은 그 실행에 쓰인 값을 돌려주지 않는다. 아래는 언제나
              *현재 정의*의 값이므로, 실행 후 정의가 바뀌었으면 다를 수 있다.
            -->
            <p
              v-if="definitionChangedAfterRun"
              class="run-viewer__param-warning"
              data-testid="workflow-run-param-warning"
            >
              ⚠ The workflow was modified after this run. These are the current
              definition's values and may differ from the ones this run actually
              used.
            </p>
            <p v-else class="run-viewer__hint">
              Values from the current definition.
            </p>

            <p v-if="!selectedParams.length" class="run-viewer__hint">
              No parameters saved on this task.
            </p>
            <div v-for="param in selectedParams" :key="param.key">
              <div class="run-viewer__param-key">{{ param.key }}</div>
              <pre class="run-viewer__param-value">{{ param.value }}</pre>
            </div>
          </div>
        </template>
        <p v-else class="run-viewer__hint">Select a task to see its details.</p>

        <!-- 정의에서 지워졌지만 이 실행에는 남아 있는 태스크 -->
        <div
          v-if="deletedTaskInstances.length"
          class="run-viewer__deleted"
          data-testid="workflow-run-deleted-tasks"
        >
          <h5>Deleted tasks ({{ deletedTaskInstances.length }})</h5>
          <p class="run-viewer__hint">
            Not in the current workflow definition, but part of this run.
          </p>
          <ul>
            <li v-for="item in deletedTaskInstances" :key="item.task_id">
              {{ item.task_name }} —
              <p-badge :badge-type="taskStateBadgeType(item.state)">
                {{ taskStateLabel(item.state) }}
              </p-badge>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <!--
      재실행 사전 확인. 어떤 태스크가 다시 도는지는 화면의 그림이 아니라 엔진이
      실제 실행 그래프를 보고 정한다. 그래서 엔진이 돌려준 대상 목록을 보여주고
      확인을 받는다.
    -->
    <div
      v-if="rerunTargets"
      class="run-viewer__modal run-viewer__modal--rerun"
      data-testid="workflow-rerun-confirm"
    >
      <div class="run-viewer__modal-box">
        <h4>These tasks will run again ({{ rerunTargets.length }})</h4>

        <p v-if="!rerunTargets.length" class="run-viewer__hint">
          No tasks to re-run.
        </p>
        <ul v-else class="run-viewer__rerun-list">
          <li
            v-for="t in rerunTargets"
            :key="t.task_id"
            data-testid="workflow-rerun-target"
          >
            <strong>{{ t.task_name }}</strong>
            <span class="run-viewer__hint">{{ componentOf(t.task_id) }}</span>
          </li>
        </ul>

        <p class="run-viewer__hint">
          These tasks will run from the start again, and work they already did
          will be applied to the target systems again.
        </p>

        <p v-if="rerunError" class="run-viewer__error">{{ rerunError }}</p>

        <div class="run-viewer__modal-actions">
          <p-button
            data-testid="workflow-rerun-cancel"
            style-type="tertiary"
            @click="cancelRerun"
          >
            Cancel
          </p-button>
          <p-button
            data-testid="workflow-rerun-ok"
            style-type="primary"
            :disabled="!rerunTargets.length || rerunPending"
            @click="confirmRerun"
          >
            Re-run
          </p-button>
        </div>
      </div>
    </div>

    <!-- 전체 실행은 되돌릴 수 없으므로 확인 없이 시작하지 않는다 -->
    <div
      v-if="showRunConfirm"
      class="run-viewer__modal"
      data-testid="workflow-run-confirm"
    >
      <div class="run-viewer__modal-box">
        <h4>Start a new run of this workflow?</h4>
        <p class="run-viewer__hint">
          This does not re-run the run selected above. It starts a new run of
          the whole workflow from the first task, and the work those tasks do
          will be applied to the target systems again.
        </p>
        <p class="run-viewer__hint">
          To run part of the run selected above again, select a task and use
          Re-run.
        </p>
        <div class="run-viewer__modal-actions">
          <p-button
            data-testid="workflow-run-confirm-cancel"
            style-type="tertiary"
            @click="showRunConfirm = false"
          >
            Cancel
          </p-button>
          <p-button
            data-testid="workflow-run-confirm-ok"
            style-type="primary"
            @click="confirmRun"
          >
            Start new run
          </p-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.run-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.run-viewer__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/*
  버튼을 오른쪽 끝으로 밀면 실행 선택과 버튼 사이에 빈 공간이 크게 남는다.
  왼쪽으로 붙여 두고, 폭이 모자라면 버튼 묶음이 아래 줄로 내려가게 한다.
*/
.run-viewer__header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.run-viewer__label {
  font-size: 0.75rem;
  color: #6b6e78;
}

.run-viewer__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.run-viewer__run-select {
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

/* 드롭다운이 폭을 다 먹으면 좁은 화면에서 버튼이 아래로 밀린다 */
.run-viewer__dropdown {
  flex: 0 1 18rem;
  min-width: 10rem;
}

.run-viewer__polling {
  font-size: 0.75rem;
  color: #6b6e78;
}

.run-viewer__meta {
  font-size: 0.75rem;
  color: #6b6e78;
}

.run-viewer__error {
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  background: #fdf3f3;
  color: #b93c3c;
  font-size: 0.8125rem;
}

.run-viewer__warning {
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  background: #fff8ef;
  color: #8a5a17;
  font-size: 0.8125rem;
}

.run-viewer__body {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

/*
  폭이 모자라면 상세 패널이 그래프 아래로 내려간다. 좌측 메뉴가 펼쳐져 있거나
  병렬 갈래가 늘어 그래프가 넓어져도 그래프가 짓눌리지 않게 하기 위함이다.
  뷰포트가 아니라 실제 남은 폭에 반응하도록 미디어 쿼리 대신 wrap을 쓴다.
*/
.run-viewer__graph {
  /* flex-basis는 병렬 갈래 수에 따라 스크립트에서 정한다 */
  flex-grow: 1;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  border: 1px solid #e5e5e8;
  border-radius: 0.375rem;
  background: #fafafb;
}

.run-viewer__empty {
  padding: 2rem;
  text-align: center;
  color: #6b6e78;
  font-size: 0.8125rem;
}

.run-viewer__panel {
  flex: 1 1 18rem;
  max-width: 100%;
  border: 1px solid #e5e5e8;
  border-radius: 0.375rem;
  padding: 0.875rem;
}

.run-viewer__panel-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.run-viewer__dl {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  row-gap: 0.375rem;
  font-size: 0.8125rem;
}

.run-viewer__dl dt {
  color: #6b6e78;
}

.run-viewer__hint {
  font-size: 0.8125rem;
  color: #6b6e78;
}

.run-viewer__params {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e5e8;
}

.run-viewer__params h5 {
  font-weight: 700;
  font-size: 0.8125rem;
  margin-bottom: 0.25rem;
}

.run-viewer__param-warning {
  font-size: 0.75rem;
  color: #8a5a17;
  background: #fff8ef;
  border-radius: 0.25rem;
  padding: 0.375rem 0.5rem;
  margin-bottom: 0.5rem;
}

.run-viewer__param-key {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b6e78;
}

.run-viewer__param-value {
  margin-top: 0.125rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  background: #f7f7f8;
  font-size: 0.6875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 14rem;
  overflow: auto;
}

.run-viewer__logs,
.run-viewer__rerun {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e5e8;
}

.run-viewer__logs h5,
.run-viewer__rerun h5 {
  font-weight: 700;
  font-size: 0.8125rem;
  margin-bottom: 0.375rem;
}

.run-viewer__try-row,
.run-viewer__rerun-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.run-viewer__failure {
  margin-top: 0.125rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  background: #fdf3f3;
  color: #8a2a2a;
  font-size: 0.6875rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.run-viewer__log-details {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.run-viewer__log {
  margin-top: 0.25rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
  background: #232533;
  color: #e8e8ea;
  font-size: 0.625rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 20rem;
  overflow: auto;
}

.run-viewer__modal {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 재실행 확인 중에는 그래프의 미리보기가 보여야 하므로 모달을 아래쪽에 둔다 */
.run-viewer__modal--rerun {
  align-items: flex-end;
  padding-bottom: 2rem;
  background: rgb(0 0 0 / 15%);
}

.run-viewer__modal-box {
  width: min(30rem, 92vw);
  background: #fff;
  border-radius: 0.5rem;
  padding: 1.25rem;
}

.run-viewer__modal-box h4 {
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.run-viewer__rerun-list {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
}

.run-viewer__rerun-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f0f0f2;
}

.run-viewer__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.run-viewer__deleted {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e5e8;
  font-size: 0.8125rem;
}

.run-viewer__deleted h5 {
  font-weight: 700;
  margin-bottom: 0.25rem;
}
</style>
