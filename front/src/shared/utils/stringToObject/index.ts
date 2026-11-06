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
    // Not JSON. That used to settle it, and it was wrong twice over.
    //
    // A body carrying a reference into a number, boolean, array or object field is
    // not JSON either — the reference sits there unquoted so the engine can
    // substitute the right type (see buildRequestBodyTemplate). And a body that is
    // simply *malformed* is not JSON either, but calling that a reference hides the
    // damage: the panel opens as though the whole body were one reference, and the
    // fields the user wrote are gone with nothing said.
    //
    // So a whole-body reference has to look like one: a task name, optionally
    // followed by a path. Braces, quotes, commas and spaces mean it is meant to be
    // a body, and if it will not parse then it is broken.
    if (parseRequestBodyTemplate(trimmed)) return false;
    return WHOLE_BODY_REFERENCE.test(trimmed);
  }
}

/**
 * What a whole-body reference may look like: `infra_recommend_get`, or that name
 * followed by a path (`infra_recommend_get.$.cloudInfraModel`). Nothing that could
 * only belong to a body.
 */
const WHOLE_BODY_REFERENCE = /^[A-Za-z_][\w-]*(\.[^\s"'{}[\],]+)*$/;

/**
 * A request body that cannot be read at all — neither JSON, nor a template with
 * references in it, nor a reference to a whole task result.
 *
 * The editor draws the body as fields, so it has to parse it. When it cannot, the
 * fields cannot be drawn and there is nothing to edit; saying so is the only honest
 * thing to do, because falling back quietly loses whatever was written.
 */
export function isUnreadableRequestBody(requestBodyString: unknown): boolean {
  if (typeof requestBodyString !== 'string') return false;
  const trimmed = requestBodyString.trim();
  if (trimmed === '') return false;
  if (parseRequestBodyTemplate(trimmed)) return false;
  return !WHOLE_BODY_REFERENCE.test(trimmed);
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

// ─────────────────────────────────────────────────────────────────────────────
// The stored body is a *template*, not JSON
//
// cm-cicada keeps `request_body` as an opaque string and only the operator makes
// JSON out of it, by substituting each `${task.path}` with the value it pulls.
// That substitution is textual, and it is asymmetric:
//
//     return value if isinstance(value, str) else json.dumps(value)
//
// A string arrives WITHOUT quotes, everything else arrives as JSON text. So the
// quotes have to come from the template, and which side they belong on depends
// on the type of the field being filled:
//
//     "name": "${a.$.n}"   → "name": "abc"        a string field
//     "count": ${a.$.n}    → "count": 5           a number field
//     "spec": ${a.$.s}     → "spec": {"id": 1}    an object field
//
// Wrapping every reference in quotes — which is what `JSON.stringify` does, since
// a reference is stored as a string — sends "5" where 5 was meant, and breaks the
// body outright when the value is an object. So a body carrying a reference into
// anything other than a string field is NOT valid JSON while it sits in storage.
// It becomes JSON when the workflow runs.
//
// These two functions are that boundary: one writes the template, the other reads
// it back. Nothing else in the console should call `JSON.stringify`/`JSON.parse`
// on a request body.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks a value that was written into the template without quotes, so reading it
 * back can tell the two apart. Never leaves this module.
 */
const RAW_MARK = '\u0000raw\u0000';

/**
 * The same mark, escaped, for writing into JSON text.
 *
 * A raw NUL is not allowed inside a JSON string, so the mark goes in as its
 * escape and `JSON.parse` turns it back into the character above. Escaped is also
 * why no real value can collide with it — the source text would have had to carry
 * a NUL of its own.
 */
const RAW_MARK_ESCAPED = '\\u0000raw\\u0000';

/**
 * Writes the request body as cm-cicada expects it.
 *
 * `rawPaths` names the fields whose reference must go in unquoted — the ones
 * whose schema type is not `string`. Paths are dotted from the body root, in the
 * same shape `extractFieldReferences` produces (`targetInfra.nodeGroups[0].id`).
 */
export function buildRequestBodyTemplate(
  body: unknown,
  rawPaths: Iterable<string> = [],
): string {
  const raw = new Set(rawPaths);

  const write = (node: unknown, path: string): string => {
    if (Array.isArray(node)) {
      return `[${node
        .map((item, index) => write(item, `${path}[${index}]`))
        .join(',')}]`;
    }
    if (node && typeof node === 'object') {
      const parts = Object.entries(node as Record<string, unknown>).map(
        ([key, value]) =>
          `${JSON.stringify(key)}:${write(value, path ? `${path}.${key}` : key)}`,
      );
      return `{${parts.join(',')}}`;
    }
    // The one place quotes are dropped: a field that does not take a string, whose
    // value is entirely one reference.
    if (
      typeof node === 'string' &&
      raw.has(path) &&
      WHOLE_VALUE_REFERENCE.test(node.trim())
    ) {
      return node.trim();
    }
    return JSON.stringify(node) ?? 'null';
  };

  return write(body, '');
}

/**
 * Reads a stored request body back into a model, and reports which fields carried
 * an unquoted reference so writing it again produces the same text.
 *
 * Returns null when the text is not a body at all — a whole-body reference
 * (`"infra_recommend_get"`), or something that is neither.
 */
export function parseRequestBodyTemplate(
  text: string,
): { model: any; rawPaths: string[] } | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;

  // Quote the bare references so the text becomes JSON, keeping a mark on each so
  // they can be told apart from the ones that were quoted to begin with.
  let quoted = '';
  let inString = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      quoted += ch;
      if (ch === '\\') {
        i += 1;
        quoted += trimmed[i] ?? '';
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      quoted += ch;
      continue;
    }
    if (ch === '$' && trimmed[i + 1] === '{') {
      const end = trimmed.indexOf('}', i);
      if (end < 0) return null;
      quoted += `"${RAW_MARK_ESCAPED}${trimmed.slice(i, end + 1)}"`;
      i = end;
      continue;
    }
    quoted += ch;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(quoted);
  } catch {
    return null;
  }
  // A bare string or number is not a body — `"infra_recommend_get"` is a
  // whole-body reference and belongs to the other path.
  if (!parsed || typeof parsed !== 'object') return null;

  const rawPaths: string[] = [];
  const strip = (node: any, path: string): any => {
    if (Array.isArray(node)) {
      return node.map((item, index) => strip(item, `${path}[${index}]`));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, any> = {};
      Object.entries(node).forEach(([key, value]) => {
        out[key] = strip(value, path ? `${path}.${key}` : key);
      });
      return out;
    }
    if (typeof node === 'string' && node.startsWith(RAW_MARK)) {
      if (path) rawPaths.push(path);
      return node.slice(RAW_MARK.length);
    }
    return node;
  };

  return { model: strip(parsed, ''), rawPaths };
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

  // A body, whether plain JSON or a template with unquoted references in it.
  const body = parseRequestBodyTemplate(trimmed);
  if (body) {
    extractFieldReferences(body.model).forEach(({ task }) => {
      if (isKnownTask(task)) names.add(task);
    });
  }
  return [...names];
}
