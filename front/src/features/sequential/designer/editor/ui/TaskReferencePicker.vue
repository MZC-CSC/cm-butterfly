<script setup lang="ts">
/**
 * Picking a value out of a previous task's result.
 *
 * Every previous task is laid out at once rather than behind a task dropdown.
 * People usually look for a value without knowing which task produces it, and
 * opening tasks one at a time to find out is the tiring part; a search box that
 * cuts across all of them ends it in one go.
 */
import type {
  IOutputSource,
  TypeVerdict,
} from '../composables/useTaskReference';

interface IProps {
  /** Field this value is going into. Empty string means the whole body. */
  targetField: string;
  sources: IOutputSource[];
  search: string;
  selectedTask: string;
  selectedPath: string;
  preview: string;
  typeVerdict: TypeVerdict;
  targetType?: string;
  selectedType?: string;
  selectedMultiple?: boolean;
  /** The task picked on the canvas. When not empty, the list is narrowed to that task. */
  focusTask?: string;
}

const props = defineProps<IProps>();

const emit = defineEmits([
  'update:search',
  'pick',
  'manual',
  'apply',
  'cancel',
  'show-all',
]);

// Vue 2 parses template expressions as plain JavaScript, so a TypeScript cast
// like `($event.target as HTMLInputElement)` cannot live in the markup. The
// reads happen here instead.
const valueOf = (event: Event): string =>
  (event.target as HTMLInputElement).value;

const onSearch = (event: Event): void => emit('update:search', valueOf(event));

const onManualTask = (event: Event): void =>
  emit('manual', valueOf(event), props.selectedPath);

const onManualPath = (event: Event): void =>
  emit('manual', props.selectedTask, valueOf(event));

const title = (): string =>
  props.targetField
    ? `Pick a value — ${props.targetField}`
    : 'Pick what to pass';
</script>

