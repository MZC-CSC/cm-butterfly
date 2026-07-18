/**
 * Links to user guides that live in the repository docs.
 *
 * The guides are Markdown, so GitHub renders them directly — no docs site is
 * needed. Keeping the URLs here means a moved or renamed guide is a one-line
 * change rather than a hunt through components.
 */
const DOCS_BASE =
  'https://github.com/MZC-CSC/cm-butterfly/blob/develop/docs/guide';

export const DOC_LINKS = {
  sourceConnectionBulkImport: `${DOCS_BASE}/source-connection-bulk-import.md`,
} as const;

/**
 * Opens a guide in a new tab. `noopener` keeps the opened page from reaching
 * back into this one through `window.opener`.
 */
export function openDocLink(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
