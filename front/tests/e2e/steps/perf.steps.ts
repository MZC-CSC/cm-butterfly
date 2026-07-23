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
import { waitLoadTestTerminal } from '../support/apiWait';

const { Given, When, Then } = createBdd(test);

/**
 * Performance verification (load test) preparation and execution steps.
 *
 * ★ Background: an EC2 instance created by cm-butterfly has nothing installed on it, and the load test
 *   does *not* depend on software migration — it only needs the migrated *infra* to exist. So the load-test
 *   prep installs its own nginx **on the target (migrated) infra** at test time via a cb-tumblebug remote
 *   command (PostCmdInfra), configures it to listen on the load-test port, opens that port on the target's
 *   security group, confirms external access, runs the cm-ant load test (web Load Config UI = POST /load/tests/run),
 *   then tears the nginx down again (test-scoped, nothing left running).
 *
 *   This is a deliberate change from an earlier design that relied on nginx being present on the *source*
 *   (sshtest) server and migrated over: nginx was removed from the source servers for security, and the
 *   load test must not hinge on whether software migration brought nginx up. If the migration happens to
 *   have installed nginx too, that is fine — but the authoritative load-test target is the nginx we install
 *   here on the configured port.
 *
 * nginx install/config, port open, access check and teardown have no matching screen in the butterfly UI,
 * so they are done via API as *test preconditions* (cb-tumblebug remote command + firewall-rule API).
 * The load test itself proceeds through the UI (Load Config), following the user flow.
 *
 * ── cb-tumblebug remote command (confirmed from api/conf/api.yaml operationId map) ──────────────────
 *   PostCmdInfra      → POST /tumblebug/ns/{nsId}/cmd/infra/{infraId}
 *                       body: { command: string[], userName?: string }   (userName = node account, cb-user)
 *   PostFirewallRules → POST /tumblebug/ns/{nsId}/resources/securityGroup/{securityGroupId}/rules
 *                       body: { firewallRules: [{ protocol, ports, direction, cidr }] }
 *   Both are reached through the portal proxy `${BASE_URL}/api/cb-tumblebug/{OperationId}` with a
 *   logged-in session token (see loginToken).
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Port the load-test nginx listens on / the target security group opens (default 5555 via TEST_LOADTEST_PORT). */
function loadTestPort(): number {
  const p = Number(workload.loadTest.port);
  return Number.isFinite(p) && p > 0 ? p : 5555;
}

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
 * Open the load-test port on the workload's security group.
 *
 * The security group of the migration-created infrastructure follows *what was collected from the source server*, so the
 * load-test port is almost never open by default. We open it here (test-scoped) so the target nginx we install can be
 * reached externally to load test. If it's already open, tumblebug rejects it, but that's not an error — it means
 * "already done", so it's ignored.
 */
async function openLoadTestPort(
  request: APIRequestContext,
  token: string,
  nsId: string,
  port: number,
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
                ports: String(port),
                direction: 'inbound',
                cidr: '0.0.0.0/0',
              },
            ],
          },
        },
      },
    );
    console.log(
      `[perf] opened port ${port} on security group ${sgId} → ${r.status()}`,
    );
  }
  if (sgIds.length === 0) {
    console.warn(
      `[perf] couldn't find the node's security group id — proceeding on the hope that ${port} is already open.`,
    );
  }
}

/**
 * "And open the load-test port of the created workload"
 *
 * The migration-created security group follows *what was collected from the source server*, so the load-test port
 * is not open. We open it (test-scoped) so the target nginx can be reached externally to load test.
 *
 * The console has no screen for editing security group rules, so this step alone is done via API (a test precondition).
 * The node's public IP is also obtained here for later steps (external access check, load target) to use.
 */
