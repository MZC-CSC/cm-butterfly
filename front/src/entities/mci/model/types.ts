export interface MciResponseData {
  infra: IMci[]; // tb-0.12.9: cb-tumblebug GetAllInfra wrapper mci→infra (소스 확정)
}

export type McisTableType =
  | 'name'
  | 'id'
  | 'status'
  | 'provider'
  | 'countTotal'
  | 'countRunning'
  | 'countTerminated'
  | 'countSuspended'
  | 'description'
  | 'deploymentAlgorithm'
  | 'type'
  | 'action';

interface Location {
  display: string;
  latitude: number;
  longitude: number;
}

interface RegionZoneInfo {
  assignedRegion: string;
  assignedZone: string;
}

interface RegionDetail {
  regionId: string;
  regionName: string;
  description: string;
  location: Location;
  zones: string[];
}

interface ConnectionConfig {
  configName: string;
  providerName: string;
  driverName: string;
  credentialName: string;
  credentialHolder: string;
  regionZoneInfoName: string;
  regionZoneInfo: RegionZoneInfo;
  regionDetail: RegionDetail;
  regionRepresentative: boolean;
  verified: boolean;
}

export interface IVm {
  resourceType: string;
  id: string;
  uid: string;
  name: string;
  nodeGroupId: string;
  location: Location;
  status: string;
  targetStatus: string;
  targetAction: string;
  monAgentStatus: string;
  networkAgentStatus: string;
  systemMessage: string;
  createdTime: string;
  label: any; // Assuming label can be any type
  description: string;
  region: {
    Region: string;
    Zone: string;
  };
  publicIP: string;
  sshPort: string;
  publicDNS: string;
  privateIP: string;
  privateDNS: string;
  rootDiskType: string;
  rootDiskSize: string;
  rootDeviceName: string;
  connectionName: string;
  connectionConfig: ConnectionConfig;
  specId: string;
  cspSpecName: string;
  imageId: string;
  cspImageName: string;
  vNetId: string;
  cspVNetId: string;
  subnetId: string;
  cspSubnetId: string;
  networkInterface: string;
  securityGroupIds: string[];
  dataDiskIds: any; // Assuming dataDiskIds can be any type
  sshKeyId: string;
  cspSshKeyId: string;
  lastloadtestStateResponse?: ILastloadtestStateResponse;
}

interface StatusCount {
  countTotal: number;
  countCreating: number;
  countRunning: number;
  countFailed: number;
  countSuspended: number;
  countRebooting: number;
  countTerminated: number;
  countSuspending: number;
  countResuming: number;
  countTerminating: number;
  countUndefined: number;
}

interface Label {
  'sys.description': string;
  'sys.id': string;
  'sys.labelType': string;
  'sys.manager': string;
  'sys.name': string;
  'sys.namespace': string;
  'sys.uid': string;
}

export interface IMci {
  resourceType: string;
  id: string;
  uid: string;
  name: string;
  status: string;
  statusCount: StatusCount;
  targetStatus: string;
  targetAction: string;
  installMonAgent: string;
  configureCloudAdaptiveNetwork: string;
  label: Label;
  systemLabel: string;
  systemMessage: string;
  description: string;
  vm: IVm[]; // tb-0.12.9: cb-tumblebug 응답은 node[]로 옴 → store 경계에서 vm으로 어댑트
  node?: IVm[]; // cb-tumblebug v0.12.19 원응답 필드(infra[].node[])
  newVmList: any; // Assuming newVmList can be any type
}

export interface IRunLoadTestRequest {
  agentHostname: string;
  collectAdditionalSystemMetrics: boolean;
  httpReqs: Array<{
    bodyData: string;
    hostname: string;
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    port: string;
    protocol: 'http' | 'https';
  }>;
  installLoadGenerator: {
    installLocation: 'local' | 'remote';
  };
  nsId: string;
  mciId: string;
  vmId: string;
  testName: string;
  virtualUsers: string;
  duration: string;
  rampUpTime: string;
  rampUpSteps: string;
}

interface LoadGeneratorServer {
  additionalVmKey: string;
  createdAt: string;
  csp: string;
  id: number;
  label: string;
  lat: string;
  lon: string;
  machineType: string;
  privateIp: string;
  publicIp: string;
  region: string;
  sshPort: string;
  startTime: string;
  status: string;
  updatedAt: string;
  username: string;
  vmId: string;
  zone: string;
}

interface LoadGeneratorInstallInfo {
  createdAt: string;
  id: number;
  installLocation: string;
  installPath: string;
  installType: string;
  installVersion: string;
  loadGeneratorServers: LoadGeneratorServer[];
  privateKeyName: string;
  publicKeyName: string;
  status: string;
  updatedAt: string;
}

// 부하테스트 실행 단계(cm-ant FR-MA2-PERF-007-08 steps[]).
// name: generator_install·agent_install·jmx_prepare·jmeter_run·result_fetch
// status: pending·running·ok·failed·skipped
export interface ILoadTestExecutionStep {
  seq?: number;
  name: string;
  status: string;
  startAt?: string;
  finishAt?: string;
  message?: string;
  detail?: string;
}

export interface ILastloadtestStateResponse {
  compileDuration: string;
  createdAt: string;
  executionDuration: string;
  executionStatus: string;
  id: number;
  loadGeneratorInstallInfo: LoadGeneratorInstallInfo;
  loadTestKey: string;
  startAt: string;
  finishAt?: string;
  totalExpectedExecutionSecond: number;
  updatedAt: string;
  // cm-ant v0.5.3+ 세분화 상태(FR-007-08). 구버전이면 없음.
  failureMessage?: string;
  steps?: ILoadTestExecutionStep[];
}
