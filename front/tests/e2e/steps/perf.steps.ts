import { createBdd } from 'playwright-bdd';
import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { scenarioState } from '../support/world';
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
    const node = (infra.node ?? infra.Node ?? [])[0] ?? {};
    nodeId = node.id ?? node.Id ?? nodeId;
    // cm-beetle GetInfra 노드의 공인 IP 키는 publicIP(대문자 IP). 소문자 변형도 안전하게 fallback.
    const ip = node.publicIP ?? node.publicIp ?? node.PublicIp ?? node.public_ip ?? '';
    if (ip) return { nodeId, ip };
    await new Promise(r => setTimeout(r, 10_000));
  }
  return { nodeId, ip: '' };
}

/** "그리고 생성된 워크로드에 nginx를 설치한다" — cb-tumblebug 원격명령으로 nginx 설치 */
Given('생성된 워크로드에 nginx를 설치한다', async ({ request }) => {
  const token = await loginToken(request);
  const { nodeId, ip } = await fetchNodePublicIp(request, token);
  scenarioState.nodeId = nodeId;
  scenarioState.nodePublicIp = ip;

  const nsId = testNamespace.id;
  const infraId = scenarioState.infraId ?? workload.infraName;
  const res = await request.post(`${config.baseURL}/api/PostCmdInfra`, {
    headers: { Authorization: `Bearer ${token}` },
    // 원격명령(apt update + nginx 설치)은 수십 초~수 분 걸리므로 기본 30s로는 부족 → 넉넉히.
    timeout: 300_000,
    data: {
      pathParams: { nsId, infraId },
      request: {
        command: [
          'sudo apt-get update -y',
          'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx',
          'sudo systemctl enable --now nginx',
        ],
      },
    },
  });
  expect(res.ok(), `nginx 설치(PostCmdInfra) 요청 실패: ${res.status()}`).toBeTruthy();
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
});

/** "그러면 부하 테스트 결과가 조회된다" */
Then('부하 테스트 결과가 조회된다', async ({ page }) => {
  const { WorkloadPage } = await import('../pages/workload.page');
  const wl = new WorkloadPage(page);
  await wl.expectLoadTestResult();
});
