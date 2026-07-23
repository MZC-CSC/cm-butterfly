import { APIRequestContext, Page } from '@playwright/test';
import { config } from '../fixtures/test-data';

/**
 * apiWait — wait for long-running framework operations to reach a terminal state by polling
 * each framework's *result-query* API through the butterfly portal, instead of staring at the
 * screen indefinitely.
 *
 * ★ Why not watch the screen — a migration workflow run, an infra creation, and a load test each
 *   take minutes. The console screen does not auto-refresh and the notification feed is a *derived*
 *   view (it only fires once its own tracker polls). Polling the same result API the front itself
 *   uses is the authoritative signal, and it lets a step return control the moment the op settles so
 *   the on-screen verification that follows is fast and deterministic.
 *
 * ★ These calls *mirror the front exactly* — same operationId/endpoint, same request wrapper, same
 *   terminal-state rule — so they cannot drift from what the console considers "done":
 *     - workflow run status : cm-cicada/get-workflow-runs      (src/entities/workflow/lib/workflowTracker.ts)
 *     - load test status    : cm-ant/Getlastloadtestexecutionstate (src/widgets/workload/vm/vmList — setVmLoadTestResult)
 *   Endpoints that could not be confirmed 1:1 from source are left as TODO and the caller keeps its
 *   existing screen wait as the fallback (see notes below) — we never guess a wrong endpoint.
 *
 * The proxy path is `/api/{operationId}` and every proxied call carries the login session's Bearer
 * token, exactly as the migration.steps prepare step already does.
 */

/** Clock skew allowance between this runner and the engine (mirrors workflowTracker SKEW_MS). */
const SKEW_MS = 5_000;

/** Workflow run terminal states — mirror isRunFinished() in src/entities/workflow/lib/taskState.ts. */
const WORKFLOW_TERMINAL = ['success', 'failed'];

/** Load test terminal states — mirror TERMINAL_SUCCESS/FAILED in loadTestTracker / VmList. */
const LOADTEST_TERMINAL = ['successed', 'test_failed'];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Read the login session's access token from the page's localStorage.
 *
 * The console keeps the token inside a JSON blob in localStorage; the same extraction is already
 * used by the run_script prepare step. Reusing the logged-in session's token means these API polls
 * go out authenticated exactly like the browser's own calls.
 */
export async function getSessionToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k) ?? '';
      const m = v.match(/"access_token"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
    }
    return '';
  });
}

interface WorkflowRun {
  state: string;
  workflow_run_id: string;
  start_date?: string;
  end_date?: string;
  execution_date?: string;
}

function runStartMs(r: WorkflowRun): number {
  return new Date(r.start_date || r.execution_date || 0).getTime();
}

/**
 * Resolve a workflow id by its name via cm-cicada/list-workflow.
 *
 * A run has no id of its own until it is listed, and there is no "get this workflow by name" call —
 * the console loads the whole list and matches by name (WorkflowList.fetchWorkflowList). We do the same.
 */
export async function resolveWorkflowIdByName(opts: {
  request: APIRequestContext;
  token: string;
  name: string;
  baseURL?: string;
}): Promise<string> {
  const base = opts.baseURL ?? config.baseURL;
  const res = await opts.request.post(`${base}/api/cm-cicada/list-workflow`, {
    headers: { Authorization: `Bearer ${opts.token}` },
    data: {},
  });
  if (!res.ok()) return '';
  const body = await res.json().catch(() => null);
  const list = Array.isArray(body?.responseData) ? body.responseData : [];
  const hit = list.find((w: any) => w?.name === opts.name);
  return hit?.id ?? '';
}

/**
 * Poll cm-cicada/get-workflow-runs until this run reaches a terminal state (success/failed).
 *
 * Resolves *which* run is ours the same way workflowTracker does: the newest run whose start is at
 * or after we started (an older run of the same workflow must not be mistaken for it). Returns the
 * final state once terminal, or the last observed state on timeout (the caller decides what to do
 * with a non-terminal result — it does not throw, so a slow engine does not fail the wait outright).
 */
