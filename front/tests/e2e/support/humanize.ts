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
/**
 * ★ 2026-07-31: 데모 속도를 절반으로 줄였다(=두 배 빠르게).
 *
 *   사람처럼 보이게 하려고 넉넉히 잡았더니 보는 쪽에서는 늘어졌다. 커서가 눈에 띄고 무엇을 눌렀는지
 *   읽히는 데 필요한 만큼만 남기고 나머지를 걷어낸다. 값은 환경변수로 여전히 조절할 수 있다.
 */
/** Held after the pointer arrives, before the click. `E2E_DEMO_CLICK_MS` overrides it. */
const DEMO_CLICK_MS = Number(process.env.E2E_DEMO_CLICK_MS ?? 45);
/** Held after a value has been entered. `E2E_DEMO_BEAT_MS` overrides it. */
const DEMO_BEAT_MS = Number(process.env.E2E_DEMO_BEAT_MS ?? 75);
/*
  Playwright's `steps` option sends the intermediate mousemove events back to back, so the
  pointer arrives in a few milliseconds - on screen that still reads as a jump. The glide
  below walks the same path but waits between the steps, which is what makes the travel
  visible at all.
*/
const DEMO_TRAVEL_MS = 170; // time for a journey across the whole screen
const DEMO_TRAVEL_MIN_MS = 45; // time for a hop to the neighbouring control
/*
  가장 긴 이동에 찍는 지점 수.

  ★ 서른 개였는데, 그만큼이 *한 번에 하나씩* 브라우저로 나간다. 계산상 170ms 짜리 이동이 실제로는
    왕복 시간에 눌려 0.5초 가까이 걸렸고, 화면은 빠르게 넘어가는데 커서만 끌리듯 움직였다 —
    사람이 손을 옮기는 모습이 아니라 렉이 걸린 모습이다 (2026-08-24 사용자 지적).

    열 개면 24fps 에서 지점 사이가 두어 프레임이라 충분히 매끄럽고, 왕복이 3분의 1로 준다.
*/
const DEMO_TRAVEL_STEPS = 10; // points along the longest journey
const DEMO_TRAVEL_REFERENCE_REACH = 2200; // screen diagonal to fall back on, in pixels
/*
  A field should never hold the camera for long. Short values are typed, which reads as
  someone entering them; anything long enough that typing would drag is pasted instead and
  simply held for a beat, which is how the values get entered in practice anyway. Either
  way the time spent in the field stays under this budget.
*/
const DEMO_TYPE_BUDGET_MS = 700;
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

/**
 * Where a person would put the pointer on this element.
 *
 * The first line of text inside it, a little in from its start — that is what the eye goes to and
 * what the finger follows. Falls back to the middle of the element when it holds no text.
 */
async function aimPoint(
  locator: Locator,
  box: { x: number; y: number; width: number; height: number },
): Promise<{ x: number; y: number }> {
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const text = await locator
    .evaluate((el: Element) => {
      // The first non-empty text node's own rectangle - not the element's, which spans the
      // whole control including its padding and any empty space beside the label.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? '').trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }
        }
        node = walker.nextNode();
      }
      return null;
    })
    .catch(() => null);

  if (!text) return middle;

  // A short way in from the left edge of the words, so the pointer sits on a letter rather than on
  // the boundary. Never past the middle of the label.
  const intoText = Math.min(14, text.width / 2);
  return { x: text.x + intoText, y: text.y + text.height / 2 };
}

