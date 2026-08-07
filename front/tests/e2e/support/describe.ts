import { Locator, Page, expect } from '@playwright/test';
import { humanClick } from './humanize';

/**
 * Write what a thing is for, and make sure it can be read.
 *
 * The walkthrough had been filling in names and leaving every description empty, so a viewer saw
 * `infra-nano-aws-5555` appear with no idea why it exists. The description is where that goes -
 * and unlike the name it is prose, so it is pasted rather than typed out letter by letter.
 *
 * Two things follow from pasting several lines into a small box:
 *
 * - it overflows, and what is on screen is the last line rather than the explanation. The box has a
 *   resize grip at its bottom-right corner, which is what a person reaches for.
 * - nobody can read it in the instant before Save is pressed, so we hold.
 */

/** Drag the textarea's resize grip down until the whole text shows. */
async function growToFit(page: Page, area: Locator): Promise<void> {
  const overflows = await area
    .evaluate(
      (el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight + 2,
    )
    .catch(() => false);
  if (!overflows) return;

  const box = await area.boundingBox();
  if (!box) return;

  // The grip sits in the bottom-right corner.
  const gripX = box.x + box.width - 6;
  const gripY = box.y + box.height - 6;

  const needed = await area
    .evaluate((el: HTMLTextAreaElement) => el.scrollHeight - el.clientHeight)
    .catch(() => 0);
  const drop = Math.min(320, needed + 24);

  await page.mouse.move(gripX, gripY);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(gripX, gripY + (drop * i) / steps);
    await page.waitForTimeout(22);
  }
  await page.mouse.up();

  // Did the drag take? Some builds of the control block resizing, and there is no point pretending
  // the text is readable when it is not - so the box is grown directly and the pointer is put back
  // on the grip in the same instant, the way a cut in the edit would leave it.
  const stillOverflows = await area
    .evaluate(
      (el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight + 2,
    )
    .catch(() => false);
  if (!stillOverflows) return;

  await area
    .evaluate((el: HTMLTextAreaElement) => {
      el.style.height = `${el.scrollHeight + 8}px`;
    })
    .catch(() => {});

  const after = await area.boundingBox();
  if (after) {
    await page.mouse.move(
      after.x + after.width - 6,
      after.y + after.height - 6,
    );
  }
}

/**
 * Paste a description in, make it readable, and leave a beat to read it.
 *
 * @param hold how long to rest on the finished text before moving on
 */
export async function describe(
  page: Page,
  area: Locator,
  text: string,
  hold = 1_200,
): Promise<void> {
  await expect(area).toBeVisible({ timeout: 10_000 });
  await humanClick(area);

  // Pasted, not typed. This is prose someone wrote earlier and dropped in.
  await area.fill(text);

  await growToFit(page, area);
  await page.waitForTimeout(hold);
}
