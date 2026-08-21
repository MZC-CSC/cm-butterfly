/**
 * Choosing a file the way a person does, when the desktop is what is being recorded.
 *
 * Playwright can answer a file request before the window ever opens, and that is the right thing
 * to do for a normal run - it is faster and does not need a desktop at all. But it means the act
 * of choosing never happens, and on a recording the filename appears out of nowhere.
 *
 * When the whole screen is being captured (x11), the window is worth having: it opens, a path goes
 * in, it closes, and the file is there. These helpers drive that window.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Is the desktop itself being recorded?
 *
 * Set by the x11 recording script. Everything else - CI, a local run, the browser's own recorder -
 * leaves it unset and takes the route that needs no desktop.
 */
export function screenCapturesTheDesktop(): boolean {
  return process.env.E2E_DESKTOP_CAPTURE === '1' && !!process.env.DISPLAY;
}

/**
 * The folder the dialog opens in, and the browser's home while the desktop is being recorded.
 *
 * ★ Without this the dialog opens on the real home directory and lists every working folder on the
 *   machine - checkouts, tool caches, someone's name. That is on screen for as long as the dialog
 *   is, which is the whole point of opening it. Giving the browser a home of its own means the
 *   dialog opens somewhere that holds the file being picked and nothing else.
 */
export function desktopDialogHome(): string {
  const dir = path.join(os.tmpdir(), 'e2e-file-picker');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Put the file where the dialog opens, and hand back the path.
 *
 * Anything an earlier run left is cleared first, so the dialog shows the one file being picked
 * rather than a pile of them. The browser's own dotfiles live here too and are left alone - the
 * dialog does not list hidden entries.
 */
export function writeTempFile(name: string, contents: string): string {
  const dir = desktopDialogHome();
  for (const entry of readdirSync(dir)) {
    if (!entry.startsWith('.')) rmSync(path.join(dir, entry), { force: true });
  }
  const file = path.join(dir, name);
  writeFileSync(file, contents, 'utf-8');
  return file;
}

function press(...args: string[]): void {
  try {
    execFileSync('xdotool', args, { timeout: 10_000 });
  } catch {
    /* The window may not be up yet - the caller waits either side of this. */
  }
}

/**
 * Answer the open file dialog the way a person does.
 *
 * ★ The dialog opens on the account's home directory, and there is no way in from here to move it.
 *   Three levers were tried and each ruled out: typing a path changes the location entry but not
 *   the listing behind it; setting HOME reaches the browser process but not the dialog, because
 *   GTK asks the account rather than reading the variable; and seeding the browser profile's
 *   last-used folder is ignored. So whatever the home directory holds is on screen for as long as
 *   the dialog is up - record this on a machine whose home is empty.
 *
 * ★ Escape is never sent. It looks like it would only dismiss the autocomplete list, but it closes
 *   the whole dialog. The list goes away on its own once Return opens the file.
 */
export async function pickFileInDesktopDialog(filePath: string): Promise<void> {
  const settle = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Ctrl+L turns the dialog's path buttons into a text field.
  press('key', '--clearmodifiers', 'ctrl+l');
  await settle(700);

  // Typed rather than pasted, so the path is readable as it goes in.
  press('type', '--delay', '55', filePath);
  await settle(1_200);

  press('key', 'Return');
  await settle(1_500);
}
