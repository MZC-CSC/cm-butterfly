// 로그아웃과 세션 만료를 한 곳에서 처리한다.
//
// 원래는 화면 이동만 하고 토큰·세션을 그대로 두었다. 그래서 로그인 화면으로 간 뒤 뒤로 가기를
// 하면 다시 들어가지고, 서버 세션도 살아 있었다.
import { axiosPost } from '@/shared/libs/api';
import {
  clearSession,
  msUntilExpiry,
  msSinceActivity,
  msSinceSessionStart,
  watchActivity,
  unwatchActivity,
} from '@/shared/libs/auth/session';
import { hasPendingDeletes } from '@/entities/mci/lib/deleteTracker';
import JwtTokenProvider from '@/shared/libs/token';

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

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 마지막 조작 후 이만큼 지나면 끊는다
const HARD_LIMIT_MS = 3 * 60 * 60 * 1000; // 배경 작업이 있어도 여기서는 무조건 끊는다
const CHECK_INTERVAL_MS = 30 * 1000; // 확인 주기
const RENEW_MARGIN_MS = 5 * 60 * 1000; // 토큰이 이만큼 남으면 미리 갱신

/**
 * 사용자가 손을 뗐어도 세션을 이어 줘야 하는 배경 작업이 있는가.
 *
 * 지금은 삭제 추적뿐이다. 진행 중인 삭제를 남겨 두고 세션을 끊으면 결과를 보여 줄 상대가
 * 사라진다 — 지켜본 의미가 없어진다. 같은 성격의 배경 작업이 늘어나면 여기에 더한다.
 */
function hasBackgroundWork(): boolean {
  return hasPendingDeletes();
}

let checkTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 세션 만료를 **화면에 머물러 있어도** 잡아낸다.
 *
 * 그동안 만료는 api 응답 인터셉터(401/403)로만 감지했다. 그래서 한 화면에 오래 머무르면
 * 만료된 줄 모르고 있다가, 뭔가를 눌러 요청이 나가는 순간에야 로그인 화면으로 튕겼다.
 *
 * 기준은 **마지막으로 사용자가 화면을 조작한 시각**이다. 서버 요청을 기준으로 삼지 않는 이유가
 * 있다 — 삭제 추적 폴링처럼 배경에서 도는 호출이 "쓰는 중" 으로 집계되면, 자리를 비워도 세션이
 * 끊기지 않는다. 조작으로 세면 폴링이 아무리 돌아도 유휴 판정을 흐리지 않는다.
 *
 * 그 위에 규칙 세 가지가 얹힌다.
 *
 * 1. 조작 중인데 토큰이 곧 만료되면 **미리 갱신**한다. 서버 토큰은 발급 후 60분 고정이라
 *    그냥 두면 열심히 쓰는 중에도 끊긴다.
 * 2. 손을 뗐어도 **배경 작업이 도는 중이면 이어 준다.** 진행 중인 삭제를 두고 끊으면 결과를
 *    보여 줄 상대가 사라진다.
 * 3. 그 연장에도 **상한**이 있다. 로그인 후 3시간이면 배경 작업이 있어도 끊는다 — 연장이
 *    무한정 이어지면 사실상 만료가 없는 것과 같다.
 */
export function startSessionExpiryWatch(): void {
  stopSessionExpiryWatch();
  watchActivity();

  void checkOnce();
  checkTimer = setInterval(() => void checkOnce(), CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
}

export function stopSessionExpiryWatch(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  unwatchActivity();
  document.removeEventListener('visibilitychange', onVisible);
}

async function checkOnce(): Promise<void> {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return; // 로그인 상태가 아니다 — 감시할 대상이 없다

  // 배경 작업 유무와 무관한 상한이다. 연장이 무한정 이어지지 않게 막는다.
  if (msSinceSessionStart() >= HARD_LIMIT_MS) {
    expireSession();
    return;
  }

  // 손을 뗀 지 오래됐다. 단, 배경 작업이 도는 중이면 끝나고 결과를 볼 때까지는 이어 준다
  // (그래도 위의 상한은 넘지 못한다).
  if (msSinceActivity() >= IDLE_LIMIT_MS && !hasBackgroundWork()) {
    expireSession();
    return;
  }

  const remain = msUntilExpiry();
  if (remain <= 0) {
    expireSession();
    return;
  }
  // 만료 시각을 읽지 못하는 토큰이면 갱신 시점을 알 수 없다. 유휴 판정만 하고 둔다 —
  // 이 경우 만료는 예전처럼 api 응답(401/403)으로 잡힌다.
  if (!Number.isFinite(remain)) return;

  if (remain <= RENEW_MARGIN_MS) await renewToken();
}

/** 아직 쓰는 중이므로 세션을 이어 간다. 실패하면 끊는다 — 어차피 곧 만료된다. */
async function renewToken(): Promise<void> {
  try {
    const provider = JwtTokenProvider.getProvider();
    const res = await provider.refreshTokens();
    const { access_token, refresh_token } = res.data.responseData ?? {};
    if (access_token && refresh_token) {
      provider.setTokens({ access_token, refresh_token });
    }
  } catch (e) {
    // refreshTokens 가 실패하면 스스로 토큰을 지우고 로그인 화면으로 보낸다. 여기선 더 할 일이 없다.
    console.warn('session renewal failed', e);
  }
}

function onVisible(): void {
  // 절전에서 깨어난 직후다. 그동안 조작이 없었으므로 유휴가 한계를 넘었을 수 있다.
  if (document.visibilityState === 'visible') void checkOnce();
}