<template>
  <div class="rp-pop" data-testid="wf-ref-popover">
    <div class="rp-head">{{ title() }}</div>

    <label class="rp-search">
      <svg viewBox="0 0 16 16" class="rp-mag" aria-hidden="true">
        <circle
          cx="7"
          cy="7"
          r="4.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="M10.2 10.2 14 14"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <input
        data-testid="wf-ref-search"
        :value="search"
        placeholder="Search by name"
        @input="onSearch"
      />
    </label>

    <!-- What was picked on the canvas has to show. If the list stays the same nobody can tell
         what was picked, and there must be a way back to see the other tasks. -->
    <p v-if="focusTask" class="rp-focus" data-testid="wf-ref-focus">
      Showing <strong>{{ focusTask }}</strong> — picked on the canvas.
      <button
        type="button"
        data-testid="wf-ref-show-all"
        @click="emit('show-all')"
      >
        Show all earlier tasks
      </button>
    </p>

    <div class="rp-tree">
      <div
        v-for="(source, index) in sources"
        :key="source.task"
        class="rp-source"
        :data-testid="`wf-ref-source-${source.task}`"
      >
        <div class="rp-group">
          <span class="rp-ord">{{ index + 1 }}</span>
          <!-- Clicking the task name picks that task's whole result.
               The items below are picked one by one, so clicking their heading, the name,
               naturally reads as "this whole task". -->
          <button
            v-if="source.hasSchema"
            type="button"
            class="rp-task rp-task-pick"
            :class="{
              on: selectedTask === source.task && selectedPath === '$',
            }"
            :data-testid="`wf-ref-task-${source.task}`"
            @click="emit('pick', source.task, '$')"
          >
            {{ source.task }}
          </button>
          <span v-else class="rp-task">{{ source.task }}</span>
          <span class="rp-anc">runs earlier</span>
        </div>

        <p
          v-if="!source.hasSchema"
          class="rp-empty"
          :data-testid="`wf-ref-no-schema-${source.task}`"
        >
          This task does not describe what it returns. Enter a path directly
          below.
        </p>

        <button
          v-for="node in source.nodes"
          v-else
          :key="`${source.task}:${node.path}`"
          type="button"
          class="rp-node"
          :class="{
            on: selectedTask === source.task && selectedPath === node.path,
            whole: node.path === '$',
          }"
          :style="{ paddingLeft: `${10 + node.depth * 13}px` }"
          :data-testid="`wf-ref-node-${source.task}-${node.path}`"
          @click="emit('pick', source.task, node.path)"
        >
          <span class="rp-name">{{ node.label }}</span>
          <span class="rp-type">{{ node.type }}</span>
          <span class="rp-ex">{{ node.example ?? '' }}</span>
          <!-- The description shows as soon as the cursor is over it. A click here *picks the value*,
               so it cannot toggle the description, and the browser's own tooltip is slow to appear
               and stretches a long description into one hard-to-read line. -->
          <span v-if="node.description" class="rp-desc">
            {{ node.description }}
          </span>
        </button>
      </div>

      <p v-if="!sources.length" class="rp-empty">
        Nothing runs before this task.
      </p>
    </div>

    <div class="rp-foot">
      <div class="rp-kv">
        <span class="rp-k">Value to be saved</span>
        <span class="rp-v strong" data-testid="wf-ref-preview">{{
          preview || 'Pick a value'
        }}</span>
      </div>
      <div class="rp-kv">
        <span class="rp-k">Type</span>
        <span class="rp-v" data-testid="wf-ref-typecheck">
          {{ selectedType || '—' }} → {{ targetType || '—' }}
          <span v-if="typeVerdict === 'match'" class="rp-pill ok">fits</span>
          <span v-else-if="typeVerdict === 'mismatch'" class="rp-pill warn"
            >does not fit</span
          >
          <span v-else class="rp-pill">cannot tell</span>
        </span>
      </div>

      <!-- A value of the wrong type cannot be picked.
           Warning and letting it through means it saves and then dies at run time, with no signal
           in between, so whoever builds the workflow thinks it is done. Once the engine supports
           type conversion, this goes back down to a warning. -->
      <p
        v-if="typeVerdict === 'mismatch'"
        class="rp-warn"
        data-testid="wf-ref-type-blocked"
      >
        This value is {{ selectedType }}, and the field takes {{ targetType }}.
        It cannot be used here — pick a {{ targetType }} value, or fill the
        field in directly.
      </p>
      <p v-if="selectedMultiple" class="rp-warn">
        If the path matches more than one item, a list arrives.
      </p>

      <details class="rp-manual">
        <summary>Enter a path directly</summary>
        <p class="rp-manual-help">
          For anything the list does not cover. It is saved in the same form as
          a value picked above.
        </p>
        <div class="rp-manual-row">
          <input
            data-testid="wf-ref-manual-task"
            class="rp-manual-task"
            placeholder="Task name"
            :value="selectedTask"
            @input="onManualTask"
          />
          <input
            data-testid="wf-ref-path-input"
            class="rp-manual-path"
            placeholder="$.result.id"
            :value="selectedPath"
            @input="onManualPath"
          />
        </div>
      </details>
    </div>

    <div class="rp-btns">
      <button
        type="button"
        class="rp-btn"
        data-testid="wf-ref-cancel"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="rp-btn primary"
        data-testid="wf-ref-apply"
        :disabled="!preview || typeVerdict === 'mismatch'"
        @click="emit('apply')"
      >
        Apply
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The whole result is a different kind of thing: not one item but the entire task.
   Styled the same, it blends in with the items below and gets passed over. */
.rp-node.whole {
  background: #f5f3ff;
  border-left: 3px solid #7c6cf0;
  font-weight: 600;
}
.rp-node.whole .rp-name {
  color: #4c3fd0;
}
.rp-node.whole:hover {
  background: #ede9fe;
}

/* Shows that the task name can be picked too. */
.rp-task-pick {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-bottom: 1px dashed transparent;
}
.rp-task-pick:hover {
  border-bottom-color: #7c6cf0;
}
.rp-task-pick.on {
  color: #4c3fd0;
}

