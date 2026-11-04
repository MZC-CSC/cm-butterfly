<script setup lang="ts">
import { PTooltip } from '@cloudforet-test/mirinae';

/**
 * Wraps a control that may be disabled and shows why on hover.
 *
 * mirinae's PTooltip (v-tooltip) keeps the content it had when first rendered: bound while
 * the reason was still empty it never shows, even after the reason is filled in. So the
 * tooltip is rendered only when there is a reason, and re-rendered when the reason changes.
 * The reason is also exposed as data-disabled-reason for tests.
 *
 * mirinae sets white-space: pre on the tooltip, so a long reason runs off the screen on one
 * line. The extra class wraps it. options is merged with lodash merge, which merges arrays by
 * index, so p-tooltip must be repeated or the base styles are lost.
 */
const tooltipOptions = { classes: ['p-tooltip', 'disabled-reason-tooltip'] };
interface IProps {
  reason?: string;
  position?: string;
  testid?: string;
}
withDefaults(defineProps<IProps>(), {
  reason: '',
  position: 'top',
  testid: undefined,
});
</script>

<template>
  <p-tooltip
    v-if="reason"
    :key="reason"
    :contents="reason"
    :position="position"
    :options="tooltipOptions"
  >
    <span
      class="disabled-reason"
      :data-disabled-reason="reason"
      :data-testid="testid"
    >
      <slot />
    </span>
  </p-tooltip>
  <span
    v-else
    class="disabled-reason"
    data-disabled-reason=""
    :data-testid="testid"
  >
    <slot />
  </span>
</template>

<style scoped lang="postcss">
.disabled-reason {
  display: inline-block;
}
</style>

<style lang="postcss">
/* The tooltip is appended to body, outside this component's scope. */
.p-tooltip.disabled-reason-tooltip .tooltip-inner {
  max-width: 420px;
  white-space: normal;
}
</style>
