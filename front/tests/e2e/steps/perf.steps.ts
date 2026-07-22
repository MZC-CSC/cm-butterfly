import { createBdd } from 'playwright-bdd';
import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { scenarioState } from '../support/world';
import {
  startLoadTestTiming,
  watchLoadTest,
  reportLoadTestTiming,
  LoadTestTiming,
} from '../support/loadTestTiming';
import {
  config,
  testNamespace,
  workload,
  getUser,
} from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * Performance verification (load test) preparation and execution steps.
 *
 * ★ Background: an EC2 instance created by cm-butterfly has nothing installed on it.
 *   A load test requires a web server (nginx) running on the target, so
 *   (unless the flow installs it via SW migration) we install nginx via a cb-tumblebug remote command (PostCmdInfra),
 *   confirm external access, then run the cm-ant load test (web Load Config UI = POST /load/tests/run).
 *
 * nginx install and access check have no matching screen in the butterfly UI, so they are done via API as *test preconditions* (remote command API).
 * The load test itself proceeds through the UI (Load Config), following the user flow.
 */

async function loginToken(request: APIRequestContext): Promise<string> {
  const u = getUser('cmiguser');
  const res = await request.post(`${config.baseURL}/api/auth/login`, {
    data: { request: { id: u.id, password: u.password } },
  });
  const body = await res.json();
  return body?.responseData?.access_token ?? body?.access_token ?? '';
}

/**
 * Fetch the public IP of the created infrastructure's first node (via cm-beetle/GetInfra).
 * Right after migration the node is Creating, so the public IP may still be empty; poll until it's
 * filled (up to ~5 minutes). Once there's an IP, the node is considered ready for SSH/remote commands.
 */
async function fetchNodePublicIp(
  request: APIRequestContext,
  token: string,
): Promise<{ nodeId: string; ip: string }> {
  const nsId = testNamespace.id;
  const infraId = scenarioState.infraId ?? workload.infraName;
  let nodeId = '';
  for (let i = 0; i < 30; i++) {
    const res = await request.post(`${config.baseURL}/api/cm-beetle/GetInfra`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { pathParams: { nsId, infraId } },
    });
    const body = await res.json().catch(() => ({}));
    const infra = body?.responseData?.data ?? body?.responseData ?? {};
    const node = (infra.node ?? [])[0] ?? {};
    nodeId = node.id ?? nodeId;
    // A remote command must go out as the account the node actually uses. A tumblebug-created node's account is `cb-user`,
    // which differs from the source server's SSH account (ubuntu) — using that directly would fail to connect the command.
    scenarioState.nodeUserName =
      node.nodeUserName ?? scenarioState.nodeUserName;
    scenarioState.securityGroupIds =
      node.securityGroupIds ?? scenarioState.securityGroupIds;
    const ip = node.publicIP ?? '';
    if (ip) return { nodeId, ip };
    await new Promise(r => setTimeout(r, 10_000));
  }
  return { nodeId, ip: '' };
}

/**
 * Open port 80 on the workload's security group.
 *
 * The security group of the migration-created infrastructure follows *what was collected from the source server*. If the
 * source has no web server, 80 isn't open, and then even after bringing up nginx you can't reach it externally to load test.
 * If it's already open, tumblebug rejects it, but that's not an error — it means "already done", so it's ignored.
 */
async function openHttpPort(
  request: APIRequestContext,
  token: string,
  nsId: string,
  infraId: string,
): Promise<void> {
  const sgIds: string[] = scenarioState.securityGroupIds ?? [];

  for (const sgId of sgIds) {
    const r = await request.post(
      `${config.baseURL}/api/cb-tumblebug/PostFirewallRules`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120_000,
        data: {
          pathParams: { nsId, securityGroupId: sgId },
          request: {
            firewallRules: [
              {
                protocol: 'TCP',
                ports: '80',
                direction: 'inbound',
                cidr: '0.0.0.0/0',
              },
            ],
          },
        },
      },
    );
    console.log(`[perf] opened port 80 on security group ${sgId} → ${r.status()}`);
  }
  if (sgIds.length === 0) {
    console.warn(
      "[perf] couldn't find the node's security group id — proceeding on the hope that 80 is already open.",
    );
  }
}

