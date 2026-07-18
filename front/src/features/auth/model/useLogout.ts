// 로그아웃과 세션 만료를 한 곳에서 처리한다.
//
// 원래는 화면 이동만 하고 토큰·세션을 그대로 두었다. 그래서 로그인 화면으로 간 뒤 뒤로 가기를
// 하면 다시 들어가지고, 서버 세션도 살아 있었다.
import { axiosPost } from '@/shared/libs/api';
import { clearSession, msUntilExpiry } from '@/shared/libs/auth/session';

const LOGIN_PATH = '/auth/login';

/**
 * 로그아웃한다.
 *
 * 서버 세션을 지우고, 브라우저에 남은 흔적을 지운 뒤, **전체 페이지 이동**으로 로그인 화면에 간다.
 * 라우터 이동(`router.replace`)이 아니라 `location.replace` 를 쓰는 이유는 두 가지다.
 *
 * - SPA 라우터 이동은 메모리에 올라와 있는 store·조회 결과를 그대로 남긴다. 전체 이동은 앱을
 *   새로 띄우므로 남는 것이 없다.
 * - `replace` 라서 히스토리에 로그인 화면이 덮어써진다 — 뒤로 가기로 이전 화면에 돌아가더라도
 *   토큰이 없으니 라우터 가드가 다시 로그인으로 보낸다.
 */
export async function logout(): Promise<void> {
  try {
    // 서버 세션 정리는 최선을 다하되, 실패해도 브라우저 쪽 정리는 반드시 한다.
    // 여기서 막히면 사용자는 로그아웃도 못 하는 상태에 갇힌다.
    await axiosPost('auth/logout', null);
  } catch (e) {
    console.warn('logout request failed; clearing local session anyway', e);
  }

  clearSession();
  window.location.replace(LOGIN_PATH);
}

/** 세션이 만료됐을 때의 처리 — 알린 뒤 로그인 화면으로 보낸다. */
function expireSession(): void {
  clearSession();
  alert('User Session Expired.\n Please login again');
  window.location.replace(LOGIN_PATH);
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 세션 만료를 **화면에 머물러 있어도** 잡아낸다.
 *
 * 그동안 만료는 api 응답 인터셉터(401/403)로만 감지했다. 그래서 한 화면에 오래 머무르면
 * 만료된 줄 모르고 있다가, 뭔가를 눌러 요청이 나가는 순간에야 로그인 화면으로 튕겼다.
 * 토큰 만료 시각에 맞춰 타이머를 걸어 두면 아무것도 누르지 않아도 제때 알린다.
 *
 * 브라우저가 절전 등으로 타이머를 늦출 수 있으므로, 화면이 다시 보일 때 남은 시간을 확인해
 * 타이머를 다시 건다.
 */
export function startSessionExpiryWatch(): void {
  stopSessionExpiryWatch();

  const remain = msUntilExpiry();
  if (remain <= 0) {
    expireSession();
    return;
  }
  // 만료 시각을 읽지 못한 토큰이다. 감시할 시점이 없으니 걸지 않는다 —
  // 이 경우 만료는 예전처럼 api 응답(401/403)으로 잡힌다.
  if (!Number.isFinite(remain)) return;

  // 시간이 됐다고 곧바로 끊지 않고 **그 시점의 토큰을 다시 본다.** 그 사이 요청이 나가면서
  // 토큰이 갱신됐을 수 있는데(401 → refresh), 그러면 세션은 아직 살아 있다.
  expiryTimer = setTimeout(() => {
    if (msUntilExpiry() > 0) startSessionExpiryWatch();
    else expireSession();
  }, remain);
  document.addEventListener('visibilitychange', onVisible);
}

export function stopSessionExpiryWatch(): void {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  document.removeEventListener('visibilitychange', onVisible);
}

function onVisible(): void {
  if (document.visibilityState === 'visible') {
    startSessionExpiryWatch();
  }
}
