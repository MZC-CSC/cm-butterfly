<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  data: any;
  readOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
});

const emit = defineEmits<{
  (e: 'update:data', value: any): void;
}>();

// Track expanded paths
const expandedPaths = ref<Set<string>>(new Set());

// Search
const searchQuery = ref('');

interface FlatRow {
  key: string;
  displayKey: string;
  value: any;
  depth: number;
  path: string;
  /** Path as segments. Used for every write - a key containing "." breaks a string path. */
  keys: string[];
  isExpandable: boolean;
  isExpanded: boolean;
  valueType: string;
  childCount?: number;
  isArrayItem: boolean;
}

function getValueType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function getValueDisplay(row: FlatRow): string {
  const v = row.value;
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `Array [${v.length}]`;
  if (typeof v === 'object') return `Object {${Object.keys(v).length}}`;
  if (typeof v === 'string') return v;
  return String(v);
}

function flattenJson(
  data: any,
  parentPath: string,
  depth: number,
  isArrayParent: boolean,
  parentKeys: string[] = [],
): FlatRow[] {
  const rows: FlatRow[] = [];
  if (data === null || data === undefined || typeof data !== 'object') return rows;

  const entries: [string, any][] = Array.isArray(data)
    ? data.map((v, i) => [String(i), v])
    : Object.entries(data);

  for (const [key, value] of entries) {
    const path = `${parentPath}.${key}`;
    const keys = [...parentKeys, key];
    const isExpandable = value !== null && typeof value === 'object';
    const isExpanded = expandedPaths.value.has(path);

    rows.push({
      key,
      displayKey: isArrayParent ? `[${key}]` : key,
      value,
      depth,
      path,
      keys,
      isExpandable,
      isExpanded,
      valueType: getValueType(value),
      childCount: isExpandable
        ? (Array.isArray(value) ? value.length : Object.keys(value).length)
        : undefined,
      isArrayItem: isArrayParent,
    });

    if (isExpandable && isExpanded) {
      rows.push(
        ...flattenJson(value, path, depth + 1, Array.isArray(value), keys),
      );
    }
  }

  return rows;
}

const parsedData = computed(() => {
  if (!props.data) return {};
  if (typeof props.data === 'string') {
    try { return JSON.parse(props.data); }
    catch { return {}; }
  }
  return props.data;
});

const flatRows = computed(() => {
  return flattenJson(parsedData.value, '$', 0, Array.isArray(parsedData.value));
});

const filteredRows = computed(() => {
  if (!searchQuery.value.trim()) return flatRows.value;
  const q = searchQuery.value.toLowerCase();
  return flatRows.value.filter(row => {
    const keyMatch = row.displayKey.toLowerCase().includes(q);
    const valMatch = !row.isExpandable && getValueDisplay(row).toLowerCase().includes(q);
    return keyMatch || valMatch;
  });
});

function toggleExpand(path: string) {
  const next = new Set(expandedPaths.value);
  if (next.has(path)) {
    // Collapse: also collapse all children
    for (const p of next) {
      if (p.startsWith(path)) next.delete(p);
    }
  } else {
    next.add(path);
  }
  expandedPaths.value = next;
}

function expandAll() {
  const allPaths = new Set<string>();
  function collect(data: any, parentPath: string) {
    if (data === null || data === undefined || typeof data !== 'object') return;
    const entries: [string, any][] = Array.isArray(data)
      ? data.map((v, i) => [String(i), v])
      : Object.entries(data);
    for (const [key, value] of entries) {
      const path = `${parentPath}.${key}`;
      if (value !== null && typeof value === 'object') {
        allPaths.add(path);
        collect(value, path);
      }
    }
  }
  collect(parsedData.value, '$');
  expandedPaths.value = allPaths;
}

function collapseAll() {
  expandedPaths.value = new Set();
}

