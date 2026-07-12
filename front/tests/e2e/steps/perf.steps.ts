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
import { config, testNamespace, workload, getUser } from '../fixtures/test-data';

const { Given, When, Then } = createBdd(test);

/**
 * 성능 검증(부하테스트) 준비·실행 스텝.
 *
 * ★ 배경: cm-butterfly가 생성한 EC2에는 아무것도 설치돼 있지 않다.
 *   부하테스트를 하려면 대상 서버에 웹서버(nginx)가 떠 있어야 하므로,
 *   (SW 마이그레이션으로 설치하는 흐름이 아니면) cb-tumblebug 원격명령(PostCmdInfra)으로 nginx를 설치하고
 *   외부 접근을 확인한 뒤, cm-ant 부하테스트(웹 Load Config UI = POST /load/tests/run)를 실행한다.
 *
 * nginx 설치·접근확인은 butterfly UI에 대응 화면이 없어 *테스트 전제조건*으로 API로 수행한다(원격명령 API).
 * 부하테스트 자체는 사용자 흐름대로 UI(Load Config)로 진행한다.
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
 * 생성된 인프라의 첫 노드 공인 IP 조회 (cm-beetle/GetInfra 경유).
 * 마이그레이션 직후 노드가 Creating이라 공인 IP가 아직 비어 있을 수 있으므로,
 * 채워질 때까지 폴링한다(최대 ~5분). IP가 있으면 SSH·원격명령이 가능한 상태로 본다.
 */
async function fetchNodePublicIp(request: APIRequestContext, token: string): Promise<{ nodeId: string; ip: string }> {
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
    // 원격명령은 노드가 실제로 쓰는 계정으로 나가야 한다. tumblebug이 만든 노드의 계정은 `cb-user`이며,
    // 소스 서버의 SSH 계정(ubuntu)과 다르다 — 그걸 그대로 쓰면 명령이 붙지 못한다.
    scenarioState.nodeUserName = node.nodeUserName ?? scenarioState.nodeUserName;
    scenarioState.securityGroupIds = node.securityGroupIds ?? scenarioState.securityGroupIds;
    const ip = node.publicIP ?? '';
    if (ip) return { nodeId, ip };
    await new Promise(r => setTimeout(r, 10_000));
  }
  return { nodeId, ip: '' };
}

/**
 * 워크로드의 보안그룹에 80 포트를 연다.
 *
 * 마이그레이션이 만든 인프라의 보안그룹은 *소스 서버에서 수집한 것*을 따라간다. 소스에 웹서버가 없으면
 * 80이 안 열려 있고, 그러면 nginx를 올려도 밖에서 못 붙어 부하테스트를 할 수 없다.
 * 이미 열려 있으면 tumblebug이 거부하는데, 그건 오류가 아니라 "이미 됨"이므로 무시한다.
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
              { protocol: 'TCP', ports: '80', direction: 'inbound', cidr: '0.0.0.0/0' },
            ],
          },
        },
      },
    );
    console.log(`[perf] 보안그룹 ${sgId} 80 포트 개방 → ${r.status()}`);
  }
  if (sgIds.length === 0) {
    console.warn('[perf] 노드의 보안그룹 id를 찾지 못했다 — 80이 이미 열려 있길 기대하고 진행한다.');
  }
}

/** "그리고 생성된 워크로드에 nginx를 설치한다" — 80 포트 개방 + cb-tumblebug 원격명령으로 nginx 설치 */
Given('생성된 워크로드에 nginx를 설치한다', async ({ request }) => {
  const token = await loginToken(request);
  const { nodeId, ip } = await fetchNodePublicIp(request, token);
  scenarioState.nodeId = nodeId;
  scenarioState.nodePublicIp = ip;

  const nsId = testNamespace.id;
  const infraId = scenarioState.infraId ?? workload.infraName;

  // 부하테스트를 하려면 밖에서 80으로 붙을 수 있어야 한다.
  await openHttpPort(request, token, nsId, infraId);
  // ★ 서비스 접두어 필수 — 접두어 없이 부르면 백엔드가 operationId를 못 찾아 404다(전역 검색 폴백 제거됨).
  const res = await request.post(`${config.baseURL}/api/cb-tumblebug/PostCmdInfra`, {
    headers: { Authorization: `Bearer ${token}` },
    // 원격명령(apt update + nginx 설치)은 수십 초~수 분 걸리므로 기본 30s로는 부족 → 넉넉히.
    timeout: 300_000,
    data: {
      pathParams: { nsId, infraId },
      request: {
        // cb-tumblebug MciCmdReq — command 목록과 접속 계정.
        // 계정은 GetInfra가 알려준 노드 계정(cb-user)을 쓴다. 소스 서버 계정(ubuntu)이 아니다.
        userName: scenarioState.nodeUserName ?? 'cb-user',
        command: [
          'sudo apt-get update -y',
          'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx',
          'sudo systemctl enable --now nginx',
        ],
      },
    },
  });
  // 실패하면 *왜* 실패했는지 본문을 그대로 남긴다. 상태코드만으로는 원인을 알 수 없다.
  const bodyText = res.ok() ? '' : (await res.text()).slice(0, 400);
  expect(
    res.ok(),
    `nginx 설치(cb-tumblebug/PostCmdInfra) 요청 실패: ${res.status()}\n응답: ${bodyText}`,
  ).toBeTruthy();
});

