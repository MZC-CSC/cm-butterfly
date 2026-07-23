import { reactive, computed, ref } from 'vue';
import {
  useListNotifications,
  useAddNotification,
  useReadNotification,
  useReadAllNotifications,
  type NotificationRecord,
  type NotificationLevel,
  type NotificationCategory,
} from '@/entities/notification/api';

/**
 * Notification badge
 *
 * When a long-running task (infra deletion, load test, workflow run) finishes, the user is
 * usually on a different screen. This module reports the result, and **it does not know what the
 * task was or how it was discovered.**
 *
 * Discovering that is the job of the per-task checkers ([trackerRunner](@/shared/libs/tracking/runner)).
 * A checker calls `notify()` once when it finishes, and from here on everything follows the same
 * path regardless of type — store, badge, list, acknowledge. A new task only needs a new checker;
 * this file stays the same.
 *
 * The poll interval is deliberately not tied to the checkers. Notifications can also originate
 * from *another tab or another machine*, so the server must be polled independently of whether
 * this browser's checkers are running.
 */

const POLL_INTERVAL_MS = 30_000;

const state = reactive<{ items: NotificationRecord[] }>({ items: [] });

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Whether an arriving notification also flashes on screen.
 *
 * The inbox always keeps it; this only controls the extra two-second toast. Stored in
 * localStorage like the workflow settings, defaulting to on — the toast is the point of the
 * feature, so someone who wants inbox-only turns it off rather than the other way around.
 */
const POPUP_KEY = 'cmig.notificationPopupEnabled';
const readPopupPref = (): boolean => {
  const v = localStorage.getItem(POPUP_KEY);
  return v === null ? true : v === 'true';
};
export const notificationPopupEnabled = ref<boolean>(readPopupPref());
export function setNotificationPopupEnabled(on: boolean): void {
  notificationPopupEnabled.value = on;
  localStorage.setItem(POPUP_KEY, String(on));
}

/**
 * Arrival pulse.
 *
 * Bumped once whenever a poll brings a *genuinely new* notification (not the login backlog).
 * The topbar watches this and plays the arrival cue — an envelope flying into the badge — so
 * the store stays free of any DOM/animation concern. One bump per poll however many arrived;
 * the badge count already says how many wait.
 */
export const arrivalSeq = ref(0);

// Ids seen on the previous poll, so a poll can tell which notifications are new and only toast
// those. `primed` guards the first load — logging in must not flash the whole backlog as if it
// had just arrived.
let knownIds = new Set<string>();
let primed = false;

/** The list the UI renders (newest first — the server sorts it). */
export const notifications = computed(() => state.items);

/** Badge count — counts everything, including informational ones. Reading clears them, so they do not pile up. */
export const notificationCount = computed(() => state.items.length);

/**
 * Is there at least one failure?
 *
 * Instead of splitting the badge in two, we distinguish by color — "there is something to look at"
 * and "there is something urgent" are different.
 */
export const hasErrorNotification = computed(() =>
  state.items.some(n => n.level === 'Error'),
);

/** Re-fetch from the server. */
export async function loadNotifications(): Promise<void> {
  try {
    const res = await useListNotifications().execute();
    const items = res.data.responseData ?? [];
    // Signal the ones that were not here last time. Only after the first load (so a login does
    // not replay the backlog as if it just arrived). The topbar owns the popup setting and the
    // animation; here we only say "something new came in".
    if (primed && items.some(n => !knownIds.has(n.id))) {
      arrivalSeq.value += 1;
    }
    knownIds = new Set(items.map(n => n.id));
    primed = true;
    state.items = items;
  } catch (e) {
    console.warn('failed to load notifications', e);
  }
}

/**
 * Post a notification — **the only interface the trackers use.**
 *
 * Put the task's own id in `dedupKey`. When several tabs are open they all catch the same
 * completion and call this redundantly; the server uses this key to ignore everything after the first.
 *
 * The caller builds the message. At completion time only the id remains, so **you must remember the
 * name and action when the task starts** in order to build a sentence like "Re-run of the
 * 'order-service' workflow has finished".
 */
export async function notify(params: {
  category: NotificationCategory;
  level: NotificationLevel;
  message: string;
  detail?: string;
  dedupKey?: string;
}): Promise<void> {
  try {
    await useAddNotification({
      category: params.category,
      level: params.level,
      message: params.message,
      detail: params.detail ?? '',
      dedup_key: params.dedupKey ?? '',
    }).execute();
    await loadNotifications();
  } catch (e) {
    // Failing to post a notification is no reason to stop tracking the task.
    console.warn('failed to add notification', e);
  }
}

/** Acknowledge one — reading removes it. */
export async function readNotification(id: string): Promise<void> {
  try {
    await useReadNotification(id).execute();
    state.items = state.items.filter(n => n.id !== id);
  } catch (e) {
    console.warn('failed to read notification', e);
  }
}

/** Acknowledge all. */
export async function readAllNotifications(): Promise<void> {
  try {
    await useReadAllNotifications().execute();
    state.items = [];
  } catch (e) {
    console.warn('failed to read all notifications', e);
  }
}

function scheduleNext(): void {
  if (!running) return;
  pollTimer = setTimeout(async () => {
    await loadNotifications();
    scheduleNext();
  }, POLL_INTERVAL_MS);
}

/** Start on login or app startup. */
export async function startNotificationPolling(): Promise<void> {
  if (running) return;
  running = true;
  await loadNotifications();
  scheduleNext();
}

/** Stop on logout — also clear the remaining list (it must not be visible to the next user). */
export function stopNotificationPolling(): void {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  state.items = [];
  // Forget what was seen, so the next login re-primes and does not replay the backlog as toasts.
  knownIds = new Set();
  primed = false;
}
