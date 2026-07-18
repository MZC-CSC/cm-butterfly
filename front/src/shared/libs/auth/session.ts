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
import { stopDeleteTracking } from '@/entities/mci/lib/deleteTracker';

const LOGIN_AUTH_STORAGE = 'LOGIN_AUTH';

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

/**
 * 브라우저에 남은 로그인 흔적을 모두 지운다.
 *
 * 화면 이동은 하지 않는다. 부르는 쪽이 이어서 처리한다.
 */
export function clearSession(): void {
  JwtTokenProvider.getProvider().removeToken();
  localStorage.removeItem(LOGIN_AUTH_STORAGE);
  stopDeleteTracking();
}