/* Value description: a layer that shows as soon as the cursor is over it. */
.rp-node {
  position: relative;
}
.rp-desc {
  position: absolute;
  z-index: 50;
  left: 10px;
  right: 10px;
  top: calc(100% - 2px);
  padding: 7px 9px;
  background: #1f2937;
  color: #f3f4f6;
  border-radius: 5px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  font-size: 11px;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.08s ease;
  pointer-events: none;
}
.rp-node:hover .rp-desc,
.rp-node:focus-visible .rp-desc {
  opacity: 1;
  visibility: visible;
}

.rp-focus {
  margin: 0 0 6px;
  padding: 6px 8px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 5px;
  color: #3730a3;
  font-size: 11px;
  line-height: 1.5;
}
.rp-focus button {
  margin-left: 4px;
  background: none;
  border: none;
  padding: 0;
  color: #4f46e5;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.rp-pop {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border: 1px solid #dfe3ea;
  border-radius: 9px;
  box-shadow: 0 18px 44px -14px rgba(16, 19, 25, 0.42);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.rp-head {
  padding: 9px 11px;
  border-bottom: 1px solid #ebeef3;
  font-size: 12px;
  font-weight: 650;
  color: #141821;
}
.rp-search {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 9px 11px;
  padding: 4px 8px;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
}
.rp-mag {
  width: 12px;
  height: 12px;
  color: #98a2b3;
  flex: none;
}
.rp-search input {
  border: 0;
  outline: 0;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #141821;
}
.rp-tree {
  max-height: 230px;
  overflow: auto;
  padding: 0 4px 6px;
}
.rp-source {
  display: contents;
}
.rp-group {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px 3px;
  font-size: 11px;
  font-weight: 700;
  color: #3d4655;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.rp-ord {
  background: #f1f3f7;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 9.5px;
  color: #6b7688;
}
.rp-task {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-anc {
  margin-left: auto;
  font-family: inherit;
  font-size: 9.5px;
  color: #98a2b3;
  flex: none;
}
.rp-node {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 76px);
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  text-align: left;
  font-size: 11.5px;
  cursor: pointer;
}
.rp-node:hover {
  background: #f5f6fa;
}
.rp-node.on {
  background: #eeeefc;
}
.rp-node.on .rp-name {
  color: #4b4ddb;
  font-weight: 650;
}
.rp-node:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: -2px;
}
.rp-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #3d4655;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-type,
.rp-ex {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  color: #98a2b3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-ex {
  color: #6b7688;
}
.rp-empty {
  margin: 4px 8px 8px;
  padding: 8px 9px;
  background: #f1f3f7;
  border-radius: 6px;
  font-size: 11.5px;
  color: #6b7688;
  line-height: 1.5;
}
.rp-foot {
  border-top: 1px solid #ebeef3;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-kv {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 11px;
}
.rp-k {
  color: #6b7688;
  flex: none;
  width: 60px;
}
.rp-v {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #3d4655;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-v.strong {
  color: #4b4ddb;
}
.rp-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 650;
  background: #f1f3f7;
  color: #6b7688;
  font-family: inherit;
}
.rp-pill.ok {
  background: #e7f4ed;
  color: #1b7a4b;
}
.rp-pill.warn {
  background: #fbf0de;
  color: #9a5b08;
}
.rp-warn {
  margin: 0;
  font-size: 11px;
  color: #9a5b08;
  line-height: 1.5;
}
.rp-manual > summary {
  font-size: 11.5px;
  color: #6b7688;
  cursor: pointer;
}
.rp-manual-help {
  margin: 6px 0 5px;
  font-size: 11px;
  color: #98a2b3;
  line-height: 1.5;
}
.rp-manual-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 6px;
}
.rp-manual-row input {
  border: 1px solid #dfe3ea;
  border-radius: 5px;
  padding: 4px 7px;
  font-size: 11.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  min-width: 0;
}
.rp-btns {
  display: flex;
  gap: 7px;
  justify-content: flex-end;
  padding: 0 11px 10px;
}
.rp-btn {
  font-size: 11.5px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #dfe3ea;
  background: #fff;
  color: #3d4655;
  cursor: pointer;
}
.rp-btn.primary {
  background: #4b4ddb;
  border-color: #4b4ddb;
  color: #fff;
  font-weight: 600;
}
.rp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rp-btn:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: 1px;
}
</style>
