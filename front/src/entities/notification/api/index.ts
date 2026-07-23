import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * Notification store API (cm-butterfly's own domain).
 *
 * These are our backend's endpoints, not proxied ones. If notifications lived
 * only in the browser, they couldn't be seen from another machine or browser,
 * which defeats the whole point of "surfacing results you missed".
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

/** All unread notifications (the server prunes expired ones at query time). */
export function useListNotifications() {
  return useAxiosPost<IAxiosResponse<NotificationRecord[]>, any>(
    'listnotifications',
    {},
  );
}

/**
 * Register a notification — the only interface the tracker uses.
 *
 * `dedup_key` takes the job's own id (delete-request id, load-run id, workflow-run
 * id). When several tabs are open they may each catch the same completion and
 * register it concurrently; with this key the server ignores every duplicate after
 * the first.
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

/** Mark as read — reading it removes it. */
export function useReadNotification(id: string) {
  return useAxiosPost<IAxiosResponse<string>, any>('readnotification', { id });
}

/** Mark all as read. */
export function useReadAllNotifications() {
  return useAxiosPost<IAxiosResponse<string>, any>('readallnotifications', {});
}
