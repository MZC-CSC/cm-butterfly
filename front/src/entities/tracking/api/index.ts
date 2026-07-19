import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * 장시간 작업 추적 저장소 API (cm-butterfly 자체 도메인).
 *
 * 부하 테스트도 워크플로우 실행도 **시작할 때 자기 id 를 돌려주지 않는다.** 그래서 시작 시점에
 * 알 수 있는 것(어느 노드인지·어느 워크플로우인지)을 자연키로 남겨 두고, 나중에 그 키로
 * "마지막 실행이 어떻게 됐나" 를 묻는다.
 *
 * 서버에 두는 이유는 삭제 추적과 같다 — 브라우저에만 두면 다른 자리에서는 결과를 알 수 없다.
 */

export type TrackedJobKind = 'perf' | 'workflow';
export type TrackedJobAction = 'run' | 'rerun' | 'rerun-failed';

export interface TrackedJobRecord {
  id: string;
  kind: TrackedJobKind | string;
  natural_key: string;
  label: string;
  action: string;
  started_at: string;
  requested_by?: string;
}

/** 추적 중인 작업 전체 — 로그인·앱 시작 시 이어받는다. */
export function useListTrackedJobs() {
  return useAxiosPost<IAxiosResponse<TrackedJobRecord[]>, any>(
    'listtrackedjobs',
    {},
  );
}

/** 작업 시작 기록(같은 대상의 이전 기록은 대체된다). */
export function useSaveTrackedJob(payload: {
  kind: TrackedJobKind;
  natural_key: string;
  label: string;
  action: TrackedJobAction;
  started_at: string;
}) {
  return useAxiosPost<IAxiosResponse<TrackedJobRecord>, any>(
    'savetrackedjob',
    payload,
  );
}

/** 끝나서 알린 작업을 목록에서 지운다. */
export function useRemoveTrackedJob(kind: TrackedJobKind, naturalKey: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('removetrackedjob', {
    kind,
    natural_key: naturalKey,
  });
}
