/**
 * Names for files the console hands to the browser.
 *
 * The rules here stay deliberately modest: take out only what an operating
 * system refuses to store, and add a timestamp so exporting the same thing
 * twice does not quietly overwrite the earlier file. Preserving names more
 * faithfully — length policy, non-ASCII handling, duplicate counters — is a
 * separate piece of work, and this module is the single place it will change.
 */

/** Characters no common operating system accepts in a file name. */
const UNSAFE_CHARACTERS = /[\\/:*?"<>|]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f]/g;

const MAX_BASE_LENGTH = 80;
const FALLBACK_BASE = 'connections';

/**
 * Make a name safe to save.
 *
 * Korean characters and spaces are left as they are. They download without
 * trouble, and stripping them would leave a name nobody could recognise.
 */
export function toSafeFileBaseName(name: string | null | undefined): string {
  const safe = (name ?? '')
    .replace(CONTROL_CHARACTERS, '')
    .replace(UNSAFE_CHARACTERS, '-')
    .replace(/-{2,}/g, '-')
    // Windows drops a trailing dot or space, which would change the name
    // without telling anyone.
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/^[\s.-]+|[\s.-]+$/g, '');

  return safe || FALLBACK_BASE;
}

/** Local time, in the same shape the JSON export already uses. */
export function exportTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Build the download name. The timestamp is what keeps repeated exports of the
 * same connections from landing on top of each other.
 */
export function buildExportFileName(
  baseName: string | null | undefined,
  extension: string,
  date: Date = new Date(),
): string {
  return `${toSafeFileBaseName(baseName)}-${exportTimestamp(date)}.${extension}`;
}
