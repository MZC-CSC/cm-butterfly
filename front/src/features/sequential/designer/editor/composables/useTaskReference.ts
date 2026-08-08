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
    const term = search.value.trim().toLowerCase();
    if (!term) return sources.value;
    return sources.value
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

  const preview = computed(() =>
    selectedTask.value && selectedPath.value
      ? buildFieldReference({
          task: selectedTask.value,
          path: selectedPath.value,
        })
      : '',
  );

  const typeVerdict = computed<TypeVerdict>(() =>
    compareTypes(selectedNode.value?.type, targetType.value),
  );

  const open = (field: string, fieldType?: string): void => {
    targetField.value = field;
    targetType.value = fieldType;
    selectedTask.value = '';
    selectedPath.value = '';
    search.value = '';
    isOpen.value = true;
    isPicking.value = false;
  };

  const close = (): void => {
    isOpen.value = false;
    isPicking.value = false;
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
    selectedPath.value = '';
    isPicking.value = false;
    isOpen.value = true;
    return true;
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
