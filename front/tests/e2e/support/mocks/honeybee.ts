import { ApiMock, ok } from '../apiMock';

/**
 * cm-honeybee(소스 컴퓨팅) mock — 소스그룹·연결정보·수집.
 * 유닛 테스트가 연계 프레임워크 없이 소스 등록→선택→수집 흐름을 완결하도록 stateful 저장소를 둔다.
 * 응답 키·스키마는 front 소비 형태에 정확히 맞춘다:
 *  - list-source-group    → responseData.source_group[] (각 항목 connection_info_status_count.connection_info_total)
 *  - list-connection-info → responseData.connection_info[] (ISourceConnectionInfo: id/name/ip_address/user/status ...)
 *  - 등록 성공            → data.status.code === 200
 */

/** ISourceConnectionInfo 형태(front setConnection이 읽는 필드) */
type Conn = {
  id: string;
  name: string;
  description: string;
  ip_address: string;
  user: string;
  ssh_port: string;
  status: string;
  source_group_id: string;
  collectInfraStatus?: string;
  collectSwStatus?: string;
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
  const latest = () => groups[groups.length - 1];

  return mock.use({
    // 소스그룹 등록 (연결정보 connection_info 동반 가능) — 명시 라우팅 opId
    'cm-honeybee/register-source-group': ({ body }) => {
      const req = body?.request ?? body ?? {};
      const id = `sg-${seq++}`;
      const conns: Conn[] = (req.connection_info ?? []).map(
        (c: any, i: number) => ({
          id: `${id}-conn-${i + 1}`,
          name: c.name ?? `conn-${i + 1}`,
          description: c.description ?? '',
          ip_address: c.ip_address ?? c.ip ?? '',
          user: c.user ?? '',
          ssh_port: String(c.ssh_port ?? '22'),
          status: 'Success',
          source_group_id: id,
        }),
      );
      groups.push({
        id,
        name: req.name,
        description: req.description ?? '',
        connectionCount: conns.length,
        connectionIds: conns.map(c => c.id),
        connections: conns,
      });
      return ok({ id, name: req.name });
    },

    // 소스그룹 목록
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

    // 소스그룹 상세
    'get-source-group': ({ body }) => {
      const id =
        body?.pathParams?.sgId ?? body?.pathParams?.id ?? body?.request?.id;
      return ok(findGroup(id) ?? latest() ?? null);
    },

    // 연결·에이전트 상태 점검
    'agent-and-connection-check': () => ok({ status: 'Success' }),

    // 연결정보 목록 — responseData.connection_info[]
    'list-connection-info': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.sourceGroupId;
      const g = findGroup(id) ?? latest();
      return ok({ connection_info: g?.connections ?? [] });
    },

    // 인프라 수집 (연결단위/그룹단위) — 수집 상태를 Success로 표시
    'import-infra': ({ body }) => {
      const g = latest();
      g?.connections.forEach(c => (c.collectInfraStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    'import-infra-source-group': () => {
      latest()?.connections.forEach(c => (c.collectInfraStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    // 소프트웨어 수집
    'import-software': () => {
      latest()?.connections.forEach(c => (c.collectSwStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    'import-software-source-group': () => {
      latest()?.connections.forEach(c => (c.collectSwStatus = 'Success'));
      return ok({ status: 'Success' });
    },

    // 수집 정제 결과 조회 — 최소 인프라 정보(연결단위/그룹단위)
    'get-infra-info-refined': () => ok(sampleRefinedInfra()),
    'get-infra-info-source-group-refined': () => ok(sampleRefinedInfra()),
    'get-software-info-refined': () => ok({ software: [] }),
    'get-software-info-source-group-refined': () => ok({ software: [] }),

    // 삭제(단건/일괄)
    'delete-source-group': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.id;
      const i = groups.findIndex(g => g.id === id);
      if (i >= 0) groups.splice(i, 1);
      return ok({ deleted: true });
    },
  });
}

/** 수집 정제 결과 최소 샘플(화면이 조회 가능 상태를 렌더하기 위한 값) */
function sampleRefinedInfra() {
  return {
    compute: {
      os: { os: { name: 'ubuntu', version: '22.04' } },
      cpu: { cores: 2, threads: 2 },
      memory: { totalSize: 4096 },
    },
    network: {},
    storage: {},
  };
}
