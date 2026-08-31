<template>
  <div class="form-field" :class="`depth-${depth}`">
    <!-- String, Number, Boolean - Simple Input -->
    <div v-if="isSimpleType" class="simple-field">
      <!-- Pull a value out of a previous task. Dragging it onto the canvas lights up
           the tasks that may be picked; clicking opens the same picker. -->
      <button
        v-if="!reference && canBind"
        type="button"
        class="btn-ref-add"
        draggable="true"
        :data-testid="`wf-field-ref-add-${referenceKey}`"
        title="Take a value from an earlier task"
        @click="$emit('reference', referenceKey, fieldSchema.type)"
        @dragstart="$emit('ref-drag-start', referenceKey, fieldSchema.type)"
        @dragend="$emit('ref-drag-end')"
      >
        <svg viewBox="0 0 16 16" class="ref-add-icon" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="3.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
          <path
            d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <label
        class="field-label"
        :class="{ 'has-tooltip': fieldSchema.description }"
        @click.stop="fieldSchema.description && toggleHelp()"
      >
        {{ fieldName }}<span v-if="isRequired" class="required-mark">*</span>
        <!-- 사용자가 적은 값이 아니라 로딩할 때 형식을 맞춰 바꾼 값이다. 저장하기 전에
             한 번 보라는 표시다. -->
        <span
          v-if="wasCoerced"
          class="field-coerced-mark"
          :data-testid="`wf-field-coerced-${referenceKey}`"
          title="This was put right when the workflow was opened. Look it over before saving — press the reference button to change what it points at."
          >check this</span
        >
        <span v-if="fieldSchema.description" class="field-help-mark">?</span>
        <!-- 설명은 레이어로 띄운다. 브라우저 기본 title 은 뜨기까지 한참 걸리고, 줄바꿈도
             길이 제한도 우리가 손댈 수 없다. 커서가 물음표로 바뀌고 밑줄까지 생기는데
             눌러도 아무 일이 없으면, 사람은 안 되는 것으로 읽는다. -->
        <span v-if="showHelp" class="field-help-layer" @click.stop>
          {{ fieldSchema.description }}
        </span>
      </label>
      <!-- Filled from a previous task: rendered as a reference, not editable text. A
           `${task.path}` reference is ordinary JSON text, so left in an input a user
           edits it by accident and it breaks with nothing to say so. -->
      <TaskReferenceValue
        v-if="reference"
        :task="reference.task"
        :path="reference.path"
        :field="referenceKey"
        :multiple="reference.multiple"
        @edit="$emit('reference', referenceKey, fieldSchema.type)"
        @clear="$emit('reference-clear', referenceKey)"
      />
      <textarea
        v-if="!reference && fieldSchema.type === 'string' && shouldUseTextarea"
        :data-testid="fieldTestId"
        :value="fieldValue || ''"
        :class="['field-textarea', { 'field-invalid': isInvalid }]"
        :placeholder="`Enter ${fieldName}`"
        rows="6"
        @input="handleInput($event)"
      />
      <input
        v-else-if="!reference && fieldSchema.type === 'string'"
        :data-testid="fieldTestId"
        type="text"
        :value="fieldValue || ''"
        :class="['field-input', { 'field-invalid': isInvalid }]"
        :placeholder="`Enter ${fieldName}`"
        @input="handleInput($event)"
      />
      <input
        v-else-if="
          !reference &&
          (fieldSchema.type === 'number' || fieldSchema.type === 'integer')
        "
        :data-testid="fieldTestId"
        type="number"
        :value="fieldValue || 0"
        :class="['field-input', { 'field-invalid': isInvalid }]"
        :placeholder="`Enter ${fieldName}`"
        @input="handleInput($event)"
      />
      <input
        v-else-if="!reference && fieldSchema.type === 'boolean'"
        :data-testid="fieldTestId"
        type="checkbox"
        :checked="!!fieldValue"
        class="field-checkbox"
        @change="handleInput($event)"
      />
      <p
        v-if="isInvalid"
        class="field-invalid-note"
        :data-testid="`wf-field-ref-invalid-${referenceKey}`"
      >
        This reads a task that does not run first, so it will fail when the
        workflow runs.
      </p>
    </div>

    <!-- Array Type -->
    <div v-else-if="fieldSchema.type === 'array'" class="array-field">
      <div class="array-header">
        <div class="header-left">
          <button
            v-if="!reference"
            :data-testid="arrayToggleTestId"
            class="btn-collapse"
            @click="toggleArrayCollapse"
          >
            {{ isArrayCollapsed ? '▶' : '▼' }}
          </button>
          <label
            class="field-label"
            :class="{ 'has-tooltip': fieldSchema.description }"
            :title="fieldSchema.description || ''"
          >
            {{ fieldName
            }}<span v-if="isRequired" class="required-mark">*</span>
            <span v-if="!reference" class="field-type"
              >({{ arrayValue.length }} items)</span
            >
          </label>
        </div>
        <div class="header-actions">
          <!-- 배열 전체를 앞선 태스크의 결과로 받을 수 있다. 그 자리에는 입력 상자가 없어
               개별 칸처럼 왼쪽에 버튼을 둘 자리가 없으므로, 항목을 더하는 버튼 옆에 둔다. -->
          <button
            v-if="!reference && canBind"
            type="button"
            class="btn-ref-add"
            :data-testid="`wf-field-ref-add-${referenceKey}`"
            title="Take this whole list from an earlier task"
            @click="$emit('reference', referenceKey, 'array')"
          >
            <svg viewBox="0 0 16 16" class="ref-add-icon" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="3.2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path
                d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button
            v-if="!reference"
            :data-testid="arrayAddTestId"
            class="btn-add-item"
            @click="addArrayItem"
          >
            + Add entity
          </button>
        </div>
      </div>

      <!-- 참조가 걸리면 항목 대신 참조를 보여준다. 실행할 때 목록 전체가 이 자리에 온다. -->
      <TaskReferenceValue
        v-if="reference"
        :task="reference.task"
        :path="reference.path"
        :field="referenceKey"
        :multiple="reference.multiple"
        @edit="$emit('reference', referenceKey, 'array')"
        @clear="$emit('reference-clear', referenceKey)"
      />

      <div v-if="!reference && !isArrayCollapsed" class="array-items">
        <!-- String Array -->
        <div v-if="isStringArray" class="string-array">
          <div
            v-for="(item, index) in arrayValue"
            :key="index"
            class="array-item"
          >
            <input
              :data-testid="arrayItemTestId(index)"
              type="text"
              :value="item"
              :class="['field-input', { 'field-invalid': isInvalid }]"
              :placeholder="`Item ${index + 1}`"
              @input="updateArrayItem(index, $event)"
            />
            <button
              :data-testid="arrayRemoveTestId(index)"
              class="btn-remove-item"
              @click="removeArrayItem(index)"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Object Array -->
        <div
          v-else-if="fieldSchema.items && fieldSchema.items.type === 'object'"
          class="object-array"
        >
          <div
            v-for="(item, index) in arrayValue"
            :key="index"
            class="array-item-object"
          >
            <div
              class="item-header"
              style="cursor: pointer"
              @click="toggleItemCollapse(index)"
            >
              <div class="item-header-left">
                <button
                  :data-testid="arrayItemToggleTestId(index)"
                  class="btn-item-collapse"
                  @click.stop="toggleItemCollapse(index)"
                >
                  {{ isItemCollapsed(index) ? '▶' : '▼' }}
                </button>
                <span class="item-title">Item {{ index + 1 }}</span>
                <span v-if="isItemCollapsed(index)" class="item-prop-count">
                  ({{ Object.keys(fieldSchema.items.properties || {}).length }}
                  properties)
                </span>
              </div>
              <button
                :data-testid="arrayRemoveTestId(index)"
                class="btn-remove-item"
                @click.stop="removeArrayItem(index)"
              >
                × Remove
              </button>
            </div>
            <div v-if="!isItemCollapsed(index)" class="item-properties">
              <recursive-form-field
                v-for="propName in sortedArrayItemPropertyNames"
                :key="`${index}-${propName}`"
                :field-name="String(propName)"
                :field-schema="fieldSchema.items.properties[propName]"
                :field-value="item[propName]"
                :step-properties="stepProperties"
                :max-auto-expand-depth="maxAutoExpandDepth"
                :parent-required="fieldSchema.items?.required || []"
                :task-name="taskName"
                :current-path="`${currentPath}[]`"
                :index-path="childIndexPath(String(propName), index)"
                :references="references"
                :invalid-paths="invalidPaths"
                :coerced-paths="coercedPaths"
                :can-bind="canBind"
                :depth="depth + 1"
                @update="
                  updateObjectArrayItemProperty(index, String(propName), $event)
                "
                @reference="(k, t) => $emit('reference', k, t)"
                @reference-clear="k => $emit('reference-clear', k)"
                @ref-drag-start="(k, t) => $emit('ref-drag-start', k, t)"
                @ref-drag-end="$emit('ref-drag-end')"
              />
            </div>
            <div v-else class="item-collapsed-indicator">
              <span class="item-collapsed-text">
                {{ Object.keys(fieldSchema.items.properties || {}).length }}
                properties (collapsed)
              </span>
            </div>
          </div>
        </div>

        <div v-if="!arrayValue || arrayValue.length === 0" class="empty-array">
          No items. Click "Add Item" to add.
        </div>
      </div>

      <div v-else-if="!reference" class="collapsed-indicator">
        <span class="collapsed-text"
          >{{ arrayValue.length }} items (collapsed)</span
        >
      </div>
    </div>

    <!-- Object Type -->
    <div v-else-if="fieldSchema.type === 'object'" class="object-field">
      <div class="object-header">
        <div class="header-left">
          <button
            v-if="!reference"
            :data-testid="objectToggleTestId"
            class="btn-collapse"
            @click="toggleObjectCollapse"
          >
            {{ isObjectCollapsed ? '▶' : '▼' }}
          </button>
          <label
            class="field-label"
            :class="{ 'has-tooltip': fieldSchema.description }"
            :title="fieldSchema.description || ''"
          >
            {{ fieldName
            }}<span v-if="isRequired" class="required-mark">*</span>
            <span v-if="!reference" class="field-type"
              >({{
                Object.keys(fieldSchema.properties || {}).length
              }}
              properties)</span
            >
          </label>
        </div>
        <div class="header-actions">
          <!-- 이 덩어리 전체를 앞선 태스크의 결과로 받는다. 안의 칸을 하나씩 채우는 대신
               한 번에 넘길 때 쓴다 — 마이그레이션 계열이 그런 모양이다. -->
          <button
            v-if="!reference && canBind"
            type="button"
            class="btn-ref-add"
            :data-testid="`wf-field-ref-add-${referenceKey}`"
            title="Take this whole object from an earlier task"
            @click="$emit('reference', referenceKey, 'object')"
          >
            <svg viewBox="0 0 16 16" class="ref-add-icon" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="3.2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path
                d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <TaskReferenceValue
        v-if="reference"
        :task="reference.task"
        :path="reference.path"
        :field="referenceKey"
        :multiple="reference.multiple"
        @edit="$emit('reference', referenceKey, 'object')"
        @clear="$emit('reference-clear', referenceKey)"
      />

      <div
        v-if="!reference && !isObjectCollapsed"
        class="object-properties"
        :class="{ 'depth-0-object': depth === 0 }"
      >
        <recursive-form-field
          v-for="propName in sortedPropertyNames"
          :key="propName"
          :field-name="String(propName)"
          :field-schema="fieldSchema.properties[propName]"
          :field-value="objectValue[propName]"
          :step-properties="stepProperties"
          :max-auto-expand-depth="maxAutoExpandDepth"
          :parent-required="fieldSchema.required || []"
          :task-name="taskName"
          :current-path="computedChildPath(propName)"
          :index-path="childIndexPath(String(propName))"
          :references="references"
          :invalid-paths="invalidPaths"
          :coerced-paths="coercedPaths"
          :can-bind="canBind"
          :depth="depth + 1"
          @update="updateObjectProperty(String(propName), $event)"
          @reference="(k, t) => $emit('reference', k, t)"
          @reference-clear="k => $emit('reference-clear', k)"
          @ref-drag-start="(k, t) => $emit('ref-drag-start', k, t)"
          @ref-drag-end="$emit('ref-drag-end')"
        />
      </div>
      <div v-else class="collapsed-indicator">
        <span class="collapsed-text"
          >{{ Object.keys(fieldSchema.properties || {}).length }} properties
          (collapsed)</span
        >
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
import {
  getPropertyOrder,
  sortPropertiesByOrder,
} from '../config/taskPropertyOrderConfig';
import TaskReferenceValue from './TaskReferenceValue.vue';

