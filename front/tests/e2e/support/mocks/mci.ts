import { ApiMock, ok, fail } from '../apiMock';

/**
 * Workload (infra) mock — for verifying the delete screen's *state machine* without any infra.
 *
 * ★ What is mocked and what is not (BAR-1530)
 *
 *   mocked     — `ListInfra` (a minimal list of rows) · `GetInfra` (echo the requested infra) · `DeleteInfra` (accept the request) · `GetRequest` (**"still running" only**)
 *   not mocked — the delete status *transitions* (`Success`/`Error`)
 *
 *   Those transitions are read out of cm-beetle's response structure, which is **the contract with the linked
 *   framework**, not our own code. Faking them would mean verifying *our parser against our own assumptions*, so
 *   the test would keep passing after the real structure changed — a textbook case of a mock hiding a defect. They
 *   are therefore never produced here; the real-infra scenario takes them on. `GetRequest` answers only that
 *   nothing has changed yet, which is what makes "a delete is under way" a state a scenario can stand on (see the
 *   handler below).
 *
 *   Un-mocked operationIds pass through to the real backend, so keep the scenario short to prevent the in-progress
 *   status from arbitrarily flipping to complete.
 *
 * The response shape matches actual observations — `ListInfra` is `responseData.data.infra[]`, and the fields the
 * list reads are `id`, `name`, `status`, `statusCount`, and `node[]`.
 */

/** The minimal infra item for drawing one list row (a subset of the real response) */
function infraItem(id: string) {
  return {
    resourceType: 'infra',
    id,
    uid: `mock-${id}`,
    name: id,
    status: 'Running:1 (R:1/1)',
    statusCount: {
      countTotal: 1,
      countCreating: 0,
      countRunning: 1,
      countFailed: 0,
      countSuspended: 0,
      countRebooting: 0,
      countTerminated: 0,
    },
    description: 'mock infra for delete UI state test',
    systemLabel: '',
    targetAction: '',
    targetStatus: '',
    node: [
      {
        id: `${id}-1`,
        name: `${id}-1`,
        status: 'Running',
        cspResourceId: 'i-mock0000000000000',
        specId: 'aws+ap-northeast-2+t3a.nano',
        connectionName: 'aws-ap-northeast-2',
        publicIP: '203.0.113.10',
      },
    ],
  };
}

/** The infra name this mock emits to the list — the scenario and steps use the same value. */
export const MOCK_INFRA_ID = 'mock-del-infra';

/**
 * Filler infras so the list holds more than two rows (BAR-1637).
 *
 * The count matters. cb-tumblebug lets only two infra lookups run at once and turns away the rest,
 * so a screen that looks up each listed infra separately breaks from the third one on — and a list
 * of one or two rows never shows it. Five rows keeps the regression check honest.
 *
 * The names deliberately share no substring with MOCK_INFRA_ID: rows are located by accessible name,
 * which matches on substring, so `mock-del-infra-2` would resolve to two rows and fail strict mode.
 */
export const MOCK_LIST_INFRA_IDS = [
  'mock-list-infra-1',
  'mock-list-infra-2',
  'mock-list-infra-3',
  'mock-list-infra-4',
];

/**
 * An infra whose delete request is refused outright.
 *
 * Separate from MOCK_INFRA_ID because the two are opposite cases: that one imitates a slow
 * delete that is genuinely under way, this one a request that never started. Sharing a name
 * would leave the list holding a row in two contradictory states.
 */
export const MOCK_REJECTED_INFRA_ID = 'mock-refused-infra';

/**
 * One slow-delete infra per scenario, rather than one shared between them.
 *
 * A delete that is meant to stay in flight never finishes here, and the record of it lives on
 * the server — so the scenario that starts one leaves it running for whatever comes next. The
 * next scenario would then find its target already being deleted and open on the progress step
 * instead of the confirm step, failing on a state the *previous* scenario left behind.
 *
 * Giving each its own target is what keeps them independent. (Records still outlive the run
 * itself; clearing them between runs is a separate matter — see the run command in the report.)
 */
