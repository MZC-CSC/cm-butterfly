import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * 알림 저장소 API (cm-butterfly 자체 도메인).
 *
 * 프록시가 아니라 우리 백엔드의 엔드포인트다. 알림을 브라우저에만 두면 다른 자리·다른 브라우저에서
 * 확인할 수 없어 "놓친 결과를 알린다" 는 목적 자체가 성립하지 않는다.
 */

export type NotificationLevel = 'Info' | 'Error';
export type NotificationCategory = 'Workload' | 'Workflow' | 'Perf';

export interface NotificationRecord {
  id: string;
  user_id: string;
  category: NotificationCategory | string;
  level: NotificationLevel;
  message: string;
  detail: string;
  dedup_key: string;
  created_at: string;
}

/** 안 읽은 알림 전체(만료분은 서버가 조회 시점에 정리한다). */
export function useListNotifications() {
  return useAxiosPost<IAxiosResponse<NotificationRecord[]>, any>(
    'listnotifications',
    {},
  );
}

/**
 * 알림 등록 — 추적기가 쓰는 유일한 인터페이스.
 *
 * `dedup_key` 는 작업 자신의 id(삭제 요청 id·부하 실행 id·워크플로우 실행 id)를 넣는다.
 * 탭이 여러 개 열려 있으면 같은 완료를 여러 탭이 동시에 잡아 중복 등록하는데, 이 키가 있으면
 * 서버가 두 번째부터는 무시한다.
 */
export function useAddNotification(payload: {
  category: NotificationCategory;
  level: NotificationLevel;
  message: string;
  detail?: string;
  dedup_key?: string;
}) {
  return useAxiosPost<IAxiosResponse<NotificationRecord>, any>(
    'addnotification',
    payload,
  );
}

/** 확인 처리 — 읽으면 지운다. */
export function useReadNotification(id: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('readnotification', { id });
}

/** 모두 확인. */
export function useReadAllNotifications() {
  return useAxiosPost<IAxiosResponse<string>, any>('readallnotifications', {});
}
