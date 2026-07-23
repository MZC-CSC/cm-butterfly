import { Locator } from '@playwright/test';

/**
 * humanize — optional "human pacing" for the integration scenario so a person watching a live run
 * (a demo, or eyeballing what the screen does) can actually follow along.
 *
 * ★ Off by default. Gated entirely by the env flag `E2E_HUMAN_PACE`. When it is not `1`, every
 *   helper falls straight through to the plain Playwright action, so CI stays fast and non-paced
 *   runs are byte-for-byte the same behavior as calling `.click()` / `.fill()` directly.
 *
 * ★ Thin wrapper only. It adds hover/focus + small waits around the real action; it never changes
 *   *what* is clicked or typed. Apply it at the scenario's page-object interaction points (login,
 *   source register, model save, recommend, workflow create/run, workload, load test) — not
 *   everywhere.
 *
 * A `slowMo` baseline is also honored via playwright.config launchOptions when E2E_HUMAN_PACE=1
 * (see humanSlowMoMs), which smooths every low-level action; the waits here add the deliberate
 * "read the screen" beats on top of the specific steps that matter in the scenario.
 */

const HOVER_MS = 500; // settle on the target before acting
const PRECLICK_MS = 500; // brief beat so the pointer landing is visible
const HOLD_MS = 1_000; // hold on the resulting screen after a click
const SHORT_FILL_MS = 1_000; // pause after filling a short value
const LONG_FILL_MS = 2_000; // pause after filling a long value
const LONG_TEXT_THRESHOLD = 24; // chars above which a value counts as "long"

/** playwright.config reads this for launchOptions.slowMo (0 = no baseline slow-mo). */
const SLOWMO_MS = 250;

export function isHumanPace(): boolean {
  return process.env.E2E_HUMAN_PACE === '1';
}

/** slowMo baseline for launchOptions — 0 unless human pacing is on. */
export function humanSlowMoMs(): number {
  return isHumanPace() ? SLOWMO_MS : 0;
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Click with human pacing when enabled: hover/focus the target (~0.5s) → small beat (~0.5s) →
 * click → hold the resulting screen (~1s). When disabled, a plain `.click(opts)`.
 *
 * `opts` is forwarded to `.click()` so callers can still pass e.g. a longer timeout. Do not route
 * special clicks (trial clicks, force) through here — keep those as direct `.click()` calls.
 */
export async function humanClick(
  locator: Locator,
  opts?: Parameters<Locator['click']>[0],
): Promise<void> {
  if (!isHumanPace()) {
    await locator.click(opts);
    return;
  }
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  // hover doubles as focus for most controls; ignore hover failure (e.g. zero-size anchors).
  await locator.hover({ timeout: opts?.timeout }).catch(() => {});
  await pause(HOVER_MS);
  await pause(PRECLICK_MS);
  await locator.click(opts);
  await pause(HOLD_MS);
}

/**
 * Fill with human pacing when enabled: focus → `.fill()` (paste-style, NO per-character typing) →
 * pause (~1s for short values, ~2s for long ones) so the entered value is readable. When disabled,
 * a plain `.fill(text)`.
 */
export async function humanFill(locator: Locator, text: string): Promise<void> {
  if (!isHumanPace()) {
    await locator.fill(text);
    return;
  }
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click().catch(() => {}); // focus the field
  await locator.fill(text); // paste-style; deliberately not .type()
  await pause(text.length > LONG_TEXT_THRESHOLD ? LONG_FILL_MS : SHORT_FILL_MS);
}