export const MOCK_REFRESH_INFRA_ID = 'mock-refresh-infra';
export const MOCK_MIXED_INFRA_ID = 'mock-mixed-infra';

/**
 * A block of infras for the scenarios about picking several at once (BAR-1719).
 *
 * Kept apart from the fillers above because those are already targets elsewhere: a scenario that
 * deletes one of them leaves it running, and a run that finds it in that state would be counting
 * one target fewer than it picked — which is exactly the number these scenarios turn on.
 */
export const MOCK_BULK_INFRA_IDS = [
  'mock-bulk-1',
  'mock-bulk-2',
  'mock-bulk-3',
  'mock-bulk-4',
  'mock-bulk-5',
];

/**
 * A target the server turns away twice before taking it (BAR-1722).
 *
 * Being turned away is not a failure — the request was not taken, and sending it again is the
 * whole of the remedy. It needs its own target because the point is what happens *before* the
 * delete starts, and any other target is taken on the first ask.
 */
export const MOCK_BUSY_INFRA_ID = 'mock-busy-infra';

/** How many times the busy target has been turned away in this run. */
let busyRefusals = 0;

/** How many refusals before it is taken. Two is enough to show a count that moves. */
const BUSY_REFUSALS_BEFORE_ACCEPT = 2;

/** Every infra name this mock puts in the list. */
export const MOCK_ALL_INFRA_IDS = [
  MOCK_INFRA_ID,
  MOCK_REJECTED_INFRA_ID,
  MOCK_REFRESH_INFRA_ID,
  MOCK_MIXED_INFRA_ID,
  MOCK_BUSY_INFRA_ID,
  ...MOCK_LIST_INFRA_IDS,
  ...MOCK_BULK_INFRA_IDS,
];

/**
 * Taken for handling — what cm-beetle answers when asked to respond on acceptance.
 *
 * 202 with a request id, in a moment. Not the outcome: the deleting starts behind it and is
 * followed through the request record.
 */
function accepted(infraId: string) {
  return ok(
    { data: { reqId: `mock-req-${infraId}`, status: 'Handling' } },
    202,
  );
}

/**
 * Turned away for the moment, with how long to wait.
 *
 * Built by hand rather than with `fail` because the wait is the point: the screen counts it
 * down and sends the request again when it reaches zero, and a refusal without it would leave
 * that number to be invented.
 */
function refusedForNow() {
  const message = 'mock: too many async jobs in progress; retry shortly';
  return {
    __httpStatus: 503,
    // Three seconds rather than one, so the countdown is something a scenario — and anyone
    // watching a recording of it — can actually see move: 3, 2, 1. At one second there is a
    // single value and no way to tell a counter from a frozen number.
    status: { code: 503, message, retryAfter: '3' },
    responseData: message,
  };
}

