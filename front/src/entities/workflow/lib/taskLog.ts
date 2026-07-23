/**
 * Normalize a task log into something displayable on screen.
 *
 * The log the engine returns is not plain text. It's the whole tuple list from
 * the execution engine's response (hostname, log body) stringified as-is, and
 * the line breaks are the literal two characters, not real newlines. Rendered
 * as-is, the entire log collapses into one line with junk wrapped around it.
 *
 * ⚠️ This is a stopgap. Once the engine returns plain text (upstream request),
 *    this util goes away. If the format isn't what we expect, it returns the raw
 *    text unchanged — it doesn't hide a parse failure.
 */

/** Strip the `[('hostname', '...body...')]` shell and turn literal newlines into real ones. */
export function normalizeTaskLog(raw: unknown): string {
  const text = toText(raw);
  if (!text) return '';

  const unwrapped = unwrapTupleList(text) ?? text;
  return unwrapped.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function toText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const content = (raw as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

function unwrapTupleList(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[(') || !trimmed.endsWith(')]')) return null;

  // Pull just the body out of ('hostname', '<body>'). The body is inside the last quote pair.
  const match = trimmed.match(
    /^\[\(\s*['"][^'"]*['"]\s*,\s*(['"])([\s\S]*)\1\s*\)\]$/,
  );
  return match ? match[2] : null;
}

const FAILURE_MARKERS = [
  'AirflowException',
  'Traceback (most recent call last)',
  'non-zero exit code',
  'ERROR -',
  'Error:',
];

/**
 * Extract the section of the log that looks like the failure cause.
 *
 * The engine doesn't summarize the failure reason (there's no such field in the
 * response). So we scan the log from the end looking for cause markers. If none
 * is found we **return empty rather than guess** — at that point the screen says
 * "couldn't find the cause" and shows the full log instead.
 */
export function extractFailureSummary(log: string, maxLines = 6): string {
  if (!log) return '';

  const lines = log.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (FAILURE_MARKERS.some(marker => lines[i].includes(marker))) {
      return lines
        .slice(i, i + maxLines)
        .join('\n')
        .trim();
    }
  }
  return '';
}
