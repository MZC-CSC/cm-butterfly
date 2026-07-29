import { Locator, Page } from '@playwright/test';

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

/*
  Demo pacing - the same helpers, slowed to the beat of someone showing the screen to
  another person. Turned on with E2E_DEMO_PACE=1 (which implies human pacing).

  It differs from human pacing in two ways that only matter when the run is being
  watched or recorded: the pointer travels to the target instead of teleporting, and
  text is typed a character at a time rather than pasted.
*/
/*
  Two different pauses, because they are doing two different jobs.

  Before a click the pointer has just travelled to the target, and a brief hold is what makes the
  click read as aimed rather than teleported - a tenth of a second is enough to see it land.

  After typing there is nothing to wait for at all: the characters appeared one by one, so the
  entry was already visible while it happened. A short beat only keeps the value on screen a moment
  before the run moves on.
*/
/** Held after the pointer arrives, before the click. `E2E_DEMO_CLICK_MS` overrides it. */
const DEMO_CLICK_MS = Number(process.env.E2E_DEMO_CLICK_MS ?? 120);
/** Held after a value has been entered. `E2E_DEMO_BEAT_MS` overrides it. */
const DEMO_BEAT_MS = Number(process.env.E2E_DEMO_BEAT_MS ?? 200);
/*
  Playwright's `steps` option sends the intermediate mousemove events back to back, so the
  pointer arrives in a few milliseconds - on screen that still reads as a jump. The glide
  below walks the same path but waits between the steps, which is what makes the travel
  visible at all.
*/
const DEMO_TRAVEL_MS = 450; // time the pointer spends travelling
const DEMO_TRAVEL_STEPS = 30; // points along the way
/*
  A field should never hold the camera for long. Short values are typed, which reads as
  someone entering them; anything long enough that typing would drag is pasted instead and
  simply held for a beat, which is how the values get entered in practice anyway. Either
  way the time spent in the field stays under this budget.
*/
const DEMO_TYPE_BUDGET_MS = 2_000;
const DEMO_MIN_TYPE_DELAY_MS = 25; // below this, typing looks like a paste anyway

export function isDemoPace(): boolean {
  return process.env.E2E_DEMO_PACE === '1';
}

/** playwright.config reads this for launchOptions.slowMo (0 = no baseline slow-mo). */
const SLOWMO_MS = 250;

export function isHumanPace(): boolean {
  return process.env.E2E_HUMAN_PACE === '1' || isDemoPace();
}

/**
 * slowMo baseline for launchOptions — 0 unless human pacing is on.
 *
 * Demo pacing turns it off. slowMo delays *every* low-level action, and the demo path already
 * spends its time where it should be seen: gliding to the target and typing. Keeping both makes
 * each step cost the sum of the two, which is what made the takes feel like they were pausing for
 * a second and a half after every entry.
 */
export function humanSlowMoMs(): number {
  if (isDemoPace()) return 0;
  return isHumanPace() ? SLOWMO_MS : 0;
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Walk the pointer to the middle of the target.
 *
 * Playwright's `.click()` places the pointer at the target and presses in one go, which
 * reads as a screen operating itself. Moving through intermediate points first sends the
 * mousemove events a person's hand would, so the on-screen cursor travels there.
 */
/** Where the pointer was left, so the next glide starts from there. */
let pointerAt: { x: number; y: number } | null = null;

/** Ease-in-out, so the pointer sets off and settles rather than sliding at one speed. */
const ease = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

async function travelTo(locator: Locator): Promise<void> {
  const page: Page = locator.page();
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;

  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const from = pointerAt ?? { x: to.x, y: Math.max(0, to.y - 200) };
  const perStep = Math.max(8, Math.round(DEMO_TRAVEL_MS / DEMO_TRAVEL_STEPS));

  for (let i = 1; i <= DEMO_TRAVEL_STEPS; i++) {
    const t = ease(i / DEMO_TRAVEL_STEPS);
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
    );
    await pause(perStep);
  }
  pointerAt = to;
}

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
  if (isDemoPace()) {
    await travelTo(locator);
    await pause(DEMO_CLICK_MS); // let the pointer be seen on the target before it presses
    await locator.click(opts);
    await pause(DEMO_CLICK_MS); // and let what the click did register
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
  if (isDemoPace()) {
    await travelTo(locator);
    await pause(DEMO_CLICK_MS); // the pointer has arrived; let it be seen before it presses
    await locator.click().catch(() => {});
    await locator.fill('');
    const perChar = text.length
      ? Math.floor(DEMO_TYPE_BUDGET_MS / text.length)
      : 0;
    if (perChar >= DEMO_MIN_TYPE_DELAY_MS) {
      await locator.pressSequentially(text, {
        delay: Math.min(perChar, 70),
      });
      // Nothing to hold for. The characters appeared one at a time, so the value was readable
      // while it was being entered - stopping afterwards only makes the run look stalled, and on
      // a login it turns two quick fields into a wait, a wait, and then a click.
    } else {
      await locator.fill(text); // too long to type without dragging - paste it
      await pause(DEMO_BEAT_MS); // it appeared all at once, so give it a moment to be read
    }
    return;
  }
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click().catch(() => {}); // focus the field
  await locator.fill(text); // paste-style; deliberately not .type()
  await pause(text.length > LONG_TEXT_THRESHOLD ? LONG_FILL_MS : SHORT_FILL_MS);
}
