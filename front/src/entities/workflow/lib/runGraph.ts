import {
  ITaskGroupResponse,
  ITaskResponse,
  IWorkflowResponse,
} from '@/entities/workflow/model/types';

/**
 * 워크플로우 정의에서 실행 그래프를 만든다.
 *
 * 실행 순서는 각 task의 `dependencies`에서만 나온다. task_group은 엔진에서
 * 실행 단위가 아니라 묶음일 뿐이므로 그룹 순서로 의존성을 지어내지 않는다.
 * 따라서 병렬·다이아몬드·다중 시작점이 정의에 있으면 그대로 그래프에 나타난다.
 */

export interface IRunGraphNode {
  /** cm-cicada task.id — 실행 상태(taskInstances)의 task_id와 같은 값 */
  id: string;
  name: string;
  taskComponent: string;
  groupName: string;
  /** 이 task에 저장돼 있는 값. 실행에 쓰인 값이 아니라 *현재 정의*의 값이다 */
  spec: Record<string, any>;
  /** 세로 위치. 자기보다 앞선 모든 task보다 뒤에 놓인다 */
  level: number;
  /** 같은 level 안에서의 가로 위치 */
  order: number;
}

export interface IRunGraphEdge {
  from: string;
  to: string;
}

/** 그래프 렌더 치수 — 뷰어가 그래프에 얼마나 폭을 내줄지 계산할 때도 쓴다 */
export const GRAPH_NODE_WIDTH = 190;
export const GRAPH_NODE_HEIGHT = 52;
export const GRAPH_GAP_X = 44;
export const GRAPH_GAP_Y = 60;
export const GRAPH_PADDING = 28;

export interface IRunGraph {
  nodes: IRunGraphNode[];
  edges: IRunGraphEdge[];
  levelCount: number;
  /** 한 단계에 가장 많이 놓이는 노드 수 = 그래프가 필요로 하는 가로 칸 수 */
  maxParallel: number;
  /** 한 줄로 이어지는 단일 체인인가 (편집기가 표현할 수 있는 유일한 형태) */
  isLinear: boolean;
  /** 정의가 온전하지 않을 때 남기는 메모. 감추지 말고 화면에 드러낸다 */
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
    // 정의상 중첩 그룹이 올 수 있으므로 함께 펼친다
    flattenTasks(group.task_groups, out);
  });
  return out;
}

function taskIdOf(task: ITaskResponse): string {
  return task.id ?? task.name;
}

/**
 * task에 저장된 값을 화면에 보여줄 형태로 모은다.
 *
 * cm-cicada의 새 형식은 `spec`에 값을 담고, 예전 형식은 request_body/path_params/
 * query_params를 따로 둔다. 둘 다 올 수 있으므로 있는 것만 모은다.
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
    // 엔진은 그룹을 가로질러 task 이름이 전역 유일할 것을 요구한다.
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
 * level = 가장 긴 선행 경로의 깊이. 같은 level의 노드는 서로 의존하지 않으므로
 * 가로로 나란히 놓아도 되고, 그래서 병렬이 병렬로 보인다.
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
      // 엔진이 순환 의존을 거부하므로 정상 워크플로우에서는 도달하지 않는다.
      // 그래도 화면이 멈추지 않도록 남은 노드를 마지막 level에 몰아 넣고 알린다.
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
 * 그래프를 다 그리는 데 필요한 가로 픽셀.
 *
 * 병렬 갈래가 없는 워크플로우(인프라·SW 마이그레이션처럼 컴포넌트가 하나뿐인
 * 경우)는 좁게 잡히므로, 뷰어가 남는 폭을 상세 패널에 내줄 수 있다.
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

/** 노드가 한 줄로만 이어지는가 — level마다 노드가 정확히 하나면 단일 체인이다 */
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

  // level마다 하나씩이라도, 엣지가 인접 level을 건너뛰면 체인이 아니다
  const levelById = new Map(nodes.map(n => [n.id, n.level]));
  return edges.every(
    edge => levelById.get(edge.to)! - levelById.get(edge.from)! === 1,
  );
}
