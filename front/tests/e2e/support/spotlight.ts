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

/**
 * ★ 2026-07-31: 도는 속도를 두 배로 올렸다.
 *
 *   가리키는 데 필요한 것은 "저기를 짚었다"가 눈에 들어오는 것뿐인데, 천천히 두 바퀴를 돌면
 *   기다리는 시간이 된다. 한 바퀴가 눈에 남을 만큼만 두고 나머지는 걷어낸다.
 */
const OUTLINE_ID = 'e2e-spotlight';

type Box = { x: number; y: number; width: number; height: number };

/**
 * Draw the outline over the given rectangle.
 *
 * ★ Passed as a *function*, not a string. `page.evaluate` given a string evaluates it as an
 *   expression and **ignores the argument** - so a string holding `(box) => {…}` simply produced a
 *   function object and returned it, never calling it. The pointer circled correctly and no outline
 *   ever appeared; nothing failed, because there was nothing to fail. Only looking at the recording
 *   showed it.
 */
async function drawOutline(page: Page, box: Box): Promise<void> {
  await page
    .evaluate(
      ({ id, b }: { id: string; b: Box }) => {
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('div');
          el.id = id;
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
        el.style.left = `${b.x - pad}px`;
        el.style.top = `${b.y - pad}px`;
        el.style.width = `${b.width + pad * 2}px`;
        el.style.height = `${b.height + pad * 2}px`;
        el.style.opacity = '1';
      },
      { id: OUTLINE_ID, b: box },
    )
    .catch(() => {});
}

async function clearOutline(page: Page): Promise<void> {
  await page
    .evaluate((id: string) => {
      const el = document.getElementById(id);
      if (el) el.style.opacity = '0';
    }, OUTLINE_ID)
    .catch(() => {});
}

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
 * Circle a *piece of text inside* an element.
 *
 * ★ Some values are not elements. The run viewer prints each parameter group - path, query, body -
 *   as one `<pre>` holding the whole JSON, so ringing "the element containing 5555" rings the
 *   entire request body. On screen that reads as pointing at nothing in particular and then
 *   scrolling, which is exactly what it was. The line the value sits on is found by walking the
 *   text and measuring a range over it. (2026-07-31)
 *
 * @returns whether the text was found and circled
 */
export async function spotlightText(
  page: Page,
  container: Locator,
  needle: string,
  laps = 2,
): Promise<boolean> {
  await container.scrollIntoViewIfNeeded().catch(() => {});

  const box = await container
    .evaluate((el: Element, text: string) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const content = node.textContent ?? '';
        const at = content.indexOf(text);
        if (at >= 0) {
          // The whole line reads better than the bare value - `"Ports": "5555"` says what it is.
          const lineStart = content.lastIndexOf('\n', at) + 1;
          let lineEnd = content.indexOf('\n', at);
          if (lineEnd < 0) lineEnd = content.length;

          const range = document.createRange();
          range.setStart(node, lineStart);
          range.setEnd(node, lineEnd);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            // Bring it into view first - a rect off screen cannot be pointed at.
            const el2 = range.startContainer.parentElement;
            el2?.scrollIntoView({ block: 'center' });
            const after = range.getBoundingClientRect();
            return {
              x: after.x,
              y: after.y,
              width: after.width,
              height: after.height,
            };
          }
        }
        node = walker.nextNode();
      }
      return null;
    }, needle)
    .catch(() => null);

  if (!box) return false;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = Math.min(220, Math.max(30, box.width / 2 + 14));
  const ry = Math.min(40, Math.max(14, box.height / 2 + 12));

  const stepsPerLap = 28;
  for (let lap = 0; lap < laps; lap++) {
    for (let i = 0; i <= stepsPerLap; i++) {
      const t = (i / stepsPerLap) * Math.PI * 2;
      await page.mouse.move(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
      await page.waitForTimeout(6);
    }
  }
  await page.mouse.move(box.x + Math.min(12, box.width / 2), cy);
  await page.waitForTimeout(230);
  return true;
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

  // ★ 스크롤이 끝난 *뒤에* 다시 잰다.
  //
  //   위치를 한 번 재고 그대로 돌면, 그 사이 화면이 밀렸을 때 커서가 옛 자리를 돈다 — 실행 상태
  //   화면은 몇 초마다 스스로 다시 그리며 위로 붙으므로 실제로 그렇게 어긋났다. 재는 것과 도는 것
  //   사이에 화면이 움직일 틈을 주지 않는다. (2026-07-31)
  await page.waitForTimeout(250);
  let box = await textBox(locator);
  if (!box) return;

  // 한 번 더 확인한다. 방금 잰 자리가 화면 밖으로 밀렸으면 다시 끌어와 다시 잰다.
  const view = page.viewportSize();
  if (view && (box.y < 0 || box.y + box.height > view.height)) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    const again = await textBox(locator);
    if (again) box = again;
  }

  // 테두리는 그리지 않는다.
  //
  // ★ 빨간 사각형을 씌워 두고 그대로 멈춰 있으면 화면이 잘못된 것처럼 보인다. 가리키는 일은
  //   커서가 잠깐 도는 것으로 충분하고, 그 편이 사람이 하는 동작에 가깝다 (2026-07-30 사용자 판단).
  void drawOutline;

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
      await page.waitForTimeout(7);
    }
  }

  // Rest on it, so the last thing seen is the value itself.
  await page.mouse.move(box.x + Math.min(12, box.width / 2), cy);
  await page.waitForTimeout(250);

  void clearOutline;
  await page.waitForTimeout(100);
}
