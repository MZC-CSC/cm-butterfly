import { APIRequestContext, TestInfo } from '@playwright/test';
import { config } from '../fixtures/test-data';

/**
 * 부하테스트 소요시간 측정.
 *
 * ★ 무엇을 재는가 — **JMeter 가 실제로 돌기 시작해 결과(CSV)가 완성될 때까지**의 시간이다.
 *   부하발생기 VM 생성 시간과 JMeter 설치 시간은 *재지 않는다*(그건 준비 과정이고, 오래 걸려도 문제가 아니다).
 *   문제가 되는 건 "10초짜리 부하를 걸었는데 결과가 나오기까지 한참 걸리는" 경우다. 가끔 아주 오래 걸린다.
 *
 * ★ 왜 재는가 — 오래 걸린다는 걸 *느낌*이 아니라 숫자로 남겨야, 어디서 늦어지는지 판단할 수 있다.
 *   그래서 실행 상태(cm-ant)를 주기적으로 찍어 구간별 시간을 기록하고, 리포트에 붙인다.
 */

/** cm-ant 가 알려주는 실행 상태 한 장면 */
export interface LoadTestSnapshot {
  /** 관찰 시각(테스트 기준 경과 초) */
  atSec: number;
  /** cm-ant 실행 상태 — 예: processing / successed / failed */
  status?: string;
  /** cm-ant 가 계산한 실행 시간 문자열 */
  executionDuration?: string;
  startAt?: string;
  finishAt?: string;
}

export interface LoadTestTiming {
  testName?: string;
  loadTestKey?: string;
  /** 부하테스트 실행을 누른 시각 */
  submittedAt: number;
  /** cm-ant 가 처음으로 "돌고 있다"고 알려준 시각(경과 초) — 여기서부터가 진짜 측정 구간 */
  runningAtSec?: number;
  /** cm-ant 상태가 종료(successed/failed)로 바뀐 시각(경과 초) */
  finishedAtSec?: number;
  /** 콘솔 화면에 결과(집계·차트)가 실제로 뜬 시각(경과 초) */
  visibleAtSec?: number;
  status?: string;
  snapshots: LoadTestSnapshot[];
}

/** 설정한 부하 시간(초)의 몇 배까지를 "정상"으로 볼지. 이걸 넘으면 리포트에 경고를 남긴다. */
const SLOW_FACTOR = 30;

export function startLoadTestTiming(): LoadTestTiming {
  return { submittedAt: Date.now(), snapshots: [] };
}

/** cm-ant 에서 *가장 최근* 부하테스트 실행 정보를 가져온다(콘솔이 쓰는 프록시 그대로). */
async function fetchLatest(
  request: APIRequestContext,
  token: string,
): Promise<Record<string, any> | null> {
  const res = await request.post(
    `${config.baseURL}/api/cm-ant/GetAllLoadTestExecutionInfos`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { queryParams: { page: '1', size: '1' } },
    },
  );
  if (!res.ok()) return null;
  const body = await res.json().catch(() => null);
  const infos =
    body?.responseData?.result?.loadTestExecutionInfos ??
    body?.responseData?.loadTestExecutionInfos ??
    [];
  return infos[0] ?? null;
}

/**
 * 결과가 완성될 때까지 cm-ant 상태를 지켜본다.
 *
 * 화면에서 결과가 보이기를 기다리는 것과 *별개로*, cm-ant 쪽 실행이 언제 시작하고 언제 끝났는지를 찍는다.
 * 화면에 안 뜨는 이유가 (a) 아직 안 끝나서인지 (b) 끝났는데 콘솔이 못 그려서인지 갈라야 하기 때문이다.
 */
