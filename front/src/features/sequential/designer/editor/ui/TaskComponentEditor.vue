<template>
  <div class="task-component-editor" data-testid="wf-task-editor">
    <!-- Task Configuration Section -->
    <div class="task-configuration-section">
      <div class="section-header">
        <h4>Task Configuration</h4>
      </div>

      <!-- Task Name Section -->
      <div class="component-name-section">
        <div class="field-label">
          <span class="label-text">Task Name</span>
          <span
            v-if="getComponentNameIsValid() === false"
            class="required-indicator"
            >*</span
          >
        </div>
        <input
          type="text"
          :value="getComponentNameValue()"
          @input="handleComponentNameInput"
          class="component-name-input"
          :class="{ invalid: !getComponentNameIsValid() }"
          @blur="getComponentNameOnBlur"
          placeholder="Enter task name"
        />
        <!-- 이름은 사용자가 바꾸지만 컴포넌트는 그대로다. 어떤 칸이 나오는지, 무엇을
             돌려주는지가 전부 여기서 갈리므로 이름 옆에 밝혀 둔다. -->
        <p class="component-kind" data-testid="wf-task-component">
          <span class="component-kind-label">Component</span>
          <code>{{ getCurrentTaskComponentName() }}</code>
        </p>
      </div>

      <!-- Path Parameters -->
      <div v-if="hasPathParams()" class="params-section">
        <h5 class="params-title">Path Parameters</h5>
        <div class="params-content">
          <div
            v-for="(value, key) in getPathParams()"
            :key="key"
            class="param-item"
          >
            <label :for="`path-${key}`" class="param-label">
              {{ key
              }}<span v-if="isPathParamRequired(key)" class="required-mark"
                >*</span
              >
            </label>
            <input
              :id="`path-${key}`"
              :data-testid="`wf-path-param-${key}`"
              type="text"
              :value="value"
              @input="handlePathParamInput(key, $event)"
              class="param-input"
            />
          </div>
        </div>
      </div>

      <!-- Query Parameters -->
      <div v-if="hasQueryParams()" class="params-section">
        <h5 class="params-title">Query Parameters</h5>
        <div class="params-content">
          <div
            v-for="(value, key) in getQueryParams()"
            :key="key"
            class="param-item"
          >
            <label :for="`query-${key}`" class="param-label">
              {{ key
              }}<span v-if="isQueryParamRequired(key)" class="required-mark"
                >*</span
              >
            </label>
            <input
              :id="`query-${key}`"
              :data-testid="`wf-query-param-${key}`"
              type="text"
              :value="value"
              @input="handleQueryParamInput(key, $event)"
              class="param-input"
            />
          </div>
        </div>
      </div>

      <!-- Body Parameters - JSON Editor -->
      <div v-if="hasBodyParams" class="params-section body-params-section">
        <h5 class="params-title">Body Parameters</h5>

        <!-- Where this task's body comes from. Filling fields one by one is the
             common case; taking it from an earlier task replaces the body with a
             single reference, so there are no fields left to draw.

             ★ 두 갈래뿐이다. 예전에는 "결과 전체" 와 "앞선 태스크에서 가져오기" 를 따로
               두었는데, 고르는 창에서 왼쪽 태스크 이름을 누르면 결과 전체, 오른쪽 값을
               누르면 그 하위 경로가 되므로 둘은 같은 일의 두 입구였다. 나뉘어 있으면
               무엇이 다른지 설명할 길이 없다. -->
        <div class="ref-source-bar">
          <label class="ref-source-option">
            <!-- v-model 만으로는 부족하다. 이미 선택된 라디오를 다시 누르면 값이 바뀌지
                 않아 아무 이벤트도 나지 않는데, 사용자는 "이쪽으로 되돌려 달라"는 뜻으로
                 누른다. 고르는 중이었다면 그 클릭으로 멈춰야 한다. -->
            <input
              v-model="bodySource"
              type="radio"
              name="wf-body-source"
              value="fields"
              data-testid="wf-body-source-fields"
              @click="setBodySourceFields()"
            />
            <span>Fill in fields</span>
            <!-- 브라우저 기본 title 은 뜨기까지 한참 걸린다. 직접 그린다. -->
            <span class="ref-source-help" role="tooltip">
              Fill in <b>{{ getComponentNameValue() || 'this task' }}</b
              >'s own fields, in the order and shape its request body asks for.
              Any one field can still take a value from an earlier task.
            </span>
          </label>
          <label
            class="ref-source-option"
            :class="{ 'is-disabled': !taskReference.canBind.value }"
          >
            <input
              v-model="bodySource"
              type="radio"
              name="wf-body-source"
              value="whole"
              data-testid="wf-body-source-whole"
              :disabled="!taskReference.canBind.value"
            />
            <span>Take from an earlier task</span>
            <span class="ref-source-help" role="tooltip">
              <template v-if="taskReference.canBind.value">
                Send an earlier task's result as
                <b>{{ getComponentNameValue() || 'this task' }}</b
                >'s body. Its name passes the whole result, a value under it
                passes one part. The fields go away — the body is replaced, not
                filled.
              </template>
              <template v-else>
                Nothing runs before this task, so there is no result to take.
              </template>
            </span>
          </label>
          <!-- 고르는 중에는 그만둘 길이 화면에 있어야 한다. 캔버스만 밝고 창이 없을 때는
               Esc 말고는 나올 방법이 없었다 — 그것을 아는 사람만 빠져나올 수 있다. -->
          <button
            v-if="isPickingOnCanvas"
            type="button"
            class="ref-pick-cancel"
            data-testid="wf-ref-pick-cancel"
            @click="cancelReference()"
          >
            Stop picking
          </button>
          <span
            v-if="!taskReference.canBind.value"
            class="ref-source-note"
            data-testid="wf-ref-none-available"
          >
            Nothing runs before this task, so there is nothing to take.
          </span>
        </div>

        <p
          v-if="invalidReferencePaths.length"
          class="ref-invalid-summary"
          data-testid="wf-ref-invalid-summary"
        >
          {{ invalidReferencePaths.length }} value(s) here read a task that does
          not run first. Fix the fields marked in red.
        </p>

        <TaskReferencePicker
          v-if="taskReference.isOpen.value"
          :target-field="taskReference.targetField.value"
          :sources="taskReference.filteredSources.value"
          :search="taskReference.search.value"
          :selected-task="taskReference.selectedTask.value"
          :selected-path="taskReference.selectedPath.value"
          :preview="taskReference.preview.value"
          :type-verdict="taskReference.typeVerdict.value"
          :target-type="taskReference.targetType.value"
          :selected-type="taskReference.selectedNode.value?.type"
          :selected-multiple="taskReference.selectedNode.value?.multiple"
          :focus-task="taskReference.focusTask.value"
          @update:search="taskReference.search.value = $event"
          @show-all="taskReference.showAllTasks()"
          @pick="(t, pth) => taskReference.selectValue(t, pth)"
          @manual="
            (t, pth) => {
              taskReference.selectedTask.value = t;
              taskReference.selectedPath.value = pth;
            }
          "
          @apply="applyReference()"
          @cancel="cancelReference()"
        />

        <!-- The whole body is a previous task's result. There are no fields to edit,
           but what actually goes across still has to be visible — an empty panel
           tells the user nothing about what this task will send. -->
        <div
          v-if="wholeBodyReference"
          class="ref-whole"
          data-testid="wf-ref-whole"
        >
          <div class="ref-whole-value">{{ wholeBodyReference }}</div>
          <button
            type="button"
            class="ref-whole-edit"
            data-testid="wf-ref-whole-edit"
            @click="setBodySourceWhole()"
          >
            Pick again
          </button>
          <table v-if="wholeBodyOutputRows.length" class="ref-whole-table">
            <thead>
              <tr>
                <th>Value passed</th>
                <th>Type</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in wholeBodyOutputRows"
                :key="row.field"
                :data-testid="`wf-ref-whole-row-${row.field}`"
              >
                <td class="ref-whole-field">{{ row.field }}</td>
                <td class="ref-whole-type">{{ row.type }}</td>
                <td class="ref-whole-example">{{ row.example }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="ref-whole-empty">
            This task does not describe what it returns, so what will be passed
            cannot be shown.
          </p>
        </div>

        <div v-else class="json-editor-container">
          <!-- Recursive Form Renderer -->
          <div class="recursive-form-container">
            <div v-if="bodyParamsSchema && bodyParamsSchema.properties">
              <recursive-form-field
                v-for="propName in sortedBodyParamPropertyNames"
                :key="String(propName)"
                :field-name="String(propName)"
                :field-schema="bodyParamsSchema.properties[propName]"
                :field-value="bodyParamsModel[propName]"
                :step-properties="getStepProperties()"
                :max-auto-expand-depth="2"
                :parent-required="bodyParamsSchema.required || []"
                :task-name="getCurrentTaskComponentName()"
                :current-path="`body_params.${propName}`"
                :index-path="`body_params.${propName}`"
                :references="fieldReferences"
                :invalid-paths="invalidReferencePaths"
                :can-bind="taskReference.canBind.value"
                @update="updateBodyParamField(String(propName), $event)"
                @reference="openReferencePicker"
                @reference-clear="clearReference"
                @ref-drag-start="startPickingOnCanvas"
                @ref-drag-end="stopPickingOnCanvas"
                :depth="0"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 본문이 없는 컴포넌트도 있다(메일 트리거처럼 HTTP 호출이 아닌 것). 지금까지는
           아무것도 그리지 않아 "왜 이 태스크만 없지" 로 남았다. 없다는 것을 말해 준다. -->
      <p v-else class="no-body-note" data-testid="wf-no-body-params">
        This task sends no request body, so there is nothing to fill in or take
        from an earlier task.
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import {
  ref,
  defineComponent,
  onMounted,
  computed,
  watch,
  nextTick,
  onBeforeUnmount,
  set as vueSet,
} from 'vue';
import { serializeDesignerSequence } from '@/entities/workflow/lib/designerSerialize';
import {
  extractFieldReferences,
  buildFieldReference,
} from '@/shared/utils/stringToObject';
import { useTaskReference } from '../composables/useTaskReference';
import referencePickingStore from '../store/referencePickingStore';
import TaskReferencePicker from './TaskReferencePicker.vue';
import { useCommonTaskEditorModel } from '../model/commonTaskEditorModel';
import type { Step } from '@/features/workflow/workflowEditor/model/types';
import RecursiveFormField from './RecursiveFormField.vue';
import { useWorkflowStore } from '@/entities/workflow/model/stores';
import { storeToRefs } from 'pinia';
import { decodeBase64, encodeBase64 } from '@/shared/utils/base64';
import { isReferenceRequestBody } from '@/shared/utils/stringToObject';
import {
  getPropertyOrder,
  sortPropertiesByOrder,
} from '../config/taskPropertyOrderConfig';

export default defineComponent({
  name: 'TaskComponentEditor',
  components: {
    RecursiveFormField,
    TaskReferencePicker,
  },
  props: {
    step: {
      type: Object as () => Step,
      required: true,
    },
    // The whole task graph. Needed to work out which tasks run before this one —
    // the engine accepts a reference to any task in the workflow, including one
    // that runs later, and only fails at run time, so the check happens here.
    definition: {
      type: Object,
      default: null,
    },
  },
  emits: ['saveComponentName', 'saveContext', 'saveFixedModel'],
  setup(props, { emit }) {
    // Wrap in computed to use props reactively
    const step = computed(() => props.step);
    const taskEditorModel = useCommonTaskEditorModel();
    const jsonEditor = ref();
    const isInitialized = ref(false);

    // Get the task components from the Workflow Store
    const workflowStore = useWorkflowStore();
    const { taskComponents } = storeToRefs(workflowStore);

    // Find the data of the task component corresponding to the current task
    const getCurrentTaskComponentData = () => {
      console.log('=== Finding Task Component Data ===');

      // 1. Check taskComponentData stored directly in the step properties (priority)
      if ((step.value.properties as any)?.taskComponentData) {
        console.log('✅ Found taskComponentData in step.properties');
        const taskComponentData = (step.value.properties as any)
          .taskComponentData;
        console.log('✅ Task component data:', taskComponentData);
        console.log(
          '✅ Task component data.body_params:',
          taskComponentData?.body_params,
        );
        return taskComponentData;
      }

      // 2. Look it up in the Store (fallback)
      const taskName = step.value.name || step.value.type;
      console.log('🔍 Task name:', taskName);
      console.log('🔍 Task type:', step.value.type);
      console.log(
        '🔍 Available task components count:',
        taskComponents.value.length,
      );
      console.log(
        '🔍 Available task components:',
        taskComponents.value.map(tc => tc.name),
      );

      const taskComponent = taskComponents.value.find(
        tc => tc.name === taskName,
      );

      if (taskComponent) {
        console.log('✅ Found task component in store:', taskComponent.name);
        console.log('✅ Task component data:', taskComponent.data);
        console.log(
          '✅ Task component data.body_params:',
          (taskComponent.data as any)?.body_params,
        );
        return taskComponent.data;
      }

      console.warn('❌ Task component not found for:', taskName);
      console.log('❌ taskComponents.value:', taskComponents.value);
      return null;
    };

    // Path Parameters
    const pathParams = ref<Record<string, any>>({});
    const pathParamsSchema = ref<any>(null);

    // Query Parameters
    const queryParams = ref<Record<string, any>>({});
    const queryParamsSchema = ref<any>(null);

    // Body Parameters - separate the Schema and Model for the JSON Editor
    const bodyParamsSchema = ref<Record<string, any>>({
      type: 'object',
      title: 'Body Parameters',
      properties: {},
      additionalProperties: true,
    });

    const bodyParamsModel = ref<Record<string, any>>({});

    // Store the initial data (for comparison - against originalData)
    const initialData = ref<{
      name: string;
      path_params: Record<string, any>;
      query_params: Record<string, any>;
      body_params: any;
      request_body: string;
    }>({
      name: '',
      path_params: {},
      query_params: {},
      body_params: {},
      request_body: '',
    });

    // The whole Task Schema (for debugging)
    const taskSchema = ref({
      type: 'object',
      title: 'Task Component Configuration',
      properties: {
        name: {
          type: 'string',
          title: 'Task Name',
        },
        type: {
          type: 'string',
          title: 'Task Type',
          enum: ['task', 'container', 'switch'],
          default: 'task',
        },
        description: {
          type: 'string',
          title: 'Description',
        },
        path_params: {
          type: 'object',
          title: 'Path Parameters',
          additionalProperties: {
            type: 'string',
          },
        },
        query_params: {
          type: 'object',
          title: 'Query Parameters',
          additionalProperties: {
            type: 'string',
          },
        },
      },
      required: ['name', 'type'],
    });

    // Build a dynamic schema based on body_params
    const generateBodyParamsSchema = (bodyParams: any) => {
      if (!bodyParams || typeof bodyParams !== 'object') {
        return {
          type: 'object',
          title: 'Body Parameters',
          additionalProperties: true,
        };
      }

      const properties: any = {};

      // Analyze each bodyParams property to build the schema
      for (const [key, value] of Object.entries(bodyParams)) {
        const title =
          key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

        if (typeof value === 'string') {
          properties[key] = {
            type: 'string',
            title: title,
            description: `String value for ${key}`,
            default: value,
          };
        } else if (typeof value === 'number') {
          properties[key] = {
            type: 'number',
            title: title,
            description: `Numeric value for ${key}`,
            default: value,
          };
        } else if (typeof value === 'boolean') {
          properties[key] = {
            type: 'boolean',
            title: title,
            description: `Boolean value for ${key}`,
            default: value,
          };
        } else if (Array.isArray(value)) {
          properties[key] = {
            type: 'array',
            title: title,
            description: `Array of ${typeof value[0] || 'string'} values`,
            items: {
              type: typeof value[0] || 'string',
            },
            default: value,
          };
        } else if (typeof value === 'object' && value !== null) {
          // For an object, handle it recursively
          const nestedSchema = generateBodyParamsSchema(value);
          properties[key] = {
            type: 'object',
            title: title,
            description: `Object containing ${Object.keys(value).length} properties`,
            properties: nestedSchema.properties || {},
            additionalProperties: true,
            default: value,
          };
        } else {
          properties[key] = {
            type: 'string',
            title: title,
            description: `Value for ${key}`,
            default: value,
          };
        }
      }

      return {
        type: 'object',
        title: 'Body Parameters',
        description: 'Configuration parameters for the task',
        properties,
        additionalProperties: true,
      };
    };

    // Task Model (reactive data) - body_params centered structure
    const taskModel = ref({
      name: '',
      type: 'task',
      description: '',
      path_params: {},
      query_params: {},
      body_params: {},
    });

    // Component Name related methods
    const getComponentNameTitle = () => {
      return (taskEditorModel.componentNameModel as any)?.context?.title || '';
    };

    const getComponentNameValue = () => {
      // componentNameModel is a plain ref, so access it directly via .value
      return (taskEditorModel.componentNameModel as any)?.value || '';
    };

    const setComponentNameValue = (value: string) => {
      // componentNameModel is a plain ref, so set it directly via .value
      if (taskEditorModel.componentNameModel) {
        (taskEditorModel.componentNameModel as any).value = value;
      }
    };

    const getComponentNameIsValid = () => {
      return (
        (taskEditorModel.componentNameModel as any)?.context?.model?.isValid ??
        true
      );
    };

    const getComponentNameOnBlur = () => {
      return (taskEditorModel.componentNameModel as any)?.context?.model
        ?.onBlur;
    };

    // Event handlers for use in the Vue 2.7 template (type assertions removed)
    const handleComponentNameInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      setComponentNameValue(target.value);

      // emit to update step.name
      // editorProviders: step.name = e
      emit('saveComponentName', target.value);
      console.log('✅ Task name updated:', target.value);
    };

    // Step Properties accessor methods (moved the type assertions into script)
    const getStepProperties = () => {
      return step.value.properties;
    };

    // Task Component Name Getter (for Property Order Config)
    // ---- referencing a previous task's result -------------------------------
    //
    // cm-cicada builds this task's body from the *shape* of its request_body: a
    // bare task name sends that task's whole result, a name plus a JSONPath sends
    // one item out of it, and ${task.path} inside a JSON body fills single fields.
    // Since cm-cicada publishes each component's response schema we can show what
    // a previous task returns and let the user pick, instead of typing a path.

    /** The task graph, rebuilt from the canvas so we can follow the edges. */
    const taskGroups = computed(() =>
      serializeDesignerSequence(
        ((props.definition as any)?.sequence ?? []) as any[],
        (designerStep: any, dependencies: string[]) => ({
          name: designerStep.name,
          task_component: designerStep.type,
          dependencies,
        }),
      ),
    );

    /** Response schema of a component, read from the same list the form uses. */
    const responseSchemaOf = (
      componentName: string,
    ): Record<string, any> | null => {
      if (!componentName) return null;
      const component = (taskComponents.value || []).find(
        (candidate: any) => candidate?.name === componentName,
      );
      const spec = (component as any)?.spec || {};
      return (
        spec.response_schema ||
        (component as any)?.data?.response_params ||
        null
      );
    };

    const taskReference = useTaskReference(
      () => taskGroups.value,
      () => step.value.name,
      responseSchemaOf,
    );

    /**
     * Fields already filled from a previous task, keyed by the same path the test
     * ids use. The saved value is plain JSON text, so without reading it back the
     * references show up as editable strings a user breaks by accident.
     */
    const fieldReferences = computed(() =>
      Object.fromEntries(
        extractFieldReferences(bodyParamsModel.value, 'body_params'),
      ),
    );

    /** Fields pointing at a task that does not run first — only possible for imported definitions. */
    const invalidReferencePaths = computed(() => {
      const allowed = new Set(taskReference.ancestors.value);
      return Object.entries(fieldReferences.value)
        .filter(([, reference]) => !allowed.has((reference as any).task))
        .map(([path]) => path);
    });

    /** Open the picker for one field. */
    const openReferencePicker = (
      fieldPath: string,
      fieldType?: string,
    ): void => {
      taskReference.open(fieldPath, fieldType);
    };

    /**
     * Hand the choice over to the canvas: it lights up the tasks that run before
     * this one and reports back which was picked, then the picker opens on that
     * task so the value can be chosen out of it.
     */
    const startPickingOnCanvas = (
      fieldPath: string,
      fieldType?: string,
    ): void => {
      referencePickingStore.start(
        taskReference.ancestors.value,
        fieldPath,
        fieldType,
        pickedTask => {
          taskReference.open(fieldPath, fieldType);
          taskReference.pickTask(pickedTask);
        },
      );
    };

    /** "결과 전체" 를 골라 두고 아직 무엇을 넘길지 정하지 않은 상태. */
    const pendingWholeBody = ref(false);

    const stopPickingOnCanvas = (): void => referencePickingStore.stop();

    /** 캔버스가 고르기 상태인가 — 그만둘 버튼을 보일지 정한다. */
    const isPickingOnCanvas = computed(
      () => referencePickingStore.isPicking.value,
    );

    /**
     * 값 고르기를 그만둔다 — 창도 닫고 캔버스 강조도 끈다.
     *
     * 창만 닫으면 캔버스가 계속 고르기 상태로 남아, 태스크를 하나 고르기 전에는
     * 빠져나갈 길이 없어진다.
     */
    const cancelReference = (): void => {
      taskReference.close();
      stopPickingOnCanvas();
      // 정하지 않고 그만뒀으면 고르기 전 상태로 되돌린다.
      if (pendingWholeBody.value) {
        pendingWholeBody.value = false;
        if (!wholeBodyRef.value) setBodySourceFields();
      }
    };

    /** 고르는 중에 Esc 를 누르면 그만둔다 — 창이 열려 있든 캔버스만 밝든. */
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (!taskReference.isOpen.value && !referencePickingStore.isPicking.value)
        return;
      cancelReference();
    };
    onMounted(() => window.addEventListener('keydown', onEscape));
    onBeforeUnmount(() => window.removeEventListener('keydown', onEscape));

    /** Write the chosen reference into that field. */
    const applyReference = (): void => {
      const chosen = taskReference.result();
      if (!chosen) return;
      if (!taskReference.targetField.value) {
        // Whole body: store the raw reference, not JSON.
        //
        // Through `set`, because on a task that never had one this key is new to the object. Vue 2
        // cannot see a key appear, so a plain assignment stores the value and redraws nothing — the
        // panel goes on showing the field list as though the choice had not been made.
        const reference =
          chosen.path && chosen.path !== '$'
            ? `${chosen.task}.${chosen.path}`
            : chosen.task;
        vueSet(step.value.properties as any, 'referenceRequestBody', reference);
        wholeBodyRef.value = reference;
        pendingWholeBody.value = false;
        emit('saveContext', bodyParamsModel.value);
        taskReference.close();
        return;
      }
      const path = taskReference.targetField.value.replace(
        /^body_params\./,
        '',
      );
      rememberQuoting(path, taskReference.targetType.value);
      setBodyParamByPath(path, buildFieldReference(chosen));
      taskReference.close();
    };

    /**
     * Remember whether this field's reference goes into the stored body with quotes.
     *
     * The engine substitutes text: a string arrives bare and everything else arrives as
     * JSON, so the quotes have to come from the body we store. A reference into a number
     * or a boolean therefore has to sit there unquoted, or `5` is sent as `"5"`. The
     * schema decides, because the schema is what the receiving API asks for.
     */
    const rememberQuoting = (path: string, fieldType?: string): void => {
      const properties = step.value.properties as any;
      const kept: string[] = Array.isArray(properties.rawBodyRefs)
        ? properties.rawBodyRefs.filter((one: string) => one !== path)
        : [];
      if (fieldType && fieldType !== 'string') kept.push(path);
      vueSet(properties, 'rawBodyRefs', kept);
    };

    /** Drop the reference and leave the field empty — restoring the old literal
     *  would put back a value the user cannot predict. */
    const clearReference = (fieldPath: string): void => {
      const path = fieldPath.replace(/^body_params\./, '');
      rememberQuoting(path, undefined);
      setBodyParamByPath(path, '');
    };

    /**
     * When the whole body is a reference, it is kept as the raw string the engine
     * expects (`A` or `A.$.path`) rather than JSON — encoding it would turn it
     * into a literal and the reference would stop working.
     */
    // Held here, not read straight off the step.
    //
    // The step object belongs to sequential-workflow-designer and is a plain object — writing to it
    // changes nothing on screen, whether by assignment or through `set`. So the panel reads our own
    // state and writes through to the step, which is what gets saved.
    const wholeBodyRef = ref<string>(
      ((step.value.properties as any)?.referenceRequestBody as string) || '',
    );
    watch(
      () => (step.value.properties as any)?.referenceRequestBody,
      value => {
        wholeBodyRef.value = (value as string) || '';
      },
    );
    watch(
      () => step.value?.id,
      () => {
        wholeBodyRef.value =
          ((step.value.properties as any)?.referenceRequestBody as string) ||
          '';
      },
    );

    const wholeBodyReference = computed<string>(() => wholeBodyRef.value);

    /** The whole body comes from a previous task: pick which one, and how much. */
    const setBodySourceWhole = (): void => {
      // Empty target field = the body itself, not one slot in it. Passing a field here would make
      // the picker fill that slot and leave the body in field mode — a different screen from the
      // one this option is supposed to show.
      taskReference.open('', undefined);
      // 캔버스도 함께 밝힌다. 어느 태스크의 결과를 넘길지 고르는 일이므로, 목록에서 찾는
      // 것과 캔버스에서 짚는 것이 같은 자리에서 되어야 한다 — 두 경로가 달라 보이면
      // 캔버스에서 고를 수 있다는 것을 모른다.
      startPickingOnCanvas('', undefined);
      // 고르다 그만두면 이 선택도 없던 일이 되어야 한다. 무엇을 넘길지 정하지 않은 채
      // "결과 전체" 에 표시만 남으면, 화면은 그 모드인데 넘길 것이 없는 상태가 된다.
      pendingWholeBody.value = true;
    };

    /** Back to filling the fields; the reference is dropped. */
    const setBodySourceFields = (): void => {
      // Choosing the other option is also a way out of picking. Without this the canvas stays lit
      // and the only way forward is to pick a task — the user asked to stop and nothing happened.
      taskReference.close();
      stopPickingOnCanvas();
      vueSet(step.value.properties as any, 'referenceRequestBody', '');
      wholeBodyRef.value = '';
      emit('saveContext', bodyParamsModel.value);
    };

    /**
     * 지금 어느 쪽인가 — 칸마다 채우기인가, 결과 전체인가.
     *
     * ★ `:checked` 로 묶으면 안 된다. 사용자가 라디오를 누르면 DOM 은 이미 바뀌어 있는데,
     *   되돌리려 할 때 묶인 값이 그대로면 Vue 는 다시 그릴 것이 없다고 보고 넘어간다.
     *   그러면 취소했는데 표시만 "결과 전체" 로 남는다. v-model 은 상태를 단일 출처로
     *   두어 그런 어긋남이 생기지 않는다.
     */
    const bodySource = computed<string>({
      get: () =>
        wholeBodyRef.value || pendingWholeBody.value ? 'whole' : 'fields',
      set: value => {
        if (value === 'whole') setBodySourceWhole();
        else setBodySourceFields();
      },
    });

    /** What a whole-body reference actually passes on, for the read-only table. */
    const wholeBodyOutputRows = computed(() => {
      const raw = wholeBodyReference.value;
      if (!raw) return [];
      const dot = raw.indexOf('.');
      const task = dot > 0 ? raw.slice(0, dot) : raw;
      const path = dot > 0 ? raw.slice(dot + 1) : '';
      const source = taskReference.sources.value.find(
        (candidate: any) => candidate.task === task,
      );
      if (!source) return [];
      const prefix = path ? (path.startsWith('$') ? path : `$.${path}`) : '$';
      return (
        source.nodes
          // The root row is the choice itself, not one of the values it carries.
          .filter(
            (node: any) => node.path.startsWith(prefix) && node.path !== prefix,
          )
          .map((node: any) => ({
            field:
              node.path.slice(prefix.length).replace(/^\./, '') || node.label,
            type: node.type,
            example: node.example ?? '',
          }))
      );
    });

    /** Writes a value at a dotted path like `targetInfra.nodeGroups[0].specId`. */
    const setBodyParamByPath = (path: string, value: any): void => {
      const parts = path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);
      if (!parts.length) return;
      let cursor: any = bodyParamsModel.value;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (cursor[key] === undefined || cursor[key] === null) {
          cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      emit('saveContext', bodyParamsModel.value);
    };

    const getCurrentTaskComponentName = (): string => {
      // Use step.type instead of step.name because step.name is user-editable
      // and property sorting should be based on the fixed task component type
      return step.value.type || '';
    };

    // Path/Query Parameters Getter
    const getPathParams = () => {
      return pathParams.value;
    };

    const getQueryParams = () => {
      return queryParams.value;
    };

    // Has Parameters Checker
    const hasPathParams = () => {
      return Object.keys(pathParams.value).length > 0;
    };

    const hasQueryParams = () => {
      return Object.keys(queryParams.value).length > 0;
    };

    // Check whether Body Parameters exist (made a computed property to be reactive)
    const hasBodyParams = computed(() => {
      const result =
        bodyParamsSchema.value &&
        bodyParamsSchema.value.properties &&
        Object.keys(bodyParamsSchema.value.properties).length > 0;
      console.log('🔍 hasBodyParams computed:', {
        hasSchema: !!bodyParamsSchema.value,
        hasProperties: !!bodyParamsSchema.value?.properties,
        propertiesKeys: Object.keys(bodyParamsSchema.value?.properties || {}),
        result,
      });
      return result;
    });

    // Body Parameters Property Names (sorting applied)
    const sortedBodyParamPropertyNames = computed(() => {
      console.log('⭐ sortedBodyParamPropertyNames computed called!');
      console.log('   bodyParamsSchema.value:', bodyParamsSchema.value);
      console.log(
        '   bodyParamsSchema.value?.properties:',
        bodyParamsSchema.value?.properties,
      );

      if (!bodyParamsSchema.value?.properties) {
        console.log('   ❌ No properties, returning empty array');
        return [];
      }

      const keys = Object.keys(bodyParamsSchema.value.properties);
      console.log('   📋 Properties keys:', keys);

      const taskName = getCurrentTaskComponentName();
      console.log('   📋 Task name:', taskName);

      if (!taskName) {
        console.log('   ⚠️ No task name, returning unsorted keys');
        return keys;
      }

      const order = getPropertyOrder(taskName, 'body_params');
      console.log('   📋 Order from config:', order);

      const sortedKeys = order ? sortPropertiesByOrder(keys, order) : keys;
      console.log('   ✅ Final sorted keys:', sortedKeys);

      console.log('🔍 Body Params Property Sorting:', {
        taskName,
        originalKeys: keys,
        order,
        sortedKeys,
      });

      return sortedKeys;
    });

    // Required Checker
    const isPathParamRequired = (key: string) => {
      return pathParamsSchema.value?.required?.includes(key) || false;
    };

    const isQueryParamRequired = (key: string) => {
      return queryParamsSchema.value?.required?.includes(key) || false;
    };

    // Path/Query Parameters update handler
    const handlePathParamInput = (key: string, event: Event) => {
      const target = event.target as HTMLInputElement;
      pathParams.value[key] = target.value;

      console.log(`Path param updated: ${key} = ${target.value}`);

      // Auto-save path params changes
      if (isInitialized.value) {
        updateStepWithParams();
      }
    };

    const handleQueryParamInput = (key: string, event: Event) => {
      const target = event.target as HTMLInputElement;
      queryParams.value[key] = target.value;

      console.log(`Query param updated: ${key} = ${target.value}`);

      // Auto-save query params changes
      if (isInitialized.value) {
        updateStepWithParams();
      }
    };

    // Update step.properties.fixedModel when Path/Query Params change
    const updateStepWithParams = () => {
      console.log('=== Updating path/query params ===');
      console.log('Path params:', pathParams.value);
      console.log('Query params:', queryParams.value);
      console.log(
        'Current step.properties.fixedModel:',
        step.value.properties?.fixedModel,
      );

      const updatedFixedModel = {
        path_params: pathParams.value || {},
        query_params: queryParams.value || {},
      };

      console.log('Updated fixedModel to emit:', updatedFixedModel);

      const updatedStep = {
        ...step.value,
        properties: {
          ...step.value.properties,
          fixedModel: updatedFixedModel as any,
        },
      };

      console.log(
        'Updated step.properties.fixedModel:',
        updatedStep.properties.fixedModel,
      );

      // 🔍 Verify fixedModel structure
      if (!updatedStep.properties.fixedModel.path_params) {
        console.error('❌ BUG: path_params is missing from fixedModel!');
      }
      if (!updatedStep.properties.fixedModel.query_params) {
        console.error('❌ BUG: query_params is missing from fixedModel!');
      }

      // Pass the changes to the parent component
      // ⚠️ IMPORTANT: editorProviders assigns step.properties.fixedModel = e, so
      // must emit only fixedModel, not the whole step!
      emit('saveFixedModel', updatedStep.properties.fixedModel);

      console.log(
        '✅ Auto-saved path/query params to step.properties.fixedModel',
      );
      console.log('===================================');
    };

    // JSON Editor related methods (based on the official example)
    const resetEditor = () => {
      console.log('Resetting JSON Editor');
      if (jsonEditor.value) {
        jsonEditor.value.reset();
      }
    };

    const saveConfiguration = () => {
      console.log('=== Saving Task Configuration ===');
      console.log('Current taskModel:', taskModel.value);

      // Store it to match the model structure
      const model = step.value.properties?.model || ({} as any);
      const modelProperties = (model as any).properties || {};

      let updatedModel;
      if (modelProperties.targetSoftwareModel) {
        // For grasshopper_task_software_migration, update targetSoftwareModel
        updatedModel = {
          ...model,
          properties: {
            ...modelProperties,
            targetSoftwareModel: taskModel.value.body_params,
          },
        };
        console.log('Updating targetSoftwareModel structure');
      } else if (modelProperties && Object.keys(modelProperties).length > 0) {
        // When using Step Model Properties, update properties
        updatedModel = {
          ...model,
          properties: {
            ...modelProperties,
            ...taskModel.value.body_params,
          },
        };
        console.log('Updating Step Model Properties structure');
      } else {
        // In the general case, use the data structure
        updatedModel = {
          ...model,
          data: {
            ...(model as any).data,
            path_params: taskModel.value.path_params,
            query_params: taskModel.value.query_params,
            body_params: taskModel.value.body_params,
          },
        };
        console.log('Updating data structure');
      }

      const updatedStep = {
        ...step.value,
        name: taskModel.value.name,
        type: taskModel.value.type,
        properties: {
          ...step.value.properties,
          model: updatedModel,
        },
        metadata: {
          ...(step.value as any).metadata,
          description: taskModel.value.description,
        },
      };

      console.log('Updated step:', updatedStep);
      console.log('Model structure being saved:', updatedModel);
      console.log('Body params being saved:', taskModel.value.body_params);

      // Pass the changes to the parent component
      // ⚠️ IMPORTANT: editorProviders assigns each one, so emit only that property
      emit('saveComponentName', updatedStep.name); // step.name = e
      emit('saveContext', updatedModel); // step.properties.model = e

      // Update fixedModel (path_params, query_params)
      if (taskModel.value.path_params || taskModel.value.query_params) {
        const updatedFixedModel = {
          path_params: taskModel.value.path_params || pathParams.value || {},
          query_params: taskModel.value.query_params || queryParams.value || {},
        };
        emit('saveFixedModel', updatedFixedModel); // step.properties.fixedModel = e
      }

      console.log('Task configuration saved successfully');
    };

    // Initialize
    onMounted(async () => {
      console.log('\n\n\n');
      console.log(
        '═══════════════════════════════════════════════════════════════',
      );
      console.log('🚀🚀🚀 TaskComponentEditor MOUNTED (or RE-OPENED) 🚀🚀🚀');
      console.log(
        '═══════════════════════════════════════════════════════════════',
      );
      console.log('✅ Task components in store:', taskComponents.value.length);
      console.log('📋 Current step.name:', step.value.name);
      console.log('📋 Current step.type:', step.value.type);
      console.log(
        '📋 Current step.properties.model keys:',
        Object.keys(step.value.properties?.model || {}),
      );
      console.log(
        '📋 Current step.properties.model JSON (first 500 chars):',
        JSON.stringify(step.value.properties?.model || {}).substring(0, 500),
      );

      // 🔍 Critical check: Is step.properties.model actual data?
      const stepModel: any = step.value.properties?.model || {};
      if (
        stepModel.targetSoftwareModel &&
        stepModel.targetSoftwareModel.servers
      ) {
        console.log(
          '✅ step.properties.model contains targetSoftwareModel.servers',
        );
        console.log(
          `   servers count: ${stepModel.targetSoftwareModel.servers.length}`,
        );
        if (stepModel.targetSoftwareModel.servers.length > 0) {
          console.log(
            '   First server keys:',
            Object.keys(stepModel.targetSoftwareModel.servers[0]),
          );
          console.log(
            '   First server.source_connection_info_id:',
            stepModel.targetSoftwareModel.servers[0].source_connection_info_id,
          );
        }
      }
      console.log(
        '═══════════════════════════════════════════════════════════════',
      );
      console.log('\n');

      // Map the Step data onto taskModel
      if (step.value) {
        console.log('=== Step Structure Analysis ===');
        console.log('Step:', step.value);
        console.log('Step.properties:', step.value.properties);
        console.log('Step.properties.model:', step.value.properties?.model);
        console.log(
          'Step.properties.originalData:',
          (step.value.properties as any)?.originalData,
        );

        // Get the Task Component's data (the result of list-task-component)
        const taskComponentData = getCurrentTaskComponentData();
        console.log('Task Component Data from store:', taskComponentData);

        // Extract params from the model structure
        const model = step.value.properties?.model || ({} as any);
        const modelProperties = (model as any).properties || {};

        console.log('=== Model Structure ===');
        console.log('model:', model);
        console.log('model keys:', Object.keys(model));
        console.log(
          'model.targetSoftwareModel:',
          (model as any).targetSoftwareModel,
        );
        console.log('model.properties:', (model as any).properties);
        console.log('modelProperties:', modelProperties);
        console.log('modelProperties keys:', Object.keys(modelProperties));

        // Check the existing data in model
        let existingBodyParamsData: any = null;
        let hasExistingData = false;

        console.log('=== 🔍 Checking for existing data in model ===');
        console.log('model keys:', Object.keys(model));
        console.log('model:', model);
        console.log('model.properties:', (model as any).properties);
        console.log('modelProperties:', modelProperties);
        console.log('modelProperties keys:', Object.keys(modelProperties));

        // Detailed log for each modelProperties field
        if (modelProperties && Object.keys(modelProperties).length > 0) {
          console.log('📊 modelProperties detail:');
          Object.keys(modelProperties).forEach(key => {
            const value = modelProperties[key];
            console.log(`   - ${key}:`, {
              type: typeof value,
              isArray: Array.isArray(value),
              hasProperties: value && value.properties ? true : false,
              hasType: value && value.type ? true : false,
              keys:
                typeof value === 'object' && value !== null
                  ? Object.keys(value)
                  : [],
              value: value,
            });
          });
        }

        // ✨ Data loading priority (✅ CORRECTED):
        // Priority 1: step.properties.model (latest data of the current session - changes are kept when the Task Editor is closed and reopened)
        // Priority 2: originalData.request_body (fallback on initial load)

        const originalData = (step.value.properties as any)?.originalData;

        // Priority 1: check step.properties.model first (latest data of the current session)
        console.log(
          '🔍 Priority 1: Checking step.properties.model (current session data - includes changes)',
        );
        console.log('   model:', model);
        console.log('   model keys:', Object.keys(model));
        console.log('   modelProperties:', modelProperties);
        console.log('   modelProperties keys:', Object.keys(modelProperties));

        // Check whether model is actual data (excluding schema)
        const modelIsSchema =
          model.type === 'object' &&
          model.properties &&
          typeof model.properties === 'object';

        console.log('   🔍 Is model a schema?:', modelIsSchema);

        if (!modelIsSchema && model && Object.keys(model).length > 0) {
          // Use model if it is not a schema and has data

          // If modelProperties exist (when the actual data is inside properties)
          if (modelProperties && Object.keys(modelProperties).length > 0) {
            // Check whether modelProperties' targetSoftwareModel is not a schema
            const targetSoftwareModelProp = (modelProperties as any)
              .targetSoftwareModel;
            if (targetSoftwareModelProp) {
              const isTSMSchema =
                targetSoftwareModelProp.type === 'object' &&
                targetSoftwareModelProp.properties;

              if (!isTSMSchema) {
                // If targetSoftwareModel is not a schema, it is actual data
                existingBodyParamsData = modelProperties;
                hasExistingData = true;
                console.log(
                  '✅ Using step.properties.model (contains current changes)',
                );
                console.log(
                  '   Data keys:',
                  Object.keys(existingBodyParamsData),
                );
              } else {
                console.log(
                  '⚠️ step.properties.model.properties.targetSoftwareModel is schema',
                );
              }
            } else {
              // If there is no targetSoftwareModel, all of modelProperties may be data
              existingBodyParamsData = modelProperties;
              hasExistingData = true;
              console.log(
                '✅ Using step.properties.model (no targetSoftwareModel schema)',
              );
              console.log('   Data keys:', Object.keys(existingBodyParamsData));
            }
          } else {
            // If there are no modelProperties, use the model itself
            existingBodyParamsData = model;
            hasExistingData = true;
            console.log(
              '✅ Using step.properties.model directly (current changes)',
            );
            console.log('   Data keys:', Object.keys(existingBodyParamsData));
          }
        } else {
          console.log('⚠️ step.properties.model is schema or empty');
        }

        // Priority 2: check originalData.request_body (fallback - only on initial load)
        if (!hasExistingData) {
          console.log(
            '🔍 Priority 2: Checking originalData.request_body (fallback for initial load)',
          );
          console.log('   originalData:', originalData);

          if (!hasExistingData && originalData && originalData.request_body) {
            console.log('   Found originalData.request_body');
            console.log(
              '   request_body type:',
              typeof originalData.request_body,
            );

            let requestBody = originalData.request_body;

            // A cm-cicada runtime reference (e.g. "infra_recommend_get.cloudInfraModel") is not a
            // literal value, so it is not parsed. Parsing it collapses it to {} and the value disappears. When it is a
            // reference, skip the originalData fallback and leave it to component schema/skeleton based rendering.
            if (
              typeof requestBody === 'string' &&
              isReferenceRequestBody(requestBody)
            ) {
              console.log(
                '   ↪️ request_body is a cm-cicada runtime reference — skip parsing:',
                requestBody,
              );
            } else if (typeof requestBody === 'string') {
              // If it is a JSON string, parse it
              try {
                console.log(
                  '   📦 Parsing JSON string (length:',
                  requestBody.length,
                  ')',
                );
                requestBody = JSON.parse(requestBody);
                console.log('   ✅ Successfully parsed JSON string');
                console.log('   Parsed keys:', Object.keys(requestBody));
              } catch (error) {
                console.warn(
                  '   ⚠️ Failed to parse request_body as JSON:',
                  error,
                );
                requestBody = {};
              }
            }

            // Check whether request_body is actual data (excluding schema)
            const requestBodyIsSchema =
              requestBody &&
              typeof requestBody === 'object' &&
              requestBody.type === 'object' &&
              requestBody.properties &&
              typeof requestBody.properties === 'object';

            console.log('   🔍 Is requestBody a schema?:', requestBodyIsSchema);

            if (
              !requestBodyIsSchema &&
              requestBody &&
              typeof requestBody === 'object' &&
              Object.keys(requestBody).length > 0
            ) {
              existingBodyParamsData = requestBody;
              hasExistingData = true;
              console.log('✅ Using originalData.request_body (saved data)');
              console.log('   Data keys:', Object.keys(existingBodyParamsData));
              console.log('   Data:', existingBodyParamsData);
            } else if (requestBodyIsSchema) {
              console.log('❌ originalData.request_body is SCHEMA, not data!');
            } else {
              console.log('⚠️ originalData.request_body is empty or invalid');
            }
          } else if (!hasExistingData) {
            console.log('⚠️ No originalData.request_body found');
          }
        }

        console.log('🔍 Final data loading result:');
        console.log('   hasExistingData:', hasExistingData);
        if (hasExistingData) {
          console.log(
            '   existingBodyParamsData keys:',
            Object.keys(existingBodyParamsData),
          );
          console.log('   existingBodyParamsData:', existingBodyParamsData);

          // Note: Decoding is already done in workflowEditorModel.ts
          // step.properties.model already contains plain text
          // No need to decode again here (prevents double decoding)
        }

        // Separate Schema and Data
        let bodyParamsSchemaSource: any = null; // Schema (form structure)
        let pathParamsData: any = {};
        let queryParamsData: any = {};
        let bodyParamsData: any = {}; // The actually stored data

        // path/query parameters are handled regardless of whether a body exists.
        // This extraction used to be inside the body_params condition, so a body-less GET component
        // (e.g. honeybee_task_get_infra_refined) was not drawn at all,
        // with no way to enter values, workflow execution failed after saving.
        if (taskComponentData) {
          const pathParamsSchemaObj = (taskComponentData as any).path_params;
          const queryParamsSchemaObj = (taskComponentData as any).query_params;

          pathParamsSchema.value = pathParamsSchemaObj || null;
          queryParamsSchema.value = queryParamsSchemaObj || null;

          if (pathParamsSchemaObj?.properties) {
            Object.keys(pathParamsSchemaObj.properties).forEach(key => {
              pathParamsData[key] = '';
            });
          }

          if (queryParamsSchemaObj?.properties) {
            Object.keys(queryParamsSchemaObj.properties).forEach(key => {
              queryParamsData[key] = '';
            });
          }
        }

        if (taskComponentData && (taskComponentData as any).body_params) {
          // The Schema comes from taskComponentData
          bodyParamsSchemaSource = (taskComponentData as any).body_params;

          // Data comes from existingBodyParamsData (originalData.request_body or model.properties)
          if (hasExistingData) {
            console.log('✅ Using existing data');
            console.log(
              '   existingBodyParamsData keys:',
              Object.keys(existingBodyParamsData),
            );
            console.log(
              '   existingBodyParamsData sample:',
              JSON.stringify(existingBodyParamsData).substring(0, 200),
            );

            // 🔍 Final schema check: check once more that existingBodyParamsData is not a schema
            const stillLooksLikeSchema =
              existingBodyParamsData.type === 'object' &&
              existingBodyParamsData.properties &&
              typeof existingBodyParamsData.properties === 'object';

            if (stillLooksLikeSchema) {
              console.error(
                '❌ CRITICAL: existingBodyParamsData is SCHEMA, not data!',
              );
              console.error('   This should not happen. Setting empty data.');
              bodyParamsData = {};
            } else {
              bodyParamsData = existingBodyParamsData;
              console.log('✅ existingBodyParamsData confirmed as actual data');
            }
          } else {
            console.log('ℹ️ No existing data, showing empty form');
            bodyParamsData = {};
          }

          // Get the actually stored path_params and query_params data
          const originalData = (step.value.properties as any)?.originalData;
          const savedPathParams =
            (model as any)?.path_params || originalData?.path_params || {};
          const savedQueryParams =
            (model as any)?.query_params || originalData?.query_params || {};

          // If a field defined in the Schema has an actual value, overwrite it
          Object.keys(savedPathParams).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(pathParamsData, key)) {
              pathParamsData[key] = savedPathParams[key];
            }
          });

          Object.keys(savedQueryParams).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(queryParamsData, key)) {
              queryParamsData[key] = savedQueryParams[key];
            }
          });

          console.log('✅ Schema loaded from taskComponentData.body_params');
          console.log(
            '   Schema properties:',
            Object.keys(bodyParamsSchemaSource?.properties || {}),
          );
          console.log('✅ Data loaded from model.properties');
          console.log('   Data keys:', Object.keys(bodyParamsData));
          console.log('✅ Path params data:', pathParamsData);
          console.log('✅ Query params data:', queryParamsData);
        } else if (hasExistingData) {
          console.log(
            '=== 🎯 PATH A: No taskComponentData, using model data for both schema and values ===',
          );
          console.log(
            'existingBodyParamsData keys:',
            Object.keys(existingBodyParamsData),
          );
          console.log('existingBodyParamsData:', existingBodyParamsData);

          // Build the Schema from the model data structure too
          bodyParamsSchemaSource = {
            type: 'object',
            properties: {},
            required: [],
          };

          // Analyze the data structure to build the schema
          Object.keys(existingBodyParamsData).forEach(key => {
            const value = existingBodyParamsData[key];
            const propSchema: any = { type: 'string' };

            if (Array.isArray(value)) {
              propSchema.type = 'array';
              if (value.length > 0) {
                const firstItem = value[0];
                if (typeof firstItem === 'object' && firstItem !== null) {
                  propSchema.items = {
                    type: 'object',
                    properties: {},
                  };
                  // Analyze the structure of the first item in the object array
                  Object.keys(firstItem).forEach(itemKey => {
                    const itemValue = firstItem[itemKey];
                    if (Array.isArray(itemValue)) {
                      propSchema.items.properties[itemKey] = {
                        type: 'array',
                        items: {
                          type:
                            typeof itemValue[0] !== 'object'
                              ? typeof itemValue[0]
                              : 'object',
                        },
                      };
                    } else if (
                      typeof itemValue === 'object' &&
                      itemValue !== null
                    ) {
                      propSchema.items.properties[itemKey] = {
                        type: 'object',
                      };
                    } else {
                      propSchema.items.properties[itemKey] = {
                        type: typeof itemValue,
                      };
                    }
                  });
                } else {
                  propSchema.items = { type: typeof firstItem };
                }
              } else {
                propSchema.items = { type: 'string' };
              }
            } else if (typeof value === 'object' && value !== null) {
              propSchema.type = 'object';
              propSchema.properties = {};
            } else {
              propSchema.type = typeof value;
            }

            bodyParamsSchemaSource.properties[key] = propSchema;
          });

          bodyParamsData = existingBodyParamsData;

          console.log('✅ Generated schema from model data');
          console.log(
            '   Schema properties:',
            Object.keys(bodyParamsSchemaSource.properties),
          );
          console.log('   Data keys:', Object.keys(bodyParamsData));

          pathParamsData = (model as any).path_params || {};
          queryParamsData = (model as any).query_params || {};
        } else {
          // Fallback when there is no Task Component (existing logic)
          console.log(
            '=== ⚠️ PATH C: Task Component not found, using fallback logic ===',
          );

          if (modelProperties.targetSoftwareModel) {
            bodyParamsData = modelProperties.targetSoftwareModel;
          } else if (
            modelProperties &&
            Object.keys(modelProperties).length > 0
          ) {
            bodyParamsData = modelProperties;
          } else {
            const data = (model as any).data || model;
            bodyParamsData = (data as any).body_params || {};
          }

          // Note: Decoding is already done in workflowEditorModel.ts
          // step.properties.model already contains plain text
          // No need to decode again here (prevents double decoding)

          pathParamsData = (model as any).path_params || {};
          queryParamsData = (model as any).query_params || {};
        }

        console.log('Model structure:', model);
        console.log(
          'Model properties (Step Model Properties):',
          modelProperties,
        );
        console.log('Body params schema source:', bodyParamsSchemaSource);
        console.log('Body params data:', bodyParamsData);
        console.log('Path params data:', pathParamsData);
        console.log('Query params data:', queryParamsData);

        // Assign to the separated params variables
        pathParams.value = pathParamsData;
        queryParams.value = queryParamsData;

        // Set the Body Params Schema and Model
        if (bodyParamsSchemaSource) {
          // Set the Schema (the Task Component's body_params)
          console.log('=== Setting Body Params ===');
          console.log('1️⃣ Schema (form structure):');
          console.log('   Full schema:', bodyParamsSchemaSource);
          console.log('   - Type:', bodyParamsSchemaSource.type);
          console.log(
            '   - Properties count:',
            Object.keys(bodyParamsSchemaSource.properties || {}).length,
          );
          console.log(
            '   - Properties keys:',
            Object.keys(bodyParamsSchemaSource.properties || {}),
          );
          console.log('   - Required:', bodyParamsSchemaSource.required);

          // Details for each Schema property
          if (bodyParamsSchemaSource.properties) {
            console.log('   Schema properties detail:');
            Object.keys(bodyParamsSchemaSource.properties).forEach(key => {
              const prop = bodyParamsSchemaSource.properties[key];
              console.log(`     - ${key}:`, {
                type: prop.type,
                hasProperties: !!prop.properties,
                hasItems: !!prop.items,
                propertiesKeys: prop.properties
                  ? Object.keys(prop.properties)
                  : [],
              });
            });
          }

          // Pass the schema to vue-json-ui-editor
          // Map the data based on the Schema structure
          let finalProperties = bodyParamsSchemaSource.properties || {};
          let finalRequired = bodyParamsSchemaSource.required || [];
          let finalBodyParamsData = bodyParamsData;

          console.log('📋 Schema structure analysis:');
          console.log('   Schema properties:', Object.keys(finalProperties));

          // Check whether the Schema has a targetSoftwareModel
          if (
            finalProperties.targetSoftwareModel &&
            finalProperties.targetSoftwareModel.properties
          ) {
            console.log('🔍 Schema has targetSoftwareModel property');
            console.log(
              '   targetSoftwareModel properties:',
              Object.keys(finalProperties.targetSoftwareModel.properties),
            );

            // Check the data structure
            if (bodyParamsData && Object.keys(bodyParamsData).length > 0) {
              console.log('📊 Data structure analysis:');
              console.log('   Data keys:', Object.keys(bodyParamsData));

              // Check whether the data is in the form { targetSoftwareModel: {...} }
              if (bodyParamsData.targetSoftwareModel) {
                console.log('✅ Data already has targetSoftwareModel wrapper');
                console.log(
                  '   Data.targetSoftwareModel keys:',
                  Object.keys(bodyParamsData.targetSoftwareModel),
                );
                finalBodyParamsData = bodyParamsData;
              } else {
                // If the data is in the form { servers: [...], source_connection_info_id: "..." }
                // Convert to { targetSoftwareModel: { servers: [...], ... } } to match the Schema structure
                console.log('🔄 Wrapping data to match schema structure');
                console.log('   Before wrap:', Object.keys(bodyParamsData));
                finalBodyParamsData = {
                  targetSoftwareModel: bodyParamsData,
                };
                console.log('   After wrap:', Object.keys(finalBodyParamsData));
              }
            }

            // Use the Schema as is (including targetSoftwareModel)
            console.log('✅ Using schema as-is (with targetSoftwareModel)');
          } else {
            // If the Schema has no targetSoftwareModel, keep the data as is too
            console.log(
              '✅ Schema has no targetSoftwareModel, using data as-is',
            );
            finalBodyParamsData = bodyParamsData;
          }

          bodyParamsSchema.value = {
            type: 'object',
            properties: finalProperties,
            required: finalRequired,
          };

          console.log('✅ Schema set to bodyParamsSchema.value');
          console.log('✅ Schema type:', bodyParamsSchema.value.type);
          console.log(
            '✅ Schema properties keys:',
            Object.keys(bodyParamsSchema.value.properties),
          );

          // Set the Model (actual data)
          console.log('2️⃣ Setting model data...');
          console.log(
            '   finalBodyParamsData type:',
            typeof finalBodyParamsData,
          );
          console.log(
            '   finalBodyParamsData keys:',
            Object.keys(finalBodyParamsData || {}),
          );

          // 🔍 CRITICAL CHECK: verify whether finalBodyParamsData is a schema
          if (
            finalBodyParamsData &&
            finalBodyParamsData.type === 'object' &&
            finalBodyParamsData.properties &&
            typeof finalBodyParamsData.properties === 'object'
          ) {
            console.error(
              '❌❌❌ CRITICAL ERROR: Trying to set SCHEMA as model data!',
            );
            console.error(
              '   finalBodyParamsData.type:',
              finalBodyParamsData.type,
            );
            console.error(
              '   finalBodyParamsData.properties:',
              Object.keys(finalBodyParamsData.properties),
            );
            console.error('   This is a SCHEMA, not actual form data!');
            console.error('   Setting empty object instead.');
            bodyParamsModel.value = {};
          } else {
            // No need to decode here - already decoded in existingBodyParamsData
            // Already decoded from existingBodyParamsData, so not needed here
            bodyParamsModel.value = finalBodyParamsData || {};
            console.log('✅ Data set to bodyParamsModel.value');
          }

          // Detailed log of the data mapping result
          if (Object.keys(bodyParamsModel.value).length > 0) {
            console.log('✅ Data successfully mapped to form');
            console.log(
              '   📦 Mapped fields:',
              Object.keys(bodyParamsModel.value),
            );

            // 🔍 Check if bodyParamsModel looks like schema
            if (
              bodyParamsModel.value.type === 'object' &&
              bodyParamsModel.value.properties
            ) {
              console.error(
                '❌❌❌ bodyParamsModel.value IS SCHEMA! This is wrong!',
              );
              console.error(
                '   Expected: { targetSoftwareModel: { servers: [...] } }',
              );
              console.error('   Got: { type: "object", properties: {...} }');
            } else {
              console.log('✅ bodyParamsModel.value looks like actual data');
            }

            Object.keys(bodyParamsModel.value).forEach(key => {
              const value = bodyParamsModel.value[key];
              if (Array.isArray(value)) {
                console.log(`   - ${key}: array with ${value.length} items`);
                if (value.length > 0 && typeof value[0] === 'object') {
                  console.log(
                    `     First item keys: [${Object.keys(value[0]).join(', ')}]`,
                  );
                }
              } else if (typeof value === 'object' && value !== null) {
                console.log(
                  `   - ${key}: object with keys [${Object.keys(value).join(', ')}]`,
                );
              } else {
                console.log(`   - ${key}: ${typeof value} = ${value}`);
              }
            });
          } else {
            console.log('ℹ️ No data to map, showing empty form');
          }

          // Update the whole taskSchema (for debugging)
          (taskSchema.value as any) = {
            type: 'object',
            title: 'Task Component Configuration',
            properties: {
              ...taskSchema.value.properties,
              body_params: bodyParamsSchema.value,
            },
          };

          console.log('Updated full taskSchema (for debug):', taskSchema.value);
        } else if (Object.keys(bodyParamsData).length > 0) {
          // If body_params is in data form, build the schema
          console.log(
            'Generating schema from body_params data:',
            bodyParamsData,
          );
          const generatedSchema = generateBodyParamsSchema(bodyParamsData);
          console.log('Generated body_params schema:', generatedSchema);

          bodyParamsSchema.value = generatedSchema;

          // No need to decode here - already decoded in existingBodyParamsData
          // Already decoded from existingBodyParamsData, so not needed here
          bodyParamsModel.value = bodyParamsData;

          console.log('Updated bodyParamsSchema with generated schema');
        } else {
          console.log('No body_params found, using default schema');
          bodyParamsSchema.value = {
            type: 'object',
            title: 'Body Parameters',
            properties: {},
            additionalProperties: true,
          };
          bodyParamsModel.value = {};
        }

        console.log('=== Final Initialization Results ===');
        console.log('Path Params:', pathParams.value);
        console.log('Query Params:', queryParams.value);
        console.log('Body Params Schema:', bodyParamsSchema.value);
        console.log('Body Params Model:', bodyParamsModel.value);
        console.log('Full taskSchema (debug):', taskSchema.value);
        console.log('Full taskModel (debug):', taskModel.value);

        // vue-json-ui-editor updates automatically via the reactive schema prop
        console.log('✅ Body params schema set reactively via :schema prop');
      }

      // Initialize TaskEditorModel
      if (step.value?.properties?.fixedModel) {
        taskEditorModel.setParamsContext(step.value.properties.fixedModel);
      }

      // Set the Task Name: a unique name was already generated in canInsertStep, so use it as is
      console.log('🔍 TaskComponentEditor - Reading task name:');
      console.log('   step.value.name:', step.value?.name);
      console.log('   step.value.type:', step.value?.type);

      const taskName = step.value?.name || step.value?.type || '';

      console.log('   Final taskName:', taskName);
      taskEditorModel.setComponentName(taskName);

      await nextTick();
      console.log('✅ Task name set to:', taskName);
      console.log('✅ Task name value from getter:', getComponentNameValue());

      // Store the initial data (for comparison)
      // ✨ BeetleTaskEditor approach: use the current model state, not originalData
      const currentModel = step.value.properties?.model || {};
      initialData.value = {
        name: step.value.name || '',
        path_params: { ...pathParams.value },
        query_params: { ...queryParams.value },
        body_params: JSON.parse(JSON.stringify(bodyParamsModel.value)),
        request_body: JSON.stringify(currentModel), // Store the current model state (BeetleTaskEditor approach)
      };

      console.log(
        '=== Initial Data Saved (for comparison - BeetleTaskEditor style) ===',
      );
      console.log('Initial name:', initialData.value.name);
      console.log('Initial path_params:', initialData.value.path_params);
      console.log('Initial query_params:', initialData.value.query_params);
      console.log('Initial body_params:', initialData.value.body_params);
      console.log(
        'Initial request_body from step.properties.model:',
        initialData.value.request_body,
      );
      console.log(
        '=======================================================================',
      );

      isInitialized.value = true;
    });

    // Data comparison function (compare the initial data with the current data)
    const compareWithInitialData = () => {
      console.log('\n');
      console.log(
        '═══════════════════════════════════════════════════════════════',
      );
      console.log('🔍 DATA COMPARISON: Initial vs Current');
      console.log(
        '═══════════════════════════════════════════════════════════════',
      );

      const currentName = step.value.name || '';
      const currentPathParams = pathParams.value;
      const currentQueryParams = queryParams.value;
      const currentBodyParams = bodyParamsModel.value;
      const currentRequestBody = JSON.stringify(step.value.properties?.model);

      // Compare Name
      const nameChanged = currentName !== initialData.value.name;
      console.log('\n📌 Task Name:');
      console.log('  Initial:', initialData.value.name);
      console.log('  Current:', currentName);
      console.log('  Changed:', nameChanged ? '❌ YES' : '✅ NO (Same)');

      // Compare Path Params
      const pathParamsChanged =
        JSON.stringify(currentPathParams) !==
        JSON.stringify(initialData.value.path_params);
      console.log('\n📌 Path Params:');
      console.log('  Initial:', JSON.stringify(initialData.value.path_params));
      console.log('  Current:', JSON.stringify(currentPathParams));
      console.log('  Changed:', pathParamsChanged ? '❌ YES' : '✅ NO (Same)');

      // Compare Query Params
      const queryParamsChanged =
        JSON.stringify(currentQueryParams) !==
        JSON.stringify(initialData.value.query_params);
      console.log('\n📌 Query Params:');
      console.log('  Initial:', JSON.stringify(initialData.value.query_params));
      console.log('  Current:', JSON.stringify(currentQueryParams));
      console.log('  Changed:', queryParamsChanged ? '❌ YES' : '✅ NO (Same)');

      // Compare Body Params
      const bodyParamsChanged =
        JSON.stringify(currentBodyParams) !==
        JSON.stringify(initialData.value.body_params);
      console.log('\n📌 Body Params (step.properties.model):');
      console.log('  Initial:', JSON.stringify(initialData.value.body_params));
      console.log('  Current:', JSON.stringify(currentBodyParams));
      console.log('  Changed:', bodyParamsChanged ? '❌ YES' : '✅ NO (Same)');

      // Compare Request Body (against originalData)
      const requestBodyChanged =
        currentRequestBody !== initialData.value.request_body;
      console.log('\n📌 Request Body (for API):');
      console.log(
        '  Initial (from originalData):',
        initialData.value.request_body,
      );
      console.log('  Current (will be sent):', currentRequestBody);
      console.log('  Changed:', requestBodyChanged ? '❌ YES' : '✅ NO (Same)');

      // Overall summary
      const anyChanges =
        nameChanged ||
        pathParamsChanged ||
        queryParamsChanged ||
        bodyParamsChanged;
      console.log('\n📊 Summary:');
      console.log(
        '  Any changes detected:',
        anyChanges
          ? '❌ YES - Data was modified'
          : '✅ NO - Data is identical to original',
      );

      if (!anyChanges) {
        console.log(
          '  ✅ DATA INTEGRITY CHECK PASSED: Current data matches originalData',
        );
      } else {
        console.log(
          '  ⚠️ DATA WAS MODIFIED: Current data differs from originalData',
        );
        console.log(
          '  Changed fields:',
          [
            nameChanged && 'name',
            pathParamsChanged && 'path_params',
            queryParamsChanged && 'query_params',
            bodyParamsChanged && 'body_params',
          ]
            .filter(Boolean)
            .join(', '),
        );
      }

      console.log(
        '═══════════════════════════════════════════════════════════════',
      );
      console.log('\n');

      return {
        anyChanges,
        changes: {
          name: nameChanged,
          pathParams: pathParamsChanged,
          queryParams: queryParamsChanged,
          bodyParams: bodyParamsChanged,
        },
      };
    };

    // Detect Body Params Schema changes (updated automatically via the reactive prop)
    watch(
      bodyParamsSchema,
      newSchema => {
        console.log(
          'Body Params Schema changed (auto-updated via reactive prop):',
          newSchema,
        );
      },
      { deep: true },
    );

    // Detect Body Params Model changes - automatically update step.properties.model on change
    watch(
      bodyParamsModel,
      newModel => {
        console.log('\n');
        console.log(
          '═══════════════════════════════════════════════════════════════',
        );
        console.log('⚡ Body Params Model WATCH triggered');
        console.log(
          '═══════════════════════════════════════════════════════════════',
        );
        console.log('New model type:', typeof newModel);
        console.log('New model keys:', Object.keys(newModel));
        console.log(
          'New model (first 300 chars):',
          JSON.stringify(newModel).substring(0, 300),
        );

        // 🔍 Check if newModel is actually the step object (bug detection)
        if ((newModel as any).componentType === 'task') {
          console.error(
            '❌ BUG DETECTED: bodyParamsModel contains step object instead of actual data!',
          );
          console.error(
            'bodyParamsModel should NOT have componentType, id, properties, etc.',
          );
          console.error(
            'This means initialization loaded wrong data into bodyParamsModel',
          );
          return;
        }

        // 🔍 Check if newModel is a schema (critical bug detection)
        if (
          (newModel as any).type === 'object' &&
          (newModel as any).properties &&
          typeof (newModel as any).properties === 'object'
        ) {
          console.error(
            '❌❌❌ CRITICAL BUG: bodyParamsModel contains SCHEMA instead of actual data!',
          );
          console.error('Schema structure detected:');
          console.error('   - type:', (newModel as any).type);
          console.error(
            '   - properties keys:',
            Object.keys((newModel as any).properties || {}),
          );
          console.error(
            'Expected structure: { targetSoftwareModel: { servers: [...], ... } }',
          );
          console.error('Got structure: { type: "object", properties: {...} }');
          console.error('❌ NOT SAVING - This would corrupt the data!');
          return;
        }

        if (!isInitialized.value) {
          console.log('⏭️ Skipping auto-save during initialization');
          return;
        }

        // ✅ Looks good, proceed with save
        console.log('✅ newModel validation passed - looks like actual data');

        // Update step.properties.model directly with newModel
        // convertToCicadaTask uses JSON.stringify(step.properties.model) as the request_body
        // Note: Keep plain text in memory. Encoding happens only in workflowEditorModel.ts
        // Keep it as plain text in memory. Encoding is done only in workflowEditorModel.ts
        let modelToSave = { ...newModel };

        console.log('📤 Model to save:');
        console.log('   Keys:', Object.keys(modelToSave));
        console.log(
          '   JSON (first 300 chars):',
          JSON.stringify(modelToSave).substring(0, 300),
        );

        const updatedStep = {
          ...step.value,
          properties: {
            ...step.value.properties,
            model: modelToSave, // Store the actual data directly
          },
        };

        console.log(
          '📝 Updated step.properties.model keys:',
          Object.keys(updatedStep.properties.model),
        );
        console.log(
          '📝 Updated step.properties.model (first 300 chars):',
          JSON.stringify(updatedStep.properties.model).substring(0, 300),
        );

        // Pass the changes to the parent component
        // ⚠️ IMPORTANT: editorProviders assigns step.properties.model = e, so
        // must emit only model, not the whole step!
        emit('saveContext', updatedStep.properties.model);

        console.log(
          '✅ Auto-saved body params changes to step.properties.model',
        );
        console.log(
          '═══════════════════════════════════════════════════════════════',
        );
        console.log('\n');
      },
      { deep: true },
    );

    return {
      // `step` is not returned: it is already a prop, and returning a computed of
      // the same object shadows it under the same name.

      // referencing a previous task's result
      taskReference,
      fieldReferences,
      invalidReferencePaths,
      openReferencePicker,
      startPickingOnCanvas,
      stopPickingOnCanvas,
      applyReference,
      clearReference,
      bodySource,
      cancelReference,
      isPickingOnCanvas,
      wholeBodyReference,
      wholeBodyOutputRows,
      setBodySourceWhole,
      setBodySourceFields,

      // Data
      taskEditorModel,
      jsonEditor,
      isInitialized,
      taskSchema,
      taskModel,

      // Separated Parameters
      pathParams,
      queryParams,
      bodyParamsSchema,
      bodyParamsModel,
      sortedBodyParamPropertyNames,

      // Component Name Methods
      getComponentNameTitle,
      getComponentNameValue,
      setComponentNameValue,
      getComponentNameIsValid,
      getComponentNameOnBlur,
      handleComponentNameInput,

      // Step Properties Method
      getStepProperties,
      getCurrentTaskComponentName,

      // Parameters Getter
      getPathParams,
      getQueryParams,

      // Parameters Checker
      hasPathParams,
      hasQueryParams,
      hasBodyParams,
      isPathParamRequired,
      isQueryParamRequired,

      // Parameters Update Handlers
      handlePathParamInput,
      handleQueryParamInput,
      updateStepWithParams,

      // Body Param Field Update Handler
      updateBodyParamField: (fieldName: string, value: any) => {
        console.log('\n');
        console.log('🔄🔄🔄 updateBodyParamField CALLED 🔄🔄🔄');
        console.log(`   Field name: ${fieldName}`);
        console.log('   New value type:', typeof value);

        // Deep inspection of new value
        if (typeof value === 'object' && value !== null) {
          console.log('   New value keys:', Object.keys(value));
          if (value.servers && Array.isArray(value.servers)) {
            console.log(`   New value.servers: array[${value.servers.length}]`);
            if (value.servers.length > 0) {
              console.log(
                '   First server keys:',
                Object.keys(value.servers[0]),
              );
              console.log(
                '   First server.source_connection_info_id:',
                value.servers[0].source_connection_info_id,
              );
            }
          }
        }
        console.log(
          '   New value JSON (first 500 chars):',
          JSON.stringify(value).substring(0, 500),
        );

        console.log(
          '   Current bodyParamsModel keys BEFORE update:',
          Object.keys(bodyParamsModel.value),
        );
        console.log(
          '   Current bodyParamsModel JSON (first 500 chars):',
          JSON.stringify(bodyParamsModel.value).substring(0, 500),
        );

        // 🔍 Create NEW object to trigger Vue reactivity
        // Deep clone to ensure Vue detects all changes
        const oldModel = bodyParamsModel.value;
        const newModel = JSON.parse(
          JSON.stringify({
            ...bodyParamsModel.value,
            [fieldName]: value,
          }),
        );

        bodyParamsModel.value = newModel;

        console.log(
          '   bodyParamsModel keys AFTER update:',
          Object.keys(bodyParamsModel.value),
        );

        // Verify update
        if (
          bodyParamsModel.value[fieldName] &&
          typeof bodyParamsModel.value[fieldName] === 'object'
        ) {
          if (
            bodyParamsModel.value[fieldName].servers &&
            Array.isArray(bodyParamsModel.value[fieldName].servers)
          ) {
            console.log(
              `   Updated bodyParamsModel.${fieldName}.servers: array[${bodyParamsModel.value[fieldName].servers.length}]`,
            );
            if (bodyParamsModel.value[fieldName].servers.length > 0) {
              console.log(
                `   Updated first server.source_connection_info_id: ${bodyParamsModel.value[fieldName].servers[0].source_connection_info_id}`,
              );
            }
          }
        }

        console.log(
          '   Updated bodyParamsModel JSON (first 500 chars):',
          JSON.stringify(bodyParamsModel.value).substring(0, 500),
        );
        console.log(
          '   ✅ bodyParamsModel.value object reference changed:',
          oldModel !== bodyParamsModel.value,
        );
        console.log('   ⏰ Waiting for watch(bodyParamsModel) to trigger...');
        console.log('🔄🔄🔄 updateBodyParamField COMPLETE 🔄🔄🔄');
        console.log('\n');
        // watch will auto-save changes
      },

      // JSON Editor Methods (based on the official example)
      resetEditor,
      saveConfiguration,
      generateBodyParamsSchema,

      // Data Comparison
      compareWithInitialData,
      initialData,
    };
  },
});
</script>