/** "그러면 nginx가 외부에서 접근 가능하다" — 노드 공인 IP:80 접근 확인 */
Then('nginx가 외부에서 접근 가능하다', async ({ request }) => {
  const ip = scenarioState.nodePublicIp;
  expect(ip, '노드 공인 IP를 확인하지 못함(인프라 생성/조회 확인 필요)').toBeTruthy();
  // 원격명령 반영에 시간이 걸리므로 재시도
  let ok = false;
  for (let i = 0; i < 12 && !ok; i++) {
    try {
      const r = await request.get(`http://${ip}:80/`, { timeout: 8000 });
      ok = r.status() < 500;
    } catch { /* 재시도 */ }
    if (!ok) await new Promise(r => setTimeout(r, 10_000));
  }
  expect(ok, `nginx 외부 접근 실패: http://${ip}:80`).toBeTruthy();
});

/**
 * "그리고 생성된 워크로드에 부하 테스트를 실행한다" — 워크로드 화면에서 부하테스트(Load Config) 실행.
 * 대상 호스트는 방금 nginx를 올린 노드 공인 IP. 비용 보호: test-data.workload.loadTest(짧고 가벼운 설정).
 * (Load Config UI가 호출하는 cm-ant POST /load/tests/run 이 곧 검증 대상)
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
  // Load Config 모달을 열어 nginx 서버(host:80)로 부하 설정 후 실행
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

  // ★ 여기서부터 시간을 잰다 — 부하발생기 VM 생성·JMeter 설치는 이 앞이라 포함되지 않는다.
  //   재고 싶은 건 "부하를 걸기 시작해 결과(CSV)가 완성될 때까지"다.
  loadTiming = startLoadTestTiming();
});

/** 이번 시나리오의 부하테스트 소요시간 (실행 스텝 → 결과 조회 스텝으로 넘긴다) */
let loadTiming: LoadTestTiming | undefined;

/**
 * "그러면 부하 테스트 결과가 조회된다"
 *
 * 화면에 결과가 뜨는지 보는 것과 *별개로*, cm-ant 쪽 실행 상태도 함께 지켜본다.
 * 결과가 안 보일 때 (a) 아직 안 끝난 건지 (b) 끝났는데 콘솔이 못 그리는 건지 갈라야 하기 때문이다.
 * 소요시간은 리포트에 붙는다 — 가끔 아주 오래 걸리는 일이 있어 숫자로 남겨 둔다.
 */
Then('부하 테스트 결과가 조회된다', async ({ page, request, $testInfo }) => {
  test.setTimeout(20 * 60_000);
  const { WorkloadPage } = await import('../pages/workload.page');
  const wl = new WorkloadPage(page);

  const timing = loadTiming ?? startLoadTestTiming();
  const token = await loginToken(request);

  // cm-ant 실행 상태 감시와 화면 확인을 나란히 돌린다.
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
