// Handles logout and session expiry in one place.
//
// Originally it only navigated away and left tokens and the session intact. As a result, after
// landing on the login screen, pressing Back let you back in, and the server session was still alive.
import { axiosPost } from '@/shared/libs/api';
import {
  clearSession,
  handleSessionExpired,
  msUntilExpiry,
  msSinceActivity,
  msSinceSessionStart,
  watchActivity,
  unwatchActivity,
} from '@/shared/libs/auth/session';
import { hasBackgroundWork as runnerHasWork } from '@/shared/libs/tracking/runner';
import JwtTokenProvider from '@/shared/libs/token';

const LOGIN_PATH = '/auth/login';

/**
 * Logs out.
 *
 * Clears the server session, wipes what is left in the browser, then goes to the login screen via a
 * **full page navigation**. There are two reasons for using `location.replace` rather than a router
 * navigation (`router.replace`).
 *
 * - An SPA router navigation leaves in-memory stores and query results intact. A full navigation
 *   reloads the app, so nothing remains.
 * - Because it is `replace`, the login screen overwrites the history entry — even if the user goes
 *   back to a previous screen, there is no token, so the router guard sends them to login again.
 */
export async function logout(): Promise<void> {
  try {
    // Make a best effort to clean up the server session, but always clean up the browser side even
    // if it fails. If we got stuck here, the user would be trapped unable to even log out.
    await axiosPost('auth/logout', null);
  } catch (e) {
    console.warn('logout request failed; clearing local session anyway', e);
  }

  clearSession();
  window.location.replace(LOGIN_PATH);
}

/** Handling when the session has expired — a central handler notifies once and sends to the login screen. */
function expireSession(): void {
  handleSessionExpired();
}

const IDLE_LIMIT_MS = 60 * 60 * 1000; // end the session this long after the last user action
const HARD_LIMIT_MS = 3 * 60 * 60 * 1000; // end unconditionally at this point, even with background work
const CHECK_INTERVAL_MS = 30 * 1000; // check interval
const RENEW_MARGIN_MS = 5 * 60 * 1000; // renew ahead of time when the token has this much left

/**
 * Whether there is background work that should keep the session alive even after the user stops interacting.
 *
 * Ending the session while work is in progress leaves no one to show the result to — watching it becomes pointless.
 * The runner knows what is running. This function stays the same even as the set of tracked work grows.
 */
function hasBackgroundWork(): boolean {
  return runnerHasWork();
}

let checkTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Catches session expiry **even while the user stays on a screen**.
 *
 * Until now, expiry was only detected via the api response interceptor (401/403). So staying on one
 * screen for a long time meant not knowing it had expired until a click sent a request, at which
 * point the user was bounced to the login screen.
 *
 * The basis is **the time the user last interacted with the screen**. There is a reason we do not use
 * server requests as the basis — if background calls like delete-tracking polling counted as "in use",
 * the session would not end even while the user is away. Counting interactions means no amount of
 * polling clouds the idle judgment.
 *
 * Three rules sit on top of that.
 *
 * 1. If the user is active and the token is about to expire, **renew ahead of time**. Server tokens are
 *    fixed at 60 minutes from issue, so left alone they would cut off mid-use.
 * 2. Even after the user stops, **keep the session alive while background work is running.** Ending it
 *    with a delete in progress leaves no one to show the result to.
 * 3. That extension also has a **cap**. Three hours after login, end even with background work — an
 *    extension that continued indefinitely would effectively mean no expiry at all.
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
  if (!access_token) return; // not logged in — nothing to watch

  // A cap independent of whether background work exists. Prevents extensions from continuing indefinitely.
  if (msSinceSessionStart() >= HARD_LIMIT_MS) {
    expireSession();
    return;
  }

  // The user has been idle for a while. However, if background work is running, keep the session
  // alive until it finishes and the result can be seen (still without exceeding the cap above).
  if (msSinceActivity() >= IDLE_LIMIT_MS && !hasBackgroundWork()) {
    expireSession();
    return;
  }

  const remain = msUntilExpiry();
  if (remain <= 0) {
    expireSession();
    return;
  }
  // If the token's expiry time cannot be read, the renewal timing is unknown. Just do the idle
  // check and leave it — in this case expiry is caught via the api response (401/403) as before.
  if (!Number.isFinite(remain)) return;

  if (remain <= RENEW_MARGIN_MS) await renewToken();
}

/** Still in use, so extend the session. If it fails, end it — it will expire soon anyway. */
async function renewToken(): Promise<void> {
  try {
    const provider = JwtTokenProvider.getProvider();
    const res = await provider.refreshTokens();
    const { access_token, refresh_token } = res.data.responseData ?? {};
    if (access_token && refresh_token) {
      provider.setTokens({ access_token, refresh_token });
    }
  } catch (e) {
    // If refreshTokens fails, it clears the tokens itself and sends the user to login. Nothing more to do here.
    console.warn('session renewal failed', e);
  }
}

function onVisible(): void {
  // Just woke from sleep. There was no interaction in the meantime, so idle time may have exceeded the limit.
  if (document.visibilityState === 'visible') void checkOnce();
}