/**
 * "And open port 80 of the created workload"
 *
 * The migration-created security group follows *what was collected from the source server*. If the source's inbound
 * has no 80, the target doesn't either, and then even with the software (nginx) up you can't reach it externally to load test.
 *
 * The console has no screen for editing security group rules, so this step alone is done via API (a test precondition).
 * The node's public IP is also obtained here for later steps (external access check, load target) to use.
 */
Given('생성된 워크로드의 80 포트를 개방한다', async ({ request }) => {
  const token = await loginToken(request);
  const { nodeId, ip } = await fetchNodePublicIp(request, token);
  scenarioState.nodeId = nodeId;
  scenarioState.nodePublicIp = ip;

  expect(
    ip,
    '노드 공인 IP를 확인하지 못했다 — 인프라 생성이 끝나지 않았을 수 있다',
  ).toBeTruthy();

  await openHttpPort(
    request,
    token,
    testNamespace.id,
    scenarioState.infraId ?? workload.infraName,
  );
});

/** Run a command on the target node and return *stdout only* (the response also carries the command text, so don't match on that) */
async function nodeStdout(
  request: APIRequestContext,
  token: string,
  command: string[],
): Promise<string> {
  const res = await request.post(
    `${config.baseURL}/api/cb-tumblebug/PostCmdInfra`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 300_000,
      data: {
        pathParams: {
          nsId: testNamespace.id,
          infraId: scenarioState.infraId ?? workload.infraName,
        },
        request: { userName: scenarioState.nodeUserName ?? 'cb-user', command },
      },
    },
  );
  const results =
    (await res.json().catch(() => null))?.responseData?.results ?? [];
  return results
    .map((r: any) => Object.values(r?.stdout ?? {}).join('\n'))
    .join('\n');
}

/**
 * "And prepare the web server for the load test"
 *
 * A load test only holds up with a web server present. The original intent is to use **the nginx brought up by the
 * software migration** directly as the target, and if that worked, do nothing.
 *
 * If it didn't, bring up nginx here to continue the load test. But **don't hide what happened** —
 * whether the migration brought it up or we prepared it is recorded as-is in the log and report. The migration's
 * success or failure was already judged separately by the earlier result-check step, so this preparation step doesn't override that verdict.
 */
Given('부하테스트 대상 웹서버를 준비한다', async ({ request, $testInfo }) => {
  test.setTimeout(15 * 60_000);
  const token = await loginToken(request);

  const running = (out: string) => /^\s*active\s*$/m.test(out);
  let out = await nodeStdout(request, token, [
    'systemctl is-active nginx || true',
  ]);

  if (running(out)) {
    scenarioState.nginxFromMigration = true;
    console.log(
      '[perf] nginx is already running — use what the software migration brought up as-is.',
    );
  } else {
    scenarioState.nginxFromMigration = false;
    console.warn(
      `[perf] ★ the software migration failed to bring up nginx (systemctl is-active → ${out.trim() || 'none'}). ` +
        'The test installs it directly to continue the load test. The migration success/failure was already judged in an earlier step.',
    );
    await nodeStdout(request, token, [
      'sudo apt-get update -y',
      'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --reinstall nginx',
      'sudo systemctl enable --now nginx',
    ]);
    out = await nodeStdout(request, token, [
      'systemctl is-active nginx || true',
    ]);
  }

  await $testInfo.attach('부하테스트-대상-웹서버', {
    body:
      `# 부하테스트 대상 웹서버\n\n` +
      `- nginx 출처: **${scenarioState.nginxFromMigration ? '소프트웨어 마이그레이션' : '테스트가 직접 설치(마이그레이션 실패)'}**\n` +
      `- systemctl is-active nginx → \`${out.trim() || '없음'}\`\n`,
    contentType: 'text/markdown',
  });

  expect(
    running(out),
    `부하테스트 대상 nginx를 띄우지 못했다: ${out.trim() || '응답 없음'}`,
  ).toBeTruthy();
});

