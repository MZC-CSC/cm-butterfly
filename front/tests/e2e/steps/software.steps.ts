import { createBdd } from 'playwright-bdd';
import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { config, testNamespace, getUser } from '../fixtures/test-data';
import { scenarioState } from '../support/world';

const { Then } = createBdd(test);

/**
 * 소프트웨어 마이그레이션 검증 스텝.
 *
 * ★ 무엇을 증명해야 하나 — "워크플로우가 성공했다"가 아니라 **소스에 있던 소프트웨어가 타깃 서버에 실제로
 *   올라갔다** 는 것이다. 워크플로우 실행 이력만 보면, grasshopper가 아무것도 안 하고 성공을 반환해도
 *   통과해 버린다. 그래서 두 가지를 함께 본다.
 *
 *   1) cm-grasshopper 가 기록한 마이그레이션 상태가 *성공으로 종료* 됐는지
 *   2) 타깃 노드에서 그 소프트웨어(nginx)가 *실제로 돌고 있는지* — 원격명령으로 직접 물어본다
 *
 *   타깃은 이번 시나리오가 방금 만든 EC2다. 거기에 nginx가 있다면 그건 마이그레이션이 올린 것뿐이다.
 *   (예전 시나리오는 cb-tumblebug 원격명령으로 nginx를 *강제 설치* 했다. 소프트웨어 마이그레이션이
 *    검증되지 않던 시절의 우회였고, 이제 그 단계는 없앴다.)
 */

async function loginToken(request: APIRequestContext): Promise<string> {
  const u = getUser('cmiguser');
  const res = await request.post(`${config.baseURL}/api/auth/login`, {
    data: { request: { id: u.id, password: u.password } },
  });
  const body = await res.json();
  return body?.responseData?.access_token ?? body?.access_token ?? '';
}

/** cm-grasshopper 가 들고 있는 소프트웨어 마이그레이션 실행 상태 목록 */
async function fetchMigrationStatuses(
  request: APIRequestContext,
  token: string,
): Promise<any[]> {
  const res = await request.post(
    `${config.baseURL}/api/cm-grasshopper/List-Software-Migration-Status`,
    { headers: { Authorization: `Bearer ${token}` }, data: {} },
  );
  if (!res.ok()) return [];
  const body = await res.json().catch(() => null);
  const rd = body?.responseData;
  return Array.isArray(rd) ? rd : (rd?.status_list ?? []);
}

const FAILED = /"(status|state|execution_status)"\s*:\s*"[^"]*(fail|error)/i;
const DONE =
  /"(status|state|execution_status)"\s*:\s*"[^"]*(success|complete|done|finish)/i;

/**
 * 타깃 노드에서 명령을 실행하고 **표준출력만** 모아 돌려준다 (cb-tumblebug 원격명령).
 *
 * ★ 응답 본문을 통째로 문자열 매칭하면 안 된다. cb-tumblebug은 응답에 *실행한 명령문*을 그대로 실어 준다.
 *   그래서 `systemctl is-active nginx` 같은 명령을 보내고 응답 전체에서 "active"를 찾으면, 명령문에 들어
 *   있는 `is-active` 에 걸려 **출력이 `failed` 인데도 통과**한다. 실제로 그렇게 거짓 통과가 났다.
 *   *실행 결과(stdout)* 만 뽑아서 본다.
 */
async function runOnNode(
  request: APIRequestContext,
  token: string,
  command: string[],
): Promise<string> {
  const res = await request.post(
    `${config.baseURL}/api/cb-tumblebug/PostCmdInfra`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 180_000,
      data: {
        pathParams: {
          nsId: testNamespace.id,
          infraId: scenarioState.infraId ?? scenarioState.infraName,
        },
        // tumblebug이 만든 노드의 계정은 cb-user다(소스 서버의 ubuntu가 아니다).
        request: { userName: scenarioState.nodeUserName ?? 'cb-user', command },
      },
    },
  );
  const body = await res.json().catch(() => null);
  const results = body?.responseData?.results ?? [];
  return results
    .map((r: any) => Object.values(r?.stdout ?? {}).join('\n'))
    .join('\n');
}

/**
 * "그러면 소스의 소프트웨어가 타깃 노드에 설치된다"
 *
 * grasshopper 실행 상태가 끝나기를 기다린 뒤, 타깃 노드에 직접 물어 nginx가 도는지 확인한다.
 */
Then('소스의 소프트웨어가 타깃 노드에 설치된다', async ({ request }) => {
  test.setTimeout(40 * 60_000);
  const token = await loginToken(request);

  // 1) grasshopper 마이그레이션이 끝날 때까지 기다린다.
  let statuses: any[] = [];
  let settled = false;
  for (let i = 0; i < 60 && !settled; i++) {
    statuses = await fetchMigrationStatuses(request, token);
    const dump = JSON.stringify(statuses);
    if (statuses.length > 0 && (DONE.test(dump) || FAILED.test(dump)))
      settled = true;
    else await new Promise(r => setTimeout(r, 30_000));
  }

  const dump = JSON.stringify(statuses);
  console.log(
    `[sw] grasshopper 마이그레이션 상태 ${statuses.length}건: ${dump.slice(0, 800)}`,
  );

  expect(
    statuses.length,
    'cm-grasshopper에 소프트웨어 마이그레이션 실행 기록이 없다 — 워크플로우가 grasshopper까지 닿지 않았다',
  ).toBeGreaterThan(0);
  expect(
    FAILED.test(dump),
    `소프트웨어 마이그레이션이 실패로 끝났다: ${dump.slice(0, 800)}`,
  ).toBeFalsy();

  // 2) 타깃 노드에 직접 물어본다 — 상태 API가 성공이라고 해도, 실제로 올라갔는지는 별개다.
  //
  //    "돌고 있다"만 본다. 실행 파일이 복사돼 있고 유닛 파일이 만들어져 있어도, 설정·의존 파일이 없어
  //    서비스가 못 뜨면 옮겨진 게 아니다(실제로 그런 상태가 나왔다 — 바이너리는 있는데 service는 failed).
  let stdout = '';
  const isRunning = (out: string) => /^\s*active\s*$/m.test(out);
  for (let i = 0; i < 10; i++) {
    stdout = await runOnNode(request, token, [
      'systemctl is-active nginx || true',
    ]);
    if (isRunning(stdout)) break;
    await new Promise(r => setTimeout(r, 30_000));
  }
  console.log(
    `[sw] 타깃 노드 nginx 서비스 상태: ${stdout.trim() || '(응답 없음)'}`,
  );

  expect(
    isRunning(stdout),
    `타깃 노드에서 nginx가 돌고 있지 않다 — 소프트웨어 마이그레이션이 실제로 설치하지 못했다.\nsystemctl is-active nginx → ${stdout.trim() || '(응답 없음)'}`,
  ).toBeTruthy();
});