<style scoped lang="postcss">
.task-component-editor {
  @apply p-4 bg-white;
}

.component-name-section {
  @apply mb-6;
}

.field-label {
  @apply flex items-center mb-2;
}

.label-text {
  @apply text-sm font-medium text-gray-700;
}

.required-indicator {
  @apply text-red-500 ml-1;
}

.component-name-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply transition-colors duration-200;
}

.component-name-input.invalid {
  @apply border-red-500 focus:ring-red-500 focus:border-red-500;
}

.task-configuration-section {
  @apply mb-6;
}

.params-section {
  @apply mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200;
}

.params-title {
  @apply text-base font-semibold text-gray-700 mb-3;
}

.params-content {
  @apply space-y-3;
}

.param-item {
  @apply flex flex-col;
}

.param-label {
  @apply text-sm font-medium text-gray-600 mb-1;
}

.param-label .required-mark {
  color: #dc2626;
  margin-left: 0.125rem;
  font-weight: bold;
}

.param-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply transition-colors duration-200;
}

.empty-params {
  @apply text-sm text-gray-400 italic;
}

.body-params-section {
  @apply bg-white border-gray-300;
}

.recursive-form-container {
  @apply bg-white;
  padding: 0;
}

.section-header {
  @apply mb-4 pb-3 border-b border-gray-200;
}

