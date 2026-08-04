import { toErrorMessage } from '@/shared/utils';

/**
 * Telling "wait and send it again" apart from a real failure, in one place.
 *
 * cb-tumblebug caps its infrastructure lookups at two a second, and cm-beetle queues what it
 * sends there. Either can turn a request away for a moment. Nothing was started when that
 * happens — the work simply was not taken — so the right response is to wait and ask again,
 * not to tell the user it failed.
 *
 * **Why one place.** The judgement used to live inside the workload list screen, and all it did
 * there was pick a different sentence. As more callers need it, a copy in each of them means
 * that the day the server starts marking these refusals with a status code of its own, the
 * change is a hunt rather than an edit. It is one function so that day is one edit.
 *
 * **Why the wording is read at all.** A refusal from cb-tumblebug reaches us through cm-beetle,
 * which wraps it as `API request failed with status: 429, body: {"message":"rate limit exceeded"}`
 * and answers 500 — so the status code alone says nothing. Until the subsystem marks these
 * apart, the sentence is the only signal, and it is matched on the fixed parts of it.
 */

/** Wordings that mean "not taken this time", each from a known source. */
const REFUSAL_MARKERS = [
  'status: 429', // cm-beetle wrapping a cb-tumblebug refusal — its format string is fixed
  'rate limit', // the body of that refusal
  'queue is full', // cm-beetle's own queue, when more arrive than it will hold
] as const;

/** Statuses that mean the same thing on their own. */
const REFUSAL_STATUSES = [
  429, // too many requests
  503, // at capacity for now — cm-beetle answers this when its async jobs are all busy
];

/** Used when the server did not say how long to wait. */
export const DEFAULT_RETRY_DELAY_MS = 2_000;

/** How many times to send it again before handing the decision back to the user. */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * The HTTP status behind a rejection, when there is one.
 *
 * The api wrapper rejects with `{error, errorMsg, status}`, all refs — the axios error sits at
 * `error.value`, and its own `status` is the wrapper's 'error' | 'cancel' string rather than an
 * HTTP code. Reading that one first is what quietly defeats this.
 */
export function httpStatusOf(e: any): number | undefined {
  const fromWrapper = e?.error?.value?.response?.status;
  if (typeof fromWrapper === 'number') return fromWrapper;
  const fromAxios = e?.response?.status;
  if (typeof fromAxios === 'number') return fromAxios;
  return typeof e?.status === 'number' ? e.status : undefined;
}

/** Whether the request was turned away for the moment rather than refused outright. */
export function isRefusedForNow(e: any): boolean {
  const status = httpStatusOf(e);
  if (status !== undefined && REFUSAL_STATUSES.includes(status)) return true;

  const message = toErrorMessage(e, '').toLowerCase();
  return REFUSAL_MARKERS.some(marker => message.includes(marker));
}

/**
 * How long the server asked us to wait, in milliseconds.
 *
 * cm-beetle sends `Retry-After` on the responses it turns away, and the backend proxy relays it
 * both as a header and in the response envelope. Reading the envelope first is deliberate: the
 * browser sees that either way, while a header can be lost to a proxy in between.
 *
 * Returns undefined when the server said nothing, which is the caller's cue to use its own
 * interval rather than to invent a number here.
 */
export function serverRetryDelayMs(e: any): number | undefined {
  const body =
    e?.error?.value?.response?.data?.status?.retryAfter ??
    e?.response?.data?.status?.retryAfter;
  const header =
    e?.error?.value?.response?.headers?.['retry-after'] ??
    e?.response?.headers?.['retry-after'];

  const seconds = Number(body ?? header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : undefined;
}

export interface RetryAttempt {
  /** 1 for the first retry. */
  attempt: number;
  /** How many retries there will be at most. */
  maxRetries: number;
  /** How long until this one goes out. */
  delayMs: number;
}

export interface RetryOptions {
  maxRetries?: number;
  /** Used only when the server did not say how long to wait. */
  fallbackDelayMs?: number;
  /**
   * Called before each wait, and again with `remainingMs` counting down while it waits, so a
   * screen can show what is happening. The countdown is driven from here rather than from the
   * screen so that what is displayed is the wait that is actually taking place.
   */
  onRetry?: (attempt: RetryAttempt, remainingMs: number) => void;
  /** Lets a caller stop a wait it no longer needs — a closed screen, say. */
  signal?: AbortSignal;
}

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs something, and sends it again while the server keeps saying "not now".
 *
 * Only refusals are retried. Anything else — rejected outright, or not understood — is thrown
 * on immediately: sending it again would not change the answer.
 *
 * The number of attempts is capped. Past that point the requests are not what is failing; the
 * far side is busy in a way that a few more will not help, and the user is better served by
 * being told and given the choice than by a screen that keeps trying on its own.
 */
export async function withRefusalRetry<T>(
  run: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const fallbackDelayMs = options.fallbackDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      if (attempt >= maxRetries || !isRefusedForNow(e)) throw e;
      if (options.signal?.aborted) throw e;

      const delayMs = serverRetryDelayMs(e) ?? fallbackDelayMs;
      const info: RetryAttempt = {
        attempt: attempt + 1,
        maxRetries,
        delayMs,
      };

      // Count down a second at a time so the screen can show the wait passing. Sleeping the
      // whole delay in one go would leave the number frozen on its first value, which is the
      // same thing to look at as a screen that has stopped — the very impression this is here
      // to dispel.
      //
      // The last tick is not reported. Reaching zero would show "0 seconds" for the instant
      // before the request goes out, which reads as though the wait had overrun; holding on
      // "1" until it fires is what actually happens.
      let remainingMs = delayMs;
      options.onRetry?.(info, remainingMs);
      while (remainingMs > 0) {
        const step = Math.min(1_000, remainingMs);
        await tick(step);
        if (options.signal?.aborted) throw e;
        remainingMs -= step;
        if (remainingMs > 0) options.onRetry?.(info, remainingMs);
      }
    }
  }
}
