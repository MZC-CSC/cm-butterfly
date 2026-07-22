// 로그인 상태를 판정하고, 로그아웃 시 남는 것이 없도록 정리한다.
//
// 판정 근거를 **토큰**으로 잡은 이유가 있다. 스토어(`useAuthStore`)는 새로고침을 넘기지 못하고
// (pinia 영속화를 쓰지 않는다) 복원을 담당하는 `loadUser()` 는 어디에서도 호출되지 않는다.
// 그래서 스토어만 보면 새로고침할 때마다 멀쩡한 사용자를 로그인 화면으로 쫓아내게 된다.
// 토큰은 localStorage 에 있어 새로고침을 넘긴다.
//
// 여기서는 라우터를 import 하지 않는다 — 라우터 가드가 이 모듈을 쓰므로 순환이 된다.
// 화면 이동은 부르는 쪽(가드·로그아웃·만료 감시)이 맡는다.
import JwtTokenProvider from '@/shared/libs/token';
import { stopTracking } from '@/shared/libs/tracking/runner';
import { stopNotificationPolling } from '@/entities/notification/lib/notificationStore';
import { stopAllPolling } from '@/shared/libs/polling';

const LOGIN_AUTH_STORAGE = 'LOGIN_AUTH';
const SESSION_STARTED_STORAGE = 'MCMP_SESSION_STARTED';

/**
 * access token 의 만료 시각(ms). 읽어내지 못하면 null.
 *
 * 우리 토큰은 표준 `exp` 가 아니라 **`Exp`** 에 만료를 담는다(`MapClaims.exp` 에도 같은 값이
 * 들어 있다). 세 자리를 모두 본다 — 발급 쪽이 표준형으로 바뀌더라도 그대로 동작한다.
 */
export function expiresAt(): number | null {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return null;

  const claims = JwtTokenProvider.getProvider().parseAccessToken() ?? {};
  const exp = claims.Exp ?? claims.exp ?? claims.MapClaims?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/**
 * 남은 세션 시간(ms).
 *
 * 토큰이 없으면 0(=만료). 토큰은 있는데 만료 시각을 읽지 못하면 **Infinity** 를 준다 —
 * "모른다" 를 "만료됐다" 로 취급하면 멀쩡한 사용자를 즉시 쫓아낸다.
 */
export function msUntilExpiry(): number {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return 0;

  const at = expiresAt();
  if (at === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, at - Date.now());
}

/**
 * 로그인 상태인가.
 *
 * 토큰이 있고 아직 만료되지 않았을 때만 참이다. 만료 시각을 읽지 못하는 토큰이라면
 * (형식이 예상과 다른 경우) 토큰이 있는 것만으로 통과시킨다 — 서버가 401 로 잡아낸다.
 */
export function isSessionAlive(): boolean {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return false;

  const at = expiresAt();
  if (at === null) return true;
  return at > Date.now();
}

// ── 세션이 시작된 시각 ────────────────────────────────────────────────────
//
// 배경 작업 때문에 세션을 연장하더라도 **무한정 늘어나서는 안 된다.** 그 상한을 재려면
// 세션이 언제 시작됐는지 알아야 하고, 새로고침을 넘겨야 하므로 저장소에 둔다.

/** 로그인 시각을 기록한다. */
export function markSessionStart(): void {
  localStorage.setItem(SESSION_STARTED_STORAGE, String(Date.now()));
}

/** 로그인 이후 흐른 시간(ms). 기록이 없으면 0(=방금 시작한 것으로 본다). */
export function msSinceSessionStart(): number {
  const raw = Number(localStorage.getItem(SESSION_STARTED_STORAGE));
  if (!raw || Number.isNaN(raw)) {
    // 이 코드가 들어오기 전에 로그인한 사용자다. 지금을 기준으로 삼는다.
    markSessionStart();
    return 0;
  }
  return Date.now() - raw;
}

// ── 마지막 사용자 활동 ────────────────────────────────────────────────────
//
// 세션을 끊는 기준은 "마지막으로 *사용자가* 쓴 시각" 이다. 서버 요청이 아니라 **화면 조작**으로
// 센다 — 이게 핵심이다. 요청을 기준으로 삼으면 삭제 추적 폴링 같은 백그라운드 호출이
// "쓰는 중" 으로 집계돼, 자리를 비워도 세션이 끊기지 않는다.
let lastActivityAt = Date.now();

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
] as const;

function markActivity(): void {
  lastActivityAt = Date.now();
}

/** 마지막 활동 이후 흐른 시간(ms). */
export function msSinceActivity(): number {
  return Date.now() - lastActivityAt;
}

/** 활동 감시를 시작한다(중복 등록되지 않는다 — 같은 리스너를 재등록하면 무시된다). */
export function watchActivity(): void {
  markActivity();
  ACTIVITY_EVENTS.forEach(type =>
    window.addEventListener(type, markActivity, { passive: true }),
  );
}

export function unwatchActivity(): void {
  ACTIVITY_EVENTS.forEach(type =>
    window.removeEventListener(type, markActivity),
  );
}

/**
 * 브라우저에 남은 로그인 흔적을 모두 지운다.
 *
 * 화면 이동은 하지 않는다. 부르는 쪽이 이어서 처리한다.
 *
 * 폴링은 개별로 끄지 않고 `stopAllPolling()` 한 번으로 끈다 — 화면·기능마다 흩어진 폴링(작업 추적,
 * 알림, 활동 감시, 부하테스트 상태)이 세션이 끊긴 뒤에도 남아 api를 때리면 다시 401 → 만료 처리로
 * 돌아가기 때문이다. 새 폴링은 레지스트리에 등록만 하면 여기서 함께 멈춘다.
 */
export function clearSession(): void {
  JwtTokenProvider.getProvider().removeToken();
  localStorage.removeItem(LOGIN_AUTH_STORAGE);
  localStorage.removeItem(SESSION_STARTED_STORAGE);
  stopAllPolling();
  // 레지스트리에 아직 등록되지 않은 앱 수준 폴러도 확실히 멈춘다(이중이어도 idempotent).
  stopTracking();
  stopNotificationPolling();
  unwatchActivity();
}

// 세션 만료를 화면 어디서 감지하든 처리는 한 번만 일어나게 한다. 만료 순간 진행 중이던 여러 요청이
// 동시에 401을 받아 각자 갱신에 실패하는데, 가드가 없으면 저마다 blocking alert 를 띄워 사용자가
// 만료 팝업을 여러 번 닫아야 했다. 첫 번째만 지우고·알리고·로그인 화면으로 보내고 나머지는 조용히
// 세션만 정리한다. 전체 페이지 이동으로 다음 로그인 때 이 플래그가 자연히 초기화된다.
let sessionExpiredHandled = false;

/** 세션 만료를 한 번만 처리한다 — 지우고, 한 번 알리고, 로그인 화면으로 보낸다. */
export function handleSessionExpired(): void {
  if (sessionExpiredHandled) {
    clearSession();
    return;
  }
  sessionExpiredHandled = true;
  clearSession();
  alert('User Session Expired.\n Please login again');
  window.location.replace('/auth/login');
}