.section-header h4 {
  @apply text-lg font-semibold text-gray-800;
}

.json-editor-container {
  /* 높이를 고정하지 않는다. 예전에는 min-height: 400px 이라 칸이 하나뿐인 태스크
     (time 하나만 받는 sleep 등)에서도 400px 를 잡아, 빈 여백만 길고 패널에 스크롤이
     생겼다. 내용만큼만 차지하게 둔다. */
  @apply bg-white;
  padding: 0;
}

/* vue-json-ui-editor base styles */
.json-editor-container :deep(.json-editor) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

/* Styles for the whole form */
.json-editor-container :deep(.el-form) {
  margin: 0;
  padding: 0;
}

.json-editor-container :deep(.el-form-item) {
  margin-bottom: 18px;
}

.json-editor-container :deep(.el-form-item__label) {
  font-size: 14px;
  color: #606266;
  line-height: 40px;
  padding: 0 12px 0 0;
  display: block;
  text-align: right;
  font-weight: 500;
}

.json-editor-container :deep(.el-form-item__content) {
  line-height: 40px;
  position: relative;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.json-editor-container :deep(.el-input) {
  position: relative;
  font-size: 14px;
  display: inline-block;
  width: 100%;
}

.json-editor-container :deep(.el-input__inner) {
  -webkit-appearance: none;
  appearance: none;
  background-color: #fff;
  background-image: none;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  box-sizing: border-box;
  color: #606266;
  display: inline-block;
  font-size: inherit;
  height: 40px;
  line-height: 40px;
  outline: none;
  padding: 0 15px;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  width: 100%;
}

.json-editor-container :deep(.el-input__inner:focus) {
  outline: none;
  border-color: #409eff;
}

.json-editor-container :deep(.el-select) {
  display: inline-block;
  position: relative;
  width: 100%;
}

.json-editor-container :deep(.el-select .el-input__inner) {
  cursor: pointer;
  padding-right: 30px;
}

.json-editor-container :deep(.el-textarea) {
  position: relative;
  display: inline-block;
  width: 100%;
  vertical-align: bottom;
  font-size: 14px;
}

.json-editor-container :deep(.el-textarea__inner) {
  display: block;
  resize: vertical;
  padding: 5px 15px;
  line-height: 1.5;
  box-sizing: border-box;
  width: 100%;
  font-size: inherit;
  color: #606266;
  background-color: #fff;
  background-image: none;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.json-editor-container :deep(.el-textarea__inner:focus) {
  outline: none;
  border-color: #409eff;
}

/* JSON Editor slot button styles (based on the official example) */
.json-editor-container :deep(.json-editor button) {
  display: inline-block;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
  -webkit-appearance: none;
  appearance: none;
  text-align: center;
  box-sizing: border-box;
  outline: none;
  margin: 0;
  transition: 0.1s;
  font-weight: 500;
  padding: 12px 20px;
  font-size: 14px;
  border-radius: 4px;
  margin-right: 10px;
  margin-top: 10px;
}

.json-editor-container :deep(.json-editor button:hover) {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.json-editor-container :deep(.json-editor button:active) {
  color: #3a8ee6;
  border-color: #3a8ee6;
  outline: none;
}

.json-editor-container :deep(.json-editor button:focus) {
  outline: none;
  border-color: #409eff;
}

/* Object/array styles */
.json-editor-container :deep(.json-editor-object) {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 10px;
  margin: 5px 0;
  background-color: #fafafa;
}

.json-editor-container :deep(.json-editor-array) {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 10px;
  margin: 5px 0;
  background-color: #f9f9f9;
}

/* --- referencing a previous task's result --- */
.component-kind {
  margin: 6px 2px 0;
  font-size: 11.5px;
  color: #8b93a3;
}
.component-kind-label {
  margin-right: 6px;
}
.component-kind code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #6b7280;
}

.no-body-note {
  margin: 6px 2px 2px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #6b7280;
}

.ref-source-bar {
  /* 아래 칸들과 성격이 다르다 — 값이 아니라 *본문이 어디서 오는가* 를 정한다.
     경계선과 옅은 바탕으로 갈라 두지 않으면 첫 번째 칸처럼 읽힌다. */
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 0 0 12px;
  padding: 8px 10px;
  background: #f7f8fb;
  border: 1px solid #e6e8ef;
  border-radius: 6px;
}
.ref-source-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: #3d4655;
  cursor: pointer;
}
/* 무엇을 고르는 것인지 호버로 알려 준다. 레이어로 그리는 이유는 브라우저 기본
   툴팁이 한참 뒤에야 뜨기 때문이다 — 고르기 전에 읽혀야 소용이 있다. */
.ref-source-help {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 40;
  width: 290px;
  padding: 8px 10px;
  border: 1px solid #d8dbe4;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.12);
  font-size: 11.5px;
  line-height: 1.55;
  color: #3d4655;
  font-weight: 400;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.08s ease;
}
.ref-source-option:hover .ref-source-help {
  opacity: 1;
  visibility: visible;
}

.ref-source-option.is-disabled {
  color: #a6aebc;
  cursor: not-allowed;
}
/* 고르기 쪽 옵션은 아이콘을 달아 눈에 띄게 둔다 — 값을 어디서 가져올지 정하는 자리다. */
.ref-source-option .ref-pick-icon {
  color: #4b4ddb;
}
.ref-source-option.is-disabled .ref-pick-icon {
  color: #a6aebc;
}
.ref-pick-icon {
  width: 13px;
  height: 13px;
}
.ref-pick-cancel {
  padding: 3px 10px;
  border: 1px solid #c7cbd4;
  border-radius: 4px;
  background: #fff;
  color: #4b5563;
  font-size: 11px;
  cursor: pointer;
}
.ref-pick-cancel:hover {
  border-color: #9aa1ad;
  color: #1f2937;
}

.ref-source-note {
  font-size: 11px;
  color: #6b7688;
}
.ref-invalid-summary {
  margin: 0 0 8px;
  padding: 7px 9px;
  border: 1px solid #d94a4a;
  border-radius: 6px;
  background: #fdecec;
  color: #b02a2a;
  font-size: 12px;
  line-height: 1.5;
}
.ref-whole {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 8px;
}
.ref-whole-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #4b4ddb;
  background: #eeeefc;
  border: 1px solid #c6c7f5;
  border-radius: 6px;
  padding: 6px 9px;
  overflow-x: auto;
}
.ref-whole-edit {
  align-self: flex-start;
  border: 1px solid #dfe3ea;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  color: #3d4655;
  cursor: pointer;
}
/* 넘어가는 값 표.
 *
 * 값 이름과 예시는 얼마든지 길어질 수 있다. 그대로 두면 표가 칸을 밀어내 패널 밖으로
 * 나가고, 가로 스크롤이 패널 전체에 걸려 오른쪽 열이 잘린 채 보인다. 폭을 고정하고
 * 넘치는 것은 칸 안에서 자르거나 접는다. */
.ref-whole {
  max-width: 100%;
  overflow-x: auto;
}
.ref-whole-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 11.5px;
}
.ref-whole-table th:nth-child(1),
.ref-whole-table td:nth-child(1) {
  width: 52%;
}
.ref-whole-table th:nth-child(2),
.ref-whole-table td:nth-child(2) {
  width: 18%;
}
.ref-whole-table th:nth-child(3),
.ref-whole-table td:nth-child(3) {
  width: 30%;
}
.ref-whole-table td {
  overflow-wrap: anywhere;
}
.ref-whole-table .ref-whole-example {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ref-whole-table th {
  text-align: left;
  padding: 5px 8px;
  border-bottom: 1px solid #dfe3ea;
  color: #6b7688;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ref-whole-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #ebeef3;
}
.ref-whole-field,
.ref-whole-type,
.ref-whole-example {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.ref-whole-type,
.ref-whole-example {
  color: #98a2b3;
  font-size: 10.5px;
}
.ref-whole-empty {
  margin: 0;
  padding: 9px;
  background: #f1f3f7;
  border-radius: 6px;
  font-size: 11.5px;
  color: #6b7688;
  line-height: 1.5;
}
</style>
