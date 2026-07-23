/**
 * Long-running task tracking runner
 *
 * Long tasks finish after the user has left the screen. To catch the result you
 * need something that runs independent of the screen, and if that "something" is
 * built per task, the polling, overlap prevention, and start-on-login code gets
 * duplicated each time.
 *
 * So we factor out only **"when to run"**. What to ask about differs per task,
 * so each checker knows that itself.
 *
 * ```
 * [runner]  polling · overlap prevention · login/logout lifecycle
 *   ├─ delete checker     check()
 *   ├─ load checker       check()
 *   └─ workflow checker   check()
 * ```
 *
 * Why completion isn't decided in the runner — delete judges completion via a
 * cm-beetle request lookup, load via execution state, and workflow via the run
 * list, each differently. Putting them in one place makes it a **per-task-type
 * branch pile** rather than something shared, and it grows every time a task type
 * is added.
 *
 * A checker does two things: *report whether it's done*, and if so *decide whether
 * to notify* and call `notify()`. The notify decision lives in the checker because
 * that's where the context is — if the user is currently looking at the result on
 * that screen there's no need to raise a badge, and the notification module can't
 * make that call.
 *
 * ★ **A checker must record the name and action at start time.** After it's done
 * only the id is left, so you can't form a sentence about "what finished". To
 * write something like "The **re-run** of the 'Order Service' workflow finished",
 * you have to remember the action (re-run) and the name at start time.
 */

export interface Tracker {
  /** Identifier for logging/debugging. */
  id: string;

  /**
   * One poll's worth of checking. If nothing is in progress it should do nothing and return.
   *
   * If it throws, the runner swallows it — one checker failing shouldn't stop the rest.
   */
  check: () => Promise<void>;

  /**
   * Whether there's still unfinished work.
   *
   * Used to decide whether to keep the session alive. While there's work running in
   * the background it keeps the session going even if you're idle — if the person
   * meant to see the result is gone, there's no point in watching.
   */
  hasWork: () => boolean;

  /** On login, take over whatever was left on the server (optional). */
  resume?: () => Promise<void>;

  /** Clean up on logout (optional). */
  reset?: () => void;
}

const POLL_INTERVAL_MS = 10_000;

const trackers: Tracker[] = [];
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Register a checker. Call it at module load time.
 *
 * Registering the same id twice ignores the later one — so a module evaluated
 * twice doesn't run duplicated.
 */
export function registerTracker(tracker: Tracker): void {
  if (trackers.some(t => t.id === tracker.id)) return;
  trackers.push(tracker);
}

/** Is there any unfinished work at all (for deciding whether to keep the session)? */
export function hasBackgroundWork(): boolean {
  return trackers.some(t => {
    try {
      return t.hasWork();
    } catch {
      return false;
    }
  });
}

async function runOnce(): Promise<void> {
  for (const tracker of trackers) {
    try {
      await tracker.check();
    } catch (e) {
      // If one fails the rest keep running. It retries on the next poll.
      console.warn(`tracker "${tracker.id}" check failed`, e);
    }
  }
}

function scheduleNext(): void {
  if (!running) return;
  // Schedule the next round after the response arrives. With setInterval, calls overlap when a poll takes longer than the interval.
  pollTimer = setTimeout(async () => {
    await runOnce();
    scheduleNext();
  }, POLL_INTERVAL_MS);
}

/**
 * Start tracking — login is the trigger.
 *
 * Whatever browser you sign in from, it takes over what was left on the server and
 * reconciles it *before* you enter that screen.
 */
export async function startTracking(): Promise<void> {
  if (running) return;
  running = true;

  for (const tracker of trackers) {
    try {
      await tracker.resume?.();
    } catch (e) {
      console.warn(`tracker "${tracker.id}" resume failed`, e);
    }
  }

  // If we only set the interval, we'd show a stale state for that whole interval.
  await runOnce();
  scheduleNext();
}

/** Stop on logout. */
export function stopTracking(): void {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  trackers.forEach(t => {
    try {
      t.reset?.();
    } catch {
      /* A cleanup failure shouldn't block logout */
    }
  });
}
