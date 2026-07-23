<template>
  <div class="task-component-editor">
    <div class="task-configuration-section">
      <div class="section-header">
        <h4>{{ headerTitle }}</h4>
      </div>

      <!--
        A parallel box does not take a name.

        It marks a branch point, not a grouping, so there is nowhere for a name to
        live — it isn't drawn on the canvas (the library draws no label for parallel
        boxes), and on save, if it sits inside a group box it gets folded into the
        outer group and the name is lost. With only an input field and nothing kept
        anywhere, the user is left believing it was saved.

        What you actually want to name is the *grouping*, and that's what a TaskGroup
        handles — its label is drawn on the canvas too. Put the parallel box inside a
        TaskGroup and that name becomes the name of the section.
      -->
      <div v-if="isLaunchPad" class="parallel-note">
        <p>
          Drop tasks side by side inside this step to add branches. They all
          start at the same time, and whatever you place after this step waits
          for every branch to finish.
        </p>
        <p>
          There is nothing to fill in here — the split is all this step does.
          Looking for a name field? A parallel step has nowhere to keep one. To
          label this part of the workflow, wrap it in a TaskGroup; that name is
          drawn on the canvas.
        </p>
      </div>

      <!-- Name Input -->
      <div v-else class="component-name-section">
        <div class="field-label">
          <span class="label-text">{{ nameLabel }}</span>
          <span class="required-indicator">*</span>
        </div>
        <input
          type="text"
          v-model="containerName"
          @input="handleNameChange"
          class="component-name-input"
          :class="{ invalid: !isNameValid }"
          placeholder="Enter name"
        />
        <span v-if="!isNameValid" class="error-message">
          {{ errorMessage }}
        </span>
      </div>

      <!-- Description (Optional) — omitted for parallel boxes for the same reason as the name -->
      <div v-if="!isLaunchPad" class="params-section">
        <h5 class="params-title">Description (optional)</h5>
        <div class="params-content">
          <textarea
            v-model="description"
            @input="handleDescriptionChange"
            class="param-input"
            style="min-height: 80px; resize: vertical"
            placeholder="Enter a description..."
          />
        </div>
      </div>

      <!-- Info Box — omitted for parallel boxes since the note above already says the same thing -->
      <div v-if="!isLaunchPad" :style="infoBoxStyle">
        <strong :style="{ color: iconColor }"
          >{{ icon }} {{ infoTitle }}</strong
        >
        <p style="margin-top: 8px; color: #424242; font-size: 13px">
          {{ infoDescription }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, computed, onMounted, defineComponent } from 'vue';

export default defineComponent({
  name: 'ContainerNameEditor',
  props: {
    step: {
      type: Object,
      required: true,
    },
    definition: {
      type: Object,
      required: true,
    },
  },
  emits: ['saveComponentName'],
  setup(props, { emit }) {
    const containerName = ref('');
    const description = ref('');
    const isNameValid = ref(true);
    const errorMessage = ref('');

    // Dynamic settings (TaskGroup vs launchPad)
    const isLaunchPad = computed(
      () => props.step.componentType === 'launchPad',
    );

    const headerTitle = computed(() =>
      isLaunchPad.value ? 'Parallel Settings' : 'TaskGroup Settings',
    );

    const nameLabel = computed(() =>
      isLaunchPad.value ? 'Parallel Name' : 'TaskGroup Name',
    );

    const icon = computed(() => (isLaunchPad.value ? '🚀' : '📦'));

    const iconColor = computed(() =>
      isLaunchPad.value ? '#2e7d32' : '#1565c0',
    );

    const infoTitle = computed(() =>
      isLaunchPad.value ? 'Parallel Execution' : 'Sequential Execution',
    );

    const infoDescription = computed(() =>
      isLaunchPad.value
        ? 'Tasks in this Parallel run concurrently in parallel.'
        : 'Tasks in this TaskGroup run sequentially.',
    );

    const infoBoxStyle = computed(() => ({
      marginTop: '16px',
      padding: '12px',
      background: isLaunchPad.value ? '#e8f5e9' : '#e3f2fd',
      borderLeft: `4px solid ${isLaunchPad.value ? '#4caf50' : '#2196f3'}`,
      borderRadius: '4px',
    }));

    onMounted(() => {
      containerName.value = props.step.name || '';
      description.value = props.step.properties?.model?.description || '';
    });

    function handleNameChange() {
      const newName = containerName.value.trim();

      // Check for empty name
      if (!newName) {
        isNameValid.value = false;
        errorMessage.value = '⚠️ Name cannot be empty';
        return;
      }

      // Check for duplicates (recursively scan the whole workflow)
      function findDuplicateInSequence(
        sequence: any[],
        targetName: string,
        excludeId: string,
      ): boolean {
        for (const s of sequence) {
          if (s.id !== excludeId && s.name === targetName) {
            return true;
          }
          if (s.sequence && s.sequence.length > 0) {
            if (findDuplicateInSequence(s.sequence, targetName, excludeId)) {
              return true;
            }
          }
        }
        return false;
      }

      if (
        findDuplicateInSequence(
          props.definition.sequence,
          newName,
          props.step.id,
        )
      ) {
        isNameValid.value = false;
        errorMessage.value = `❌ Name "${newName}" already exists`;
        return;
      }

      isNameValid.value = true;
      errorMessage.value = '';
      emit('saveComponentName', newName);
    }

    function handleDescriptionChange() {
      if (!props.step.properties.model) {
        props.step.properties.model = {};
      }
      props.step.properties.model.description = description.value;
    }

    return {
      containerName,
      description,
      isNameValid,
      errorMessage,
      headerTitle,
      nameLabel,
      icon,
      iconColor,
      infoTitle,
      infoDescription,
      infoBoxStyle,
      isLaunchPad,
      handleNameChange,
      handleDescriptionChange,
    };
  },
});
</script>

<style scoped lang="postcss">
.task-component-editor {
  @apply p-4 bg-white;
}

.parallel-note {
  margin-bottom: 12px;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.6;
}

.parallel-note p + p {
  margin-top: 10px;
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

.error-message {
  @apply text-red-500 text-xs mt-1 block;
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

.param-input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply transition-colors duration-200;
}

.section-header {
  @apply mb-4 pb-3 border-b border-gray-200;
}

.section-header h4 {
  @apply text-lg font-semibold text-gray-800;
}
</style>