/**
 * 지금 열려 있는 설명 하나. 컴포넌트 밖에 두는 이유는 위 toggleHelp 주석에 있다.
 */
const openHelpKey = ref<string>('');

if (typeof window !== 'undefined') {
  // 바깥을 누르면 닫는다.
  //
  // ★ 레이블 클릭에 .stop 이 필요하다. 없으면 여는 그 클릭이 여기까지 올라와 곧바로 닫아,
  //   눌러도 아무 일이 없는 것처럼 보인다.
  window.addEventListener('click', () => {
    openHelpKey.value = '';
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') openHelpKey.value = '';
  });
}

export default defineComponent({
  name: 'RecursiveFormField',
  components: { TaskReferenceValue },
  props: {
    fieldName: {
      type: String,
      required: true,
    },
    fieldSchema: {
      type: Object,
      required: true,
    },
    fieldValue: {
      type: [String, Number, Boolean, Object, Array],
      default: null,
    },
    stepProperties: {
      type: Object,
      default: () => ({}),
    },
    depth: {
      type: Number,
      default: 0,
    },
    maxAutoExpandDepth: {
      type: Number,
      default: 2, // default: auto-expand only up to depth 2
    },
    parentRequired: {
      type: Array,
      default: () => [],
    },
    taskName: {
      type: String,
      default: '',
    },
    currentPath: {
      type: String,
      default: '',
    },
    // Path used only to build test ids. It mirrors currentPath but keeps array indices, so every leaf
    // gets a unique id. currentPath itself must stay index-free — the schema lookup keys off `foo[]`.
    indexPath: {
      type: String,
      default: '',
    },
    // Fields bound to a previous task's output, keyed by the same path the test ids
    // use. Threaded down the recursion so any depth can render a reference.
    references: {
      type: Object,
      default: () => ({}),
    },
    // Paths whose reference points at a task that does not run first.
    invalidPaths: {
      type: Array,
      default: () => [],
    },
    /** Paths whose value was converted on load, so the user can look them over. */
    coercedPaths: {
      type: Array,
      default: () => [],
    },
    // False when this task has nothing before it, so there is nothing to pull from.
    canBind: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'update',
    'reference',
    'reference-clear',
    'ref-drag-start',
    'ref-drag-end',
  ],
  setup(props, { emit }) {
    // Every leaf input gets a stable id built from its path in the schema, e.g.
    // `wf-field-body_params.targetInfra.name`. The label text is the only other thing that identifies
    // a field here, and label text changes; the path does not. Tests need to point at one specific
    // field (the target infrastructure name, say) without guessing at wording or DOM position.
    const fieldTestId = computed(
      () =>
        `wf-field-${props.indexPath || props.currentPath || props.fieldName}`,
    );

    /**
     * 설명 레이어를 여닫는다. **한 번에 하나만** 열린다.
     *
     * 여러 개가 동시에 열려 있으면 어느 것이 무엇의 설명인지 알 수 없다. 다른 칸을 누르면
     * 앞엣것이 닫히도록 열린 칸을 모듈 하나에 기억해 둔다 — 각 컴포넌트가 자기 것만 알면
     * 서로를 닫을 수가 없다.
     */
    const showHelp = computed(() => openHelpKey.value === helpKey.value);
    const helpKey = computed(
      () => `${props.indexPath || props.currentPath || props.fieldName}`,
    );
    const toggleHelp = (): void => {
      openHelpKey.value = showHelp.value ? '' : helpKey.value;
    };

    /** Key this field is known by in the reference map — the same path the test ids use. */
    const referenceKey = computed(
      () => props.indexPath || props.currentPath || props.fieldName,
    );

    /** The reference on this field, if any. */
    const reference = computed(
      () =>
        (props.references as Record<string, any>)[referenceKey.value] || null,
    );

    /** True when this field's value was forced into shape rather than typed. */
    const wasCoerced = computed(() =>
      (props.coercedPaths as string[]).includes(referenceKey.value),
    );

    /** True when this field references a task that does not run before this one. */
    const isInvalid = computed(() =>
      (props.invalidPaths as string[]).includes(referenceKey.value),
    );

    /** Child path for the test id, keeping the array index so siblings do not collide. */
    const childIndexPath = (propName: string | number, arrayIndex?: number) => {
      const base = props.indexPath || props.currentPath || props.fieldName;
      return arrayIndex === undefined
        ? `${base}.${propName}`
        : `${base}[${arrayIndex}].${propName}`;
    };
    const arrayItemTestId = (arrayIndex: number) =>
      `wf-field-${props.indexPath || props.currentPath || props.fieldName}[${arrayIndex}]`;

    /** The button that adds an entry to this array, named after the array it acts on. */
    const arrayAddTestId = computed(
      () =>
        `wf-array-add-${props.indexPath || props.currentPath || props.fieldName}`,
    );

    /**
     * The toggles that open and close a nested field.
     *
     * They all read the same from the outside — a triangle — so a test that reaches for one by
     * position picks a different toggle as soon as the form gains a field. The path names which
     * one it opens, the same way the leaf inputs are named.
     */
    // ★ 셋 다 `wf-toggle-` 하나로 간다. develop 이 그렇게 쓰고 있고, 여기서 갈라 놓으면
    //   같은 화면을 보는 e2e 가 브랜치마다 다른 이름을 찾게 된다 — 실제로 충돌했다.
    //   경로가 이미 어느 쪽인지 말해 주므로(배열이면서 객체인 칸은 없다) 접두어를 나눌
    //   이유도 없다. 항목은 뒤에 `[i]` 가 붙어 저절로 갈린다.
    const arrayToggleTestId = computed(
      () =>
        `wf-toggle-${props.indexPath || props.currentPath || props.fieldName}`,
    );

    const objectToggleTestId = computed(
      () =>
        `wf-toggle-${props.indexPath || props.currentPath || props.fieldName}`,
    );

    const arrayItemToggleTestId = (arrayIndex: number) =>
      `wf-toggle-${props.indexPath || props.currentPath || props.fieldName}[${arrayIndex}]`;

    /** The button that removes one entry, which needs the entry's position as well. */
    const arrayRemoveTestId = (arrayIndex: number) =>
      `wf-array-remove-${props.indexPath || props.currentPath || props.fieldName}[${arrayIndex}]`;

    // Check whether required
    const isRequired = computed(() => {
      return props.parentRequired.includes(props.fieldName);
    });
    // 🔥 Depth-based auto-collapse logic
    const shouldAutoCollapse = computed(() => {
      return props.depth >= props.maxAutoExpandDepth;
    });

    // Decide whether to use a textarea
    const shouldUseTextarea = computed(() => {
      const taskComponent = props.stepProperties?.originalData?.task_component;
      // Support both cicada_task_script and cicada_task_run_script
      const isCicadaScriptTask =
        taskComponent === 'cicada_task_script' ||
        taskComponent === 'cicada_task_run_script';
      const result = isCicadaScriptTask && props.fieldName === 'content';

      // Debug logging
      if (props.fieldName === 'content') {
        console.log('🔍 shouldUseTextarea check for content field:');
        console.log('   taskComponent:', taskComponent);
        console.log('   fieldName:', props.fieldName);
        console.log('   isCicadaScriptTask:', isCicadaScriptTask);
        console.log('   result:', result);
        console.log('   stepProperties:', props.stepProperties);
      }

      return result;
    });

    // Collapse states
    const isArrayCollapsed = ref(shouldAutoCollapse.value);
    const isObjectCollapsed = ref(shouldAutoCollapse.value);
    const itemCollapsedStates = ref<Record<number, boolean>>({}); // Per-array-item collapse/expand state

    const isSimpleType = computed(() => {
      return ['string', 'number', 'integer', 'boolean'].includes(
        props.fieldSchema.type,
      );
    });

    const isStringArray = computed(() => {
      return props.fieldSchema.items?.type === 'string';
    });

    const arrayValue = computed(() => {
      if (!props.fieldValue) return [];
      if (Array.isArray(props.fieldValue)) return props.fieldValue;
      return [];
    });

    const objectValue = computed(() => {
      if (!props.fieldValue) return {};
      if (
        typeof props.fieldValue === 'object' &&
        !Array.isArray(props.fieldValue)
      ) {
        return props.fieldValue;
      }
      return {};
    });

    // Property ordering - Object properties
    const sortedPropertyNames = computed(() => {
      if (!props.fieldSchema.properties) return [];
      const keys = Object.keys(props.fieldSchema.properties);

      if (!props.taskName || !props.currentPath) return keys;

      const order = getPropertyOrder(props.taskName, props.currentPath);
      return order ? sortPropertiesByOrder(keys, order) : keys;
    });

    // Property ordering - Array item properties
    const sortedArrayItemPropertyNames = computed(() => {
      if (!props.fieldSchema.items?.properties) return [];
      const keys = Object.keys(props.fieldSchema.items.properties);

      if (!props.taskName || !props.currentPath) return keys;

      const arrayItemPath = `${props.currentPath}[]`;
      const order = getPropertyOrder(props.taskName, arrayItemPath);
      return order ? sortPropertiesByOrder(keys, order) : keys;
    });

    // Compute the child path
    const computedChildPath = (propName: string): string => {
      if (!props.currentPath) return propName;
      return `${props.currentPath}.${propName}`;
    };

    const handleInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      let value: any;

      if (props.fieldSchema.type === 'boolean') {
        value = target.checked;
      } else if (
        props.fieldSchema.type === 'number' ||
        props.fieldSchema.type === 'integer'
      ) {
        value = parseFloat(target.value) || 0;
      } else {
        value = target.value;
      }

      emit('update', value);
    };

    /**
     * Find data in stepProperties by matching field structure.
     * Locates the actual data for the current field path within step.properties.
     */
    const findDataInStepProperties = (fieldPath: string): any => {
      console.log('🔍 Finding data in stepProperties for path:', fieldPath);
      console.log('   stepProperties:', props.stepProperties);

      if (!props.stepProperties) return null;

      // Search in step.properties.model or step.properties.originalData.request_body
      const searchPaths = [
        props.stepProperties,
        (props.stepProperties as any)?.model,
        (props.stepProperties as any)?.originalData?.request_body,
        (props.stepProperties as any)?.targetSoftwareModel,
      ];

      for (const searchRoot of searchPaths) {
        if (!searchRoot) continue;

        // Look up directly by the current fieldName
        if (searchRoot[props.fieldName] !== undefined) {
          console.log(
            '✅ Found data in stepProperties:',
            props.fieldName,
            '=',
            searchRoot[props.fieldName],
          );
          return searchRoot[props.fieldName];
        }
      }

      console.log('⚠️ No data found in stepProperties for:', props.fieldName);
      return null;
    };

    const addArrayItem = () => {
      const newArray = [...arrayValue.value];

      console.log('=== Add Array Item ===');
      console.log('Field name:', props.fieldName);
      console.log('Current array length:', newArray.length);

      if (isStringArray.value) {
        // String array - default value from schema or empty string
        const defaultValue = props.fieldSchema.items?.default || '';
        newArray.push(defaultValue);
      } else if (props.fieldSchema.items?.type === 'object') {
        // Object array - create object from schema with default values
        const newItem: any = {};

        // 1. Find the actual data in stepProperties
        const actualDataArray = findDataInStepProperties(props.fieldName);
        console.log('📊 Actual data from stepProperties:', actualDataArray);

        if (props.fieldSchema.items.properties) {
          Object.keys(props.fieldSchema.items.properties).forEach(key => {
            const propSchema = props.fieldSchema.items.properties[key];

            // Priority 1: use the first item's value from the actual stepProperties data
            if (
              Array.isArray(actualDataArray) &&
              actualDataArray.length > 0 &&
              actualDataArray[0][key] !== undefined
            ) {
              if (propSchema.type === 'array') {
                newItem[key] = Array.isArray(actualDataArray[0][key])
                  ? JSON.parse(JSON.stringify(actualDataArray[0][key]))
                  : [];
                console.log(
                  `   📋 Property "${key}" from stepProperties (array):`,
                  newItem[key],
                );
              } else if (propSchema.type === 'object') {
                newItem[key] =
                  typeof actualDataArray[0][key] === 'object'
                    ? JSON.parse(JSON.stringify(actualDataArray[0][key]))
                    : {};
                console.log(
                  `   📋 Property "${key}" from stepProperties (object):`,
                  newItem[key],
                );
              } else {
                newItem[key] = actualDataArray[0][key];
                console.log(
                  `   📋 Property "${key}" from stepProperties (value):`,
                  newItem[key],
                );
              }
            }
            // Priority 2: Schema default value
            else if (propSchema.default !== undefined) {
              newItem[key] = propSchema.default;
              console.log(
                `   🔧 Property "${key}" from schema default:`,
                newItem[key],
              );
            }
            // Priority 3: copy from the first item of the current array
            else if (
              arrayValue.value.length > 0 &&
              arrayValue.value[0][key] !== undefined
            ) {
              if (propSchema.type === 'array') {
                newItem[key] = Array.isArray(arrayValue.value[0][key])
                  ? JSON.parse(JSON.stringify(arrayValue.value[0][key]))
                  : [];
              } else if (propSchema.type === 'object') {
                newItem[key] =
                  typeof arrayValue.value[0][key] === 'object'
                    ? JSON.parse(JSON.stringify(arrayValue.value[0][key]))
                    : {};
              } else {
                newItem[key] = arrayValue.value[0][key];
              }
              console.log(
                `   📝 Property "${key}" from current array[0]:`,
                newItem[key],
              );
            }
            // Priority 4: Type-based default
            else if (propSchema.type === 'array') {
              newItem[key] = [];
            } else if (propSchema.type === 'object') {
              newItem[key] = {};
            } else if (
              propSchema.type === 'number' ||
              propSchema.type === 'integer'
            ) {
              newItem[key] = 0;
            } else if (propSchema.type === 'boolean') {
              newItem[key] = false;
            } else {
              newItem[key] = '';
            }
          });
        }
        newArray.push(newItem);

        console.log('✅ Added new array item:', newItem);
        console.log(
          '   Based on schema properties:',
          Object.keys(props.fieldSchema.items.properties || {}),
        );
      }

      emit('update', newArray);
    };

    const duplicateLastArrayItem = () => {
      const newArray = [...arrayValue.value];

      if (newArray.length > 0) {
        const lastItem = newArray[newArray.length - 1];

        // Deep clone the last item
        let duplicatedItem;
        if (typeof lastItem === 'object') {
          duplicatedItem = JSON.parse(JSON.stringify(lastItem));
        } else {
          duplicatedItem = lastItem;
        }

        newArray.push(duplicatedItem);

        console.log('✅ Duplicated last array item');
        console.log('   Original item:', lastItem);
        console.log('   Duplicated item:', duplicatedItem);
      }

      emit('update', newArray);
    };

    const removeArrayItem = (index: number) => {
      const newArray = [...arrayValue.value];
      newArray.splice(index, 1);
      emit('update', newArray);
    };

    const updateArrayItem = (index: number, event: Event) => {
      const target = event.target as HTMLInputElement;
      const newArray = [...arrayValue.value];
      newArray[index] = target.value;
      emit('update', newArray);
    };

    const updateObjectArrayItemProperty = (
      index: number,
      propName: string,
      value: any,
    ) => {
      const newArray = [...arrayValue.value];
      if (!newArray[index]) {
        newArray[index] = {};
      }
      newArray[index] = {
        ...newArray[index],
        [propName]: value,
      };
      emit('update', newArray);
    };

    const updateObjectProperty = (propName: string, value: any) => {
      let baseObject = objectValue.value;

      // 🔍 CRITICAL FIX: Check if baseObject is a schema (not actual data)
      if (
        baseObject &&
        baseObject.type === 'object' &&
        baseObject.properties &&
        typeof baseObject.properties === 'object'
      ) {
        // This is a JSON schema, not actual data!
        // Start with empty object to avoid including schema properties in the result
        console.warn(
          `⚠️ updateObjectProperty: objectValue is schema for field "${props.fieldName}", starting with empty object`,
        );
        console.warn(
          '   Schema properties:',
          Object.keys(baseObject.properties),
        );
        baseObject = {};
      }

      const newObject = {
        ...baseObject,
        [propName]: value,
      };

      console.log(`🔄 updateObjectProperty: ${props.fieldName}.${propName}`);
      console.log('   Base object keys:', Object.keys(baseObject));
      console.log('   New value type:', typeof value);
      console.log('   Result object keys:', Object.keys(newObject));

      emit('update', newObject);
    };

    // Toggle functions
    const toggleArrayCollapse = () => {
      isArrayCollapsed.value = !isArrayCollapsed.value;
    };

    const toggleObjectCollapse = () => {
      isObjectCollapsed.value = !isObjectCollapsed.value;
    };

    const toggleItemCollapse = (index: number) => {
      const currentState = isItemCollapsed(index);
      console.log(
        `🔄 Toggle Item ${index}: ${currentState} → ${!currentState}`,
      );

      // Create a new object for Vue 3 reactivity
      itemCollapsedStates.value = {
        ...itemCollapsedStates.value,
        [index]: !currentState,
      };

      console.log(`   Updated state:`, itemCollapsedStates.value[index]);
    };

    const isItemCollapsed = (index: number): boolean => {
      // If there's no initial state, decide based on depth
      if (itemCollapsedStates.value[index] === undefined) {
        // If depth >= maxAutoExpandDepth - 1, collapse the item too
        const initialState = props.depth >= props.maxAutoExpandDepth - 1;
        itemCollapsedStates.value = {
          ...itemCollapsedStates.value,
          [index]: initialState,
        };
      }
      return itemCollapsedStates.value[index];
    };

    return {
      fieldTestId,
      showHelp,
      toggleHelp,
      referenceKey,
      reference,
      isInvalid,
      wasCoerced,
      childIndexPath,
      arrayItemTestId,
      arrayAddTestId,
      arrayToggleTestId,
      objectToggleTestId,
      arrayItemToggleTestId,
      arrayRemoveTestId,
      isSimpleType,
      isStringArray,
      arrayValue,
      objectValue,
      isArrayCollapsed,
      isObjectCollapsed,
      itemCollapsedStates,
      shouldAutoCollapse,
      shouldUseTextarea,
      isRequired,
      sortedPropertyNames,
      sortedArrayItemPropertyNames,
      computedChildPath,
      handleInput,
      addArrayItem,
      duplicateLastArrayItem,
      removeArrayItem,
      updateArrayItem,
      updateObjectArrayItemProperty,
      updateObjectProperty,
      toggleArrayCollapse,
      toggleObjectCollapse,
      toggleItemCollapse,
      isItemCollapsed,
    };
  },
});
</script>

