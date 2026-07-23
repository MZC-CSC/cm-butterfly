import {
  ITaskGroupResponse,
  ITaskResponse,
} from '@/entities/workflow/model/types';
import { serializeDesignerSequence } from '@/entities/workflow/lib/designerSerialize';

/**
 * Reconstructs a saved workflow back into a form the canvas can draw.
 *
 * All that is saved is the **edges (`dependencies`)**. A TaskGroup is a label, not
 * an execution unit, so how the boxes were nested is not preserved. So when
 * reconstructing we ignore the groups and rebuild the diagram from **the edges alone**.
 * If there was parallelism it comes back as parallel, branches may differ in length,
 * and a branch may itself contain more parallelism.
 *
 * At the end we verify the reconstructed diagram really matches the original edges by
 * **comparing them directly** (see the verification section). Since we don't judge by
 * hand-enumerating rules, there's no room for a wrong rule to make it silently incorrect.
 */

export type ITopologyItem =
  | { kind: 'task'; task: ITaskResponse; groupName: string | null }
  | {
      kind: 'parallel';
      groupName: string | null;
      /** Each branch is itself a linear diagram (which may contain more parallelism) */
      branches: ITopologyItem[][];
    };

export interface ITopologyAnalysis {
  items: ITopologyItem[];
  /** Whether the canvas can draw this diagram as-is */
  representable: boolean;
  /** Reasons it can't be drawn / flaws in the definition. Surface them on screen, don't hide them */
  warnings: string[];
}

/** Whether this is a virtual group created on save to wrap a single ungrouped task */
export function isVirtualRootGroup(groupName: string): boolean {
  return groupName.startsWith('__root_task_group_') && groupName.endsWith('__');
}

const sameSet = (a: string[], b: string[]): boolean => {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((v, i) => v === right[i]);
};

