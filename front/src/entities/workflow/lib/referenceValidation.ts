/**
 * Checking that a workflow only reads results from tasks that ran first.
 *
 * The engine accepts a reference to any task whose name exists in the workflow,
 * including one that runs later or on a branch that never reaches this task. It
 * saves fine and then dies at run time with no result to pull. The editor never
 * produces one — it only offers tasks that run first — but a definition can also
 * arrive from an import, from another tool, or from a hand-edited file, and then
 * nothing has checked it.
 */

import type { ITaskGroupResponse, ITaskResponse } from '../model/types';
import { ancestorsOf } from './designerTopology';
import {
  extractFieldReferences,
  isReferenceRequestBody,
  isUnreadableRequestBody,
  parseFieldReference,
  parseRequestBodyTemplate,
} from '@/shared/utils/stringToObject';

export interface IBrokenReference {
  /** Task holding the bad reference */
  task: string;
  /**
   * Field it sits in, as a dotted path. Empty when the whole body is the
   * reference rather than one field of it.
   */
  field: string;
  /** Task being referenced, which does not run first */
  referencedTask: string;
  /** Why it is wrong — a task can also be referenced that is not there at all */
  reason: 'not-ancestor' | 'unknown-task';
}

/**
 * The request body of a task as cm-cicada stores it.
 *
 * It lives under `spec`, not at the top of the task. Reading the wrong one finds nothing and the
 * check passes every workflow — which is worse than not having the check, because it reads as
 * "this workflow is fine".
 */
const requestBodyOf = (task: ITaskResponse): string =>
  String(
    (task as any)?.spec?.request_body ?? (task as any)?.request_body ?? '',
  );

const allTasksOf = (
  taskGroups: Array<ITaskGroupResponse> | undefined,
): ITaskResponse[] => (taskGroups ?? []).flatMap(group => group.tasks ?? []);

/**
 * Splits a whole-body reference into the task it names and the path after it.
 * Mirrors the engine, which splits at the FIRST dot and treats the whole string
 * as a task name when one by that name exists.
 */
function parseWholeBodyReference(
  requestBody: string,
  isKnownTask: (name: string) => boolean,
): string {
  const trimmed = (requestBody ?? '').trim();
  if (!trimmed || !isReferenceRequestBody(trimmed)) return '';
  if (isKnownTask(trimmed)) return trimmed;
  const dot = trimmed.indexOf('.');
  return dot > 0 ? trimmed.slice(0, dot) : '';
}

/**
 * Every reference in this workflow that points somewhere it should not.
 * Returns an empty list for a workflow built in this editor.
 */
export function findBrokenReferences(
  taskGroups: Array<ITaskGroupResponse> | undefined,
): IBrokenReference[] {
  const tasks = allTasksOf(taskGroups);
  const names = new Set(tasks.map(task => task.name));
  const isKnownTask = (name: string) => names.has(name);
  const broken: IBrokenReference[] = [];

  tasks.forEach(task => {
    const allowed = ancestorsOf(taskGroups, task.name);
    const requestBody = requestBodyOf(task);

    const judge = (referenced: string, field: string): void => {
      if (!referenced) return;
      if (!isKnownTask(referenced)) {
        broken.push({
          task: task.name,
          field,
          referencedTask: referenced,
          reason: 'unknown-task',
        });
        return;
      }
      if (!allowed.has(referenced)) {
        broken.push({
          task: task.name,
          field,
          referencedTask: referenced,
          reason: 'not-ancestor',
        });
      }
    };

    // The whole body is one reference.
    const whole = parseWholeBodyReference(requestBody, isKnownTask);
    if (whole) {
      judge(whole, '');
      return;
    }

    // Individual fields filled from previous tasks.
    //
    // Read with the template reader, not JSON.parse: a reference into a number or an
    // object field is stored unquoted, so the body is not JSON until the engine
    // substitutes. Parsing it as JSON throws and every field in it goes unchecked.
    const body = parseRequestBodyTemplate(requestBody);
    if (body) {
      extractFieldReferences(body.model).forEach((reference, field) =>
        judge(reference.task, field),
      );
    }
  });

  return broken;
}

/** Field paths of the bad references in one task, for marking them on screen. */
export function brokenFieldPathsOf(
  broken: IBrokenReference[],
  taskName: string,
  prefix = 'body_params',
): string[] {
  return broken
    .filter(entry => entry.task === taskName && entry.field)
    .map(entry => (prefix ? `${prefix}.${entry.field}` : entry.field));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bodies the editor cannot draw
//
// The panel renders a request body as fields, so it has to read it first. Two
// things stop that, and both used to pass silently:
//
//   ① the body will not parse at all — a hand-edited file, a bad import
//   ② a value's type is not what the task's schema asks for
//
// ① matters most: the panel opened as though the whole body were one reference
// and every field the user had written was simply not there. Saving from that
// state overwrites the file with the misreading.
// ─────────────────────────────────────────────────────────────────────────────

export interface IBodyProblem {
  /** Task the problem is in */
  task: string;
  /** Field, as a dotted path. Empty when the whole body is unreadable. */
  field: string;
  kind: 'unreadable' | 'type' | 'reference-quoting';
  /** What is there now — the offending text, or the value's type */
  found: string;
  /** What the task asks for. Empty for an unreadable body. */
  expected: string;
}

/** The declared type of one body field, addressed the way references are keyed. */
function schemaTypeAt(
  schema: Record<string, any> | undefined,
  path: string,
): string | undefined {
  let node: any = schema;
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  for (const part of parts) {
    if (!node) return undefined;
    node = /^\d+$/.test(part)
      ? node.items
      : (node.properties || {})[part] || node.items?.properties?.[part];
  }
  return node?.type;
}

/** What a value actually is, in the words the schema uses. */
function valueType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return type;
}

