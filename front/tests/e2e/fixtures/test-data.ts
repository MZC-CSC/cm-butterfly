/**
 * 테스트 데이터·설정 — 계정·네임스페이스·스펙 등을 한곳에서 관리.
 * 민감정보/환경 의존값은 환경변수로 오버라이드.
 */

export const config = {
  /** 대상 서버. 기본은 로컬 nginx. 배포 검증은 BASE_URL로 cm-mayfly 기동 인프라 서버 주소를 지정. */
  baseURL: process.env.BASE_URL || 'http://localhost',
};

/** 로그인 계정 (id → 자격증명). 기본 cmiguser */
export const users: Record<string, { id: string; password: string }> = {
  cmiguser: {
    id: process.env.TEST_USERNAME || 'cmiguser',
    password: process.env.TEST_PASSWORD || 'cmiguserPassword!',
  },
};

/** 네임스페이스(워크스페이스) */
export const testNamespace = {
  id: process.env.TEST_NS || 'default',
};

/** 소스 서버(온프렘 대체 nano EC2) — 마이그레이션 시나리오용 */
export const sourceServer = {
  name: process.env.TEST_SOURCE_NAME || 'e2e-nano-source',
  // @unit은 백엔드 mock이라 실제 접속 안 함 → 더미 기본값(문서용 TEST-NET-3). @scenario는 env로 실제값 주입.
  ip: process.env.TEST_SOURCE_IP || '203.0.113.10',
  privateIp: process.env.TEST_SOURCE_PRIVATE_IP || '',
  sshPort: process.env.TEST_SOURCE_SSH_PORT || '22',
  sshUser: process.env.TEST_SOURCE_SSH_USER || 'ubuntu',
  // 연결정보 폼은 password 또는 privateKey가 있어야 등록 가능. @unit 기본은 더미 password.
  password: process.env.TEST_SOURCE_PASSWORD || 'e2e-dummy-pass',
  privateKey: process.env.TEST_SOURCE_PRIVATE_KEY || '',
};

/** 타깃 추천 — 저비용(nano/small급) 강제 */
export const targetSpec = {
  csp: process.env.TEST_TARGET_CSP || 'aws',
  region: process.env.TEST_TARGET_REGION || 'ap-northeast-2',
  /** 추천 결과에서 이 급 이하로 강제(요금 보호) */
  maxClass: process.env.TEST_TARGET_MAX_CLASS || 'small',
};

/**
 * 워크로드(인프라/부하테스트) 데이터.
 * ★ 현행화: 식별자는 infraId/nodeId(구 mciId/vmId), 조회는 cm-beetle 경유(ListInfra),
 *   부하테스트는 cm-ant(Runloadtest). 마이그레이션 시나리오가 만든 인프라 이름과 맞춘다.
 */
export const workload = {
  /** 마이그레이션 시나리오가 생성하는 인프라(MCI) 이름 — 워크로드 목록에서 확인할 대상 */
  // cm-beetle 마이그레이션이 생성하는 타깃 인프라(MCI) 이름. 추천 응답 targetInfra.name 기본값이
  // 'infra101'이고 nameSeed(접두)는 비워두므로 생성 MCI 이름 = 'infra101'.
  infraName: process.env.TEST_INFRA_NAME || 'infra101',
  /** 인프라 내 노드(VM) 이름 */
  nodeName: process.env.TEST_NODE_NAME || 'e2e-target-node',
  /** 부하테스트 기본 설정(비용 보호: 짧고 가볍게) */
  loadTest: {
    scenarioName: process.env.TEST_LOADTEST_NAME || 'e2e-smoke-load',
    targetHost: process.env.TEST_LOADTEST_HOST || '127.0.0.1',
    port: process.env.TEST_LOADTEST_PORT || '80',
    path: process.env.TEST_LOADTEST_PATH || '/',
    virtualUsers: process.env.TEST_LOADTEST_VU || '1',
    duration: process.env.TEST_LOADTEST_DURATION || '10',
    rampUpTime: process.env.TEST_LOADTEST_RAMPUP_TIME || '1',
    rampUpSteps: process.env.TEST_LOADTEST_RAMPUP_STEPS || '1',
  },
  /** 시나리오 템플릿(카탈로그) 이름 */
  scenarioTemplateName: process.env.TEST_SCENARIO_TEMPLATE || 'e2e-template',
};