export function analyzeTopology(
  taskGroups: Array<ITaskGroupResponse> | undefined,
): ITopologyAnalysis {
  const warnings: string[] = [];
  const flat: Array<{ task: ITaskResponse; groupName: string }> = [];
  (taskGroups ?? []).forEach(group =>
    (group.tasks ?? []).forEach(task =>
      flat.push({ task, groupName: group.name }),
    ),
  );

  if (!flat.length) {
    return { items: [], representable: true, warnings };
  }

  const byName = new Map<string, ITaskResponse>();
  const groupOf = new Map<string, string>();
  flat.forEach(({ task, groupName }) => {
    if (byName.has(task.name)) {
      warnings.push(`There are tasks with duplicate names: ${task.name}`);
    }
    byName.set(task.name, task);
    groupOf.set(task.name, groupName);
  });

  const depsOf = new Map<string, string[]>();
  flat.forEach(({ task }) => {
    const deps: string[] = [];
    (task.dependencies ?? []).forEach((dep: any) => {
      const name = String(dep);
      if (!byName.has(name)) {
        warnings.push(
          `${task.name} depends on a task that does not exist: ${name}`,
        );
        return;
      }
      deps.push(name);
    });
    depsOf.set(task.name, deps);
  });

  const groupNameFor = (names: string[]): string | null => {
    const groups = new Set(names.map(name => groupOf.get(name)!));
    if (groups.size !== 1) return null;
    const only = [...groups][0];
    return isVirtualRootGroup(only) ? null : only;
  };

  /** Tasks that wait on this task */
  const successorsOf = (name: string): string[] =>
    flat
      .map(({ task }) => task.name)
      .filter(other => (depsOf.get(other) ?? []).includes(name));

  let failed = false;

  /**
   * Decomposes one region into a linear diagram.
   *
   * `entryOutputs` are the tasks that must have finished before this region can start.
   * If more than one task in the region can start at the same time, that point is
   * parallel, and each branch is decomposed the same way (which is how parallelism
   * inside a branch comes out).
   */
  const decompose = (
    region: string[],
    entryOutputs: string[],
    depth: number,
  ): ITopologyItem[] => {
    if (failed) return [];
    if (depth > 50) {
      // A diagram so tangled it won't decompose further. Reaching here means it can't be drawn.
      failed = true;
      return [];
    }

    const items: ITopologyItem[] = [];
    const remaining = new Set(region);
    let outputs = entryOutputs;

    while (remaining.size) {
      const pending = [...remaining];
      const starters = pending.filter(name =>
        sameSet(depsOf.get(name) ?? [], outputs),
      );

      if (!starters.length) {
        failed = true;
        return items;
      }

      if (starters.length === 1) {
        const name = starters[0];
        remaining.delete(name);
        items.push({
          kind: 'task',
          task: byName.get(name)!,
          groupName: groupNameFor([name]),
        });
        outputs = [name];
        continue;
      }

      // Several tasks start at once = parallel. Find where they rejoin and take
      // everything up to that point as one parallel region.
      const inRegion = new Set(starters);
      let tails = [...starters];

      for (;;) {
        const candidates = pending.filter(
          name =>
            !inRegion.has(name) &&
            (depsOf.get(name) ?? []).every(
              dep => inRegion.has(dep) || outputs.includes(dep),
            ),
        );

        // If a task waits on **all** of the branch tails, that's the join point.
        // That task belongs to the next item, not to the parallel region.
        const joins = candidates.some(name =>
          sameSet(depsOf.get(name) ?? [], tails),
        );
        if (joins || !candidates.length) break;

        candidates.forEach(name => inRegion.add(name));
        tails = [...inRegion].filter(name =>
          successorsOf(name).every(next => !inRegion.has(next)),
        );
      }

      // Split into branches — branches that reach the same task are one branch (which is parallel within)
      const branchOf = new Map<string, number>();
      starters.forEach((name, index) => branchOf.set(name, index));
      const merge = (from: number, to: number) => {
        [...branchOf.entries()].forEach(([name, index]) => {
          if (index === from) branchOf.set(name, to);
        });
      };
      let changed = true;
      while (changed) {
        changed = false;
        [...inRegion].forEach(name => {
          const owners = new Set(
            (depsOf.get(name) ?? [])
              .filter(dep => inRegion.has(dep))
              .map(dep => branchOf.get(dep)!)
              .filter(index => index !== undefined),
          );
          if (!owners.size) return;
          const target = Math.min(...owners);
          owners.forEach(owner => {
            if (owner !== target) {
              merge(owner, target);
              changed = true;
            }
          });
          if (branchOf.get(name) !== target) {
            branchOf.set(name, target);
            changed = true;
          }
        });
      }

      const branchIndexes = [...new Set(starters.map(s => branchOf.get(s)!))];
      const branches = branchIndexes.map(index => {
        const members = [...inRegion].filter(
          name => branchOf.get(name) === index,
        );
        // If a branch is identical to the whole region, it means it won't decompose further
        if (members.length === inRegion.size && branchIndexes.length === 1) {
          failed = true;
          return [];
        }
        return decompose(members, outputs, depth + 1);
      });

      inRegion.forEach(name => remaining.delete(name));
      items.push({
        kind: 'parallel',
        groupName: groupNameFor([...inRegion]),
        branches,
      });
      outputs = tails;

      if (failed) return items;
    }

    return items;
  };

  const items = decompose(
    flat.map(({ task }) => task.name),
    [],
    0,
  );

  // ── Verification ──────────────────────────────────────────────────────
  // We don't judge by hand-enumerating rules. We **serialize the diagram we just built
  // back into the saved format** and compare it edge by edge with the original. If even
  // one differs, the canvas and the actual execution would diverge, so we don't open it.
  let representable = !failed;
  if (representable) {
    const rebuilt = serializeDesignerSequence(
      toShape(items),
      (step, dependencies) => ({ name: step.name, dependencies }),
    );
    const rebuiltDeps = new Map<string, string[]>();
    rebuilt.forEach(group =>
      (group.tasks ?? []).forEach((task: any) =>
        rebuiltDeps.set(task.name, task.dependencies ?? []),
      ),
    );

    representable = rebuiltDeps.size === byName.size;
    byName.forEach((_task, name) => {
      if (!sameSet(rebuiltDeps.get(name) ?? [], depsOf.get(name) ?? [])) {
        representable = false;
      }
    });
  }

  if (!representable) {
    warnings.push(
      'This workflow execution order cannot be drawn on screen as-is — the diagram would differ from the actual execution, so it will not be opened.',
    );
  }

  return { items, representable, warnings };
}

/** Minimal shape for comparison — the name and box kind are enough to derive the edges */
function toShape(items: ITopologyItem[]): any[] {
  return items.map(item =>
    item.kind === 'task'
      ? { name: item.task.name, componentType: 'task' }
      : {
          name: item.groupName ?? 'Parallel',
          componentType: 'launchPad',
          sequence: item.branches.map((branch, index) => ({
            name: `Branch ${index + 1}`,
            componentType: 'container',
            sequence: toShape(branch),
          })),
        },
  );
}
