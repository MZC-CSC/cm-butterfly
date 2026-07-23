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
import { checkDesignerSupport } from '@/entities/workflow/lib/designerSupport';
import { buildRunGraph, IRunGraph } from '@/entities/workflow/lib/runGraph';
import { useWorkflowStore } from '@/entities';
import { showSuccessMessage } from '@/shared/utils';
import { isRunFinished } from '@/entities/workflow/lib/taskState';
import { trackWorkflow } from '@/entities/workflow/lib/workflowTracker';
import {
  extractFailureSummary,
  normalizeTaskLog,
} from '@/entities/workflow/lib/taskLog';

/**
 * Poll the execution status periodically.
 *
 * The engine has no channel to push status changes, so polling is the only option. But that
 * polling is serialized per workflow inside the engine, so a short interval delays operations
 * like run and re-run. So we keep the interval generous and stop the moment a run finishes.
 */
const POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 2000;

export function useWorkflowRunViewerModel() {
  const workflow = ref<IWorkflowResponse | null>(null);
  /** Whether the engine can read this workflow — a freshly created one is unreadable for a moment */
  const workflowReadyState = ref<'ready' | 'waiting' | 'timeout'>('ready');
  const runs = ref<IWorkflowRun[]>([]);
  const selectedRunId = ref<string | null>(null);
  const workflowStore = useWorkflowStore();

  const instances = ref<ITaskInstance[]>([]);
  const selectedTaskId = ref<string | null>(null);
  const loadError = ref<string | null>(null);
  const isPolling = ref(false);

  // Log
  const logText = ref('');
  const logError = ref<string | null>(null);
  const logLoading = ref(false);
  const selectedTryNumber = ref<number | null>(null);

  // Re-run
  const rerunTargets = ref<ITaskInstanceReference[] | null>(null);
  const rerunError = ref<string | null>(null);
  const rerunPending = ref(false);
  const rerunOption = ref<IClearTaskOption | null>(null);

  const failureSummary = computed(() => extractFailureSummary(logText.value));

  /**
   * Progress. We know the total number of tasks to run, so we can count "how many of how many
   * have finished" directly. If the UI says nothing while it runs, it looks stuck.
   */
  const TERMINAL_STATES = ['success', 'failed', 'skipped', 'upstream_failed'];

  const progress = computed(() => {
    const total = graph.value.nodes.length;
    const stateOf = (id: string) =>
      (instances.value.find(i => i.task_id === id)?.state ?? '').toLowerCase();

    const states = graph.value.nodes.map(n => stateOf(n.id));
    const done = states.filter(s => TERMINAL_STATES.includes(s)).length;
    const running = states.filter(s => s === 'running').length;
    const failed = states.filter(s =>
      ['failed', 'upstream_failed'].includes(s),
    ).length;

    return {
      total,
      done,
      running,
      failed,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  });

  const graph = computed<IRunGraph>(() => buildRunGraph(workflow.value));

  /**
   * Whether the graph can be opened in the workflow tool. This decides whether Edit / Clone&Edit
   * go to the tool or to JSON.
   *
   * The decision uses **the exact same function the workflow tool uses when loading** ([[designerSupport]]).
   * If the two decide differently, you get a case where something is sent to the tool that the tool
   * cannot open (or vice versa). It used to split on "if it has parallel, always JSON", but now the
   * tool draws parallel, so the criterion changed from "is it parallel" to **"can we move it over as-is"**.
   */
  const designerSupport = computed(() =>
    checkDesignerSupport(workflow.value?.data?.task_groups),
  );
  const canEditInDesigner = computed(() => designerSupport.value.canEdit);

  /**
   * Whether this workflow has ever run. The viewer's button set branches on this —
   * if never run, only Run / Edit; otherwise Start new run / Clone&Edit / Re-run failed.
   * `Start new run` builds up new history each run, so it only makes sense when there is history to
   * build on, and a workflow that has run blocks direct edits to the original (the engine keeps no
   * per-run definition), so there is no Edit either.
   */
  const hasRuns = computed(() => runs.value.length > 0);

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
   * Whether the workflow was modified after this run finished.
   *
   * The engine does not return "the definition used for that run". The parameters the UI shows are
   * always values from the *current definition*, so if the definition changed after the run, the
   * displayed values may differ from what the run actually used. We surface that fact rather than hide it.
   */
  const definitionChangedAfterRun = computed(() => {
    const updatedAt = workflow.value?.updated_at;
    const startedAt = selectedRun.value?.start_date;
    if (!updatedAt || !startedAt) return false;
    return new Date(updatedAt).getTime() > new Date(startedAt).getTime();
  });

  /**
   * Tasks that exist in the run history but not in the current definition. There is no place to draw
   * them in the graph, so instead of dropping them silently we show them separately.
   */
  const deletedTaskInstances = computed(() => {
    const known = new Set(graph.value.nodes.map(n => n.id));
    return instances.value.filter(i => !known.has(i.task_id));
  });

  async function loadWorkflow(wfId: string) {
    try {
      const { data, execute } = useGetWorkflow(wfId);
      await execute();
      workflow.value = data.value?.responseData ?? null;
    } catch {
      workflow.value = null;
    }
    return workflow.value != null;
  }

  /**
   * Wait until the engine can read this workflow.
   *
   * A freshly created workflow fails to load for a short while, before Airflow has registered the
   * DAG (measured at about 5 seconds on the dev server). If we draw the graph then, it shows
   * **"No tasks to display"**, which is not true — there are tasks, they just cannot be read yet. If
   * the UI cannot tell "empty" from "not yet", the user assumes the workflow is empty.
   *
   * So we wait until it becomes readable and tell the UI that we are waiting.
   */
  const WORKFLOW_READY_INTERVAL_MS = 2000;
  const WORKFLOW_READY_TIMEOUT_MS = 60000;

  async function waitForWorkflow(wfId: string) {
    const deadline = Date.now() + WORKFLOW_READY_TIMEOUT_MS;
    for (;;) {
      if (await loadWorkflow(wfId)) {
        workflowReadyState.value = 'ready';
        return true;
      }
      if (Date.now() + WORKFLOW_READY_INTERVAL_MS > deadline) {
        workflowReadyState.value = 'timeout';
        return false;
      }
      workflowReadyState.value = 'waiting';
      await new Promise(resolve =>
        setTimeout(resolve, WORKFLOW_READY_INTERVAL_MS),
      );
    }
  }

  async function loadRuns(wfId: string) {
    try {
      const { data, execute } = useGetWorkflowRuns(wfId);
      await execute();
      runs.value = data.value?.responseData ?? [];
    } catch {
      // A workflow that has never run fails to load from the engine — before Airflow has read the
      // new DAG, it appears not to exist. **This is not a failure but "not yet"**, so instead of a
      // red error we show an empty state that invites the user to run it.
      runs.value = [];
    }
  }

  let inFlight = false;

  async function fetchInstances(wfId: string, runId: string) {
    // Polling the same workflow concurrently contends with the engine-side serialization
    if (inFlight) return;
    inFlight = true;
    try {
      // This composable binds its parameters at creation time, so create a fresh one per call
      const { data, execute } = useGetTaskInstances(wfId, runId);
      await execute();
      instances.value = data.value?.responseData ?? [];
      loadError.value = null;
    } catch (e: any) {
      // Right after a run the engine may not be ready yet and this can fail.
      // Do not conclude it is an error immediately; retry on the next poll.
      loadError.value = e?.message ?? 'Failed to load run status.';
    } finally {
      inFlight = false;
    }
  }

  async function refreshRunState(wfId: string) {
    // There is no endpoint to fetch a single run, so re-fetch the list
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
        // The poll that confirmed completion already captured the final state, so stop here
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
    // **Do not inherit content from another workflow.** If we do not clear it, then when a load
    // fails, the runs of the previously viewed workflow linger as if they belonged to this one —
    // which always happens with a freshly created workflow (the engine cannot read the new DAG yet
    // and answers 404).
    runs.value = [];
    instances.value = [];
    selectedRunId.value = null;
    selectedTaskId.value = null;
    logText.value = '';
    logError.value = null;
    workflowReadyState.value = 'ready';

    // Secure the definition first. Fetching the run list while it is unreadable would fail for the same reason.
    const ready = await waitForWorkflow(wfId);
    if (!ready) return;
    await loadRuns(wfId);

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

  /** Must be viewable per try — needed to compare before and after a re-run */
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
        // "No log" and "failed to fetch" are different. Do not paper over it with a blank screen.
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
   * Pre-check before a re-run.
   *
   * Which tasks run again is decided by **the engine looking at the actual execution graph**, not by
   * the picture on screen. The two can diverge, so before running we always fetch the target list and
   * have the user confirm it.
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
        // The engine rejects a pre-check that also sends a run-state reset
        // ("if dry_run is true, reset_dag_runs is meaningless").
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
      // A re-run reuses this run id, so the checker leans on startedAt to tell this attempt
      // from the last. onlyFailed decides whether the message says "failed tasks" or the run.
      void trackWorkflow({
        wfId,
        label: workflow.value?.name || wfId,
        action: option.onlyFailed ? 'rerun-failed' : 'rerun',
        runId,
      });
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
   * Clone the original.
   *
   * When you want to run with different parameters, *you must not edit the original* — the engine
   * does not return "the definition used for that run", so the moment you edit the original, that
   * workflow's past runs start showing wrong values on screen. Editing the clone leaves the original
   * and its history intact.
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

      /*
        The clone response returns the whole workflow (including the definition), so put it straight
        into the cache. Without this, opening the editor right away shows a blank screen — the engine
        reads the workflow from Airflow, and since Airflow has not yet read the just-created DAG, the
        fetch fails for a while ("failed to get the workflow from the airflow server"). The list is
        drawn from this cache too, so the clone also appears in the list.
      */
      workflowStore.upsertWorkflow(cloned);

      // Identify the clone by name — the list accumulates in creation order, so there is no
      // guarantee the new workflow is on the first page. Tell the user by name what was created.
      showSuccessMessage(
        'Workflow copied',
        `Created "${cloned.name}". Opening it in the editor.`,
      );
      return cloned.id;
    } catch (e: any) {
      loadError.value = e?.message ?? 'Failed to clone this workflow.';
      return null;
    } finally {
      cloning.value = false;
    }
  }

  /** Run directly from the viewer — no need to go to the list screen */
  async function runWorkflow() {
    const wfId = workflow.value?.id;
    if (!wfId) return;
    const { execute } = useRunWorkflow(wfId);
    await execute();
    // Hand it to the app-wide checker so the outcome is caught after leaving this screen.
    // The name has to be captured here — at completion there is only the run id.
    void trackWorkflow({
      wfId,
      label: workflow.value?.name || wfId,
      action: 'run',
    });
    // Right after DAG registration the run may not appear immediately, so reopen after a short delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    await open(wfId);
  }

  // Ensure polling does not linger after leaving the screen
  onScopeDispose(stopPolling);

  return {
    workflow,
    workflowReadyState,
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
    hasRuns,
    canEditInDesigner,
    designerSupport,
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
    progress,
    runWorkflow,
    stopPolling,
  };
}