async function travelTo(locator: Locator): Promise<void> {
  const page: Page = locator.page();
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;

  // Aim where the words are, not at the middle of the box.
  //
  // A wide control - a full-width row, a link that stretches across the panel - has its label at the
  // left and empty space to the right. Clicking the box's centre lands well past the end of the
  // text, which is not where anyone would put the pointer: the recording shows a click into blank
  // space several centimetres from what it is supposedly pressing.
  //
  // So the target is the start of the label. `textBox()` measures the text itself; when there is no
  // text to measure (an icon button) the box's centre is right anyway.
  const to = await aimPoint(locator, box);
  const from = pointerAt ?? { x: to.x, y: Math.max(0, to.y - 200) };

  // Time the journey by how far it is, not by a fixed budget.
  //
  // Every move used to take the same 450ms, so crossing the window and hopping to the next field
  // looked equally urgent - and the short hop, covering a few dozen pixels over that long, crawled.
  // A hand moves a short distance quickly and takes longer only when there is ground to cover.
  //
  // Distance is measured against the window's diagonal so the pacing holds at any viewport.
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const viewport = page.viewportSize();
  const reach = viewport
    ? Math.hypot(viewport.width, viewport.height)
    : DEMO_TRAVEL_REFERENCE_REACH;
  const share = Math.min(1, distance / reach);

  const duration =
    DEMO_TRAVEL_MIN_MS + (DEMO_TRAVEL_MS - DEMO_TRAVEL_MIN_MS) * share;
  // Fewer points for a short hop - thirty of them across forty pixels is finer than the screen can
  // show, and each one still costs a round trip to the browser.
  const steps = Math.max(4, Math.round(DEMO_TRAVEL_STEPS * share));
  // 왕복 자체가 이미 시간을 먹으므로 그만큼 빼고 쉰다 — 빼지 않으면 계산보다 훨씬 느려진다.
  const perStep = Math.max(0, Math.round(duration / steps) - 8);

  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
    );
    await pause(perStep);
  }
  pointerAt = to;
}

/**
 * Drag something by its handle, the way a hand would.
 *
 * ★ Not `page.mouse.down()` on a spot. The drawn cursor follows `page.mouse`, so a drag that starts
 *   without travelling there first shows the window moving while the pointer sits somewhere else
 *   entirely - which is what the help window did: it slid across the screen with the cursor still
 *   over the button that had undocked it. The pointer has to arrive at the handle, press, carry it,
 *   and let go.
 *
 * @param handle what is grabbed - a title bar, a resize corner
 * @param by how far to carry it
 */
export async function humanDrag(
  handle: Locator,
  by: { dx: number; dy: number },
): Promise<void> {
  const page: Page = handle.page();
  await handle.scrollIntoViewIfNeeded().catch(() => {});
  const box = await handle.boundingBox().catch(() => null);
  if (!box) return;

  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Arrive first, so the press happens where the pointer is.
  await travelToPoint(page, from);
  await pause(isDemoPace() ? 320 : 60);
  await page.mouse.down();
  await pause(isDemoPace() ? 220 : 40);

  // Carry it in steps - a single jump reads as the window teleporting.
  const steps = isDemoPace() ? 40 : 12;
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await page.mouse.move(from.x + by.dx * t, from.y + by.dy * t);
    await pause(isDemoPace() ? 14 : 4);
  }
  pointerAt = { x: from.x + by.dx, y: from.y + by.dy };

  await pause(isDemoPace() ? 220 : 40);
  await page.mouse.up();
  await pause(isDemoPace() ? 420 : 80);
}

