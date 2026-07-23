/**
 * Names a step that is newly dropped onto the canvas.
 *
 * A name only has to be unique **within a single workflow**. When the engine
 * resolves dependencies it looks at just the task group of one workflow, and
 * when execution starts each step gets a separate identifier with the name
 * serving only as a key to find that identifier. It does not need to be unique
 * across the whole server.
 *
 * We used to append a four-digit random suffix to the name. Producing names no
 * human could read was one problem, but the bigger one was that this logic also
 * ran **when opening a saved workflow**, rewriting the names. Other tasks'
 * dependencies still pointed at the old names, so the links broke. On top of
 * that, the code that stripped the trailing four digits also corrupted tasks
 * whose names legitimately ended that way. Now it runs **only when a step is
 * newly dropped onto the canvas**, and it appends a sequence number.
 */

/** Collect every name currently on the canvas (including nested ones). */
export function collectStepNames(
  steps: Array<any> | undefined,
  out: Set<string> = new Set(),
): Set<string> {
  (steps ?? []).forEach(step => {
    if (step?.name) out.add(String(step.name));
    collectStepNames(step?.sequence, out);
    Object.values(step?.branches ?? {}).forEach(branch =>
      collectStepNames(branch as Array<any>, out),
    );
  });
  return out;
}

/**
 * Pick an unused name — climbing `name`, `name2`, `name3`, and so on.
 *
 * If a name that already has a sequence number is passed back in, we strip the
 * trailing digits first so the numbers don't pile up. Duplicating `sleep2`
 * yields `sleep3`, not `sleep22`.
 */
export function nextAvailableName(
  baseName: string,
  taken: Set<string>,
): string {
  const base = String(baseName).replace(/\d+$/, '') || String(baseName);
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}
