import type { SourceConnection } from '@/shared/libs';

export interface ISourceGroup {
  name: string;
  description: string;
  connections: SourceConnection[];
}

/**
 * How a source group's connections are collected. cm-honeybee still answers with the
 * earlier spelling `ssh` (or an empty value) for on-premise groups.
 */
export const SourceGroupType = {
  OnPremise: 'onprem',
  Csp: 'csp',
} as const;

export function isCspSourceGroup(type?: string | null): boolean {
  return (type ?? '').toLowerCase() === SourceGroupType.Csp;
}

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
  /** `csp` for a cloud source account; anything else is an on-premise group. */
  type?: string;
  providerName?: string;
  regionName?: string;
}

// On-premise groups read the machines over SSH; CSP groups read a cloud account.
export function sourceTypeLabel(sourceService: ISourceService): string {
  if (!isCspSourceGroup(sourceService.type)) return 'On-premise';
  return `Cloud (${sourceService.providerName ?? '-'} / ${
    sourceService.regionName ?? '-'
  })`;
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
  | 'viewSoftware';
