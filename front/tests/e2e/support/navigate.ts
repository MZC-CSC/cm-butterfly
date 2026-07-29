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
): Promise<void> {
  const insideConsole = page.url().includes('/main/');

  if (insideConsole) {
    await humanClick(page.getByTestId(`menu-${menuId}`));
  } else {
    await page.goto(path);
  }

  await expect(page).toHaveURL(new RegExp(escapeForUrl(path)), {
    timeout: 20_000,
  });
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
  await openScreen(page, menuId, path.replace(/\/[^/]+$/, ''));
  await humanClick(page.getByTestId(`lsb-${subMenuId}`));
  await expect(page).toHaveURL(new RegExp(escapeForUrl(path)), {
    timeout: 20_000,
  });
}

function escapeForUrl(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