function expandToDepth(maxDepth: number) {
  const paths = new Set<string>();
  function collect(data: any, parentPath: string, depth: number) {
    if (depth >= maxDepth || data === null || data === undefined || typeof data !== 'object') return;
    const entries: [string, any][] = Array.isArray(data)
      ? data.map((v, i) => [String(i), v])
      : Object.entries(data);
    for (const [key, value] of entries) {
      const path = `${parentPath}.${key}`;
      if (value !== null && typeof value === 'object') {
        paths.add(path);
        collect(value, path, depth + 1);
      }
    }
  }
  collect(parsedData.value, '$', 0);
  expandedPaths.value = paths;
}

// Default: expand first 2 levels
watch(parsedData, () => {
  expandToDepth(2);
}, { immediate: true });

function getTypeClass(type: string): string {
  const map: Record<string, string> = {
    string: 'type-string',
    number: 'type-number',
    boolean: 'type-boolean',
    null: 'type-null',
    array: 'type-structural',
    object: 'type-structural',
  };
  return map[type] || '';
}

// Editing state
const editingPath = ref<string | null>(null);
const editValue = ref('');

function startEdit(row: FlatRow) {
  if (props.readOnly || row.isExpandable) return;
  editingPath.value = row.path;
  editValue.value = row.valueType === 'string' ? row.value : String(row.value);
}

/* Row operations
   ------------------------------------------------------------------
   The grid is the view people actually use on these documents, because the
   library table mode only opens arrays and our models are objects at the root.
   So adding a row has to work here: keep the keys of the row we copy from, and
   the new entry arrives with every column already in place. */

function cloneData(): any {
  return JSON.parse(JSON.stringify(parsedData.value));
}

// Walk to the container that holds the row, so the last key can be written.
function containerOf(data: any, keys: string[]): any {
  let current = data;
  for (const key of keys.slice(0, -1)) current = current[key];
  return current;
}

function commit(data: any) {
  emit('update:data', JSON.stringify(data, null, 2));
}

const canEdit = computed(() => !props.readOnly);

// Only entries of an array or an object can be duplicated or removed.
function isRemovable(row: FlatRow): boolean {
  return canEdit.value && row.keys.length > 0;
}

function duplicateRow(row: FlatRow) {
  if (!isRemovable(row)) return;
  const data = cloneData();
  const container = containerOf(data, row.keys);
  const key = row.keys[row.keys.length - 1];

  if (Array.isArray(container)) {
    const index = Number(key);
    container.splice(
      index + 1,
      0,
      JSON.parse(JSON.stringify(container[index])),
    );
  } else {
    let name = `${key}_copy`;
    let n = 2;
    while (name in container) name = `${key}_copy${n++}`;
    container[name] = JSON.parse(JSON.stringify(container[key]));
  }
  commit(data);
}

function removeRow(row: FlatRow) {
  if (!isRemovable(row)) return;
  const data = cloneData();
  const container = containerOf(data, row.keys);
  const key = row.keys[row.keys.length - 1];

  if (Array.isArray(container)) container.splice(Number(key), 1);
  else delete container[key];
  commit(data);
}

// Add an entry to the array on this row, shaped like the entry already there.
function addArrayItem(row: FlatRow) {
  if (!canEdit.value || row.valueType !== 'array') return;
  const data = cloneData();
  let target = data;
  for (const key of row.keys) target = target[key];
  if (!Array.isArray(target)) return;

  const last = target.length ? target[target.length - 1] : '';
  target.push(JSON.parse(JSON.stringify(last)));

  // Show what was just added rather than leaving it folded away.
  expandedPaths.value = new Set([...expandedPaths.value, row.path]);
  commit(data);
}

function confirmEdit(row: FlatRow) {
  if (!editingPath.value) return;

  // Build new value with correct type
  let newValue: any = editValue.value;
  if (row.valueType === 'number') {
    const n = Number(editValue.value);
    if (!isNaN(n)) newValue = n;
  } else if (row.valueType === 'boolean') {
    newValue = editValue.value === 'true';
  } else if (editValue.value === 'null') {
    newValue = null;
  }

  // Apply change to data
  const newData = cloneData();
  containerOf(newData, row.keys)[row.keys[row.keys.length - 1]] = newValue;

  commit(newData);
  editingPath.value = null;
}