export async function waitWorkflowRunTerminal(opts: {
  request: APIRequestContext;
  token: string;
  wfId: string;
  since: number;
  baseURL?: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ state: string; run?: WorkflowRun; terminal: boolean }> {
  const base = opts.baseURL ?? config.baseURL;
  const timeoutMs = opts.timeoutMs ?? 20 * 60_000;
  const pollMs = opts.pollMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;
  const sinceMs = opts.since - SKEW_MS;
  let last: WorkflowRun | undefined;

  for (;;) {
    let runs: WorkflowRun[] = [];
    try {
      const res = await opts.request.post(
        `${base}/api/cm-cicada/get-workflow-runs`,
        {
          headers: { Authorization: `Bearer ${opts.token}` },
          data: { pathParams: { wfId: opts.wfId } },
        },
      );
      if (res.ok()) {
        const body = await res.json().catch(() => null);
        runs = Array.isArray(body?.responseData) ? body.responseData : [];
      }
    } catch {
      // A freshly created workflow answers 400 (dag not found) for a few seconds; treat any
      // transient error as "not settled yet" and look again — mirrors workflowTracker.checkOne.
    }

    const ours = runs
      .filter(r => runStartMs(r) >= sinceMs)
      .sort((a, b) => runStartMs(b) - runStartMs(a))[0];
    if (ours) {
      last = ours;
      const state = (ours.state ?? '').toLowerCase();
      if (WORKFLOW_TERMINAL.includes(state)) {
        return { state, run: ours, terminal: true };
      }
    }

    if (Date.now() > deadline) {
      return {
        state: (last?.state ?? '').toLowerCase(),
        run: last,
        terminal: false,
      };
    }
    await sleep(pollMs);
  }
}

/**
 * Poll cm-ant/Getlastloadtestexecutionstate until the load test on the given node settles.
 *
 * Mirrors VmList.setVmLoadTestResult: request `{ nsId, infraId, nodeId }`, read
 * responseData.result.executionStatus, and treat successed/test_failed as terminal (anything else —
 * on_processing/on_fetching — is still running). Returns the final status, or the last observed
 * status on timeout (does not throw).
 */
export async function waitLoadTestTerminal(opts: {
  request: APIRequestContext;
  token: string;
  nsId: string;
  infraId: string;
  nodeId: string;
  baseURL?: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ status: string; result?: any; terminal: boolean }> {
  const base = opts.baseURL ?? config.baseURL;
  const timeoutMs = opts.timeoutMs ?? 20 * 60_000;
  const pollMs = opts.pollMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;
  let lastResult: any;

  for (;;) {
    try {
      const res = await opts.request.post(
        `${base}/api/cm-ant/Getlastloadtestexecutionstate`,
        {
          headers: { Authorization: `Bearer ${opts.token}` },
          data: {
            request: {
              nsId: opts.nsId,
              infraId: opts.infraId,
              nodeId: opts.nodeId,
            },
          },
        },
      );
      if (res.ok()) {
        const body = await res.json().catch(() => null);
        const result = body?.responseData?.result;
        if (result) {
          lastResult = result;
          const status = String(result.executionStatus ?? '').toLowerCase();
          if (LOADTEST_TERMINAL.includes(status)) {
            return { status, result, terminal: true };
          }
        }
      }
    } catch {
      // Transient lookup failure is not a completion — look again next pass (mirrors loadTestTracker).
    }

    if (Date.now() > deadline) {
      return {
        status: String(lastResult?.executionStatus ?? '').toLowerCase(),
        result: lastResult,
        terminal: false,
      };
    }
    await sleep(pollMs);
  }
}

/**
 * NOTE — infra creation / deletion status.
 *
 * The scenario's infra-created and infra-gone checks stay on their existing screen waits
 * (WorkloadPage.expectInstanceCreated / expectInfraGone), which page the MCI list. The front reads
 * infra node status from cm-beetle/ListInfra|GetInfra, but the exact status field that means
 * "Running" vs "Terminated" is rendered as a composed string ("Running:1 (R:1/1)") rather than a
 * single documented field, so polling it by API here would be guessing. Per BAR-1595 guidance we do
 * NOT invent that endpoint — the screen wait remains the source of truth for infra up/down, and only
 * the well-confirmed workflow-run and load-test result APIs are polled here. (TODO: once cm-beetle's
 * GetInfra node-status field is confirmed from source, add waitInfraNodesRunning / waitInfraAbsent.)
 */
