import type { SourceConnection } from '@/shared/libs';

export interface ISourceGroup {
  name: string;
  description: string;
  connections: SourceConnection[];
}

/**
 * cm-honeybee source group types (0.6.4). The type decides which connections the group takes:
 * `onprem` and `csp` say where the sources are, `fs`, `db` and `minio` what they are. cm-honeybee
 * still answers with the earlier spelling `ssh` (or an empty value) for on-premise groups.
 */
export const SourceGroupType = {
  OnPremise: 'onprem',
  Csp: 'csp',
  Fs: 'fs',
  Db: 'db',
  Minio: 'minio',
} as const;

export type SourceGroupTypeValue =
  (typeof SourceGroupType)[keyof typeof SourceGroupType];

export const SOURCE_GROUP_TYPE_LABEL: Record<SourceGroupTypeValue, string> = {
  onprem: 'On-premise',
  csp: 'Cloud',
  fs: 'File system',
  db: 'DBMS',
  minio: 'MinIO',
};

export function groupTypeOf(type?: string | null): SourceGroupTypeValue {
  const t = (type ?? '').toLowerCase();
  if (t === '' || t === 'ssh') return SourceGroupType.OnPremise;
  return t as SourceGroupTypeValue;
}

export function isCspSourceGroup(type?: string | null): boolean {
  return groupTypeOf(type) === SourceGroupType.Csp;
}

/** Connection (resource) types and their labels. An on-premise connection without one is a server. */
export type ConnectionResourceType =
  | 'vm'
  | 'k8s'
  | 'object_storage'
  | 'nlb'
  | 'rdbms';

export const CONNECTION_TYPE_LABEL: Record<ConnectionResourceType, string> = {
  vm: 'VM (infra)',
  k8s: 'Kubernetes',
  object_storage: 'Object storage',
  nlb: 'NLB',
  rdbms: 'RDBMS',
};

/**
 * The connection types each group type takes, as cm-honeybee 0.6.4 validates them. fs, db and
 * minio groups take connections of their own kind with no resource type. Kept here until
 * cm-honeybee provides this list through an API (upstream request A).
 */
export const CONNECTION_TYPES_BY_GROUP_TYPE: Record<
  SourceGroupTypeValue,
  ConnectionResourceType[]
> = {
  onprem: ['vm', 'k8s'],
  csp: ['vm', 'k8s', 'object_storage', 'nlb', 'rdbms'],
  fs: [],
  db: [],
  minio: [],
};

export function connectionTypeOf(connection: {
  resource_type?: string | null;
}): ConnectionResourceType {
  return ((connection.resource_type ?? '').toLowerCase() ||
    'vm') as ConnectionResourceType;
}

/** Providers cm-honeybee accepts for minio and db groups (0.6.4, controller/provider.go). */
export const DATA_SOURCE_PROVIDERS = [
  'onprem',
  'aws',
  'alibaba',
  'tencent',
  'ncp',
  'nhn',
  'ibm',
  'gcp',
  'kt',
  'azure',
  'openstack',
];

/** A minio group of these providers needs a region (cm-honeybee regionRequired). */
export const MINIO_REGION_REQUIRED_PROVIDERS = [
  'aws',
  'alibaba',
  'tencent',
  'ncp',
  'nhn',
  'ibm',
  'gcp',
];

export type CspResourceType = 'vm' | 'k8s' | 'object_storage' | 'nlb' | 'rdbms';

export interface ICspCredentialField {
  key: string;
  example: string;
  description: string;
}

export interface ICspInfo {
  name: string;
  credential_keys: string[];
  credentials: ICspCredentialField[];
  region_keys: string[];
  default_region?: string;
}

export interface ICspListResponse {
  csp: string[];
}

export interface ICspRegion {
  name: string;
  display_name: string;
  zones: string[];
}

export interface ICspRegionListResponse {
  provider: string;
  regions: ICspRegion[];
}

