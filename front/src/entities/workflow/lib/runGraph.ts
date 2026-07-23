import {
  ITaskGroupResponse,
  ITaskResponse,
  IWorkflowResponse,
} from '@/entities/workflow/model/types';

/**
 * Builds an execution graph from a workflow definition.
 *
 * Execution order comes solely from each task's `dependencies`. A task_group is just a grouping
 * in the engine, not an execution unit, so we do not fabricate dependencies from group order.
 * As a result, parallel, diamond, and multi-start-point shapes in the definition appear as-is in the graph.
 */

export interface IRunGraphNode {
  /** cm-cicada task.id — the same value as task_id in the execution state (taskInstances) */
  id: string;
  name: string;
  taskComponent: string;
  groupName: string;
  /** The value stored on this task. Not the value used at execution time but the value in the *current definition* */
  spec: Record<string, any>;
  /** Vertical position. Placed after every task that precedes it */
  level: number;
  /** Horizontal position within the same level */
  order: number;
}

export interface IRunGraphEdge {
  from: string;
  to: string;
}

/** Graph render dimensions — also used when the viewer calculates how much width to give the graph */
/* At 190px, names like beetle_task_infra_migration overflowed the box.
   SVG text does not wrap or clip to the box, so we size the box to the name. */
export const GRAPH_NODE_WIDTH = 240;
export const GRAPH_NODE_HEIGHT = 52;
export const GRAPH_GAP_X = 44;
export const GRAPH_GAP_Y = 60;
export const GRAPH_PADDING = 28;

export interface IRunGraph {
  nodes: IRunGraphNode[];
  edges: IRunGraphEdge[];
  levelCount: number;
  /** Maximum number of nodes placed in one level = the number of horizontal columns the graph needs */
  maxParallel: number;
  /** Whether it is a single chain in one line (the only shape the editor can represent) */
  isLinear: boolean;
  /** Notes left when the definition is not intact. Surface them on screen rather than hiding them */
  warnings: string[];
}

function flattenTasks(
  groups: Array<ITaskGroupResponse> | undefined,
  out: Array<{ task: ITaskResponse; groupName: string }> = [],
): Array<{ task: ITaskResponse; groupName: string }> {
  (groups ?? []).forEach(group => {
    (group.tasks ?? []).forEach(task => {
      out.push({ task, groupName: group.name });
    });
    // Nested groups are allowed in the definition, so flatten them too
    flattenTasks(group.task_groups, out);
  });
  return out;
}

function taskIdOf(task: ITaskResponse): string {
  return task.id ?? task.name;
}

/**
 * Gathers the values stored on a task into a form suitable for display.
 *
 * cm-cicada's new format holds values in `spec`, while the old format keeps request_body/path_params/
 * query_params separately. Both can appear, so we collect only what is present.
 */
function taskSpecOf(task: ITaskResponse): Record<string, any> {
  const spec: Record<string, any> = { ...(task.spec ?? {}) };
  if (task.request_body !== undefined && spec.request_body === undefined) {
    spec.request_body = task.request_body;
  }
  if (task.path_params !== undefined && spec.path_params === undefined) {
    spec.path_params = task.path_params;
  }
  if (task.query_params !== undefined && spec.query_params === undefined) {
    spec.query_params = task.query_params;
  }
  return spec;
}

