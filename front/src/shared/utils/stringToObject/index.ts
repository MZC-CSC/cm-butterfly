export function parseRequestBody(requestBodyString: string): object {
  try {
    // Use JSON.parse to convert the string into an object
    const parsedObject = JSON.parse(requestBodyString);
    return parsedObject;
  } catch (error) {
    return {};
  }
}

/**
 * Determines whether a request_body string is a cm-cicada runtime reference rather than a literal body value.
 *
 * From cm-cicada v0.5.1 onward, a template task's request_body arrives as a reference string that
 * injects a previous task's output instead of literal JSON. Examples:
 *   - dot-path reference: `infra_recommend_get.cloudInfraModel`
 *   - task-name reference: `infra_recommend_get`
 *   - template reference: `${...}`
 * These strings are not JSON, so `parseRequestBody` drops them to `{}`.
 * Parsing a reference as if it were a literal loses the value entirely, so references must be
 * excluded from parsing and fall back to a component skeleton.
 *
 * Rule: a non-empty string that is not valid JSON is treated as a reference
 * (a literal body is always valid JSON — object/array/string/number).
 */
export function isReferenceRequestBody(requestBodyString: unknown): boolean {
  if (typeof requestBodyString !== 'string') return false;
  const trimmed = requestBodyString.trim();
  if (trimmed === '') return false;
  try {
    JSON.parse(trimmed);
    return false; // valid JSON → literal body, not a reference
  } catch {
    return true; // cannot parse → treated as a runtime reference
  }
}

/**
 * A single field bound to a previous task's output.
 *
 * `task` is the upstream task name, `path` the JSONPath fragment written after
 * it. cm-cicada prefixes a fragment that does not start with `$` with `$.`, so
 * `A.targetInfra` and `A.$.targetInfra` mean the same thing; we keep whatever
 * was written and let the engine normalize.
 */
export interface IFieldReference {
  task: string;
  path: string;
}

/** Matches a value that is *entirely* one `${<task>.<jsonpath>}` reference. */
const WHOLE_VALUE_REFERENCE = /^\$\{([^}]+)\}$/;

/**
 * Reads one field value and reports the reference it carries, or null.
 *
 * Only a value that is entirely a single reference counts. A value that mixes a
 * reference with other text (`"prefix-${A.$.id}"`) is left alone: the engine
 * substitutes it fine, but the editor cannot render it as a chip without losing
 * the surrounding text, so it stays literal text.
 */
export function parseFieldReference(value: unknown): IFieldReference | null {
  if (typeof value !== 'string') return null;
  const match = WHOLE_VALUE_REFERENCE.exec(value.trim());
  if (!match) return null;
  const ref = match[1].trim();
  // cm-cicada splits the reference at the FIRST dot, so a task name containing
  // a dot cannot be referenced at all. Mirror that split here.
  const dot = ref.indexOf('.');
  if (dot <= 0) return null;
  const task = ref.slice(0, dot);
  const path = ref.slice(dot + 1);
  if (!task || !path) return null;
  return { task, path };
}

/** Builds the stored value for a reference. Inverse of `parseFieldReference`. */
export function buildFieldReference(reference: IFieldReference): string {
  return `\${${reference.task}.${reference.path}}`;
}

/**
 * Walks a parsed request body and collects every field that is bound to a
 * previous task's output, keyed by dotted field path (`targetInfra.vNetId`,
 * `targetInfra.nodeGroups[0].specId`).
 *
 * The editor needs this because `isReferenceRequestBody` cannot see these:
 * a body carrying `${...}` is still valid JSON, so it is classified as a
 * literal and the references render as plain text a user can silently break.
 */
export function extractFieldReferences(
  body: unknown,
  basePath = '',
): Map<string, IFieldReference> {
  const found = new Map<string, IFieldReference>();

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(
        ([key, value]) => {
          walk(value, path ? `${path}.${key}` : key);
        },
      );
      return;
    }
    const reference = parseFieldReference(node);
    if (reference && path) found.set(path, reference);
  };

  walk(body, basePath);
  return found;
}

/**
 * Every upstream task referenced by a request body, whichever form it takes:
 * a whole-body reference (`"A"` / `"A.$.x"`) or field references (`${A.$.x}`).
 *
 * Used to keep `dependencies` in step with what the body actually reads — the
 * engine only checks that a referenced task exists somewhere in the workflow,
 * so a missing edge is not caught until the run fails on a missing XCom.
 */
export function referencedTaskNames(
  requestBodyString: string,
  isKnownTask: (name: string) => boolean,
): string[] {
  const names = new Set<string>();
  const trimmed = (requestBodyString ?? '').trim();
  if (!trimmed) return [];

  if (isReferenceRequestBody(trimmed)) {
    // Whole-body reference: the task name is the string, or its head up to the
    // first dot. Try the full string first — a task name may look like a path.
    if (isKnownTask(trimmed)) {
      names.add(trimmed);
    } else {
      const dot = trimmed.indexOf('.');
      const head = dot > 0 ? trimmed.slice(0, dot) : '';
      if (head && isKnownTask(head)) names.add(head);
    }
    return [...names];
  }

  try {
    extractFieldReferences(JSON.parse(trimmed)).forEach(({ task }) => {
      if (isKnownTask(task)) names.add(task);
    });
  } catch {
    // not JSON and not a reference — nothing to read
  }
  return [...names];
}
