// One place that knows about every background poll.
//
// The app polls in several places — job tracking, notifications, the session-activity watch, the
// load-test status on the workload screen. When a session ends, all of them have to stop, or a
// leftover poll keeps hitting the API, gets a 401, and puts the user back on the "session expired"
// path from a screen that has no session left. Stopping them one by one meant every new poll was a
// place to forget; a registry makes "stop everything" a single call that new polls opt into.
//
// A poll registers a stop function and gets an unregister back to call when it ends on its own.

const stoppers = new Set<() => void>();

/**
 * Register a poll's stop function. Returns an unregister to call when the poll ends normally, so a
 * finished poll does not linger in the set.
 */
export function registerPoller(stop: () => void): () => void {
  stoppers.add(stop);
  return () => {
    stoppers.delete(stop);
  };
}

/** Stop every registered poll. Safe to call repeatedly; a stopper that throws does not block the rest. */
export function stopAllPolling(): void {
  for (const stop of [...stoppers]) {
    try {
      stop();
    } catch (e) {
      console.warn('a poller stop handler threw', e);
    }
  }
  stoppers.clear();
}