function cancelEdit() {
  editingPath.value = null;
}
</script>

<template>
  <div class="property-grid">
    <!-- Toolbar -->
    <div class="pg-toolbar">
      <div class="pg-toolbar-left">
        <button class="pg-btn" @click="expandAll" title="Expand All">
          <span class="pg-icon">&#9660;</span> Expand All
        </button>
        <button class="pg-btn" @click="collapseAll" title="Collapse All">
          <span class="pg-icon">&#9654;</span> Collapse All
        </button>
        <button class="pg-btn" @click="expandToDepth(2)" title="Depth 2">
          D2
        </button>
        <button class="pg-btn" @click="expandToDepth(3)" title="Depth 3">
          D3
        </button>
        <button class="pg-btn" @click="expandToDepth(5)" title="Depth 5">
          D5
        </button>
        <button class="pg-btn" @click="expandToDepth(7)" title="Depth 7">
          D7
        </button>
      </div>
      <div class="pg-toolbar-right">
        <input
          v-model="searchQuery"
          type="text"
          class="pg-search"
          placeholder="Search key or value..."
        />
      </div>
    </div>

    <!-- Table -->
    <div class="pg-table-wrapper">
      <table class="pg-table">
        <thead>
          <tr>
            <th class="pg-th-key">Property</th>
            <th class="pg-th-value">Value</th>
            <th v-if="canEdit" class="pg-th-actions">Row</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredRows"
            :key="row.path"
            :class="['pg-row', `depth-${Math.min(row.depth, 8)}`]"
          >
            <!-- Key column -->
            <td
              class="pg-cell-key"
              :style="{ paddingLeft: (row.depth * 20 + 8) + 'px' }"
            >
              <span
                v-if="row.isExpandable"
                class="pg-toggle"
                @click="toggleExpand(row.path)"
              >
                {{ row.isExpanded ? '&#9660;' : '&#9654;' }}
              </span>
              <span v-else class="pg-toggle-placeholder" />
              <span :class="['pg-key', { 'pg-key-index': row.isArrayItem }]">
                {{ row.displayKey }}
              </span>
            </td>

            <!-- Value column -->
            <td
              class="pg-cell-value"
              :class="getTypeClass(row.valueType)"
              @dblclick="startEdit(row)"
            >
              <!-- Editing mode -->
              <template v-if="editingPath === row.path">
                <input
                  v-model="editValue"
                  class="pg-edit-input"
                  @keydown.enter="confirmEdit(row)"
                  @keydown.escape="cancelEdit"
                  @blur="confirmEdit(row)"
                  ref="editInput"
                  autofocus
                />
              </template>

              <!-- Display mode -->
              <template v-else>
                <template v-if="row.isExpandable">
                  <span class="pg-type-badge">
                    {{ row.valueType === 'array' ? 'Array' : 'Object' }}
                  </span>
                  <span class="pg-count">({{ row.childCount }})</span>
                </template>
                <template v-else>
                  <span class="pg-value">{{ getValueDisplay(row) }}</span>
                </template>
              </template>
            </td>

            <!-- Row actions -->
            <td v-if="canEdit" class="pg-cell-actions">
              <button
                v-if="row.valueType === 'array'"
                class="pg-row-btn"
                data-testid="json-grid-array-add"
                title="Add an entry shaped like the last one"
                @click="addArrayItem(row)"
              >
                +
              </button>
              <button
                v-if="isRemovable(row)"
                class="pg-row-btn"
                data-testid="json-grid-row-duplicate"
                title="Duplicate this entry"
                @click="duplicateRow(row)"
              >
                &#10697;
              </button>
              <button
                v-if="isRemovable(row)"
                class="pg-row-btn pg-row-btn-danger"
                data-testid="json-grid-row-remove"
                title="Remove this entry"
                @click="removeRow(row)"
              >
                &#10005;
              </button>
            </td>
          </tr>
          <tr v-if="filteredRows.length === 0">
            <td :colspan="canEdit ? 3 : 2" class="pg-empty">
              {{ searchQuery ? 'No matching results' : 'Empty data' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.property-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}

/* Toolbar */
.pg-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  gap: 8px;
}

