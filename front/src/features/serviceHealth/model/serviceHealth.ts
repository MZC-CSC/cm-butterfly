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

export interface HealthResult {
  summary: HealthSummary;
  items: HealthItem[];
}

/*
  Settings, not constants.

  How often to look, and how many failures in a row before saying so, depend on
  the environment: a demo box that is restarted all day and a long-running
  installation want different answers. Defaults are what a normal lineup wants.
*/
function envNumber(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CHECK_INTERVAL_SEC = envNumber(
  import.meta.env?.VITE_HEALTH_CHECK_INTERVAL_SEC,
  300,
);

/*
  One failed check is not a failure yet. A service restarting, or a request that
  happened to land during a redeploy, answers again on the next look — telling
  the user about that is noise, and noise is what makes a real alert ignorable.
*/
export const FAILURE_THRESHOLD = envNumber(
  import.meta.env?.VITE_HEALTH_CHECK_FAILURE_THRESHOLD,
  2,
);

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
    const res = await axiosPost<HealthResult>('api/health/subsystems', {});
    result.value = res.data;
    lastError.value = null;
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
  if (consecutiveFailures.value >= FAILURE_THRESHOLD) failing.value = true;
}

/** Start watching. Safe to call twice; the second call does nothing. */
export function startHealthWatch(): void {
  if (timer !== null) return;
  void checkHealth();
  timer = setInterval(() => void checkHealth(), CHECK_INTERVAL_SEC * 1000);
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
}
