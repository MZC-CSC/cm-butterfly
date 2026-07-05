import { ApiMock, ok } from '../apiMock';

/**
 * cm-honeybee(소스 컴퓨팅) mock — 소스그룹·연결정보·수집.
 * 유닛 테스트가 연계 프레임워크 없이 소스 등록→선택→수집 흐름을 완결하도록 stateful 저장소를 둔다.
 * 응답 키는 front 소비 형태에 맞춘다: 목록은 res.data.responseData(배열), 등록 성공은 data.status.code===200.
 */

type Conn = {
  connectionId: string;
  connectionName: string;
  connectionDescription: string;
  connectionStatus: string;
};
type Group = {
  id: string;
  name: string;
  description: string;
  connectionCount: number;
  connectionIds: string[];
  connections: Conn[];
};

export function registerHoneybeeMocks(mock: ApiMock): ApiMock {
  const groups: Group[] = [];
  let seq = 1;

  const findGroup = (id?: string) => groups.find(g => g.id === id);

  return mock.use({
    // 소스그룹 등록 (연결정보 connection_info 동반 가능) — 명시 라우팅 opId
    'cm-honeybee/register-source-group': ({ body }) => {
      const req = body?.request ?? body ?? {};
      const id = `sg-${seq++}`;
      const conns: Conn[] = (req.connection_info ?? []).map((c: any, i: number) => ({
        connectionId: `${id}-conn-${i + 1}`,
        connectionName: c.name ?? c.connectionName ?? `conn-${i + 1}`,
        connectionDescription: c.description ?? '',
        connectionStatus: 'Success',
      }));
      groups.push({
        id,
        name: req.name,
        description: req.description ?? '',
        connectionCount: conns.length,
        connectionIds: conns.map(c => c.connectionId),
        connections: conns,
      });
      return ok({ id, name: req.name });
    },

    // 소스그룹 목록 — 스토어(setService)가 responseData.source_group[] 를 기대하고
    // 각 항목의 connection_info_status_count.connection_info_total 을 읽는다.
    'list-source-group': () =>
      ok({
        source_group: groups.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description,
          connection_info_status_count: {
            connection_info_total: g.connectionCount,
            count_connection_success: g.connectionCount,
            count_connection_failed: 0,
          },
        })),
      }),

    // 소스그룹 상세 (연결정보 포함)
    'get-source-group': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.pathParams?.id ?? body?.request?.id;
      const g = findGroup(id) ?? groups[groups.length - 1];
      return ok(g ?? null);
    },

    // 연결·에이전트 상태 점검
    'agent-and-connection-check': () => ok({ status: 'Success' }),

    // 연결정보 목록
    'list-connection-info': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.sourceGroupId;
      const g = findGroup(id) ?? groups[groups.length - 1];
      return ok(g?.connections ?? []);
    },

    // 삭제(단건/일괄)
    'delete-source-group': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.id;
      const i = groups.findIndex(g => g.id === id);
      if (i >= 0) groups.splice(i, 1);
      return ok({ deleted: true });
    },
  });
}