/**
 * 워크플로우(cm-cicada) 데이터.
 * cm-cicada는 TaskComponent를 type/spec 스키마로 정의한다.
 * 5개 task type: http · http_xcom · bash · ssh · trigger_workflow.
 */
export const workflowData = {
  /** cm-cicada 신 스키마의 5개 task type (생성/팔레트 검증용) */
  taskTypes: ['http', 'http_xcom', 'bash', 'ssh', 'trigger_workflow'] as const,

  /**
   * 실행(run) 유닛 테스트에 사용할 "요금 안전" 워크플로우 이름.
   * 실제 클라우드 인프라를 프로비저닝하지 않는 예제(bash echo 등) 워크플로우여야 한다.
   * 마이그레이션 워크플로우(beetle_task_infra_migration 등)는 EC2를 만들므로 @unit 실행 금지.
   */
  safeRunWorkflowName:
    process.env.TEST_WF_SAFE_RUN || 'e2e-sample-bash-workflow',

  /** 마이그레이션 워크플로우 생성 시 자동 선택되는 인프라 템플릿 이름 */
  infraTemplateName:
    process.env.TEST_WF_INFRA_TEMPLATE || 'migrate_infra_workflow',

  /** 생성 유닛 테스트에서 만들 워크플로우 이름(접미사는 스텝에서 부여) */
  createNamePrefix: process.env.TEST_WF_CREATE_PREFIX || 'e2e-wf',

  /** run 상태 폴링 종료 상태(성공/실패) */
  terminalStates: ['success', 'failed'] as const,

  /** run 상태 폴링 최대 대기(ms). 예제 워크플로우 기준 넉넉히. */
  runPollTimeoutMs: Number(process.env.TEST_WF_RUN_TIMEOUT || 120_000),
};

/**
 * CSP 자격증명(Credential) — cb-spider Register-Credential 입력값.
 * 현재 등록 모달은 AWS 전용(access/secret key)이라 provider는 AWS 기준.
 * 실제 키는 env로만 주입(민감정보 코드 미포함).
 */
export const credentials: Record<
  string,
  { name: string; provider: string; accessKey: string; secretKey: string }
> = {
  aws: {
    name: process.env.TEST_CRED_NAME || 'e2e-aws-cred',
    provider: 'AWS',
    accessKey: process.env.TEST_AWS_ACCESS_KEY || 'e2e-dummy-access-key',
    secretKey: process.env.TEST_AWS_SECRET_KEY || 'e2e-dummy-secret-key',
  },
};

/**
 * CSP 자격증명 헬퍼. 인자는 CSP 키("aws") 또는 자격증명 이름.
 * fixture에 없으면 인자를 그대로 이름으로 쓰고 키는 env에서 채운다.
 */
export function getCredential(key: string) {
  return (
    credentials[key?.toLowerCase()] ?? {
      name: key,
      provider: 'AWS',
      accessKey: process.env.TEST_AWS_ACCESS_KEY || 'e2e-dummy-access-key',
      secretKey: process.env.TEST_AWS_SECRET_KEY || 'e2e-dummy-secret-key',
    }
  );
}

/** VPC(vNet) — cb-tumblebug 등록/삭제 대상 */
export const vpc = {
  name: process.env.TEST_VPC_NAME || 'e2e-vpc',
};

/** 로그인 계정 헬퍼 */
export function getUser(id: string) {
  return users[id] ?? { id, password: process.env.TEST_PASSWORD || 'cmiguserPassword!' };
}
