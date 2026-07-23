import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * Deletion request tracking store API (cm-butterfly's own domain).
 *
 * This is our backend's own endpoint, not a proxy (`cm-beetle/*`). The deletion
 * request id is kept on the server so that **whichever browser you connect from,
 * you can resume the work in progress**. If it lived only in the browser, from
 * another spot you would have no way to know a deletion failed, or why.
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

/** List all tracked deletions — on app start / login, resume any pending ones. */
export function useListDeleteRequests() {
  return useAxiosPost<IAxiosResponse<DeleteRequestRecord[]>, any>(
    'listdeleterequests',
    {},
  );
}

/** Record a deletion request (a prior record for the same infra is replaced by the new one). */
export function useSaveDeleteRequest(payload: Partial<DeleteRequestRecord>) {
  return useAxiosPost<IAxiosResponse<DeleteRequestRecord>, any>(
    'savedeleterequest',
    payload,
  );
}

/** Update status — only move to Error or Unknown. On success the record is removed. */
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

/** Remove the record — on successful deletion, or when the infra is gone from the list. */
export function useRemoveDeleteRequest(uid: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('removedeleterequest', {
    uid,
  });
}
