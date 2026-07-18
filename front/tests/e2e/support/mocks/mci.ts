import { ApiMock, ok } from '../apiMock';

/**
 * 워크로드(인프라) mock — 삭제 화면의 *상태 기계* 를 인프라 없이 검증하기 위한 것.
 *
 * ★ 무엇을 mock 하고 무엇을 하지 않는가 (BAR-1530)
 *
 *   mock 한다   — `ListInfra`(행을 그리기 위한 최소 목록) · `DeleteInfra`(요청 수락)
 *   mock 안 한다 — `GetRequest`
 *
 *   `GetRequest` 는 삭제 상태를 `Success`/`Error` 로 **전이**시키는 근거이고, 그 응답 구조를 파싱하는
 *   것은 우리 코드가 아니라 **연계 프레임워크와의 계약**이다. 이를 mock 으로 만들면 *우리 파서를
 *   우리 가정으로* 검증하는 셈이라, 실제 응답 구조가 바뀌어도 테스트는 통과한다. 목이 결함을 가리는
 *   전형적인 경우라 의도적으로 제외한다(실 인프라 시나리오가 그 몫을 맡는다).
 *
 *   mock 되지 않은 operationId 는 실제 백엔드로 통과하므로, 진행 중 상태가 임의로 완료로 바뀌지
 *   않도록 시나리오를 짧게 유지한다.
 *
 * 응답 형태는 실제 관측값에 맞춘다 — `ListInfra` 는 `responseData.data.infra[]` 이고, 목록이 읽는
 * 필드는 `id`·`name`·`status`·`statusCount`·`node[]` 다.
 */

/** 목록에 한 행을 그리기 위한 최소 인프라 항목(실제 응답의 부분집합) */
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

/** 이 mock 이 목록에 내보내는 인프라 이름 — 시나리오와 스텝이 같은 값을 쓴다. */
export const MOCK_INFRA_ID = 'mock-del-infra';

export function registerMciMocks(mock: ApiMock): ApiMock {
  return mock.use({
    // 목록 — 삭제 대상 한 건만 내보낸다.
    'cm-beetle/ListInfra': () =>
      ok({ data: { infra: [infraItem(MOCK_INFRA_ID)] } }),

    // 상세 — 행 선택 시 호출될 수 있어 같은 항목을 돌려준다.
    'cm-beetle/GetInfra': () => ok({ data: infraItem(MOCK_INFRA_ID) }),

    // 삭제 요청 — **응답을 붙들고 있는다.**
    //
    // ★ 즉시 응답하면 안 된다. 실제 DeleteInfra 는 완료까지 응답을 붙들고 있고, 화면은 그동안
    //   "진행 중"(Handling) 상태를 유지한다. mock 이 즉시 성공을 돌려주면 요청 직후 곧장 완료로
    //   전이해 기록이 지워지고, 우리가 보려던 진행 중 상태 자체가 존재하지 않게 된다
    //   (실제로 그렇게 3건이 실패했다). 오래 걸리는 API 는 *오래 걸리는 것까지* 흉내내야 한다.
    'cm-beetle/DeleteInfra': () => new Promise(() => {}),
  });
}
