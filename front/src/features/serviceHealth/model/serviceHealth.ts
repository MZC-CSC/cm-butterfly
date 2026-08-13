/**
 * Whether the linked services are answering, watched from the browser.
 *
 * The console is a front for other services, so a screen that will not load is
 * usually one of them being down rather than the console itself. Until now that
 * only showed as an empty list, and finding out which service meant reading logs
 * on the host.
 *
 * This asks the console's own endpoint on a timer and keeps the answer, so that
 * every screen can say the same thing about the same moment.
 *
 * How the user is told is deliberately narrow:
 *
 *   - one modal the first time it breaks, which does not close on its own
 *   - a single line at the top for as long as it stays broken
 *   - nothing in the notification list
 *
 * A failure is a state to act on now, not an entry to scroll past later, and a
 * check running every few minutes would push everything else out of that list.
 */

import { computed, ref } from 'vue';
import { axiosPost } from '@/shared/libs/api/request';

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface HealthItem {
  name: string;
  status: HealthStatus;
  version?: string;
  swagger?: string;
  endpoint?: string;
  message?: string;
  checkedAt: string;
}

export interface HealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  checkedAt: string;
}

export interface HealthSettings {
  intervalSec: number;
  failureThreshold: number;
}

export interface HealthResult {
  summary: HealthSummary;
  items: HealthItem[];
  settings?: HealthSettings;
}

/*
  Settings come from the console's own endpoint, not from this build.

  How often to look, and how many failures in a row before saying so, depend on
  the installation: a demo box restarted all day and a long-running environment
  want different answers. The console ships as a static build, so a value fixed
  here could not be changed by whoever runs the lineup — which is exactly who
  needs to change it.

  These are the values used until the first answer arrives, and what is used if
  the answer carries none.
*/
export const DEFAULT_INTERVAL_SEC = 300;
export const DEFAULT_FAILURE_THRESHOLD = 2;

const intervalSec = ref(DEFAULT_INTERVAL_SEC);
const failureThreshold = ref(DEFAULT_FAILURE_THRESHOLD);

const result = ref<HealthResult | null>(null);
const isChecking = ref(false);
const lastError = ref<string | null>(null);

/*
  Nothing is said until the lineup has been seen working once.

  Starting the stack brings the console up before the services behind it, so the
  first checks fail as a matter of course. Alerting on those would train the user
  to dismiss the alert.
*/
const everHealthy = ref(false);
const consecutiveFailures = ref(0);

/** Failing, and it has been failing long enough to say so. */
const failing = ref(false);
/** The user has seen the modal for this failure. */
const acknowledged = ref(false);

let timer: ReturnType<typeof setInterval> | null = null;

export const healthResult = computed(() => result.value);
export const healthIntervalSec = computed(() => intervalSec.value);
export const healthFailureThreshold = computed(() => failureThreshold.value);
export const healthItems = computed(() => result.value?.items ?? []);
export const healthSummary = computed(() => result.value?.summary ?? null);
export const healthIsChecking = computed(() => isChecking.value);
export const healthLastError = computed(() => lastError.value);

/** Show the modal: failing, and not yet acknowledged. */
export const healthAlertOpen = computed(
  () => failing.value && !acknowledged.value,
);
/** Show the banner: failing, and already acknowledged. */
export const healthBannerVisible = computed(
  () => failing.value && acknowledged.value,
);

/** The services that are not answering, for the modal and the banner to name. */
export const failedServiceNames = computed(() =>
  healthItems.value.filter(i => i.status === 'unhealthy').map(i => i.name),
);

/**
 * The user has seen it. Both modal buttons come here — one of them navigates to
 * the screen first, and a modal that reappeared on arrival would make the screen
 * unreadable.
 */
export function acknowledgeHealthAlert(): void {
  acknowledged.value = true;
}

export async function checkHealth(): Promise<HealthResult | null> {
  isChecking.value = true;
  try {
    // The instance already carries the console's API base, so the path is given
    // relative to it — spelling out /api here asks for /api/api/... and 404s.
    const res = await axiosPost<HealthResult>('health/subsystems', {});
    result.value = res.data;
    lastError.value = null;
    adoptSettings(res.data);
    applyVerdict(res.data);
    return res.data;
  } catch (e: any) {
    /*
      The console's own endpoint did not answer. That is not the same as a linked
      service being down, and guessing between them would report the wrong thing,
      so the last known answer is kept and the reason is recorded.
    */
    lastError.value = e?.message ?? 'health check failed';
    return null;
  } finally {
    isChecking.value = false;
  }
}

/**
 * Take the interval and threshold the console reports.
 *
 * The timer is rebuilt when the interval changes, so a value edited on the host
 * takes effect on the next check rather than on the next page load.
 */
function adoptSettings(r: HealthResult): void {
  const s = r.settings;
  if (!s) return;

  if (Number.isFinite(s.failureThreshold) && s.failureThreshold > 0) {
    failureThreshold.value = s.failureThreshold;
  }
  if (
    Number.isFinite(s.intervalSec) &&
    s.intervalSec > 0 &&
    s.intervalSec !== intervalSec.value
  ) {
    intervalSec.value = s.intervalSec;
    if (timer !== null) {
      clearInterval(timer);
      timer = setInterval(() => void checkHealth(), intervalSec.value * 1000);
    }
  }
}

function applyVerdict(r: HealthResult): void {
  const healthyNow = r.summary.unhealthy === 0;

  if (healthyNow) {
    everHealthy.value = true;
    consecutiveFailures.value = 0;
    /*
      Back to normal. The banner goes, and so does the acknowledgement — the next
      failure has to interrupt again. Carrying "already seen" forward would mean a
      user who dismissed one failure never hears about the next.
    */
    failing.value = false;
    acknowledged.value = false;
    return;
  }

  if (!everHealthy.value) return;

  consecutiveFailures.value += 1;
  if (consecutiveFailures.value >= failureThreshold.value) failing.value = true;
}

/** Start watching. Safe to call twice; the second call does nothing. */
export function startHealthWatch(): void {
  if (timer !== null) return;
  void checkHealth();
  timer = setInterval(() => void checkHealth(), intervalSec.value * 1000);
}

export function stopHealthWatch(): void {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

/** Test seam — puts the watcher back to how it starts. */
export function resetHealthWatch(): void {
  stopHealthWatch();
  result.value = null;
  isChecking.value = false;
  lastError.value = null;
  everHealthy.value = false;
  consecutiveFailures.value = 0;
  failing.value = false;
  acknowledged.value = false;
  intervalSec.value = DEFAULT_INTERVAL_SEC;
  failureThreshold.value = DEFAULT_FAILURE_THRESHOLD;
}