/**
 * "Then nginx is accessible from outside" — check access to the node's public IP:80
 */
Then('nginx가 외부에서 접근 가능하다', async ({ request }) => {
  const ip = scenarioState.nodePublicIp;
  expect(
    ip,
    '노드 공인 IP를 확인하지 못함(인프라 생성/조회 확인 필요)',
  ).toBeTruthy();
  // service startup and security group propagation take time, so retry
  let ok = false;
  for (let i = 0; i < 12 && !ok; i++) {
    try {
      const r = await request.get(`http://${ip}:80/`, { timeout: 8000 });
      ok = r.status() < 500;
    } catch {
      /* retry */
    }
    if (!ok) await new Promise(r => setTimeout(r, 10_000));
  }
  expect(ok, `nginx 외부 접근 실패: http://${ip}:80`).toBeTruthy();
});

/**
 * "And run a load test on the created workload" — run the load test (Load Config) from the workload screen.
 * The target host is the node public IP where nginx was just brought up. Cost protection: test-data.workload.loadTest (a short, light config).
 * (The cm-ant POST /load/tests/run that the Load Config UI calls is the thing under verification)
 */
When('생성된 워크로드에 부하 테스트를 실행한다', async ({ page }) => {
  const { WorkloadPage } = await import('../pages/workload.page');
  const wl = new WorkloadPage(page);
  const targetHost = scenarioState.nodePublicIp ?? workload.loadTest.targetHost;

  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(scenarioState.infraName ?? workload.infraName);
  await wl.openServerTab();
  await wl.selectNode(workload.nodeName);
  // open the Load Config modal, configure load against the nginx server (host:80), then run
  await wl.runLoadTest({
    scenarioName: workload.loadTest.scenarioName,
    targetHost,
    port: workload.loadTest.port,
    path: workload.loadTest.path,
    virtualUsers: workload.loadTest.virtualUsers,
    duration: workload.loadTest.duration,
    rampUpTime: workload.loadTest.rampUpTime,
    rampUpSteps: workload.loadTest.rampUpSteps,
  });

  // ★ start timing from here — the load-generator VM creation and JMeter install come before this and aren't included.
  //   what we want to measure is "from starting to apply load until the result (CSV) is complete".
  loadTiming = startLoadTestTiming();
});

/** this scenario's load-test elapsed time (passed from the run step to the result-check step) */
let loadTiming: LoadTestTiming | undefined;

/**
 * "Then the load test result is retrieved"
 *
 * *Separately* from watching whether the result shows on screen, also watch the cm-ant execution status.
 * This is because when the result doesn't appear, we must distinguish (a) whether it isn't finished yet from
 * (b) whether it finished but the console can't render it.
 * The elapsed time is attached to the report — it occasionally takes very long, so we keep the number.
 */
Then('부하 테스트 결과가 조회된다', async ({ page, request, $testInfo }) => {
  test.setTimeout(20 * 60_000);
  const { WorkloadPage } = await import('../pages/workload.page');
  const wl = new WorkloadPage(page);

  const timing = loadTiming ?? startLoadTestTiming();
  const token = await loginToken(request);

  // run the cm-ant execution-status watch and the screen check in parallel.
  const watching = watchLoadTest(request, token, timing).catch(() => {});

  try {
    await wl.expectLoadTestResult(
      scenarioState.infraName ?? workload.infraName,
      workload.nodeName,
    );
    timing.visibleAtSec = Math.round((Date.now() - timing.submittedAt) / 1000);
  } finally {
    await watching;
    await reportLoadTestTiming(
      $testInfo,
      timing,
      Number(workload.loadTest.duration),
    );
  }
});
