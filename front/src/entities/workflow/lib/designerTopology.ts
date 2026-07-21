import {
  ITaskGroupResponse,
  ITaskResponse,
} from '@/entities/workflow/model/types';
import { serializeDesignerSequence } from '@/entities/workflow/lib/designerSerialize';

/**
 * 저장된 워크플로우를 화면에 그릴 형태로 되돌린다.
 *
 * 저장돼 있는 것은 **선(`dependencies`)뿐**이다. TaskGroup 은 실행 단위가 아니라
 * 이름표라서, 상자를 어떻게 겹쳐 놨었는지는 남지 않는다. 그러니 되돌릴 때도 그룹을 보지
 * 않고 **선만 보고** 그림을 다시 세운다. 병렬이 있으면 병렬로 나오고, 갈래마다 길이가
 * 달라도 되고, 갈래 안에 또 병렬이 있어도 된다.
 *
 * 되돌린 그림이 원래 선과 정말 같은지는 마지막에 **직접 대조해서** 확인한다(§검증).
 * 규칙을 손으로 나열해 판정하지 않으므로, 내가 규칙을 잘못 세워서 조용히 틀릴 여지가 없다.
 */

export type ITopologyItem =
  | { kind: 'task'; task: ITaskResponse; groupName: string | null }
  | {
      kind: 'parallel';
      groupName: string | null;
      /** 갈래 하나하나가 다시 한 줄의 그림이다 (그 안에 또 병렬이 올 수 있다) */
      branches: ITopologyItem[][];
    };

export interface ITopologyAnalysis {
  items: ITopologyItem[];
  /** 화면이 이 그림을 그대로 그릴 수 있나 */
  representable: boolean;
  /** 그릴 수 없는 이유·정의의 흠. 감추지 말고 화면에 드러낸다 */
  warnings: string[];
}

/** 저장할 때 상자 밖 task 하나를 감싸려고 만든 가상 그룹인가 */
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

  /** 이 task 를 기다리는 task 들 */
  const successorsOf = (name: string): string[] =>
    flat
      .map(({ task }) => task.name)
      .filter(other => (depsOf.get(other) ?? []).includes(name));

  let failed = false;

  /**
   * 한 덩어리를 한 줄의 그림으로 푼다.
   *
   * `entryOutputs` 는 이 덩어리가 시작하기 전에 끝나 있어야 하는 task 들이다.
   * 덩어리 안에서 동시에 시작할 수 있는 것이 둘 이상이면 그 지점이 병렬이고,
   * 각 갈래를 다시 같은 방법으로 푼다(그래서 갈래 안의 병렬도 나온다).
   */
  const decompose = (
    region: string[],
    entryOutputs: string[],
    depth: number,
  ): ITopologyItem[] => {
    if (failed) return [];
    if (depth > 50) {
      // 서로 얽혀 더 쪼개지지 않는 그림. 여기까지 오면 그릴 수 없는 것이다.
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

      // 여럿이 동시에 시작한다 = 병렬. 어디서 다시 합류하는지를 찾아 그 앞까지를
      // 하나의 병렬 덩어리로 잡는다.
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

        // 갈래의 끝을 **전부** 기다리는 것이 나오면 거기서 합류한다.
        // 그 task 는 병렬 덩어리가 아니라 그 다음 항목이다.
        const joins = candidates.some(name =>
          sameSet(depsOf.get(name) ?? [], tails),
        );
        if (joins || !candidates.length) break;

        candidates.forEach(name => inRegion.add(name));
        tails = [...inRegion].filter(name =>
          successorsOf(name).every(next => !inRegion.has(next)),
        );
      }

      // 갈래 나누기 — 같은 task 에 닿는 갈래는 한 갈래다(그 안이 다시 병렬이다)
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
        // 갈래가 통째로 원래 덩어리와 같으면 더 쪼개지지 않는다는 뜻이다
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

  // ── 검증 ───────────────────────────────────────────────────────────────
  // 규칙을 손으로 나열해 판정하지 않는다. 방금 세운 그림을 **다시 저장 형식으로
  // 되돌려** 원래 선과 하나하나 대조한다. 하나라도 다르면 화면과 실제 실행이
  // 달라진다는 뜻이므로 열지 않는다.
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

/** 대조용 최소 형태 — 이름과 상자 종류만 있으면 선을 뽑아낼 수 있다 */
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
