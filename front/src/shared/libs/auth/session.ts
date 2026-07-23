// Determines login state and, on logout, cleans up so nothing is left behind.
//
// There's a reason login state is judged from the **token**. The store (`useAuthStore`)
// doesn't survive a refresh (we don't use pinia persistence), and `loadUser()`, which
// would restore it, is never called anywhere. So relying on the store alone would kick a
// perfectly valid user back to the login screen on every refresh. The token lives in
// localStorage and survives refreshes.
//
// We don't import the router here — the router guard uses this module, which would create
// a cycle. Navigation is left to the caller (guard, logout, expiry watcher).
import JwtTokenProvider from '@/shared/libs/token';
import { stopTracking } from '@/shared/libs/tracking/runner';
import { stopNotificationPolling } from '@/entities/notification/lib/notificationStore';
import { stopAllPolling } from '@/shared/libs/polling';

const LOGIN_AUTH_STORAGE = 'LOGIN_AUTH';
const SESSION_STARTED_STORAGE = 'MCMP_SESSION_STARTED';

/**
 * Access token expiry time (ms). null if it can't be read.
 *
 * Our token carries expiry in **`Exp`** rather than the standard `exp` (the same value is
 * also in `MapClaims.exp`). We check all three spots — so it keeps working even if the
 * issuer switches to the standard form.
 */
export function expiresAt(): number | null {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return null;

  const claims = JwtTokenProvider.getProvider().parseAccessToken() ?? {};
  const exp = claims.Exp ?? claims.exp ?? claims.MapClaims?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/**
 * Time left in the session (ms).
 *
 * Returns 0 (= expired) if there's no token. If there's a token but the expiry can't be
 * read, it returns **Infinity** — treating "unknown" as "expired" would immediately kick
 * out a perfectly valid user.
 */
export function msUntilExpiry(): number {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return 0;

  const at = expiresAt();
  if (at === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, at - Date.now());
}

/**
 * Whether the session is logged in.
 *
 * True only when there's a token and it hasn't expired yet. If the token's expiry can't
 * be read (its format differs from what we expect), having a token is enough to pass —
 * the server will catch it with a 401.
 */
export function isSessionAlive(): boolean {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();
  if (!access_token) return false;

  const at = expiresAt();
  if (at === null) return true;
  return at > Date.now();
}

// ── When the session started ──────────────────────────────────────────────
//
// Even if a session gets extended by background work, it **must not grow indefinitely.**
// To cap that, we need to know when the session started, and since it has to survive
// refreshes we keep it in storage.

/** Record the login time. */
export function markSessionStart(): void {
  localStorage.setItem(SESSION_STARTED_STORAGE, String(Date.now()));
}

/** Time elapsed since login (ms). If there's no record, returns 0 (= treated as just started). */
export function msSinceSessionStart(): number {
  const raw = Number(localStorage.getItem(SESSION_STARTED_STORAGE));
  if (!raw || Number.isNaN(raw)) {
    // This user logged in before this code existed. Use now as the baseline.
    markSessionStart();
    return 0;
  }
  return Date.now() - raw;
}

// ── Last user activity ────────────────────────────────────────────────────
//
// The session times out based on "the last time *the user* interacted." Crucially, we
// count **screen interactions**, not server requests. If we counted requests, background
// calls like delete-tracking polling would register as "active," and the session would
// never end even while the user is away.
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

/** Time elapsed since the last activity (ms). */
export function msSinceActivity(): number {
  return Date.now() - lastActivityAt;
}

/** Start watching for activity (no duplicate registration — re-adding the same listener is ignored). */
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
 * Clears every trace of login left in the browser.
 *
 * It does not navigate. The caller handles that afterward.
 *
 * Polling is stopped in one shot with `stopAllPolling()` rather than one by one — polling
 * scattered across screens and features (task tracking, notifications, activity watching,
 * load-test status) would otherwise linger after the session ends and keep hitting the
 * api, looping back into 401 → expiry handling. New polling just needs to register in the
 * registry and it stops here too.
 */
export function clearSession(): void {
  JwtTokenProvider.getProvider().removeToken();
  localStorage.removeItem(LOGIN_AUTH_STORAGE);
  localStorage.removeItem(SESSION_STARTED_STORAGE);
  stopAllPolling();
  // Also make sure app-level pollers not yet in the registry are stopped (idempotent even if doubled up).
  stopTracking();
  stopNotificationPolling();
  unwatchActivity();
}

// No matter where in the app expiry is detected, handle it only once. At the moment of
// expiry, several in-flight requests all get a 401 and each fails to refresh; without a
// guard, each one would raise a blocking alert, forcing the user to dismiss the expiry
// popup multiple times. Only the first one clears, alerts, and redirects to login; the
// rest quietly just clean up the session. The full-page navigation naturally resets this
// flag by the next login.
let sessionExpiredHandled = false;

/** Handle session expiry only once — clear, alert once, and redirect to login. */
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
