import { Page, expect } from '@playwright/test';
import { humanClick } from './humanize';

/**
 * Move to a screen the way a person does - by the left menu.
 *
 * `page.goto()` reloads the whole application. The screen goes white, the shell is drawn again, and
 * the recording carries a flash between every step; several steps in a row and the video blinks its
 * way through the scenario. A menu click is a route change, so the shell stays where it is and only
 * the screen underneath swaps - which is also what a viewer expects to see.
 *
 * The menu is only there once the console is open. Before that - a fresh browser, or straight after
 * a login - there is nothing to click, so the first move has to be a real navigation. That is a
 * difference in where we are starting from, not a second way of finding the same thing.
 *
 * Menu ids are the route names from `entities/menu/model/types.ts` (MENU_ID), and each menu item
 * carries them as `data-testid="menu-{id}"`.
 */
export async function openScreen(
  page: Page,
  menuId: string,
  path: string,
  marker?: string,
): Promise<void> {
  // Already here? Then there is nothing to do.
  //
  // A person on the source services list who wants to add a second one presses Add again - they do
  // not go back to the left menu and click their way in a second time. The recording was doing
  // exactly that, once per registration, and the same loop showed up around the workloads screen.
  //
  // ★ "Here" means the screen, not the address. Sub-views keep the same path - the JSON editor
  //   opened from a target model still reads `/models/target-models` - so a URL match alone said
  //   "already there" while the editor was still on screen, and everything after it looked for
  //   buttons that belong to the list. The caller passes a marker for what the screen itself shows;
  //   without one the address is all there is to go on. (2026-07-31)
  if (page.url().includes(path)) {
    if (!marker) return;
    const onScreen = await page
      .getByTestId(marker)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (onScreen) return;
    // Same address, different screen. Reload to get back to the list itself.
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(escapeForUrl(path)), {
      timeout: 20_000,
    });
    return;
  }

  const insideConsole = page.url().includes('/main/');

  if (insideConsole) {
    await humanClick(page.getByTestId(`menu-${menuId}`));
  } else {
    await page.goto(path);
  }

  await passFirstVisitWelcome(page, path);

  await expect(page).toHaveURL(new RegExp(escapeForUrl(path)), {
    timeout: 20_000,
  });
}

/**
 * Get past the welcome an empty installation puts in the way.
 *
 * On an installation where nothing has been done yet, the console sends the first
 * navigation to the migration guide and opens a welcome dialog over it
 * (`features/guidedSetup`). It is a full-screen layer, so it swallows every click meant
 * for the screen underneath - which is how it showed up here: not as a failed assertion
 * about the dialog, but as a click on a link that "intercepts pointer events".
 *
 * This is not a fallback selector. The dialog is a real state the product has, it appears
 * exactly once per browser, and a scenario that asked for some other screen has to pass
 * through it the same way a person does.
 *
 * Asking for the guide itself is left alone - arriving there is the destination, and
 * 구간1 shows the dialog on purpose.
 */
async function passFirstVisitWelcome(page: Page, path: string): Promise<void> {
  if (path.includes('/migration-guide')) return;

  // The redirect only decides after a progress lookup returns, so it can land a moment
  // after the navigation. Wait for whichever address wins rather than guessing a delay.
  await page
    .waitForURL(
      url =>
        url.pathname.includes(path) ||
        url.pathname.includes('/main/migration-guide'),
      { timeout: 20_000 },
    )
    .catch(() => undefined);

  if (page.url().includes(path)) return;

  const welcome = page.getByTestId('guided-setup-welcome');
  if (!(await welcome.isVisible().catch(() => false))) return;

  // "Just looking" - close it and go where we were going. Start would take us to the
  // first step's screen, which is not necessarily the one that was asked for.
  await humanClick(page.getByTestId('guided-setup-welcome-dismiss'));
  await expect(welcome).toBeHidden({ timeout: 10_000 });
  await page.goto(path);
}

/**
 * Pick a screen from the side list a landing screen shows.
 *
 * Some entries in the sidebar do not go straight to a screen - Workloads opens a page whose own
 * side list carries MCI and PMK (api/conf/menu.yaml has them as children of `workloads`). Those
 * items carry `data-testid="lsb-{id}"`, from the same route names.
 */
export async function openSubScreen(
  page: Page,
  menuId: string,
  subMenuId: string,
  path: string,
): Promise<void> {
  if (page.url().includes(path)) return;

  await openScreen(page, menuId, path.replace(/\/[^/]+$/, ''));
  await humanClick(page.getByTestId(`lsb-${subMenuId}`));
  await expect(page).toHaveURL(new RegExp(escapeForUrl(path)), {
    timeout: 20_000,
  });
}

function escapeForUrl(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