export function buildRunGraph(workflow: IWorkflowResponse | null): IRunGraph {
  const warnings: string[] = [];
  const flat = flattenTasks(workflow?.data?.task_groups);

  const nodes: IRunGraphNode[] = flat.map(({ task, groupName }) => ({
    id: taskIdOf(task),
    name: task.name,
    taskComponent: task.task_component,
    groupName,
    spec: taskSpecOf(task),
    level: 0,
    order: 0,
  }));

  const idByName = new Map<string, string>();
  flat.forEach(({ task }) => {
    // The engine requires task names to be globally unique across groups.
    if (idByName.has(task.name)) {
      warnings.push(`Duplicate task name: ${task.name}`);
    }
    idByName.set(task.name, taskIdOf(task));
  });

  const edges: IRunGraphEdge[] = [];
  const depsByNode = new Map<string, string[]>();

  flat.forEach(({ task }) => {
    const id = taskIdOf(task);
    const deps: string[] = [];
    (task.dependencies ?? []).forEach((depName: any) => {
      const depId = idByName.get(String(depName));
      if (!depId) {
        warnings.push(
          `${task.name} depends on a task that does not exist: ${depName}`,
        );
        return;
      }
      deps.push(depId);
      edges.push({ from: depId, to: id });
    });
    depsByNode.set(id, deps);
  });

  assignLevels(nodes, depsByNode, warnings);
  assignOrders(nodes);

  const levelCount = nodes.length
    ? Math.max(...nodes.map(n => n.level)) + 1
    : 0;

  return {
    nodes,
    edges,
    levelCount,
    maxParallel: maxNodesPerLevel(nodes),
    isLinear: isSingleChain(nodes, edges),
    warnings,
  };
}

/**
 * level = the depth of the longest predecessor path. Nodes at the same level do not depend on
 * each other, so they can be placed side by side, which is why parallel work looks parallel.
 */
function assignLevels(
  nodes: IRunGraphNode[],
  depsByNode: Map<string, string[]>,
  warnings: string[],
): void {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const resolved = new Set<string>();

  let remaining = nodes.slice();
  while (remaining.length) {
    const ready = remaining.filter(node =>
      (depsByNode.get(node.id) ?? []).every(dep => resolved.has(dep)),
    );

    if (!ready.length) {
      // The engine rejects cyclic dependencies, so this is unreachable for a valid workflow.
      // Still, to keep the view from stalling, pile the remaining nodes into the last level and warn.
      warnings.push(
        'Some tasks form a dependency cycle, so their execution order cannot be determined.',
      );
      const fallbackLevel = resolved.size
        ? Math.max(...[...resolved].map(id => nodeById.get(id)!.level)) + 1
        : 0;
      remaining.forEach(node => {
        node.level = fallbackLevel;
      });
      return;
    }

    ready.forEach(node => {
      const deps = depsByNode.get(node.id) ?? [];
      node.level = deps.length
        ? Math.max(...deps.map(dep => nodeById.get(dep)!.level)) + 1
        : 0;
    });
    ready.forEach(node => resolved.add(node.id));
    remaining = remaining.filter(node => !resolved.has(node.id));
  }
}

function maxNodesPerLevel(nodes: IRunGraphNode[]): number {
  const counts = new Map<number, number>();
  nodes.forEach(node => {
    counts.set(node.level, (counts.get(node.level) ?? 0) + 1);
  });
  return Math.max(1, ...counts.values());
}

/**
 * Horizontal pixels needed to draw the entire graph.
 *
 * A workflow with no parallel branches (a single-component case such as infra or SW migration)
 * comes out narrow, so the viewer can give the leftover width to the detail panel.
 */
export function graphPixelWidth(graph: IRunGraph): number {
  const columns = graph.maxParallel;
  return (
    GRAPH_PADDING * 2 + columns * GRAPH_NODE_WIDTH + (columns - 1) * GRAPH_GAP_X
  );
}

function assignOrders(nodes: IRunGraphNode[]): void {
  const seen = new Map<number, number>();
  nodes.forEach(node => {
    const next = seen.get(node.level) ?? 0;
    node.order = next;
    seen.set(node.level, next + 1);
  });
}

/** Whether the nodes form a single line — exactly one node per level means a single chain */
function isSingleChain(
  nodes: IRunGraphNode[],
  edges: IRunGraphEdge[],
): boolean {
  if (nodes.length <= 1) return true;

  const perLevel = new Map<number, number>();
  nodes.forEach(node => {
    perLevel.set(node.level, (perLevel.get(node.level) ?? 0) + 1);
  });
  if ([...perLevel.values()].some(count => count > 1)) return false;

  // Even with one node per level, it is not a chain if an edge skips an adjacent level
  const levelById = new Map(nodes.map(n => [n.id, n.level]));
  return edges.every(
    edge => levelById.get(edge.to)! - levelById.get(edge.from)! === 1,
  );
}
