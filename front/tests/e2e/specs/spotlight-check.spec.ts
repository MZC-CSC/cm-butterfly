import { test, expect } from '@playwright/test';
import { getUser, workflowData } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkflowPage } from '../pages/workflow.page';
import { installCursor } from '../support/cursor';
import { spotlight } from '../support/spotlight';

/**
 * Does the highlight land on the value, and only on the value?
 *
 * Running the whole walkthrough to look at one ring costs half an hour, so this records just the
 * moments the ring is drawn. The frames are then read back to see where it went - the ring should
 * hug the text, not the column it sits in.
 *
 *   BASE_URL=http://cmig.dev.cscmzc.com npx playwright test \
 *     --config=tests/e2e/playwright.specs.config.ts spotlight-check
 */
test('the highlight lands on the value @integration', async ({ page }) => {
  test.setTimeout(5 * 60_000);

  await installCursor(page);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const wf = new WorkflowPage(page);
  await wf.gotoWorkflows();

  // A name in a wide column - the case that went wrong, where the ring took the whole row.
  const nameCell = page
    .getByTestId('workflow-list-table')
    .getByRole('row')
    .filter({ hasText: workflowData.failureSampleName })
    .first()
    // 이름이 든 칸 — 첫 칸은 체크박스라 글자가 없다
    .locator('td')
    .filter({ hasText: workflowData.failureSampleName })
    .first();

  await expect(
    nameCell,
    '샘플 워크플로우가 목록에 없다 — scripts/seed-samples.sh 로 심는다',
  ).toBeVisible({ timeout: 20_000 });

  // Where the ring should be, measured the same way the highlight measures it.
  const textRect = await nameCell.evaluate((el: Element) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if ((node.textContent ?? '').trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (r.width > 0) return { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      node = walker.nextNode();
    }
    return null;
  });
  const cellBox = await nameCell.boundingBox();

  console.log(`[spotlight] 셀 폭 ${Math.round(cellBox?.width ?? 0)}px`);
  console.log(`[spotlight] 글자 폭 ${Math.round(textRect?.w ?? 0)}px`);

  await spotlight(page, nameCell);

  // The ring follows the text, so the text has to be the smaller of the two - otherwise there is
  // nothing being narrowed down and the check proves nothing.
  expect(textRect, '글자 사각형을 재지 못했다').toBeTruthy();
  expect(
    textRect!.w,
    '글자가 셀만큼 넓다 — 이 셀로는 강조 범위를 확인할 수 없다',
  ).toBeLessThan((cellBox?.width ?? 0) * 0.9);
});