export async function watchLoadTest(
  request: APIRequestContext,
  token: string,
  timing: LoadTestTiming,
  timeoutMs = 15 * 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const info = await fetchLatest(request, token).catch(() => null);
    const atSec = Math.round((Date.now() - timing.submittedAt) / 1000);

    if (info) {
      const state = info.loadTestExecutionState ?? {};
      const status: string | undefined = state.executionStatus;
      timing.testName ??= info.testName;
      timing.loadTestKey ??= info.loadTestKey;
      timing.status = status;
      timing.snapshots.push({
        atSec,
        status,
        executionDuration: info.executionDuration,
        startAt: state.startAt,
        finishAt: state.finishAt,
      });

      if (status && timing.runningAtSec === undefined) timing.runningAtSec = atSec;
      if (status && /success|fail/i.test(status)) {
        timing.finishedAtSec = atSec;
        return;
      }
    }

    if (Date.now() > deadline) return;
    await new Promise(r => setTimeout(r, 15_000));
  }
}

/**
 * 측정 결과를 사람이 읽을 수 있게 정리해 리포트에 붙인다.
 * 너무 오래 걸렸으면 *어디서* 늦어졌는지 판단할 근거를 함께 남긴다.
 */
export async function reportLoadTestTiming(
  testInfo: TestInfo,
  timing: LoadTestTiming,
  configuredDurationSec: number,
): Promise<string> {
  const lines: string[] = [];
  const secs = (v?: number) => (v === undefined ? '-' : `${v}초`);

  lines.push('# 부하테스트 소요시간');
  lines.push('');
  lines.push(`- 테스트 이름: ${timing.testName ?? '-'}`);
  lines.push(`- loadTestKey: ${timing.loadTestKey ?? '-'}`);
  lines.push(`- 설정한 부하 시간: ${configuredDurationSec}초`);
  lines.push(`- 최종 상태: ${timing.status ?? '-'}`);
  lines.push('');
  lines.push('| 구간 | 경과 |');
  lines.push('|------|------|');
  lines.push(`| 실행 요청 → cm-ant가 실행을 인지 | ${secs(timing.runningAtSec)} |`);
  lines.push(`| 실행 요청 → cm-ant 실행 종료 | ${secs(timing.finishedAtSec)} |`);
  lines.push(`| 실행 요청 → **화면에 결과 표시** | ${secs(timing.visibleAtSec)} |`);
  lines.push('');

  // 판단 — 어디서 늦어졌나
  const total = timing.visibleAtSec ?? timing.finishedAtSec;
  const slowThreshold = configuredDurationSec * SLOW_FACTOR;
  if (total !== undefined && total > slowThreshold) {
    lines.push(`## ⚠️ 오래 걸렸다 (${total}초 > 기준 ${slowThreshold}초)`);
    lines.push('');
    if (
      timing.finishedAtSec !== undefined &&
      timing.visibleAtSec !== undefined &&
      timing.visibleAtSec - timing.finishedAtSec > 60
    ) {
      lines.push(
        `- **콘솔 표시가 늦다.** cm-ant 실행은 ${timing.finishedAtSec}초에 끝났는데 화면에는 ` +
          `${timing.visibleAtSec}초에야 떴다(${timing.visibleAtSec - timing.finishedAtSec}초 지연). ` +
          '집계/조회 쪽을 본다.',
      );
    } else {
      lines.push(
        '- **cm-ant 실행 자체가 길다.** 부하는 짧게(설정값) 걸었는데 종료까지 오래 걸렸다. ' +
          'JMeter 구동 → 결과(CSV) 수집 구간을 본다(부하발생기 VM 생성·JMeter 설치 시간은 이 측정에 포함되지 않는다).',
      );
    }
    lines.push('');
  }

  lines.push('## 상태 변화 기록');
  lines.push('');
  lines.push('| 경과 | 상태 | cm-ant executionDuration |');
  lines.push('|------|------|--------------------------|');
  for (const s of timing.snapshots) {
    lines.push(`| ${s.atSec}초 | ${s.status ?? '-'} | ${s.executionDuration ?? '-'} |`);
  }

  const md = lines.join('\n');
  await testInfo.attach('부하테스트-소요시간', {
    body: md,
    contentType: 'text/markdown',
  });
  console.log('\n' + md + '\n');
  return md;
}
