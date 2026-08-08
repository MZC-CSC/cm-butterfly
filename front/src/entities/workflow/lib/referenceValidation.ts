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
    const requestBody = String(task.request_body ?? '');

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
    try {
      extractFieldReferences(JSON.parse(requestBody)).forEach(
        (reference, field) => judge(reference.task, field),
      );
    } catch {
      // Not JSON and not a reference — nothing here reads another task.
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
