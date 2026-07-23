/**
 * Test data and settings — accounts, namespaces, specs, etc. managed in one place.
 * Sensitive/environment-dependent values are overridden via environment variables.
 */

/**
 * Assemble the target server baseURL from environment variables.
 *
 * Priority:
 *  1) If `BASE_URL` is set, use it as-is (a full override with protocol, host, and port).
 *  2) Otherwise assemble from `E2E_PROTOCOL` (default http), `E2E_HOST` (default localhost),
 *     and `E2E_PORT` (optional). To change just the port, set e.g. `E2E_PORT=8080`. Without a
 *     port it uses the protocol's default port (80/443).
 *
 * Examples:
 *   BASE_URL=https://cmig.dev.cscmzc.com   → used as-is
 *   E2E_PORT=8080                          → http://localhost:8080
 *   E2E_HOST=10.0.0.5 E2E_PORT=80          → http://10.0.0.5:80
 */
function resolveBaseURL(): string {
  const explicit = process.env.BASE_URL;
  if (explicit && explicit.trim() !== '') return explicit;

  const protocol = process.env.E2E_PROTOCOL || 'http';
  const host = process.env.E2E_HOST || 'localhost';
  const port = process.env.E2E_PORT;
  return port && port.trim() !== ''
    ? `${protocol}://${host}:${port}`
    : `${protocol}://${host}`;
}

export const config = {
  /**
   * Target server. Defaults to local nginx (http://localhost). For deployment
   * verification, point `BASE_URL` at the cm-mayfly-launched infra server address,
   * or to change just the port use `E2E_PORT` (+`E2E_HOST`/`E2E_PROTOCOL`).
   */
  baseURL: resolveBaseURL(),
};

/** Login accounts (id → credentials). Default cmiguser */
export const users: Record<string, { id: string; password: string }> = {
  cmiguser: {
    id: process.env.TEST_USERNAME || 'cmiguser',
    password: process.env.TEST_PASSWORD || 'cmiguserPassword!',
  },
};

/** Namespace (workspace) */
/**
 * Namespace — must use the *same* value as the console.
 *
 * Infra created by migration goes into cb-tumblebug's `mig01` ("Default namespace for computing
 * infra migration"). The console also uses DEFAULT_NAMESPACE = 'mig01' from
 * `shared/constants/namespace.ts`.
 *
 * This used to be left at 'default' here only. As a result, querying workloads always looked empty,
 * and remote commands (PostCmdInfra) failed with "no such infra in that ns". What the console saw
 * and what the test saw were different.
 */
export const testNamespace = {
  id: process.env.TEST_NS || 'mig01',
};

/**
 * Source server (a small EC2 standing in for on-prem) — used by @seed·@scenario as a collection target.
 *
 * ★ It must be a server that SSH actually connects to.
 *   cm-honeybee SSHes directly to this address to collect infra and software (agentless). With a
 *   dummy IP, collection eventually fails and everything downstream (source model, recommendation,
 *   workflow) collapses with no data.
 *   The recommended spec follows the source spec, so create it as a small instance (nano/micro/small).
 *
 *   TEST_SOURCE_IP / TEST_SOURCE_PRIVATE_KEY must be injected.
 */
export const sourceServer = {
  name: process.env.TEST_SOURCE_NAME || 'e2e-nano-source',
  ip: process.env.TEST_SOURCE_IP || '',
  privateIp: process.env.TEST_SOURCE_PRIVATE_IP || '',
  sshPort: process.env.TEST_SOURCE_SSH_PORT || '22',
  sshUser: process.env.TEST_SOURCE_SSH_USER || 'ubuntu',
  // The connection-info form requires a password or privateKey to register. @unit defaults to a dummy password.
  password: process.env.TEST_SOURCE_PASSWORD || 'e2e-dummy-pass',
  privateKey: process.env.TEST_SOURCE_PRIVATE_KEY || '',
};

/** Target recommendation — force low cost (nano/small class) */
export const targetSpec = {
  csp: process.env.TEST_TARGET_CSP || 'aws',
  region: process.env.TEST_TARGET_REGION || 'ap-northeast-2',
  /**
   * Force the recommendation result to this class or below (charge protection). Picks the
   * *largest candidate within that upper bound*.
   *
   * Going down to micro class makes software migration never finish due to CPU saturation
   * (measured: 11 of 39 in 40 minutes), so you can't see the very thing you meant to check —
   * "does migration work". Keep the upper bound, but give some room within it.
   */
  maxClass: process.env.TEST_TARGET_MAX_CLASS || 'medium',
};