<style scoped lang="postcss">
.form-field {
  margin-bottom: 1rem;
  position: relative;
  padding-left: 1.5rem;
}

/* Depth indicators - absolute positioning */
.depth-0::before,
.depth-1::before,
.depth-2::before,
.depth-3::before,
.depth-4::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.depth-0 {
  padding-left: 0;
  background-color: #ffffff;
}

.depth-0::before {
  display: none;
}

.depth-1 {
  padding-left: 0.75rem;
  margin-left: 0;
}

.depth-1::before {
  background-color: #10b981;
  left: 0.25rem;
}

.depth-2 {
  padding-left: 0.75rem;
  margin-left: 0;
}

.depth-2::before {
  background-color: #f59e0b;
  left: 0.5rem;
}

.depth-3 {
  padding-left: 0.75rem;
  margin-left: 0;
}

.depth-3::before {
  background-color: #ef4444;
  left: 0.75rem;
}

.depth-4 {
  padding-left: 0.75rem;
  margin-left: 0;
}

.depth-4::before {
  background-color: #8b5cf6;
  left: 1rem;
}

.simple-field {
  /* 참조 버튼 · 레이블 · 값. 버튼이 늘 첫 칸을 차지해야 값 칸의 왼쪽 선이 흔들리지 않는다 —
     버튼이 없는 칸(참조가 이미 걸렸거나 가져올 곳이 없는 경우)에서도 폭을 비워 둔다. */
  display: grid;
  /* 레이블 칸을 *이름 길이에 맞춰* 잡는다.
     %로 고정했더니 중첩으로 들어갈수록 칸이 좁아져 acceleratorCount 같은 이름이
     "acceleratorCo / unt" 처럼 **단어 중간에서** 잘렸다. max-content 면 이름이 한
     줄에 들어갈 만큼만 가져가고, 입력 칸은 최소 140px 를 지킨다 — 이름이 정말 길면
     그때서야 레이블이 접힌다. */
  grid-template-columns: 22px minmax(120px, max-content) minmax(140px, 1fr);
  gap: 0.5rem;
  align-items: center;
}

