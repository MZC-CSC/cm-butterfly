<script setup lang="ts">
import { computed } from 'vue';
import { PTextInput } from '@cloudforet-test/mirinae';

// Register components
const components = {
  PTextInput
};

interface IProps {
  title: string;
  modelValue: string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  readonly?: boolean;
  onBlur?: () => void;
}

const props = withDefaults(defineProps<IProps>(), {
  size: 'md',
  invalid: false,
  readonly: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// Two-way binding using computed
const inputValue = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit('update:modelValue', value);
  }
});

const handleInput = (value: string) => {
  emit('update:modelValue', value);
};

const handleInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  handleInput(target.value);
};

const handleBlur = () => {
  if (props.onBlur) {
    props.onBlur();
  }
};
</script>

<template>
  <div class="field-group">
    <div class="field-title-box">
      {{ title }}
    </div>
    <div class="field-content-box">
      <!-- Debug: inspect the passed-in values -->
      <div style="font-size: 10px; color: red; margin-bottom: 4px;">
        DEBUG: modelValue = "{{ modelValue }}", size = {{ size }}, invalid = {{ invalid }}
      </div>
      <!-- Use a plain input instead of p-text-input -->
      <input
        v-model="inputValue"
        :class="['text-input', { 'invalid': invalid }]"
        :readonly="readonly"
        @blur="handleBlur"
        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
      />
    </div>
  </div>
</template>

<style scoped lang="postcss">
.field-group {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid;
  @apply border-gray-200;
  
  .field-title-box {
    display: flex;
    align-items: center;
    width: 200px;
    height: 44px;
    font-size: 14px;
    font-weight: 700;
    padding: 6px 16px;
    flex-shrink: 0;
  }

  .field-content-box {
    display: flex;
    align-items: center;
    flex: 1;
    min-height: 44px;
    padding: 6px 16px;
  }
}
</style>
