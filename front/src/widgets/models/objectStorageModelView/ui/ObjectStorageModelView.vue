<script setup lang="ts">
import { PButtonModal } from '@cloudforet-test/mirinae';
import { computed } from 'vue';

/**
 * Shows an object storage model as cm-beetle keeps it. These models are not edited as
 * JSON here: the source model comes from collection and the target model from the
 * recommendation, where the target bucket names and versioning are adjusted.
 */
interface IProps {
  model: any;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal']);

const json = computed(() =>
  JSON.stringify(props.model?.objectStorage ?? {}, null, 2),
);
</script>

<template>
  <p-button-modal
    :visible="true"
    :header-title="`View Model: ${model?.userModelName ?? ''}`"
    size="lg"
    hide-footer-close-button
    @confirm="emit('update:close-modal', false)"
    @close="emit('update:close-modal', false)"
  >
    <template #body>
      <pre class="json" data-testid="os-model-view-json">{{ json }}</pre>
    </template>
    <template #confirm-button>
      <span data-testid="os-model-view-close">OK</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.json {
  max-height: 32rem;
  overflow: auto;
  padding: 0.75rem;
  font-size: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
}
</style>