.simple-field > .btn-ref-add {
  grid-column: 1;
}

/* 버튼이 없을 때 레이블이 첫 칸으로 당겨지지 않게 자리를 지킨다. */
.simple-field > .field-label {
  grid-column: 2;
}

/* 값 자리는 늘 셋째 칸이다 — 입력 상자든, 참조 표시든. */
.simple-field > .field-input,
.simple-field > .field-textarea,
.simple-field > .field-checkbox,
.simple-field > .field-select,
.simple-field > .task-ref-row {
  grid-column: 3;
}

.field-label {
  display: block;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
  text-align: right;
  padding-right: 0.5rem;
  /* 단어 중간에서 자르지 않는다. 자리가 정말 모자랄 때만 접힌다. */
  word-break: normal;
  overflow-wrap: break-word;
}

.field-coerced-mark {
  /* 사용자가 적은 것이 아니라 우리가 맞춘 것이다. 저장하기 전에 한 번 보라는 뜻이라
     눈에 띄는 색으로 둔다 — 참조를 다시 고르면 사라진다. */
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.field-label.has-tooltip {
  cursor: pointer;
  position: relative;
}

.field-label.has-tooltip:hover {
  color: #1f2937;
  text-decoration: underline dotted;
}

/* 눌러 볼 것이 있다는 표시. 커서만 바꾸면 무엇을 누르라는 것인지 알 수 없다. */
.field-help-mark {
  display: inline-block;
  margin-left: 0.25rem;
  width: 13px;
  height: 13px;
  line-height: 13px;
  text-align: center;
  border-radius: 50%;
  background: #e5e9f0;
  color: #5b6474;
  font-size: 9px;
  font-weight: 700;
  vertical-align: middle;
}

.field-label.has-tooltip:hover .field-help-mark {
  background: #4f46e5;
  color: #fff;
}

/* 레이어라 줄바꿈도 길이도 우리가 정한다. */
.field-help-layer {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  max-width: 320px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  color: #374151;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.5;
  white-space: pre-wrap;
  text-decoration: none;
  cursor: default;
}

.required-mark {
  color: #dc2626;
  margin-left: 0.125rem;
  font-weight: bold;
}

.field-type {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 400;
  margin-left: 0.25rem;
}

.field-description {
  display: block;
  font-size: 0.75rem;
  color: #4b5563;
  font-weight: 400;
  margin-top: 0.25rem;
}

.field-input {
  width: 100%;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.field-textarea {
  width: 100%;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  box-sizing: border-box;
  font-family: monospace;
  resize: vertical;
  min-height: 120px;
}

.field-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.field-checkbox {
  height: 1rem;
  width: 1rem;
}

/* Array Field Styles */
.array-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 0;
}

.array-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-right: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
}

