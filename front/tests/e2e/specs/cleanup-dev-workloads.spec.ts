import { test, expect } from '@playwright/test';
import { getUser } from '../fixtures/test-data';
import { LoginPage } from '../pages/login.page';
import { WorkloadPage } from '../pages/workload.page';

/**
 * Delete every workload on the environment, through the console's own delete.
 *
 * Before recording a run, the environment has to be empty - leftovers from earlier work sit in the
 * list beside what the recording creates and there is no telling them apart on screen.
 *
 * It deletes through the screen rather than by wiping the platform's data, because the two are not
 * the same thing. Removing the data leaves the instances, networks and keys standing at the cloud
 * provider with nothing left pointing at them, and they keep costing money and holding names that
 * the next run wants. Delete is what releases them.
 *
 * Not tagged, so no project picks it up. Run it deliberately:
 *
 *   BASE_URL=http://cmig.dev.cscmzc.com npx playwright test \
 *     --config=tests/e2e/playwright.config.ts --project=integration \
 *     tests/e2e/specs/cleanup-dev-workloads.spec.ts
 */
test('delete every workload through the console', async ({ page }) => {
  test.setTimeout(60 * 60_000);

  const user = getUser('cmiguser');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.id, user.password);
  await login.expectLoggedIn();

  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();

  // Re-read the list each time round. Deleting reorders it, and an index taken before the first
  // delete would walk off the end or skip a row.
  for (let round = 1; round <= 30; round++) {
    await wl.gotoMci();
    await wl.expectMciListLoaded();
    const names = await page
      .getByTestId('mci-list-table')
      .locator('tbody tr')
      .filter({ has: page.locator('td.select-checkbox') })
      .locator('td')
      .nth(1)
      .allInnerTexts()
      .catch(() => [] as string[]);
    const remaining = names.map(n => n.trim()).filter(Boolean);
    if (!remaining.length) {
      console.log(`[cleanup] 남은 워크로드 없음 (라운드 ${round})`);
      return;
    }
    const target = remaining[0];
    console.log(`[cleanup] 삭제: ${target} (남은 ${remaining.length}건)`);
    try {
      await wl.selectMci(target);
      await wl.openDeleteModal();
      await wl.confirmDelete(target, 'normal');
    } catch (e) {
      // A row that is already on its way out still shows in the list with its actions shut off.
      // That is not a failure to report - wait for it to go and read the list again.
      console.log(
        `[cleanup] ${target} 삭제를 열 수 없음 (이미 진행 중일 수 있음)`,
      );
    }

    // The provider takes its time, and while it is working the row is still listed with its actions
    // shut off - going straight back round would try to delete the same one again and find nothing
    // to click. Wait for the row itself to go.
    const gone = Date.now() + 15 * 60_000;
    while (Date.now() < gone) {
      await page.waitForTimeout(20_000);
      await wl.gotoMci().catch(() => {});
      const still = await wl
        .mciRow(target)
        .count()
        .catch(() => 1);
      if (!still) break;
      console.log(`[cleanup] ${target} 삭제 진행 중`);
    }
  }

  expect(false, '30회 반복 후에도 워크로드가 남아 있다').toBe(true);
});
