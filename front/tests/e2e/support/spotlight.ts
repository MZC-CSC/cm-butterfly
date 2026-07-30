import { Locator, Page } from '@playwright/test';

/**
 * Point at something on screen so a viewer cannot miss it.
 *
 * The recording is shown to people who have never used the console, and the moments that matter are
 * small: a port that became 5555, a spec that is now the one we chose. Those sit in a table of
 * similar-looking rows, and a viewer who does not know where to look will not find them in the
 * second they are on screen.
 *
 * So we do what a presenter does with a laser pointer - draw a ring around it and circle it - and
 * leave a red outline behind for a beat. The outline is an overlay positioned over the element; it
 * does not touch the product's own markup.
 */

const OUTLINE_ID = 'e2e-spotlight';

const OUTLINE_SCRIPT = `(box) => {
  let el = document.getElementById('${OUTLINE_ID}');
  if (!el) {
    el = document.createElement('div');
    el.id = '${OUTLINE_ID}';
    el.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483646',
      'border:3px solid #e11d48',
      'border-radius:6px',
      'box-shadow:0 0 0 3px rgba(225,29,72,.18)',
      'transition:opacity .18s ease',
    ].join(';');
    document.body.appendChild(el);
  }
  const pad = 6;
  el.style.left = (box.x - pad) + 'px';
  el.style.top = (box.y - pad) + 'px';
  el.style.width = (box.width + pad * 2) + 'px';
  el.style.height = (box.height + pad * 2) + 'px';
  el.style.opacity = '1';
}`;

const CLEAR_SCRIPT = `() => {
  const el = document.getElementById('${OUTLINE_ID}');
  if (el) el.style.opacity = '0';
}`;

/**
 * Circle the element with the pointer, outline it, hold, then let go.
 *
 * @param laps how many times to go round - two reads as deliberate, more reads as fidgeting
 */
export async function spotlight(
  page: Page,
  locator: Locator,
  laps = 2,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;

  await page.evaluate(OUTLINE_SCRIPT, box).catch(() => {});

  // Go round the outside of it. The radius follows the element's own size so a wide row gets a wide
  // sweep and a short cell gets a tight one.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = Math.max(48, box.width / 2 + 26);
  const ry = Math.max(30, box.height / 2 + 22);

  const stepsPerLap = 28;
  for (let lap = 0; lap < laps; lap++) {
    for (let i = 0; i <= stepsPerLap; i++) {
      const t = (i / stepsPerLap) * Math.PI * 2;
      await page.mouse.move(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
      await page.waitForTimeout(14);
    }
  }

  // Rest on it, so the last thing seen is the value itself.
  await page.mouse.move(box.x + Math.min(20, box.width / 2), cy);
  await page.waitForTimeout(900);

  await page.evaluate(CLEAR_SCRIPT).catch(() => {});
  await page.waitForTimeout(200);
}