export function registerMciMocks(mock: ApiMock): ApiMock {
  // Each run starts with the busy target able to turn requests away again.
  busyRefusals = 0;

  return mock.use({
    // List — the deletion target plus fillers, so the row count is realistic.
    'cm-beetle/ListInfra': () =>
      ok({ data: { infra: MOCK_ALL_INFRA_IDS.map(id => infraItem(id)) } }),

    // Detail — called when the server tab opens. Echo whichever infra was asked for; returning a
    // fixed one would let a test that looks up the wrong infra pass.
    'cm-beetle/GetInfra': ({ body }) =>
      ok({ data: infraItem(body?.pathParams?.infraId ?? MOCK_INFRA_ID) }),

    // Lifecycle control — accept and answer the way cb-tumblebug does.
    //
    // ★ What these scenarios actually check is **what went out**, not what came back. The console
    //   has no state machine of its own here: it sends one call per target and shows the answer. So
    //   the thing that can silently break is the *request* — the wrong operationId (cm-beetle has no
    //   control endpoint, so a stray `cm-beetle/` prefix 404s), a missing `action`, or a `force` that
    //   goes out when nobody asked for it. The steps read the recorded calls for exactly that.
    //
    //   The reply is a single message line, which is all cb-tumblebug returns (model.SimpleMsg). It
    //   is an acknowledgement, not a completion — echoing the action keeps that visible.
    'cb-tumblebug/GetControlInfra': ({ body }) =>
      ok({ message: `${body?.queryParams?.action} requested for the Infra` }),
    'cb-tumblebug/GetControlInfraNode': ({ body }) =>
      ok({ message: `${body?.queryParams?.action} requested for the Node` }),

    // Selecting a server makes the screen ask cm-ant for that server's last load test. Nothing here
    // is about load testing, but an un-mocked call goes out to the real backend and comes back as a
    // toast that can sit over the very controls the scenario is about to press. Answered with "no
    // run on record" purely to keep it out of the way — **this is silencing, not verification.**
    // The load-test contract is checked where it belongs, against the real lineup.
    'cm-ant/Getlastloadtestexecutionstate': () => ok({ result: null }),

    // Delete request — **hold the response**, except for the one infra that is meant to be refused.
    //
    // ★ Do not respond immediately. The real DeleteInfra holds the response until completion, and the screen keeps
    //   the "in progress" (Handling) status the whole time. If the mock returns success immediately, it transitions
    //   straight to complete right after the request, the record is dropped, and the in-progress status we wanted to
    //   observe never exists (3 cases actually failed that way). A slow API must be imitated *down to being slow*.
    //
    // MOCK_REJECTED_INFRA_ID is the exception: it is refused outright, which is a different thing
    // from a slow delete. A refusal means nothing was started, so the record must not be left
    // "in progress" — that status is what blocks a second attempt, and leaving it there would make
    // the workload permanently undeletable even though nothing had happened to it.
    // Delete — answered on acceptance, which is what the console asks for.
    //
    // ★ This used to be a promise that never settled, and that was right while the call only
    //   answered once the deleting had finished: a delete under way was a call still waiting.
    //   The console now sends `Prefer: respond-async` and cm-beetle answers 202 straight away,
    //   so a mock that never answers no longer stands for anything real — it would hang the
    //   submitting step instead of letting it complete.
    //
    //   "A delete is under way" is now held by `GetRequest` answering Handling, below.
    'cm-beetle/DeleteInfra': ({ body }) => {
      const infraId = body?.pathParams?.infraId;

      // Rejected outright: nothing was started and asking again will not change that.
      if (infraId === MOCK_REJECTED_INFRA_ID) {
        return fail(400, 'mock: delete request refused');
      }

      // Turned away while the far side is full, then taken. Nothing is started by a refusal,
      // so each attempt arrives with a new request id and only the last one is recorded.
      if (
        infraId === MOCK_BUSY_INFRA_ID &&
        busyRefusals < BUSY_REFUSALS_BEFORE_ACCEPT
      ) {
        busyRefusals += 1;
        return refusedForNow();
      }

      return accepted(infraId ?? MOCK_INFRA_ID);
    },

    // Request tracking — answer "still running", and nothing else.
    //
    // ★ Why this one *is* mocked now, when the note above says it is deliberately not.
    //   That note is about the **transitions** — Success and Error. Those are read out of
    //   cm-beetle's response structure, so faking them would check our parser against our own
    //   assumptions and keep passing after the real structure changed. That still holds: the
    //   two terminal states are never produced here.
    //
    //   What is answered is the *absence* of a transition. Without it these scenarios cannot
    //   exist at all: the request ids are invented by this mock, so a real cm-beetle answers 404,
    //   and the console — correctly — concludes the outcome cannot be learned and stops treating
    //   the delete as running. That happens within a poll or two, which left "a delete is under
    //   way" as a state that survived a few seconds and then vanished. Scenarios about that state
    //   passed or failed on how quickly the browser got there.
    'cm-beetle/GetRequest': () => ok({ data: { status: 'Handling' } }),
  });
}