.btn-collapse {
  padding: 0.25rem 0.5rem;
  background-color: #e5e7eb;
  color: #374151;
  font-size: 0.75rem;
  font-weight: bold;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  min-width: 2rem;
  transition: background-color 0.2s;
}

.btn-collapse:hover {
  background-color: #d1d5db;
}

.btn-add-item {
  padding: 0.25rem 0.75rem;
  background-color: #3b82f6;
  color: #ffffff;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-add-item:hover {
  background-color: #2563eb;
}

.btn-duplicate-item {
  padding: 0.25rem 0.75rem;
  background-color: #10b981;
  color: #ffffff;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-duplicate-item:hover {
  background-color: #059669;
}

.array-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.string-array {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.array-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-remove-item {
  padding: 0.25rem 0.5rem;
  background-color: #ef4444;
  color: #ffffff;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-remove-item:hover {
  background-color: #dc2626;
}

.object-array {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.array-item-object {
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.5rem;
  background-color: #f9fafb;
  margin-right: 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #d1d5db;
  transition: background-color 0.2s;
  padding: 0.5rem;
  margin: -0.5rem;
  margin-bottom: 0.75rem;
  border-radius: 0.375rem;
}

.item-header:hover {
  background-color: #e5e7eb;
}

.item-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-item-collapse {
  padding: 0.25rem 0.5rem;
  background-color: #e5e7eb;
  color: #374151;
  font-size: 0.75rem;
  font-weight: bold;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  min-width: 2rem;
  transition: background-color 0.2s;
}

.btn-item-collapse:hover {
  background-color: #d1d5db;
}

.item-title {
  font-weight: 600;
  color: #374151;
}

.item-prop-count {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: normal;
}

.item-collapsed-indicator {
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.25rem;
  text-align: center;
}

.item-collapsed-text {
  color: #6b7280;
  font-size: 0.875rem;
  font-style: italic;
}

.item-properties {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0;
  margin-right: 0;
}

.empty-array {
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
  padding: 0.75rem;
  background-color: #f3f4f6;
  border-radius: 0.375rem;
}

.collapsed-indicator {
  padding: 0.5rem 1rem;
  margin-top: 0.5rem;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  text-align: center;
}

.collapsed-text {
  color: #6b7280;
  font-size: 0.875rem;
  font-style: italic;
}

/* Object Field Styles */
.object-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 0;
}

.object-header {
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 0;
}

.object-properties {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0;
  border-left: none;
  margin-right: 0;
}

.depth-0-object {
  padding-left: 0;
  margin-left: 0;
}

/* Responsive adjustments for deep nesting */
.depth-3 .field-label,
.depth-4 .field-label {
  font-size: 0.813rem;
}

.depth-3 .field-input,
.depth-4 .field-input {
  font-size: 0.813rem;
  padding: 0.375rem 0.5rem;
}

/* --- value reference --- */
.btn-ref-add {
  flex: none;
  border: 1px solid #c6c7f5;
  background: #eeeefc;
  color: #4b4ddb;
  border-radius: 5px;
  padding: 3px 5px;
  cursor: grab;
  line-height: 0;
}
.btn-ref-add:hover {
  background: #e2e2fa;
}
.btn-ref-add:active {
  cursor: grabbing;
}
.btn-ref-add:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: 1px;
}
.ref-add-icon {
  width: 13px;
  height: 13px;
}

/* A reference pointing at a task that does not run first. Left alone it saves
   fine and then fails at run time, so it has to be visible here. */
.field-invalid {
  background: #fdecec;
  border-color: #d94a4a;
}
.field-invalid-note {
  margin: 3px 0 0;
  font-size: 11px;
  color: #b02a2a;
  line-height: 1.5;
}
</style>
