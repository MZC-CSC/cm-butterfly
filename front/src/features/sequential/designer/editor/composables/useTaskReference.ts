/**
 * Value reference — picking a value out of a previous task's result.
 *
 * cm-cicada decides how to build a task's request body from the *shape* of its
 * `request_body` string: a bare task name sends that task's whole response, a
 * name plus a JSONPath sends one item out of it, and `${task.path}` placeholders
 * inside a JSON body fill single fields. See cm-cicada `docs/task-response-passing.md`.
 *
 * Since cm-cicada publishes `spec.response_schema` the editor can finally show
 * what a previous task returns, so a user picks a value instead of typing a
 * JSONPath from memory.
 *
 * Two things this module deliberately does NOT do:
 *  - it never invents a sample value. A field shows a value only when the schema
 *    carries an `example`; a type default would read as "this is what you get".
 *  - it never offers a task that does not run first. The engine only checks that
 *    a referenced task exists *somewhere* in the workflow, so referencing a later
 *    task saves fine and then dies at run time with no result to pull.
 */

import { computed, ref } from 'vue';
import type { ITaskGroupResponse } from '@/entities/workflow/model/types';
import { orderedAncestorsOf } from '@/entities/workflow/lib/designerTopology';
import {
  buildFieldReference,
  type IFieldReference,
} from '@/shared/utils/stringToObject';

/** One selectable value in a previous task's output. */
export interface IOutputNode {
  /** JSONPath fragment as it will be written after the task name */
  path: string;
  /** Leaf name, shown in the tree */
  label: string;
  /** Nesting level, for indentation */
  depth: number;
  type: string;
  /** Only when the schema carries one — never fabricated */
  example?: string;
  description?: string;
  /** Objects and arrays can be picked too, but usually you want a leaf */
  isContainer: boolean;
  /** True when reached through an array, so the value may arrive as a list */
  multiple: boolean;
}

/** A previous task and what it offers. */
export interface IOutputSource {
  task: string;
  /** Component the task is built from, for looking the schema up */
  component: string;
  nodes: IOutputNode[];
  /** False when the component does not publish a response schema at all */
  hasSchema: boolean;
}

const MAX_DEPTH = 6;

/**
 * Flattens a response schema into pickable rows.
 *
 * Arrays are walked through `items` with `[*]` in the path — that is what a
 * user writes to reach into every element, and cm-cicada returns a list when
 * more than one item matches.
 */
export function flattenResponseSchema(
  schema: Record<string, any> | null | undefined,
  basePath = '$',
  depth = 0,
  multiple = false,
): IOutputNode[] {
  if (!schema || depth > MAX_DEPTH) return [];
  const rows: IOutputNode[] = [];

  const push = (
    path: string,
    label: string,
    node: Record<string, any>,
    isContainer: boolean,
    inList: boolean,
  ): void => {
    rows.push({
      path,
      label,
      depth,
      type: node.type || (node.properties ? 'object' : 'unknown'),
      example: node.example !== undefined ? String(node.example) : undefined,
      description: node.description,
      isContainer,
      multiple: inList,
    });
  };

  if (schema.type === 'array' && schema.items) {
    const itemPath = `${basePath}[*]`;
    push(itemPath, '[*]', schema.items, true, true);
    rows.push(
      ...flattenResponseSchema(schema.items, itemPath, depth + 1, true),
    );
    return rows;
  }

  Object.entries(schema.properties || {}).forEach(([key, raw]) => {
    const node = raw as Record<string, any>;
    const path = `${basePath}.${key}`;
    const isArray = node.type === 'array' && !!node.items;
    const isObject = !!node.properties;
    push(path, key, node, isArray || isObject, multiple);
    if (isArray) {
      rows.push(...flattenResponseSchema(node, path, depth + 1, multiple));
    } else if (isObject) {
      rows.push(...flattenResponseSchema(node, path, depth + 1, multiple));
    }
  });

  return rows;
}

/** Does the picked value fit the field it is going into? */
export type TypeVerdict = 'match' | 'mismatch' | 'unknown';

