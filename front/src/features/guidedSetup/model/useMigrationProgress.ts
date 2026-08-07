import { ref, computed } from 'vue';
import { axiosPost } from '@/shared/libs/api/request';
import { GUIDED_STEPS } from './steps';

/**
 * How far through a migration this installation has got, worked out from the data
 * itself rather than from anything remembered about the user.
 *
 * ## Why from the data
 *
 * A product tour replays a fixed order and needs to remember where it left off. This
 * does not: someone who registered a source service last week and comes back today is
 * on step 2 because a source service exists and nothing has been collected - the same
 * answer on any browser, on any machine, for anyone looking. Nothing has to be stored
 * for that to hold.
 *
 * ## Why it stops at the first gap
 *
 * The steps only ever run in order, so the first one that is not done is where the
 * user is - what comes after it cannot have happened. Checking stops there. Someone
 * starting out costs one call; only a finished installation is looked at end to end,
 * and a finished installation is not asked again.
 *
 * ## Why a failure produces nothing
 *
 * If a call fails, the answer is unknown - not "nothing exists". Treating a failure as
 * an empty installation would greet someone who has been working here for weeks as a
 * first-time visitor. On failure this reports `failed` and every piece of guidance
 * stays off the screen.
 */

const LIST_SOURCE_GROUP = 'cm-honeybee/list-source-group';
/*
  The *refined* view, not the raw one.

  The raw group-level call crashes the service outright when nothing has been collected
  yet - a nil dereference, no response at all - which is the most common state there is:
  servers registered a moment ago. The refined call answers the same question and, asked
  in that same state, replies properly with an error instead of dying.
*/
const GET_INFRA_INFO_SOURCE_GROUP =
  'cm-honeybee/get-infra-info-source-group-refined';
const GET_MODELS = 'cm-damselfly/GetModels';
const LIST_WORKFLOW = 'cm-cicada/list-workflow';
const GET_WORKFLOW_RUNS = 'cm-cicada/get-workflow-runs';

export type ProgressState = 'idle' | 'loading' | 'ready' | 'failed';

/** 1-5 while there is something left to do, or `done` once every step is behind you. */
export type CurrentStep = 1 | 2 | 3 | 4 | 5 | 'done';

const state = ref<ProgressState>('idle');
const current = ref<CurrentStep>(1);

/** Guidance only ever speaks when the answer is known. */
export const progressState = computed(() => state.value);
export const currentStep = computed(() => current.value);
export const progressKnown = computed(() => state.value === 'ready');
export const isFinished = computed(
  () => state.value === 'ready' && current.value === 'done',
);

/** The step the user is on, when there is one. */
export const currentGuidedStep = computed(() =>
  typeof current.value === 'number'
    ? (GUIDED_STEPS[current.value - 1] ?? null)
    : null,
);

/**
 * Did the call come back with something in it?
 *
 * Used where the question is "is there anything here at all", and the shape of the answer
 * is not ours to choose: one service answers a list, another answers a nested object of
 * the same facts. Counting only lists reads a full object as empty, which is how a
 * finished collection looked like no collection at all.
 */
function hasContent(payload: any): boolean {
  if (payload === null || payload === undefined) return false;
  if (Array.isArray(payload)) return payload.length > 0;
  if (typeof payload === 'object') return Object.keys(payload).length > 0;
  return Boolean(payload);
}

function asArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.responseData)) return payload.responseData;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function post(operationId: string, body: unknown): Promise<any> {
  const res = await axiosPost<any, unknown>(operationId, body ?? {});
  return res?.data?.responseData ?? res?.data ?? null;
}

/** Step 1 - is there anything registered to migrate from? */
async function sourceGroups(): Promise<any[]> {
  const payload = await post(LIST_SOURCE_GROUP, {});
  // honeybee returns null rather than an empty array when there are none.
  return asArray(payload?.source_group ?? payload);
}

/**
 * Step 2 - has anything actually been read off those servers?
 *
 * Asked per source group, and only until one answers yes. A first-time installation
 * has one group, so this is one call; it is never asked at all unless step 1 is done.
 *
 * "Nothing collected" arrives as a refusal rather than as an empty list - the service
 * answers 4xx when it has nothing to show. That is an answer, so it is read as one: this
 * group has not been collected. Only a call that never gets a reply at all is unknown.
 */
async function anythingCollected(groups: any[]): Promise<boolean> {
  for (const group of groups) {
    const id = group?.id ?? group?.source_group_id;
    if (!id) continue;
    try {
      const payload = await post(GET_INFRA_INFO_SOURCE_GROUP, {
        pathParams: { sgId: id },
      });
      if (hasContent(payload)) return true;
    } catch (e: any) {
      // A refusal is a "no". Anything else - no reply, no status - is genuinely unknown.
      if (!e?.response?.status) throw e;
    }
  }
  return false;
}

/** Steps 3 and 4 - the same call, told apart by which side of the migration it describes. */
async function models(isTargetModel: boolean): Promise<any[]> {
  const payload = await post(GET_MODELS, {
    pathParams: { isTargetModel: String(isTargetModel) },
  });
  return asArray(payload);
}

/** Step 5 - a workflow exists, and it has been run at least once. */
async function anyRun(workflows: any[]): Promise<boolean> {
  for (const workflow of workflows) {
    const id = workflow?.id ?? workflow?.workflow_id;
    if (!id) continue;
    const payload = await post(GET_WORKFLOW_RUNS, { pathParams: { wfId: id } });
    if (asArray(payload).length > 0) return true;
  }
  return false;
}

/**
 * Work out the current step and publish it.
 *
 * Runs once per visit to the guide screen. Cheap enough to repeat, but there is no
 * reason to: nothing changes underneath while the screen is being read.
 */
export async function evaluateProgress(): Promise<void> {
  state.value = 'loading';
  try {
    const groups = await sourceGroups();
    if (groups.length === 0) {
      current.value = 1;
      state.value = 'ready';
      return;
    }

    /*
      From here on, a failure understates rather than silences.

      Step 1 has already answered - source services exist - so no one can be greeted as a
      first-time visitor by mistake, which was the reason for saying nothing at all. What
      is left is the choice between naming a step the reader may have finished and naming
      none. The first is a hint they can walk past; the second leaves them with nothing.
    */
    try {
      if (!(await anythingCollected(groups))) {
        current.value = 2;
        state.value = 'ready';
        return;
      }
    } catch {
      current.value = 2;
      state.value = 'ready';
      return;
    }

    if ((await models(false)).length === 0) {
      current.value = 3;
      state.value = 'ready';
      return;
    }

    if ((await models(true)).length === 0) {
      current.value = 4;
      state.value = 'ready';
      return;
    }

    const workflows = asArray(await post(LIST_WORKFLOW, {}));
    if (workflows.length === 0 || !(await anyRun(workflows))) {
      current.value = 5;
      state.value = 'ready';
      return;
    }

    current.value = 'done';
    state.value = 'ready';
  } catch {
    // Unknown, not empty. Say nothing rather than guess.
    state.value = 'failed';
  }
}
