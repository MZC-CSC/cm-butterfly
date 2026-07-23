import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { WorkloadPage } from '../pages/workload.page';
import { SourceServicesPage } from '../pages/sourceServices.page';
import { sourceServer, workload } from '../fixtures/test-data';
import { scenarioState } from '../support/world';
import { uniqueName } from '../support/naming';

const { Given } = createBdd(test);

/**
 * Steps specific to the migration scenario — most steps reuse the per-domain steps
 * (auth/source/models/workflow/workload) as-is, and this file holds only the scenario teardown.
 *
 * ★ Cleanup must actually delete.
 *   The old implementation cast the Page Object with `as unknown as Record<...>` and then optionally called
 *   *non-existent methods* like `goto?.()` / `selectInfra?.()`, so it deleted nothing and quietly passed (cost leak).
 *   Keep the type as-is and call the real methods. The point is to let the compiler catch typos.
 *
 *   A failed deletion does not break the test (cleanup is best-effort), but every failure must be logged —
 *   if it slips by silently, no one knows a resource was left behind.
 */
Given('생성된 리소스를 정리한다', async ({ page }) => {
  const infraName = scenarioState.infraName ?? workload.infraName;

  // 1) Delete the target infra (MCI) — the core of cost protection
  //
  // ★ Judge two things *separately*.
  //    (a) Does the delete modal close on its own — the screen behavior
  //    (b) Did the infra actually disappear — the resource result
  //
  //    (a) can fail while (b) succeeds (the resource is deleted but the screen just does not close). That is the actual state.
  //    So we do not turn a blind eye to (a) — record a failure as a failure, and still verify (b) all the way.
  //    If a screen defect is worked around and passed in the test, the bug that needs fixing stays invisible forever.
  const wl = new WorkloadPage(page);
  await wl.gotoMci();
  await wl.expectMciListLoaded();
  await wl.selectMci(infraName);
  await wl.openDeleteModal();
  // ★ It must be Normal Delete (= cb-tumblebug `option=terminate`). It actually terminates and removes the VM.
  //
  //   Force Delete (`option=force`) **removes only the metadata regardless of the CSP deletion result** — the modal's
  //   warning banner says so. Cleaning up with that makes it disappear from the list while the EC2 keeps running and
  //   accruing charges. Instances abandoned that way had actually been running for days. Cleanup must mean *the resource
  //   truly goes away*.
  await wl.confirmDelete(infraName, 'normal');

  const modalClosed = await wl.deleteModalClosed();

  // (b) Whether the resource was actually deleted is verified by revisiting the list. This is the substance of cost protection.
  await wl.expectInfraGone(infraName);
  console.log(`[teardown] target infra deletion confirmed: ${infraName}`);

  // (a) The screen defect is surfaced here.
  expect(
    modalClosed,
    'The deletion happened but the delete modal did not close on its own — a screen defect.\n' +
      'MciDeleteModal.handleConfirm holds one delete request synchronously and waits. But deleting an infra actually\n' +
      'reclaims cloud resources, which takes several minutes, and the gateway cuts off at 60s (firing the same request\n' +
      'directly via the API returns a 504, and checking afterward shows the resource is gone). So the screen never\n' +
      'receives a response and the modal does not close. Deletion should be made async (accept → poll status).',
  ).toBeTruthy();

  // 2) Delete the source group — if a source model was created, remove the connection servers too (scenario step 7)
  const groupName = uniqueName(sourceServer.name);
  try {
    const source = new SourceServicesPage(page);
    await source.goto();
    await source.selectGroup(groupName);
    await source.deleteSelectedGroup();
    console.log(`[teardown] source group deleted: ${groupName}`);
  } catch (e) {
    console.warn(
      `[teardown] ★ failed to delete source group (${groupName}) — manual check needed:`,
      (e as Error).message,
    );
  }
});
