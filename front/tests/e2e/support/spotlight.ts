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
  const pad = 4;
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
 * The rectangle of the text inside, not of the box around it.
 *
 * ★ A value cell is as wide as the column - a hundred pixels of which ten are the number. Measuring
 *   the element gives the column, so the ring went round the whole row, field label and all. What
 *   is being pointed at is the value, so the value is what gets measured.
 *
 * Falls back to the element when there is nothing to measure (an icon, an empty cell).
 */
async function textBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const measured = await locator
    .evaluate((el: Element) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      let best: DOMRect | null = null;
      while (node) {
        if ((node.textContent ?? '').trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (!best || r.width > best.width)) {
            best = r;
          }
        }
        node = walker.nextNode();
      }
      return best
        ? { x: best.x, y: best.y, width: best.width, height: best.height }
        : null;
    })
    .catch(() => null);

  if (measured) return measured;
  return locator.boundingBox().catch(() => null);
}

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
  const box = await textBox(locator);
  if (!box) return;

  await page.evaluate(OUTLINE_SCRIPT, box).catch(() => {});

  // Go round the outside of it. The radius follows the element's own size so a wide row gets a wide
  // sweep and a short cell gets a tight one.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Hug the value. A ring big enough to enclose the whole cell says "somewhere in this row", which
  // is not what a person means when they point at a number.
  const rx = Math.min(90, Math.max(22, box.width / 2 + 12));
  const ry = Math.min(46, Math.max(15, box.height / 2 + 11));

  const stepsPerLap = 28;
  for (let lap = 0; lap < laps; lap++) {
    for (let i = 0; i <= stepsPerLap; i++) {
      const t = (i / stepsPerLap) * Math.PI * 2;
      await page.mouse.move(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
      await page.waitForTimeout(14);
    }
  }

  // Rest on it, so the last thing seen is the value itself.
  await page.mouse.move(box.x + Math.min(12, box.width / 2), cy);
  await page.waitForTimeout(900);

  await page.evaluate(CLEAR_SCRIPT).catch(() => {});
  await page.waitForTimeout(200);
}
