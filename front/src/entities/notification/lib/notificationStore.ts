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
import { showNotificationToast } from '@/shared/utils';

/**
 * 알림 배지
 *
 * 오래 걸리는 작업(인프라 삭제·부하 테스트·워크플로우 실행)은 끝나는 순간 사용자가 다른 화면에 있다.
 * 그 결과를 알리는 것이 이 모듈이고, **작업이 무엇인지·어떻게 알아냈는지는 모른다.**
 *
 * 알아내는 일은 작업별 체커가 한다([trackerRunner](@/shared/libs/tracking/runner)). 체커는 끝났을 때
 * `notify()` 한 번을 부르고, 여기서부터는 종류와 무관하게 같은 길을 탄다 — 저장·배지·목록·확인.
 * 새 작업이 생겨도 체커만 추가하면 되고 이 파일은 그대로다.
 *
 * 조회 주기를 체커와 묶지 않은 이유가 있다. 알림은 *다른 탭·다른 자리*에서 생긴 것도 받아야 하므로
 * 내 브라우저의 체커가 도는 것과는 별개로 서버를 봐야 한다.
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

// Ids seen on the previous poll, so a poll can tell which notifications are new and only toast
// those. `primed` guards the first load — logging in must not flash the whole backlog as if it
// had just arrived.
let knownIds = new Set<string>();
let primed = false;

/** 화면이 그리는 목록(최신순 — 서버가 정렬해 준다). */
export const notifications = computed(() => state.items);

/** 배지 숫자 — 정보성까지 전부 센다. 읽으면 사라지므로 쌓이지 않는다. */
export const notificationCount = computed(() => state.items.length);

/**
 * 실패가 하나라도 있는가.
 *
 * 배지를 둘로 나누지 않는 대신 색으로 가른다 — "볼 것이 있다" 와 "급한 것이 있다" 는 다르다.
 */
export const hasErrorNotification = computed(() =>
  state.items.some(n => n.level === 'Error'),
);

/** 서버에서 다시 읽어 온다. */
export async function loadNotifications(): Promise<void> {
  try {
    const res = await useListNotifications().execute();
    const items = res.data.responseData ?? [];
    // Flash the ones that were not here last time. Only after the first load (so a login does
    // not replay the backlog), and only when the popup is on.
    if (primed && notificationPopupEnabled.value) {
      for (const n of items) {
        if (!knownIds.has(n.id)) {
          showNotificationToast(n.category ?? 'Notification', n.message, n.level);
        }
      }
    }
    knownIds = new Set(items.map(n => n.id));
    primed = true;
    state.items = items;
  } catch (e) {
    console.warn('failed to load notifications', e);
  }
}

/**
 * 알림을 남긴다 — **추적기가 쓰는 유일한 인터페이스.**
 *
 * `dedupKey` 에는 작업 자신의 id 를 넣는다. 탭이 여러 개 열려 있으면 같은 완료를 여러 탭이 잡아
 * 중복으로 부르는데, 서버가 이 키로 두 번째부터를 무시한다.
 *
 * 메시지는 부르는 쪽이 만든다. 완료 시점에는 id 밖에 남지 않으므로, **작업을 시작할 때 이름과
 * 동작을 함께 기억해 두어야** "'주문서비스' 워크플로우 재실행이 끝났습니다" 같은 문장을 만들 수 있다.
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
    // 알림을 못 남긴다고 작업 추적까지 멈출 이유는 없다.
    console.warn('failed to add notification', e);
  }
}

/** 하나 확인 — 읽으면 지운다. */
export async function readNotification(id: string): Promise<void> {
  try {
    await useReadNotification(id).execute();
    state.items = state.items.filter(n => n.id !== id);
  } catch (e) {
    console.warn('failed to read notification', e);
  }
}

/** 모두 확인. */
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

/** 로그인·앱 기동 시 시작. */
export async function startNotificationPolling(): Promise<void> {
  if (running) return;
  running = true;
  await loadNotifications();
  scheduleNext();
}

/** 로그아웃 시 정지 — 남은 목록도 비운다(다음 사용자에게 보이면 안 된다). */
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
