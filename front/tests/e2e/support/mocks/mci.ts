import { ApiMock, ok } from '../apiMock';

/**
 * Workload (infra) mock — for verifying the delete screen's *state machine* without any infra.
 *
 * ★ What is mocked and what is not (BAR-1530)
 *
 *   mocked     — `ListInfra` (a minimal list of rows) · `GetInfra` (echo the requested infra) · `DeleteInfra` (accept the request)
 *   not mocked — `GetRequest`
 *
 *   `GetRequest` is the basis for **transitioning** the delete status to `Success`/`Error`, and parsing its
 *   response structure is **the contract with the linked framework**, not our own code. Mocking it would mean
 *   verifying *our parser against our own assumptions*, so the test would pass even if the real response structure
 *   changed. That is a textbook case of a mock hiding a defect, so it is deliberately excluded (the real-infra
 *   scenario takes that on).
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

/** Every infra name this mock puts in the list. */
export const MOCK_ALL_INFRA_IDS = [MOCK_INFRA_ID, ...MOCK_LIST_INFRA_IDS];

export function registerMciMocks(mock: ApiMock): ApiMock {
  return mock.use({
    // List — the deletion target plus fillers, so the row count is realistic.
    'cm-beetle/ListInfra': () =>
      ok({ data: { infra: MOCK_ALL_INFRA_IDS.map(id => infraItem(id)) } }),

    // Detail — called when the server tab opens. Echo whichever infra was asked for; returning a
    // fixed one would let a test that looks up the wrong infra pass.
    'cm-beetle/GetInfra': ({ body }) =>
      ok({ data: infraItem(body?.pathParams?.infraId ?? MOCK_INFRA_ID) }),

    // Delete request — **hold the response.**
    //
    // ★ Do not respond immediately. The real DeleteInfra holds the response until completion, and the screen keeps
    //   the "in progress" (Handling) status the whole time. If the mock returns success immediately, it transitions
    //   straight to complete right after the request, the record is dropped, and the in-progress status we wanted to
    //   observe never exists (3 cases actually failed that way). A slow API must be imitated *down to being slow*.
    'cm-beetle/DeleteInfra': () => new Promise(() => {}),
  });
}
