import { ITaskGroupResponse } from '@/entities/workflow/model/types';

/**
 * Turns the diagram drawn on screen into a workflow definition.
 *
 * **All the engine keeps are the edges (`dependencies`).** A TaskGroup is a label,
 * not an execution unit, and how the boxes are nested is not saved. So on screen you
 * can nest boxes freely (a parallel branch inside a parallel), and when saving you
 * just extract the edges that fall out of that diagram as they are.
 *
 * The rules fit in two lines:
 *  - things laid out in a single line: the next one starts only after the previous ends
 *  - branches inside a parallel box start **at the same point simultaneously**, and the
 *    next thing waits for **all** the branch ends
 *
 * We do not recompute edges from on-screen positions. It must be saved as drawn so that
 * reopening it yields the same diagram. Previously edges were re-fabricated from array
 * order, so a parallel workflow lost its parallelism just by **opening and saving it**.
 *
 * This only deals with *structure*. Building one task's contents (spec, body, type)
 * needs to know the screen side, so it is passed in via `toTask` and called. That is
 * why this file can be tested without the screen.
 */
export function serializeDesignerSequence<TStep extends DesignerStepLike>(
  sequence: TStep[],
  toTask: (step: TStep, dependencies: string[]) => any,
): ITaskGroupResponse[] {
  // A group is just a label, but the save format requires one, so we gather tasks
  // under the nearest box name. A task with no box gets wrapped in one layer.
  const groups: ITaskGroupResponse[] = [];
  const groupByName = new Map<string, ITaskGroupResponse>();

  const put = (boxName: string | null, description: string, task: any) => {
    const name = boxName ?? `__root_task_group_${task.name}__`;
    let group = boxName === null ? undefined : groupByName.get(name);
    if (!group) {
      group = {
        name,
        description:
          boxName === null
            ? 'Virtual task group for root-level task'
            : description,
        tasks: [],
      };
      groups.push(group);
      if (boxName !== null) groupByName.set(name, group);
    }
    group.tasks.push(task);
  };

  const descriptionOf = (step: TStep) =>
    (step.properties?.model as any)?.description ?? '';

  /** Things laid out in a single line. Each output feeds the next input. Returns this line's end. */
  const walkSequence = (steps: TStep[], startsAfter: string[]): string[] => {
    let outputs = startsAfter;
    (steps ?? []).forEach(step => {
      outputs = walkStep(step, outputs);
    });
    return outputs;
  };

  /** Serialize one step. Returns the tasks that "the next thing must wait for". */
  const walkStep = (
    step: TStep,
    startsAfter: string[],
    boxName: string | null = null,
  ): string[] => {
    if (step.componentType === 'task') {
      put(boxName, '', toTask(step, startsAfter));
      return [step.name];
    }

    if (step.componentType === 'launchPad') {
      // A parallel box is a **fork marker, not a group.** When it sits inside a group
      // box, its inner tasks are bound to the outer group — a group forking does not
      // make it a different group. Only when it stands alone on the outside does its
      // own name become the binding name.
      const groupName = boxName ?? step.name;
      // The branches all start from the same point. They do not wait on each other.
      const outs = (step.sequence ?? []).flatMap(child =>
        walkStep(child as TStep, startsAfter, groupName),
      );
      // If empty, nothing was done, so pass the previous output straight through
      return outs.length ? outs : startsAfter;
    }

    // Box (TaskGroup) — its contents are chained into a single line
    const inner = walkSequenceIn(
      (step.sequence ?? []) as TStep[],
      startsAfter,
      step.name,
      descriptionOf(step),
    );
    return inner;
  };

  const walkSequenceIn = (
    steps: TStep[],
    startsAfter: string[],
    boxName: string,
    description: string,
  ): string[] => {
    let outputs = startsAfter;
    steps.forEach(step => {
      if (step.componentType === 'task') {
        put(boxName, description, toTask(step, outputs));
        outputs = [step.name];
      } else {
        outputs = walkStep(step, outputs, boxName);
      }
    });
    return outputs;
  };

  walkSequence(sequence ?? [], []);
  return groups;
}

/**
 * Before saving, check whether the current diagram can be turned into a workflow.
 *
 * The old validator passed whatever it was given, and the separate check function
 * that existed was dead code called from nowhere. That was why an untranslatable
 * diagram got saved as is and looked different when reopened.
 *
 * However boxes are nested, all that matters is that edges come out, so nesting
 * itself is not blocked. The only thing blocked is the case where *no edges can be
 * produced*.
 */
export function validateDesignerSequence(
  sequence: DesignerStepLike[],
): string[] {
  const problems: string[] = [];
  const nameCounts = new Map<string, number>();

  const visit = (steps: DesignerStepLike[] | undefined) => {
    (steps ?? []).forEach(step => {
      if (step.componentType === 'task') {
        const name = String(step.name ?? '').trim();
        if (!name) {
          problems.push('There is a task with an empty name.');
          return;
        }
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
        return;
      }

      if (!countTasks(step)) {
        problems.push(`${step.name}: the box is empty and will not be saved.`);
      }
      visit(step.sequence);
    });
  };

  visit(sequence);

  [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .forEach(([name]) =>
      problems.push(
        `Duplicate name: ${name} — names must be unique within a workflow.`,
      ),
    );

  if (!nameCounts.size) {
    problems.push('There is no task to run.');
  }

  return problems;
}

/**
 * Things that don't block saving but should be flagged.
 *
 * The classic case is a parallel box with only one branch. The execution result is
 * the same as a plain single line so it isn't wrong, but it is most likely a **half-
 * finished two-branch** setup. Once the screen is closed the diagram is gone and only
 * the saved edges remain, so we point it out before leaving.
 */
export function reviewDesignerSequence(sequence: DesignerStepLike[]): string[] {
  const notices: string[] = [];

  const visit = (steps: DesignerStepLike[] | undefined) => {
    (steps ?? []).forEach(step => {
      if (step.componentType === 'launchPad') {
        const branches = (step.sequence ?? []).filter(
          child => countTasks(child) > 0,
        );
        if (branches.length === 1) {
          notices.push(
            `${step.name}: only one branch — saving as is just links it into a single line. Add another branch or remove the box.`,
          );
        }
      }
      visit(step.sequence);
    });
  };

  visit(sequence);
  return notices;
}

/** Whether the box contains a task (at any nesting depth) */
function countTasks(step: DesignerStepLike): number {
  if (step.componentType === 'task') return 1;
  return (step.sequence ?? []).reduce(
    (sum, child) => sum + countTasks(child),
    0,
  );
}

/** The minimal shape needed to read structure from the screen */
export interface DesignerStepLike {
  name: string;
  componentType: string;
  sequence?: DesignerStepLike[];
  properties?: { model?: object };
}
