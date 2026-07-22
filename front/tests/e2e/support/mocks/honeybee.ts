import { ApiMock, ok } from '../apiMock';

/**
 * cm-honeybee (source computing) mock — source groups, connection info, collection.
 * Keeps a stateful store so unit tests can complete the source register → select → collect flow without the linked frameworks.
 * Response keys and schema match exactly what the front consumes:
 *  - list-source-group    → responseData.source_group[] (each item has connection_info_status_count.connection_info_total)
 *  - list-connection-info → responseData.connection_info[] (ISourceConnectionInfo: id/name/ip_address/user/status ...)
 *  - register success     → data.status.code === 200
 */

/** ISourceConnectionInfo shape (the fields front setConnection reads) */
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
    // Register a source group (may include connection_info) — explicitly routed opId
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

    // Source group list
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

    // Source group detail
    'get-source-group': ({ body }) => {
      const id =
        body?.pathParams?.sgId ?? body?.pathParams?.id ?? body?.request?.id;
      return ok(findGroup(id) ?? latest() ?? null);
    },

    // Connection and agent status check
    'agent-and-connection-check': () => ok({ status: 'Success' }),

    // Connection info list — responseData.connection_info[]
    'list-connection-info': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.sourceGroupId;
      const g = findGroup(id) ?? latest();
      return ok({ connection_info: g?.connections ?? [] });
    },

    // Infra collection (per-connection / per-group) — marks collection status as Success
    'import-infra': ({ body }) => {
      const g = latest();
      g?.connections.forEach(c => (c.collectInfraStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    'import-infra-source-group': () => {
      latest()?.connections.forEach(c => (c.collectInfraStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    // Software collection
    'import-software': () => {
      latest()?.connections.forEach(c => (c.collectSwStatus = 'Success'));
      return ok({ status: 'Success' });
    },
    'import-software-source-group': () => {
      latest()?.connections.forEach(c => (c.collectSwStatus = 'Success'));
      return ok({ status: 'Success' });
    },

    // Query refined collection results — minimal infra info (per-connection / per-group)
    'get-infra-info-refined': () => ok(sampleRefinedInfra()),
    'get-infra-info-source-group-refined': () => ok(sampleRefinedInfra()),
    'get-software-info-refined': () => ok({ software: [] }),
    'get-software-info-source-group-refined': () => ok({ software: [] }),

    // Delete (single / bulk)
    'delete-source-group': ({ body }) => {
      const id = body?.pathParams?.sgId ?? body?.request?.id;
      const i = groups.findIndex(g => g.id === id);
      if (i >= 0) groups.splice(i, 1);
      return ok({ deleted: true });
    },
  });
}

/** Minimal sample of refined collection results (values so the screen can render a viewable state) */
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
