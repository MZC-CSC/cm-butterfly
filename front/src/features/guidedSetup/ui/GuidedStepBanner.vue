<script setup lang="ts">
/**
 * The guidance, said on the screen where the work happens.
 *
 * The guide screen knows which step you are on, but only while you are looking at it.
 * Press "Go to step" and the thread is dropped: you arrive at a list that says nothing
 * about why you came. This is that thread, picked up on arrival.
 *
 * It appears only when *this* screen is the current step. A screen you are ahead of, or
 * have not reached, says nothing - the same rule the guide uses, from the same source, so
 * the two can never disagree.
 *
 * That also makes it self-clearing: register a source service and the step moves on, so
 * the strip goes with it. Nothing to dismiss, nothing to remember.
 *
 * Plain markup on purpose (DESIGN-MIRINAE "inventory").
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router/composables';
import { GUIDED_STEPS, type GuidedStepId } from '../model/steps';
import {
  refreshProgress,
  currentGuidedStep,
  progressKnown,
  progressFacts,
} from '../model/useMigrationProgress';
import { guidanceOff } from '../model/guidedSetupPreferences';
import { MENU_ID } from '@/entities';

const props = defineProps<{
  /** Which step this screen is. More than one screen can carry the same step. */
  step: GuidedStepId;
}>();

const router = useRouter();

/*
  Worked out afresh every time this screen is opened, not once per session.

  The whole point is that it moves: register a source service and the step is no longer
  the one it was a moment ago. Holding the first answer would leave the strip telling
  someone to do what they have just done.
*/
onMounted(async () => {
  await refreshProgress().catch(() => undefined);
});

const step = computed(() => GUIDED_STEPS.find(s => s.id === props.step) ?? null);

const show = computed(
  () =>
    !guidanceOff.value &&
    progressKnown.value &&
    currentGuidedStep.value?.id === props.step,
);

function openGuide() {
  router.push({ name: MENU_ID.MIGRATION_GUIDE }).catch(() => undefined);
}
</script>

<template>
  <div
    v-if="show && step"
    class="mb-3 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3"
    data-testid="guided-step-banner"
    :data-step-id="step.id"
  >
    <span
      class="mt-0.5 shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white"
      data-testid="guided-step-banner-badge"
    >
      Step {{ step.no }} of {{ GUIDED_STEPS.length }}
    </span>

    <span class="flex-1 text-sm text-blue-900" data-testid="guided-step-banner-text">
      {{ step.standing(progressFacts) }}
    </span>

    <button
      type="button"
      class="shrink-0 text-sm text-blue-700 underline hover:text-blue-900"
      data-testid="guided-step-banner-guide"
      @click="openGuide"
    >
      Open the guide
    </button>
  </div>
</template>

<style scoped lang="postcss"></style>
