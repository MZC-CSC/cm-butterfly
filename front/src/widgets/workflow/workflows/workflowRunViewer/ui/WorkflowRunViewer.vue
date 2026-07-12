<script setup lang="ts">
import { computed, watch } from 'vue';
import { PBadge, PSelectDropdown } from '@cloudforet-test/mirinae';
import RunGraph from './RunGraph.vue';
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

const {
  runs,
  selectedRunId,
  selectedRun,
  instances,
  selectedTaskId,
  selectedInstance,
  selectedNode,
  deletedTaskInstances,
  graph,
  isPolling,
  loadError,
  open,
  selectRun,
  selectTask,
} = useWorkflowRunViewerModel();

const runOptions = computed(() =>
  [...runs.value]
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .map(run => ({
      name: run.workflow_run_id,
      label: `${run.start_date ?? run.execution_date} · ${taskStateLabel(run.state)}`,
    })),
);

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
  <div class="run-viewer">
    <div class="run-viewer__header">
      <div class="run-viewer__run-select">
        <p-select-dropdown
          :menu="runOptions"
          :selected.sync="selectedRunId"
          class="run-viewer__dropdown"
          @select="onRunChange"
        />
        <p-badge
          v-if="selectedRun"
          :badge-type="taskStateBadgeType(selectedRun.state)"
        >
          {{ taskStateLabel(selectedRun.state) }}
        </p-badge>
        <span v-if="isPolling" class="run-viewer__polling">
          자동 갱신 중 · 3초
        </span>
      </div>
      <div v-if="selectedRun" class="run-viewer__meta">
        시작 {{ selectedRun.start_date || '-' }} · 종료
        {{ selectedRun.end_date || '-' }} · 소요
        {{ formatDuration(selectedRun.duration_date) }}
      </div>
    </div>

    <!-- 조회가 실패했는데 정상인 것처럼 보이면 안 된다 -->
    <div v-if="loadError" class="run-viewer__error">
      실행 상태를 가져오지 못했습니다: {{ loadError }}
    </div>

    <div v-if="graph.warnings.length" class="run-viewer__warning">
      <div v-for="(warning, i) in graph.warnings" :key="i">
        ⚠ {{ warning }}
      </div>
    </div>

    <div class="run-viewer__body">
      <div class="run-viewer__graph">
        <div v-if="!graph.nodes.length" class="run-viewer__empty">
          표시할 태스크가 없습니다.
        </div>
        <run-graph
          v-else
          :graph="graph"
          :instances="instances"
          :selected-task-id="selectedTaskId"
          @select="selectTask"
        />
      </div>

      <aside class="run-viewer__panel">
        <template v-if="selectedNode">
          <h4 class="run-viewer__panel-title">{{ selectedNode.name }}</h4>
          <dl class="run-viewer__dl">
            <dt>상태</dt>
            <dd>
              <p-badge
                :badge-type="taskStateBadgeType(selectedInstance?.state)"
              >
                {{ taskStateLabel(selectedInstance?.state) }}
              </p-badge>
            </dd>
            <dt>컴포넌트</dt>
            <dd>{{ selectedNode.taskComponent }}</dd>
            <dt>그룹</dt>
            <dd>{{ selectedNode.groupName }}</dd>
            <dt>시도</dt>
            <dd>{{ selectedInstance?.try_number ?? 0 }}회</dd>
            <dt>시작</dt>
            <dd>{{ selectedInstance?.start_date || '-' }}</dd>
            <dt>종료</dt>
            <dd>{{ selectedInstance?.end_date || '-' }}</dd>
            <dt>소요</dt>
            <dd>{{ formatDuration(selectedInstance?.duration_date) }}</dd>
          </dl>
        </template>
        <p v-else class="run-viewer__hint">
          태스크를 선택하면 상세가 표시됩니다.
        </p>

        <!-- 정의에서 지워졌지만 이 실행에는 남아 있는 태스크 -->
        <div v-if="deletedTaskInstances.length" class="run-viewer__deleted">
          <h5>삭제된 태스크 ({{ deletedTaskInstances.length }})</h5>
          <p class="run-viewer__hint">
            현재 워크플로우 정의에는 없지만 이 실행에는 포함돼 있습니다.
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

.run-viewer__run-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.run-viewer__dropdown {
  min-width: 20rem;
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
  gap: 1rem;
  align-items: flex-start;
}

.run-viewer__graph {
  flex: 1 1 auto;
  min-width: 0;
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
  flex: 0 0 18rem;
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