Given('생성된 워크로드의 부하테스트 포트를 개방한다', async ({ request }) => {
  const token = await loginToken(request);
  const { nodeId, ip } = await fetchNodePublicIp(request, token);
  scenarioState.nodeId = nodeId;
  scenarioState.nodePublicIp = ip;

  expect(
    ip,
    '노드 공인 IP를 확인하지 못했다 — 인프라 생성이 끝나지 않았을 수 있다',
  ).toBeTruthy();

  await openLoadTestPort(request, token, testNamespace.id, loadTestPort());
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

/** Marker path so the teardown knows exactly what this test dropped on the target. */
const E2E_NGINX_CONF = '/etc/nginx/conf.d/e2e-loadtest.conf';

/**
 * "And prepare the web server for the load test"
 *
 * The load test targets the migrated *infra* — it does not depend on software migration. So we install nginx **on the
 * target node** here (test-scoped) and configure it to listen on the load-test port, regardless of whether the software
 * migration brought its own nginx up on port 80. We still record whether nginx was already running (i.e. the migration
 * likely brought it up) for the report — but that verdict was already made separately in the earlier SW-result step and
 * this prep does not override it; here we only guarantee a load-test target on the configured port.
 *
 * Install + listener config go out as a single cb-tumblebug remote command (PostCmdInfra). The server block returns a
 * fixed 200 for any path, so the load test does not depend on a document root being populated.
 */
Given('부하테스트 대상 웹서버를 준비한다', async ({ request, $testInfo }) => {
  test.setTimeout(60 * 60_000); // inherit generous scenario budget (was test.setTimeout(15 * 60_000);, capped the whole test)
  const token = await loginToken(request);
  const port = loadTestPort();

  // Record whether nginx was already up before we touched it (migration likely brought it up on :80).
  const preState = await nodeStdout(request, token, [
    'systemctl is-active nginx || true',
  ]);
  scenarioState.nginxFromMigration = /^\s*active\s*$/m.test(preState);

  // Install nginx and drop a dedicated server block that listens on the load-test port and returns 200 for any path.
  // (Single-quoted heredoc → the config is written literally; no shell/`$` expansion, so no escaping traps.)
  const nginxConf = [
    `server {`,
    `    listen ${port};`,
    `    location / { return 200 'cm-butterfly-e2e-loadtest'; }`,
    `}`,
  ].join('\n');

  await nodeStdout(request, token, [
    'sudo apt-get update -y',
    'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx',
    `sudo tee ${E2E_NGINX_CONF} > /dev/null <<'NGINXCONF'\n${nginxConf}\nNGINXCONF`,
    'sudo nginx -t',
    'sudo systemctl enable --now nginx',
    'sudo systemctl restart nginx',
  ]);

  // Verify locally on the node that the port answers (avoids blaming the security group for an nginx problem).
  const active = await nodeStdout(request, token, [
    'systemctl is-active nginx || true',
  ]);
  const localCode = await nodeStdout(request, token, [
    `curl -s -o /dev/null -w '%{http_code}' http://localhost:${port}/ || true`,
  ]);
  const localOk = /2\d\d|3\d\d/.test(localCode);

  await $testInfo.attach('부하테스트-대상-웹서버', {
    body:
      `# 부하테스트 대상 웹서버 (타깃 인프라)\n\n` +
      `- 대상 포트: **${port}**\n` +
      `- nginx 이미 실행 중이었나(마이그레이션 설치 추정): **${scenarioState.nginxFromMigration ? '예' : '아니오'}**\n` +
      `- systemctl is-active nginx → \`${active.trim() || '없음'}\`\n` +
      `- http://localhost:${port}/ → \`${localCode.trim() || '없음'}\`\n` +
      `- nginx 출처: 테스트가 타깃 인프라에 직접 설치(부하테스트 전용, 테스트 후 정리)\n`,
    contentType: 'text/markdown',
  });

  expect(
    /^\s*active\s*$/m.test(active) && localOk,
    `부하테스트 대상 nginx를 포트 ${port}로 띄우지 못했다: is-active=${active.trim() || '응답 없음'}, http=${localCode.trim() || '응답 없음'}`,
  ).toBeTruthy();
});

/**
 * "Then nginx is accessible from outside" — check access to the node's public IP on the load-test port.
 */
Then('nginx가 외부에서 접근 가능하다', async ({ request }) => {
  const ip = scenarioState.nodePublicIp;
  const port = loadTestPort();
  expect(
    ip,
    '노드 공인 IP를 확인하지 못함(인프라 생성/조회 확인 필요)',
  ).toBeTruthy();
  // service startup and security group propagation take time, so retry
  let ok = false;
  for (let i = 0; i < 12 && !ok; i++) {
    try {
      const r = await request.get(`http://${ip}:${port}/`, { timeout: 8000 });
      ok = r.status() < 500;
    } catch {
      /* retry */
    }
    if (!ok) await new Promise(r => setTimeout(r, 10_000));
  }
  expect(ok, `nginx 외부 접근 실패: http://${ip}:${port}`).toBeTruthy();
});

/**
 * "And clean up the load-test target web server"
 *
 * The nginx we installed on the target is test-scoped — remove it after the load test so nothing is left running.
 * (The whole target infra is deleted later by "생성된 리소스를 정리한다"; this is an extra, principled teardown for the
 * case the infra is kept for inspection.) Best-effort: never fail the scenario on teardown.
 *
 * Note: the security-group rule opened above is *not* removed here — the firewall API only adds rules, and the SG is
 * destroyed with the infra at final cleanup. If you keep the infra, the opened port stays open until the infra is deleted.
 */
Given('부하테스트 대상 웹서버를 정리한다', async ({ request }) => {
  test.setTimeout(60 * 60_000); // inherit generous scenario budget (was test.setTimeout(5 * 60_000);, capped the whole test)
  try {
    const token = await loginToken(request);
    await nodeStdout(request, token, [
      `sudo rm -f ${E2E_NGINX_CONF}`,
      'sudo systemctl stop nginx || true',
      'sudo systemctl disable nginx || true',
    ]);
    console.log('[perf] load-test nginx removed from the target node.');
  } catch (e) {
    console.warn(
      '[perf] ★ failed to tear down the load-test nginx (target infra is deleted at final cleanup anyway):',
      (e as Error).message,
    );
  }
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
  test.setTimeout(60 * 60_000); // inherit generous scenario budget (was test.setTimeout(20 * 60_000);, capped the whole test)
  const { WorkloadPage } = await import('../pages/workload.page');
  const wl = new WorkloadPage(page);

  const timing = loadTiming ?? startLoadTestTiming();
  const token = await loginToken(request);

  // run the cm-ant execution-status watch and the screen check in parallel.
  const watching = watchLoadTest(request, token, timing).catch(() => {});

  try {
    // ★ Settle on cm-ant's result API first, then verify the screen — the screen is not the thing
    //   being polled for completion. Poll Getlastloadtestexecutionstate (the same endpoint the VM
    //   screen uses) for this node until successed/test_failed, so expectLoadTestResult below is
    //   confirming an already-finished run. Best-effort: if the nodeId is unknown, skip and let the
    //   screen wait stand.
    const nodeId = scenarioState.nodeId;
    if (nodeId) {
      const settle = await waitLoadTestTerminal({
        request,
        token,
        nsId: testNamespace.id,
        infraId: scenarioState.infraId ?? workload.infraName,
        nodeId,
        timeoutMs: 15 * 60_000,
      });
      console.log(
        `[apiWait] load test on node ${nodeId} → status=${settle.status || 'unknown'} terminal=${settle.terminal}`,
      );
    } else {
      console.warn(
        '[apiWait] no nodeId for load-test status poll; relying on the screen wait.',
      );
    }

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