export interface IDiscoveredResource {
  resource_type: CspResourceType;
  resource_id: string;
  name: string;
  region?: string;
  extra?: Record<string, any>;
}

export interface IDiscoverResponse {
  items: IDiscoveredResource[] | null;
  unsupported?: boolean;
  reason?: string;
}

export interface ICspSourceGroupRequest {
  name: string;
  description: string;
  type: typeof SourceGroupType.Csp;
  provider_name: string;
  region_name: string;
  credential: Array<{ key: string; value: string }>;
}

/**
 * What the server said about one connection, kept as it said it.
 *
 * A source service that cannot be reached is shown as failed, but "failed" alone does
 * not say whether the machine refused the SSH connection or answered and then failed to
 * take the agent. The server distinguishes the two and explains each in its own message;
 * nothing in the console was reading them.
 */
export interface ISourceConnectionOutcome {
  name: string;
  ipAddress: string;
  connectionStatus: string;
  connectionMessage: string;
  agentStatus: string;
  agentMessage: string;
}

export interface ISourceService {
  id: string;
  name: string;
  description: string;
  connectionCount: string | number;
  connectionIds: string[];
  // status: SourceServiceStatusType;
  status?: string;
  /** Per-connection outcome behind the aggregated status, for the reader who asks why. */
  connectionOutcomes?: ISourceConnectionOutcome[];
  infraModel?: IInfraSourceGroupResponse;
  softwareModel?: any;
  /** cm-honeybee group type: onprem (or ssh / empty), csp, fs, db or minio. */
  type?: string;
  providerName?: string;
  regionName?: string;
}

// The group type, with the account or provider the group is tied to.
export function sourceTypeLabel(sourceService: ISourceService): string {
  const type = groupTypeOf(sourceService.type);
  const label = SOURCE_GROUP_TYPE_LABEL[type] ?? type;
  if (type === SourceGroupType.Csp || type === SourceGroupType.Minio) {
    return `${label} (${sourceService.providerName ?? '-'} / ${
      sourceService.regionName || '-'
    })`;
  }
  if (type === SourceGroupType.Db) {
    return `${label} (${sourceService.providerName ?? '-'})`;
  }
  return label;
}

export interface ISourceAgentAndConnectionStatusResponse {
  agentConnectionDetails: {
    connectionDescription: string;
    connectionFailedMessage: string;
    connectionId: string;
    connectionName: string;
    agentStatus: SourceServiceStatusType;
    connectionStatus: SourceServiceStatusType;
  };
  agentConnectionStatus: SourceServiceStatusType;
}

export interface ISourceConnectionStatusCountResponse {
  connection_info_total: number;
  count_agent_failed: number;
  count_agent_success: number;
  count_connection_failed: number;
  count_connection_success: number;
}

export const SourceServiceStatus = {
  Success: 'Success',
  PartialSuccess: 'PartialSuccess',
  Failed: 'Failed',
  Unknown: 'Unknown',
} as const;

export type SourceServiceStatusType = keyof typeof SourceServiceStatus;

export interface ISourceServiceResponseElement {
  description: string;
  id: string;
  name: string;
  connection_info_status_count: ISourceConnectionStatusCountResponse;
  type?: string;
  provider_name?: string;
  region_name?: string;
}

export interface ISourceServiceResponse {
  // honeybee returns null (not an empty array) when there are no source groups.
  source_group: Array<ISourceServiceResponseElement> | null;
}

export type IInfraSourceGroupResponse = Array<IInfraConnectionData>;

interface IInfraConnectionData {
  connection_id: string;
  infra_data: string;
  saved_time: string;
  status: string;
}

export type SourceServiceTableType =
  | 'name'
  | 'id'
  | 'description'
  | 'connectionCount'
  | 'sourceType'
  | 'status'
  | 'viewInfra'
  | 'viewSoftware'
  | 'viewObjectStorage';