export function compareTypes(
  sourceType: string | undefined,
  targetType: string | undefined,
): TypeVerdict {
  if (!sourceType || !targetType || sourceType === 'unknown') return 'unknown';
  if (sourceType === targetType) return 'match';
  // `${...}` substitution puts text in place, so dropping a whole object or list
  // into a text field leaves a body that no longer has the shape the API wants.
  if (
    (sourceType === 'object' || sourceType === 'array') &&
    targetType !== sourceType
  ) {
    return 'mismatch';
  }
  if (targetType === 'integer' && sourceType === 'number') return 'match';
  if (targetType === 'number' && sourceType === 'integer') return 'match';
  return 'mismatch';
}

export function useTaskReference(
  taskGroups: () => Array<ITaskGroupResponse> | undefined,
  currentTaskName: () => string,
  /**
   * Response schema of a task component, or null when it publishes none.
   *
   * Injected rather than read from a store: the editor already resolves task
   * components from the workflow store to draw its form, and reading the same
   * place keeps the two from disagreeing about what a component offers.
   */
  responseSchemaOf: (componentName: string) => Record<string, any> | null,
) {
  /** Field the picker was opened for. Empty means the whole body. */
  const targetField = ref<string>('');

  /**
   * 캔버스에서 고른 태스크. 값 목록을 그 태스크로 좁히는 데 쓴다.
   *
   * 좁히지 않으면 캔버스에서 고른 것이 화면에 아무 영향을 주지 않는다 — 목록이 그대로라
   * 무엇이 골라졌는지 알 수 없고, 다시 목록에서 찾아야 한다.
   */
  const focusTask = ref<string>('');
  const targetType = ref<string | undefined>(undefined);
  const isOpen = ref(false);
  /** True while the crosshair is being dragged over the canvas */
  const isPicking = ref(false);
  const selectedTask = ref<string>('');
  const selectedPath = ref<string>('');
  const search = ref('');

  /** Task name -> component name, so we can look a response schema up. */
  const componentOf = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    (taskGroups() ?? []).forEach(group =>
      (group.tasks ?? []).forEach(task => {
        map.set(task.name, task.task_component);
      }),
    );
    return map;
  });

  /** Tasks that run before this one — the only ones we may reference. */
  const ancestors = computed<string[]>(() =>
    orderedAncestorsOf(taskGroups(), currentTaskName()),
  );

  const canBind = computed(() => ancestors.value.length > 0);

  /** Everything the previous tasks offer, all of it at once. */
  const sources = computed<IOutputSource[]>(() =>
    ancestors.value.map(task => {
      const component = componentOf.value.get(task) ?? '';
      const schema = responseSchemaOf(component);
      const fields = flattenResponseSchema(schema);
      return {
        task,
        component,
        // The whole result is a choice in its own right, and until it was listed there was no way to
        // make it — replacing the body wholesale is exactly what the "whole result" option is for,
        // and the list started at the fields one level in.
        nodes: schema
          ? [
              {
                path: '$',
                label: 'The whole result',
                depth: 0,
                type: schema.type || (schema.properties ? 'object' : 'unknown'),
                isContainer: true,
                multiple: schema.type === 'array',
              },
              ...fields.map(node => ({ ...node, depth: node.depth + 1 })),
            ]
          : fields,
        hasSchema: !!schema,
      };
    }),
  );

  /**
   * The same list narrowed by the search box. A task whose own name matches
   * keeps all of its rows, so typing a task name still shows what it offers.
   */
  const filteredSources = computed<IOutputSource[]>(() => {
    const focused = focusTask.value
      ? sources.value.filter(source => source.task === focusTask.value)
      : sources.value;
    const term = search.value.trim().toLowerCase();
    if (!term) return focused;
    return focused
      .map(source => {
        if (source.task.toLowerCase().includes(term)) return source;
        return {
          ...source,
          nodes: source.nodes.filter(
            node =>
              node.label.toLowerCase().includes(term) ||
              node.path.toLowerCase().includes(term),
          ),
        };
      })
      .filter(source => source.nodes.length > 0 || !source.hasSchema);
  });

  const selectedNode = computed<IOutputNode | undefined>(() =>
    sources.value
      .find(source => source.task === selectedTask.value)
      ?.nodes.find(node => node.path === selectedPath.value),
  );

  /**
   * 저장될 값. **모드에 따라 형태가 다르다.**
   *
   * 본문 전체를 넘길 때는 `<task>` 또는 `<task>.<path>` 를 그대로 쓴다. 칸을 채울 때만
   * `${...}` 로 감싼다 — 감싼 형태는 본문 안의 한 자리를 바꾸는 문법이라, 본문 자체를
   * 대신할 때 쓰면 엔진이 그것을 리터럴 문자열로 읽는다.
   *
   * 미리보기가 실제 저장값과 다르면 사용자는 저장하고 나서야 다른 것이 들어간 것을 안다.
   */
  const preview = computed(() => {
    if (!selectedTask.value || !selectedPath.value) return '';
    const wholeBody = targetField.value === '';
    if (wholeBody) {
      return selectedPath.value === '$'
        ? selectedTask.value
        : `${selectedTask.value}.${selectedPath.value}`;
    }
    return buildFieldReference({
      task: selectedTask.value,
      path: selectedPath.value,
    });
  });

  const typeVerdict = computed<TypeVerdict>(() =>
    compareTypes(selectedNode.value?.type, targetType.value),
  );

  const open = (field: string, fieldType?: string): void => {
    targetField.value = field;
    targetType.value = fieldType;
    selectedTask.value = '';
    selectedPath.value = '';
    search.value = '';
    focusTask.value = '';
    isOpen.value = true;
    isPicking.value = false;
  };

  const close = (): void => {
    isOpen.value = false;
    isPicking.value = false;
    focusTask.value = '';
  };

  /** Start the drag: the canvas lights up the tasks that may be picked. */
  const startPicking = (field: string, fieldType?: string): void => {
    if (!canBind.value) return;
    targetField.value = field;
    targetType.value = fieldType;
    isPicking.value = true;
  };

  /** A task was dropped on (or clicked). Only ancestors are accepted. */
  const pickTask = (task: string): boolean => {
    if (!ancestors.value.includes(task)) return false;
    selectedTask.value = task;
    // 고른 그 순간 *그 태스크의 결과 전체*가 정해진다. 그래야 캔버스에서 태스크를 고르는
    // 행위가 그 자체로 뜻을 갖는다 — 더 좁히고 싶으면 열린 목록에서 항목을 고르면 된다.
    selectedPath.value = '$';
    focusTask.value = task;
    isPicking.value = false;
    isOpen.value = true;
    return true;
  };

  /** 좁혀 둔 것을 풀고 앞선 태스크 전부를 다시 보여 준다. */
  const showAllTasks = (): void => {
    focusTask.value = '';
  };

  /**
   * 열린 목록에서 값을 고른다.
   *
   * 캔버스에서 고르는 pickTask 와 다르다 — 이쪽은 목록을 좁히지 않는다. 이미 목록을 보고
   * 있는데 고르는 순간 다른 태스크가 사라지면, 옆 태스크와 견주어 보던 흐름이 끊긴다.
   */
  const selectValue = (task: string, path: string): void => {
    if (!ancestors.value.includes(task)) return;
    selectedTask.value = task;
    selectedPath.value = path;
  };

  const pickPath = (path: string): void => {
    selectedPath.value = path;
  };

  const result = (): IFieldReference | null =>
    selectedTask.value && selectedPath.value
      ? { task: selectedTask.value, path: selectedPath.value }
      : null;

  return {
    // state
    isOpen,
    isPicking,
    focusTask,
    showAllTasks,
    selectValue,
    targetField,
    targetType,
    selectedTask,
    selectedPath,
    search,
    // derived
    ancestors,
    canBind,
    sources,
    filteredSources,
    selectedNode,
    preview,
    typeVerdict,
    // actions
    open,
    close,
    startPicking,
    pickTask,
    pickPath,
    result,
  };
}