/**
 * Workload (infra / load test) data.
 * ★ Updated: identifiers are infraId/nodeId (formerly mciId/vmId), lookups go via cm-beetle
 *   (ListInfra), and load tests use cm-ant (Runloadtest). Matches the infra name the migration
 *   scenario creates.
 */
export const workload = {
  /** Name of the infra (MCI) the migration scenario creates — the target to check in the workload list */
  // Name of the target infra (MCI) that cm-beetle migration creates. The recommendation response's
  // targetInfra.name defaults to 'infra101' and nameSeed (prefix) is left empty, so the created MCI
  // name = 'infra101'.
  infraName: process.env.TEST_INFRA_NAME || 'infra101',
  /** Node (VM) name within the infra */
  nodeName: process.env.TEST_NODE_NAME || 'e2e-target-node',
  /** Load test default settings (cost protection: short and light) */
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
  /** Scenario template (catalog) name */
  scenarioTemplateName: process.env.TEST_SCENARIO_TEMPLATE || 'e2e-template',
};

/**
 * Workflow (cm-cicada) data.
 * cm-cicada defines a TaskComponent with a type/spec schema.
 * 5 task types: http · http_xcom · bash · ssh · trigger_workflow.
 */
export const workflowData = {
  /** The 5 task types in cm-cicada's new schema (for create/palette verification) */
  taskTypes: ['http', 'http_xcom', 'bash', 'ssh', 'trigger_workflow'] as const,

  /**
   * Name of the "charge-safe" workflow used by the run unit test.
   * It must be an example workflow (bash echo, etc.) that provisions no real cloud infra.
   * Migration workflows (beetle_task_infra_migration, etc.) create EC2, so @unit must not run them.
   */
  safeRunWorkflowName:
    process.env.TEST_WF_SAFE_RUN || 'e2e-sample-bash-workflow',

  /**
   * Name of the *template* used to create the charge-safe example workflow.
   * It's an example template cm-cicada ships by default, so it creates no real infra.
   */
  safeRunTemplateName:
    process.env.TEST_WF_SAFE_TEMPLATE || '_v2_example_xcom_workflow',

  /**
   * Task component name of the infra migration workflow.
   * On the designer canvas, this name is used to target the step and open the edit panel
   * (the library attaches an `sqd-type-{name}` class).
   */
  infraMigrationTask:
    process.env.TEST_WF_INFRA_TASK || 'beetle_task_infra_migration',

  /** Name of the infra template auto-selected when creating the migration workflow */
  infraTemplateName:
    process.env.TEST_WF_INFRA_TEMPLATE || 'migrate_infra_workflow',

  /** Software migration workflow template name */
  softwareTemplateName:
    process.env.TEST_WF_SW_TEMPLATE || 'migrate_software_workflow',

  /**
   * Task component name of the software migration workflow.
   *
   * Unlike infra migration, this task **takes which infra to install onto as query parameters**
   * (`nsId`·`infraId`, both required). That is, infra migration must have finished first, and the
   * id of the resulting infra must be filled into the workflow tool for it to run.
   */
  softwareMigrationTask:
    process.env.TEST_WF_SW_TASK || 'grasshopper_task_software_migration',

  /** Name of the workflow the create unit test will make (the suffix is assigned in the step) */
  createNamePrefix: process.env.TEST_WF_CREATE_PREFIX || 'e2e-wf',

  /** Terminal states for run-status polling (success/failure) */
  terminalStates: ['success', 'failed'] as const,

  /** Max wait for run-status polling (ms). Generous, based on the example workflow. */
  runPollTimeoutMs: Number(process.env.TEST_WF_RUN_TIMEOUT || 120_000),
};

/**
 * CSP Credential — input for cb-spider Register-Credential.
 * The current registration modal is AWS-only (access/secret key), so provider is AWS-based.
 * Real keys are injected via env only (no sensitive data in code).
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
 * CSP credential helper. The argument is a CSP key ("aws") or a credential name.
 * If not in the fixture, the argument is used as the name as-is and the keys are filled from env.
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

/** VPC (vNet) — cb-tumblebug register/delete target */
export const vpc = {
  name: process.env.TEST_VPC_NAME || 'e2e-vpc',
};

/** Login account helper */
export function getUser(id: string) {
  return (
    users[id] ?? {
      id,
      password: process.env.TEST_PASSWORD || 'cmiguserPassword!',
    }
  );
}
