import { reactive } from 'vue';
import {
  useListTrackedJobs,
  useSaveTrackedJob,
  useRemoveTrackedJob,
  type TrackedJobRecord,
  type TrackedJobKind,
  type TrackedJobAction,
} from '@/entities/tracking/api';

/**
 * 추적 중인 장시간 작업 목록 (BAR-1544 / BAR-1545 공용)
 *
 * 체커들이 공유하는 창고다. 각 체커는 자기 `kind` 의 것만 꺼내 확인한다.
 *
 * **왜 기록이 필요한가** — 부하 테스트도 워크플로우 실행도 시작할 때 자기 id 를 주지 않는다.
 * 시작 시점에 손에 있는 것은 *어느 노드/어느 워크플로우인가* 뿐이고, 그것을 남겨 둬야 나중에
 * "그 대상의 마지막 실행이 어떻게 됐나" 를 물을 수 있다.
 *
 * **왜 이름과 동작까지 남기는가** — 끝난 뒤에는 id 밖에 없어서 문장을 만들 수 없다.
 * "'주문서비스' 워크플로우 **재실행**이 끝났습니다" 를 쓰려면 이름과 동작을 시작할 때 잡아야 한다.
 */

export interface TrackedJob {
  kind: TrackedJobKind;
  naturalKey: string;
  label: string;
  action: TrackedJobAction;
  startedAt: string;
}

const state = reactive<{ jobs: Record<string, TrackedJob> }>({ jobs: {} });

const keyOf = (kind: string, naturalKey: string) => `${kind}::${naturalKey}`;

function fromRecord(r: TrackedJobRecord): TrackedJob {
  return {
    kind: r.kind as TrackedJobKind,
    naturalKey: r.natural_key,
    label: r.label,
    action: (r.action || 'run') as TrackedJobAction,
    startedAt: r.started_at,
  };
}

/** 특정 종류의 추적 중인 작업들. */
export function trackedJobsOf(kind: TrackedJobKind): TrackedJob[] {
  return Object.values(state.jobs).filter(j => j.kind === kind);
}

/** 추적 중인 것이 하나라도 있는가(세션 유지 판단에 쓰인다). */
export function hasTrackedJobs(kind: TrackedJobKind): boolean {
  return trackedJobsOf(kind).length > 0;
}

/** 작업 시작을 기록한다. */
export async function putTrackedJob(job: TrackedJob): Promise<void> {
  state.jobs[keyOf(job.kind, job.naturalKey)] = job;
  try {
    await useSaveTrackedJob({
      kind: job.kind,
      natural_key: job.naturalKey,
      label: job.label,
      action: job.action,
      started_at: job.startedAt,
    }).execute();
  } catch (e) {
    // 서버 기록에 실패해도 이번 브라우저에서는 추적한다. 다만 다른 자리에서는 이어받지
    // 못하게 되므로 조용히 넘기지 않는다.
    console.error('[trackedJobs] 작업 기록 실패', e);
  }
}

/** 자연키를 바꿔 다시 기록한다 — 시작 후에야 실제 id 를 알게 되는 경우에 쓴다. */
export async function retagTrackedJob(
  job: TrackedJob,
  nextNaturalKey: string,
): Promise<TrackedJob> {
  await clearTrackedJob(job.kind, job.naturalKey);
  const next = { ...job, naturalKey: nextNaturalKey };
  await putTrackedJob(next);
  return next;
}

/** 끝난 작업을 목록에서 지운다. */
export async function clearTrackedJob(
  kind: TrackedJobKind,
  naturalKey: string,
): Promise<void> {
  delete state.jobs[keyOf(kind, naturalKey)];
  try {
    await useRemoveTrackedJob(kind, naturalKey).execute();
  } catch (e) {
    console.error('[trackedJobs] 작업 기록 제거 실패', e);
  }
}

/** 서버에 남아 있는 추적 기록을 받아 온다(로그인·앱 시작 시). */
export async function loadTrackedJobs(): Promise<void> {
  try {
    const res: any = await useListTrackedJobs().execute();
    const list: TrackedJobRecord[] = res?.data?.responseData ?? [];
    const next: Record<string, TrackedJob> = {};
    for (const r of Array.isArray(list) ? list : []) {
      next[keyOf(r.kind, r.natural_key)] = fromRecord(r);
    }
    state.jobs = next;
  } catch (e) {
    console.error('[trackedJobs] 추적 기록 조회 실패', e);
  }
}
