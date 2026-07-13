import { computed, onScopeDispose, ref } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import {
  useGetTaskInstances,
  useGetWorkflow,
  useGetWorkflowRuns,
} from '@/entities/workflow/api/index';
import {
  ITaskInstance,
  IWorkflowResponse,
  IWorkflowRun,
} from '@/entities/workflow/model/types';
import { buildRunGraph, IRunGraph } from '@/entities/workflow/lib/runGraph';
import { isRunFinished } from '@/entities/workflow/lib/taskState';

/**
 * 실행 상태를 주기적으로 조회한다.
 *
 * 엔진에 상태 변경을 알려주는 채널이 없어 조회 말고는 방법이 없다. 그런데 그
 * 조회가 엔진 안에서 워크플로우 단위로 직렬화되므로, 주기를 짧게 잡으면 실행·
 * 재실행 같은 작업을 지연시킨다. 그래서 주기는 넉넉히 두고, 실행이 끝나면
 * 곧바로 멈춘다.
 */
const POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 2000;

export function useWorkflowRunViewerModel() {
  const workflow = ref<IWorkflowResponse | null>(null);
  const runs = ref<IWorkflowRun[]>([]);
  const selectedRunId = ref<string | null>(null);
  const instances = ref<ITaskInstance[]>([]);
  const selectedTaskId = ref<string | null>(null);
  const loadError = ref<string | null>(null);
  const isPolling = ref(false);

  const graph = computed<IRunGraph>(() => buildRunGraph(workflow.value));

  const selectedRun = computed(
    () =>
      runs.value.find(r => r.workflow_run_id === selectedRunId.value) ?? null,
  );

  const selectedInstance = computed(
    () => instances.value.find(i => i.task_id === selectedTaskId.value) ?? null,
  );

  const selectedNode = computed(
    () => graph.value.nodes.find(n => n.id === selectedTaskId.value) ?? null,
  );

  /**
   * 이 실행이 끝난 뒤에 워크플로우가 수정됐는가.
   *
   * 엔진은 "그 실행에 쓰인 정의"를 돌려주지 않는다. 화면이 보여주는 파라미터는
   * 언제나 *현재 정의*의 값이므로, 실행 이후 정의가 바뀌었으면 화면 값과 실제
   * 실행에 쓰인 값이 다를 수 있다. 그 사실을 감추지 않고 알린다.
   */
  const definitionChangedAfterRun = computed(() => {
    const updatedAt = workflow.value?.updated_at;
    const startedAt = selectedRun.value?.start_date;
    if (!updatedAt || !startedAt) return false;
    return new Date(updatedAt).getTime() > new Date(startedAt).getTime();
  });

  /**
   * 실행 이력에는 있는데 현재 정의에는 없는 태스크. 그래프에 그릴 자리가 없으므로
   * 조용히 버리지 않고 따로 보여준다.
   */
  const deletedTaskInstances = computed(() => {
    const known = new Set(graph.value.nodes.map(n => n.id));
    return instances.value.filter(i => !known.has(i.task_id));
  });

  async function loadWorkflow(wfId: string) {
    const { data, execute } = useGetWorkflow(wfId);
    await execute();
    workflow.value = data.value?.responseData ?? null;
  }

  async function loadRuns(wfId: string) {
    const { data, execute } = useGetWorkflowRuns(wfId);
    await execute();
    runs.value = data.value?.responseData ?? [];
  }

  let inFlight = false;

  async function fetchInstances(wfId: string, runId: string) {
    // 같은 워크플로우를 동시에 조회하면 엔진 쪽 직렬화와 경합한다
    if (inFlight) return;
    inFlight = true;
    try {
      // 이 컴포저블은 생성 시점에 파라미터를 묶으므로 호출마다 새로 만든다
      const { data, execute } = useGetTaskInstances(wfId, runId);
      await execute();
      instances.value = data.value?.responseData ?? [];
      loadError.value = null;
    } catch (e: any) {
      // 실행 직후에는 엔진이 아직 준비되지 않아 실패할 수 있다.
      // 곧바로 에러로 단정하지 않고 다음 주기에 다시 시도한다.
      loadError.value = e?.message ?? '실행 상태를 가져오지 못했습니다.';
    } finally {
      inFlight = false;
    }
  }

  async function refreshRunState(wfId: string) {
    // 실행 하나만 조회하는 엔드포인트가 없어 목록을 다시 받는다
    await loadRuns(wfId);
  }

  const { pause, resume } = useIntervalFn(
    async () => {
      const wfId = workflow.value?.id;
      const runId = selectedRunId.value;
      if (!wfId || !runId) return;

      await fetchInstances(wfId, runId);
      await refreshRunState(wfId);

      if (isRunFinished(selectedRun.value?.state)) {
        // 종료를 확인한 주기에 마지막 상태까지 담았으므로 여기서 멈춘다
        stopPolling();
      }
    },
    Math.max(POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS),
    { immediate: false },
  );

  function startPolling() {
    if (isPolling.value) return;
    isPolling.value = true;
    resume();
  }

  function stopPolling() {
    if (!isPolling.value) return;
    isPolling.value = false;
    pause();
  }

  async function selectRun(wfId: string, runId: string) {
    stopPolling();
    selectedRunId.value = runId;
    selectedTaskId.value = null;
    instances.value = [];

    await fetchInstances(wfId, runId);

    if (!isRunFinished(selectedRun.value?.state)) startPolling();
  }

  async function open(wfId: string, runId?: string | null) {
    loadError.value = null;
    await Promise.all([loadWorkflow(wfId), loadRuns(wfId)]);

    const target =
      runId ??
      [...runs.value].sort((a, b) =>
        (b.start_date ?? '').localeCompare(a.start_date ?? ''),
      )[0]?.workflow_run_id;

    if (target) await selectRun(wfId, target);
  }

  function selectTask(taskId: string) {
    selectedTaskId.value = taskId;
  }

  // 화면을 벗어나면 조회가 남지 않게 한다
  onScopeDispose(stopPolling);

  return {
    workflow,
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
    loadError,
    open,
    selectRun,
    selectTask,
    stopPolling,
  };
}
