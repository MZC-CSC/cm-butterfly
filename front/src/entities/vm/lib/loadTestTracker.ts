import { useGetLoadTestStateByKey } from '@/entities/vm/api/api';
import { notify } from '@/entities/notification/lib/notificationStore';
import { registerTracker } from '@/shared/libs/tracking/runner';
import {
  putTrackedJob,
  clearTrackedJob,
  trackedJobsOf,
  hasTrackedJobs,
  loadTrackedJobs,
  type TrackedJob,
} from '@/entities/tracking/lib/trackedJobs';

/**
 * 부하 테스트 추적 (BAR-1544)
 *
 * 부하 테스트는 몇 분씩 걸리고 그동안 사용자는 VM 목록을 떠난다. 지금까지 폴링은 그 화면이
 * 소유해서 **화면을 벗어나면 추적이 끊겼다.** 여기로 옮겨 앱이 떠 있는 동안 계속 돌게 한다.
 *
 * ★ **추적 키는 실행 키(loadTestKey)다.**
 *
 * 처음에는 `{nsId}/{infraId}/{nodeId}` 를 키로 삼고 "그 노드의 마지막 실행" 을 물으려 했는데,
 * 그러면 **알림이 엉뚱한 실행을 가리킬 수 있다.** 그 셋은 이름이고 이름은 재사용된다 —
 * VM 을 지우고 같은 이름으로 다시 만들면 삭제된 VM 의 실행이 답으로 돌아온다(BAR-1546 에서 실측).
 * 같은 노드에서 부하 테스트를 두 번 돌린 경우에도 첫 번째 완료를 두 번째 것으로 착각한다.
 *
 * 실행 키는 그 실행 하나만 가리키므로 두 문제가 모두 사라진다. 키는 **실행 응답에서 받는다** —
 * cm-ant 가 돌려주고 있었는데 화면이 버리고 있었다.
 */

const KIND = 'perf' as const;

/** cm-ant 가 끝났다고 보는 값. 그 외(on_processing·on_fetching)는 진행 중이다. */
const TERMINAL_SUCCESS = 'successed';
const TERMINAL_FAILED = 'test_failed';

/**
 * 부하 테스트 시작을 기록한다.
 *
 * `label` 에는 **사용자가 알아볼 이름**을 넣는다. 완료 시점에 남는 것은 실행 키뿐이라
 * "어느 VM 이었는지" 를 문장으로 만들 수 없다.
 */
export async function trackLoadTest(params: {
  loadTestKey: string;
  label: string;
}): Promise<void> {
  if (!params.loadTestKey) {
    // 키가 없으면 추적할 방법이 없다. 이름으로 대신 추적하면 다른 실행을 알리게 되므로
    // 아예 걸지 않는다 — 알림이 없는 편이 틀린 알림보다 낫다.
    console.warn('[loadTestTracker] 실행 키가 없어 추적하지 않는다');
    return;
  }

  await putTrackedJob({
    kind: KIND,
    naturalKey: params.loadTestKey,
    label: params.label,
    action: 'run',
    startedAt: new Date().toISOString(),
  });
}

/** 진행 중인 부하 테스트가 있는가(세션 유지 판단). */
export function hasPendingLoadTests(): boolean {
  return hasTrackedJobs(KIND);
}

/** 하나의 결과를 확인한다. */
async function checkOne(job: TrackedJob): Promise<void> {
  let result: any;
  try {
    const res: any = await useGetLoadTestStateByKey(job.naturalKey).execute();
    result = res?.data?.responseData?.result;
  } catch {
    // 조회가 실패했다. 실패로 단정하지 않고 다음 주기에 다시 본다 — 테스트 자체는 돌고 있을 수 있다.
    return;
  }

  if (!result) return;

  const status = String(result.executionStatus ?? '').toLowerCase();
  if (status !== TERMINAL_SUCCESS && status !== TERMINAL_FAILED) return;

  if (status === TERMINAL_SUCCESS) {
    await notify({
      category: 'Perf',
      level: 'Info',
      message: `Load test on "${job.label}" completed.`,
      dedupKey: `perf:${job.naturalKey}:done`,
    });
  } else {
    await notify({
      category: 'Perf',
      level: 'Error',
      message: `Load test on "${job.label}" failed.`,
      detail: result.failureMessage || '',
      dedupKey: `perf:${job.naturalKey}:error`,
    });
  }

  await clearTrackedJob(KIND, job.naturalKey);
}

registerTracker({
  id: 'load-test',
  check: async () => {
    for (const job of trackedJobsOf(KIND)) {
      await checkOne(job);
    }
  },
  hasWork: hasPendingLoadTests,
  resume: loadTrackedJobs,
  reset: () => {
    /* 목록은 trackedJobs 가 소유한다 — 로그아웃 정리는 그쪽에서 한 번만 한다 */
  },
});
