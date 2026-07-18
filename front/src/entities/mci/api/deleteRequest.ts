import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * 삭제 요청 추적 저장소 API (cm-butterfly 자체 도메인).
 *
 * 프록시(`cm-beetle/*`)가 아니라 우리 백엔드의 자체 엔드포인트다. 삭제 요청 id 를 서버에 두는
 * 이유는 **어느 브라우저에서 접속하든 하던 처리를 이어받기 위해서**다. 브라우저에만 두면 다른
 * 자리에서는 삭제가 실패한 사실도, 그 사유도 알 수 없다.
 */

export type DeleteRequestStatus = 'Handling' | 'Error' | 'Unknown';

export interface DeleteRequestRecord {
  uid: string;
  ns_id: string;
  infra_id: string;
  req_id: string;
  option: string;
  status: DeleteRequestStatus;
  error_reason: string;
  requested_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** 추적 중인 삭제 전체 조회 — 앱 시작·로그인 시 밀린 것을 이어받는다. */
export function useListDeleteRequests() {
  return useAxiosPost<IAxiosResponse<DeleteRequestRecord[]>, any>(
    'listdeleterequests',
    {},
  );
}

/** 삭제 요청 기록(같은 인프라의 이전 기록은 새 요청으로 대체된다). */
export function useSaveDeleteRequest(payload: Partial<DeleteRequestRecord>) {
  return useAxiosPost<IAxiosResponse<DeleteRequestRecord>, any>(
    'savedeleterequest',
    payload,
  );
}

/** 상태 갱신 — 실패(Error)·판단 불가(Unknown) 로만 옮긴다. 성공은 기록을 지운다. */
export function useUpdateDeleteRequestStatus(
  uid: string,
  status: DeleteRequestStatus,
  errorReason?: string,
) {
  return useAxiosPost<IAxiosResponse<string>, any>(
    'updatedeleterequeststatus',
    { uid, status, error_reason: errorReason ?? '' },
  );
}

/** 기록 제거 — 삭제 성공, 또는 인프라가 목록에서 사라진 경우. */
export function useRemoveDeleteRequest(uid: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('removedeleterequest', {
    uid,
  });
}
