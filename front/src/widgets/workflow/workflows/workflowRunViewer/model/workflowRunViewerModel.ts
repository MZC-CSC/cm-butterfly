import { computed, onScopeDispose, ref } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import {
  IClearTaskOption,
  useClearTaskInstances,
  useCloneWorkflow,
  useGetTaskInstances,
  useGetTaskLogs,
  useGetWorkflow,
  useGetWorkflowRuns,
  useRunWorkflow,
} from '@/entities/workflow/api/index';
import {
  ITaskInstance,
  ITaskInstanceReference,
  IWorkflowResponse,
  IWorkflowRun,
} from '@/entities/workflow/model/types';
import { buildRunGraph, IRunGraph } from '@/entities/workflow/lib/runGraph';
import { isRunFinished } from '@/entities/workflow/lib/taskState';
import {
  extractFailureSummary,
  normalizeTaskLog,
} from '@/entities/workflow/lib/taskLog';

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

  // 로그
  const logText = ref('');
  const logError = ref<string | null>(null);
  const logLoading = ref(false);
  const selectedTryNumber = ref<number | null>(null);

  // 재실행
  const rerunTargets = ref<ITaskInstanceReference[] | null>(null);
  const rerunError = ref<string | null>(null);
  const rerunPending = ref(false);
  const rerunOption = ref<IClearTaskOption | null>(null);

  const failureSummary = computed(() => extractFailureSummary(logText.value));

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
      loadError.value = e?.message ?? 'Failed to load run status.';
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
    logText.value = '';
    logError.value = null;
    selectedTryNumber.value = null;
  }

  /** 시도(try)별로 볼 수 있어야 한다 — 재실행 전후를 비교하려면 필요하다 */
  async function loadLog(tryNumber?: number) {
    const wfId = workflow.value?.id;
    const runId = selectedRunId.value;
    const instance = selectedInstance.value;
    if (!wfId || !runId || !instance) return;

    const target = tryNumber ?? instance.try_number;
    if (!target) {
      logError.value = 'This task has not run yet, so there is no log.';
      return;
    }

    selectedTryNumber.value = target;
    logLoading.value = true;
    logError.value = null;
    try {
      const { data, execute } = useGetTaskLogs(
        wfId,
        runId,
        instance.task_id,
        String(target),
      );
      await execute();
      const raw = data.value?.responseData;
      if (raw === undefined || raw === null) {
        // 로그가 없는 것과 조회에 실패한 것은 다르다. 빈 화면으로 얼버무리지 않는다.
        logText.value = '';
        logError.value = 'Failed to load the log.';
        return;
      }
      logText.value = normalizeTaskLog(raw);
    } catch (e: any) {
      logText.value = '';
      logError.value = e?.message ?? 'Failed to load the log.';
    } finally {
      logLoading.value = false;
    }
  }

  /**
   * 재실행 사전 확인.
   *
   * 어떤 태스크가 다시 도는지는 화면의 그림이 아니라 **엔진이 실제 실행 그래프를 보고**
   * 정한다. 둘이 어긋날 수 있으므로 실행 전에 반드시 대상 목록을 받아 확인시킨다.
   */
  async function previewRerun(option: IClearTaskOption) {
    const wfId = workflow.value?.id;
    const runId = selectedRunId.value;
    if (!wfId || !runId) return;

    rerunError.value = null;
    rerunTargets.value = null;
    rerunPending.value = true;
    try {
      const { data, execute } = useClearTaskInstances(wfId, runId, {
        ...option,
        dryRun: true,
        // 엔진은 사전 확인에 실행 상태 리셋을 함께 보내면 거부한다
        // ("dry_run이 true이면 reset_dag_runs는 의미가 없습니다").
        resetDagRuns: false,
      });
      await execute();
      rerunTargets.value = data.value?.responseData ?? [];
      rerunOption.value = option;
    } catch (e: any) {
      rerunError.value =
        e?.message ?? 'Failed to check which tasks would run again.';
    } finally {
      rerunPending.value = false;
    }
  }

  async function confirmRerun() {
    const wfId = workflow.value?.id;
    const runId = selectedRunId.value;
    const option = rerunOption.value;
    if (!wfId || !runId || !option) return;

    rerunPending.value = true;
    rerunError.value = null;
    try {
      const { execute } = useClearTaskInstances(wfId, runId, {
        ...option,
        dryRun: false,
        resetDagRuns: true,
      });
      await execute();
      cancelRerun();
      await fetchInstances(wfId, runId);
      startPolling();
    } catch (e: any) {
      rerunError.value = e?.message ?? 'Re-run failed.';
    } finally {
      rerunPending.value = false;
    }
  }

  function cancelRerun() {
    rerunTargets.value = null;
    rerunOption.value = null;
    rerunError.value = null;
  }

  /**
   * 원본을 복제한다.
   *
   * 파라미터를 바꿔 실행하고 싶을 때 *원본을 고치면 안 된다* — 엔진은 "그 실행에 쓰인
   * 정의"를 돌려주지 않으므로, 원본을 고치는 순간 그 워크플로우의 과거 실행이 화면에서
   * 엉뚱한 값으로 보이게 된다. 복제본을 고치면 원본과 그 이력은 그대로 남는다.
   */
  const cloning = ref(false);

  async function cloneForEdit(): Promise<string | null> {
    const wfId = workflow.value?.id;
    if (!wfId) return null;

    cloning.value = true;
    loadError.value = null;
    try {
      const { data, execute } = useCloneWorkflow(wfId);
      await execute();
      const cloned = data.value?.responseData;
      if (!cloned?.id) {
        loadError.value = 'Failed to clone this workflow.';
        return null;
      }
      return cloned.id;
    } catch (e: any) {
      loadError.value = e?.message ?? 'Failed to clone this workflow.';
      return null;
    } finally {
      cloning.value = false;
    }
  }

  /** 뷰어에서 바로 실행 — 목록 화면까지 가지 않아도 된다 */
  async function runWorkflow() {
    const wfId = workflow.value?.id;
    if (!wfId) return;
    const { execute } = useRunWorkflow(wfId);
    await execute();
    // DAG 등록 직후에는 실행이 바로 보이지 않을 수 있으므로 잠시 뒤 다시 연다
    await new Promise(resolve => setTimeout(resolve, 3000));
    await open(wfId);
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
    rerunOption,
    open,
    selectRun,
    selectTask,
    loadLog,
    previewRerun,
    confirmRerun,
    cancelRerun,
    cloneForEdit,
    runWorkflow,
    stopPolling,
  };
}