/** Move the pointer to a point with the same pacing `travelTo` uses for elements. */
async function travelToPoint(
  page: Page,
  to: { x: number; y: number },
): Promise<void> {
  const from = pointerAt ?? { x: to.x, y: Math.max(0, to.y - 200) };
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const viewport = page.viewportSize();
  const reach = viewport
    ? Math.hypot(viewport.width, viewport.height)
    : DEMO_TRAVEL_REFERENCE_REACH;
  const share = Math.min(1, distance / reach);
  const duration =
    DEMO_TRAVEL_MIN_MS + (DEMO_TRAVEL_MS - DEMO_TRAVEL_MIN_MS) * share;
  const steps = Math.max(4, Math.round(DEMO_TRAVEL_STEPS * share));
  // 왕복 자체가 이미 시간을 먹으므로 그만큼 빼고 쉰다 — 빼지 않으면 계산보다 훨씬 느려진다.
  const perStep = Math.max(0, Math.round(duration / steps) - 8);

  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
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
/**
 * @param opts Playwright 의 click 옵션에 하나를 더 받는다.
 *   `pauseBeforeMs` — 커서가 닿고 누르기까지 더 기다릴 시간.
 *   ★ 누르자마자 확인 창이 뜨는 버튼이 있다. 기본 간격으로는 커서가 닿는 것과 창이 뜨는 것이 거의
 *     같은 프레임이라, 보는 사람은 *무엇을 눌러서* 그 창이 떴는지 알 수 없다. 그런 자리에만 한
 *     박자를 더 준다. (2026-07-31)
 */
/**
 * 값이 있는 자리에 커서를 두고 잠깐 머무른다 — 원을 그리지 않는다.
 *
 * ★ 강조 고리(spotlight)를 쓰던 자리를 이것으로 바꾼다. 고리는 요소의 사각형을 감싸는데,
 *   **입력칸에는 글자 노드가 없어 칸 전체가 잡힌다.** 값은 왼쪽에 있고 칸은 넓으니, 정작 값이
 *   없는 오른쪽 빈 자리를 감싼 채 돌았다. 게다가 도는 동안 화면이 다시 그려지면 고리만 남아
 *   뚝뚝 끊긴다(원본 촬영본에서도 그랬다).
 *
 *   사람이 하는 일은 그 값에 손을 얹고 잠깐 두는 것이다. 커서는 `travelTo` 가 이미 *글자가
 *   시작되는 곳*을 겨누므로 넓은 칸에서도 값 위에 놓인다. (2026-08-24 사용자 결정)
 */
/**
 * 요소를 화면 *가운데*로 끌어온다.
 *
 * ★ `scrollIntoViewIfNeeded` 는 조금이라도 보이면 아무 것도 하지 않는다. 그래서 버튼이 아래쪽에
 *   반쯤 걸린 채로 눌리고, 영상에서는 무엇을 눌렀는지 흐릿하게 남는다 (2026-08-24 사용자 지적 —
 *   부하 설정 확인 버튼). 눌리는 것이 보여야 하는 자리에서는 가운데로 끌어온다.
 */
export async function bringIntoFullView(locator: Locator): Promise<void> {
  await locator
    .evaluate((el: Element) =>
      el.scrollIntoView({ block: 'center', inline: 'nearest' }),
    )
    .catch(() => {});
  await pause(400);
}

export async function pointAt(locator: Locator, holdMs = 1_000): Promise<void> {
  if (!isDemoPace()) {
    // 촬영이 아니면 커서를 그리지 않는다 — 그 자리가 화면에 있는지만 확인한다.
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    return;
  }
  await travelTo(locator);
  await pause(holdMs);
}

export async function humanClick(
  locator: Locator,
  opts?: Parameters<Locator['click']>[0] & { pauseBeforeMs?: number },
): Promise<void> {
  const { pauseBeforeMs, ...clickOpts } = opts ?? {};
  if (!isHumanPace()) {
    await locator.click(clickOpts);
    return;
  }
  if (isDemoPace()) {
    await travelTo(locator);
    await pause(pauseBeforeMs ?? DEMO_CLICK_MS); // let the pointer be seen on the target
    await locator.click(clickOpts);
    await pause(DEMO_CLICK_MS); // and let what the click did register
    return;
  }
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  // hover doubles as focus for most controls; ignore hover failure (e.g. zero-size anchors).
  await locator.hover({ timeout: opts?.timeout }).catch(() => {});
  await pause(HOVER_MS);
  await pause(PRECLICK_MS);
  await locator.click(clickOpts);
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
    // No hold on either side of a text field. The pointer travels there visibly and the characters
    // appear one at a time, so both the aiming and the entering are already on screen - a pause
    // before and after just turns filling a form into a series of stops.
    await travelTo(locator);
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