.pg-toolbar-left {
  display: flex;
  gap: 4px;
}

.pg-btn {
  padding: 3px 8px;
  font-size: 11px;
  color: #4b5563;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
}

.pg-icon {
  font-size: 8px;
  vertical-align: middle;
}

.pg-search {
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  outline: none;
  width: 180px;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px #6366f1;
  }
}

/* Table */
.pg-table-wrapper {
  flex: 1;
  overflow: auto;
}

.pg-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.pg-th-key,
.pg-th-value,
.pg-th-actions {
  position: sticky;
  top: 0;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  background: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
  text-align: left;
  z-index: 1;
}

.pg-th-key {
  width: 45%;
}

.pg-th-value {
  width: 55%;
}

.pg-th-actions {
  width: 92px;
  text-align: right;
}

.pg-cell-actions {
  padding: 3px 6px;
  text-align: right;
  vertical-align: top;
  white-space: nowrap;
}

.pg-row-btn {
  padding: 1px 6px;
  margin-left: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: #4b5563;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;

  &:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #4f46e5;
  }
}

.pg-row-btn-danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

/* Keep the row quiet until it is the one being worked on. */
.pg-row:hover .pg-row-btn,
.pg-row-btn:focus {
  opacity: 1;
}

.pg-row {
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background-color: #f8faff;
  }

  &.depth-0 > .pg-cell-key {
    font-weight: 600;
  }
}

/* Depth zebra-striping for visual grouping */
.pg-row.depth-0 { background-color: #ffffff; }
.pg-row.depth-1 { background-color: #fafbfc; }
.pg-row.depth-2 { background-color: #f6f8fa; }
.pg-row.depth-3 { background-color: #f3f5f7; }
.pg-row.depth-4 { background-color: #f0f2f5; }
.pg-row.depth-5,
.pg-row.depth-6,
.pg-row.depth-7,
.pg-row.depth-8 { background-color: #eef0f3; }

.pg-cell-key {
  padding: 5px 8px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid #e5e7eb;
  vertical-align: top;
}

.pg-cell-value {
  padding: 5px 8px;
  color: #374151;
  word-break: break-word;
  vertical-align: top;
  cursor: default;
}

.pg-toggle {
  display: inline-block;
  width: 16px;
  font-size: 9px;
  color: #6b7280;
  cursor: pointer;
  text-align: center;
  vertical-align: middle;
  user-select: none;

  &:hover {
    color: #6366f1;
  }
}

.pg-toggle-placeholder {
  display: inline-block;
  width: 16px;
}

.pg-key {
  color: #1e3a5f;
  vertical-align: middle;
}

.pg-key-index {
  color: #6366f1;
  font-style: italic;
}

/* Value type colors */
.type-string .pg-value { color: #059669; }
.type-number .pg-value { color: #dc2626; }
.type-boolean .pg-value { color: #7c3aed; }
.type-null .pg-value { color: #9ca3af; font-style: italic; }

.type-structural .pg-type-badge {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 500;
  color: #6366f1;
  background: #eef2ff;
  border-radius: 3px;
  vertical-align: middle;
}

.pg-count {
  margin-left: 4px;
  font-size: 11px;
  color: #9ca3af;
}

/* Editing */
.pg-edit-input {
  width: 100%;
  padding: 2px 4px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid #6366f1;
  border-radius: 2px;
  outline: none;
  background: #fffff0;
}

.pg-empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
}
</style>