/** Does a value of this type belong in a field declared that way? */
function fits(found: string, expected: string): boolean {
  if (found === expected) return true;
  if (expected === 'number' && found === 'integer') return true;
  if (expected === 'integer' && found === 'number') return true;
  // Nothing is asked of a field the schema does not describe.
  return !expected;
}

/**
 * Everything about this workflow's bodies that the editor cannot draw faithfully.
 *
 * `schemaOf` gives the body schema for a task component — the same one the panel
 * builds its fields from. Without it the type check is skipped, because a field the
 * schema says nothing about asks nothing of its value.
 */
export function findBodyProblems(
  taskGroups: Array<ITaskGroupResponse> | undefined,
  schemaOf: (componentName: string) => Record<string, any> | undefined,
): IBodyProblem[] {
  const problems: IBodyProblem[] = [];

  allTasksOf(taskGroups).forEach(task => {
    const requestBody = requestBodyOf(task);
    if (!requestBody.trim()) return;

    const body = parseRequestBodyTemplate(requestBody);
    if (!body) {
      // Either a whole-body reference, which is fine, or damage.
      if (isUnreadableRequestBody(requestBody)) {
        problems.push({
          task: task.name,
          field: '',
          kind: 'unreadable',
          found: requestBody.trim().slice(0, 120),
          expected: '',
        });
      }
      return;
    }

    const schema = schemaOf((task as any).task_component || '');
    if (!schema) return;

    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }
      if (node && typeof node === 'object') {
        Object.entries(node as Record<string, unknown>).forEach(
          ([key, value]) => walk(value, path ? `${path}.${key}` : key),
        );
        return;
      }
      if (!path) return;
      const expected = schemaTypeAt(schema, path);
      // A reference is text until it runs, and what it hands back is not known here.
      // What *can* be judged is how it was written down: the engine substitutes into
      // the body as text, so a reference feeding anything but a string field has to
      // sit there without quotes. A file written elsewhere often has them all quoted,
      // and then a number field is handed "5".
      if (parseFieldReference(node)) {
        if (!expected) return;
        const bare = body.rawPaths.includes(path);
        const shouldBeBare = expected !== 'string';
        if (bare !== shouldBeBare) {
          problems.push({
            task: task.name,
            field: path,
            kind: 'reference-quoting',
            found: bare ? 'unquoted' : 'quoted',
            expected,
          });
        }
        return;
      }
      if (!expected) return;
      const found = valueType(node);
      if (!fits(found, expected)) {
        problems.push({
          task: task.name,
          field: path,
          kind: 'type',
          found,
          expected,
        });
      }
    };

    walk(body.model, '');
  });

  return problems;
}

/** One value that was forced into the type its field asks for. */
export interface ICoercion {
  task: string;
  field: string;
  from: string;
  to: string;
}

/** Can this value be turned into what the field asks for without losing anything? */
function coerce(
  value: unknown,
  expected: string,
): { ok: boolean; value?: any } {
  if (expected === 'string') {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return { ok: true, value: String(value) };
    }
    return { ok: false };
  }
  if (expected === 'number' || expected === 'integer') {
    if (typeof value !== 'string' || value.trim() === '') return { ok: false };
    const asNumber = Number(value);
    // Only when nothing is lost — "5" becomes 5, "5abc" and "" do not become anything.
    if (!Number.isFinite(asNumber)) return { ok: false };
    if (expected === 'integer' && !Number.isInteger(asNumber))
      return { ok: false };
    return { ok: true, value: asNumber };
  }
  if (expected === 'boolean') {
    if (value === 'true') return { ok: true, value: true };
    if (value === 'false') return { ok: true, value: false };
    return { ok: false };
  }
  // An object or a list cannot be conjured out of a scalar.
  return { ok: false };
}

/**
 * Whether every mistyped value could be forced into shape — the question the dialog
 * asks before offering to do it. A conversion that can only fix some of them would
 * leave the user believing the workflow is now sound.
 */
export function canCoerceAll(
  problems: IBodyProblem[],
  valueAt: (task: string, field: string) => unknown,
): boolean {
  const fixable = problems.filter(
    one => one.kind === 'type' || one.kind === 'reference-quoting',
  );
  if (!fixable.length) return false;
  // 참조는 인용부호만 옮기면 된다 — 값은 건드리지 않으니 잃을 것이 없다.
  return fixable.every(
    one =>
      one.kind === 'reference-quoting' ||
      coerce(valueAt(one.task, one.field), one.expected).ok,
  );
}

/** Forces one value into the type its field asks for. Returns undefined when it cannot. */
export function coerceValue(value: unknown, expected: string): any {
  const result = coerce(value, expected);
  return result.ok ? result.value : undefined;
}
