<script setup lang="ts">
/**
 * The one thing said to someone opening this console for the first time.
 *
 * It is not a tour. A tour replays a fixed order and has to be got through; this is a
 * sentence explaining why the screen behind it is the guide, and then it is gone. The
 * guide behind it is the thing that does the work.
 *
 * Shown only when nothing at all has been done yet, only once, and never after the
 * reader has turned guidance off. Both buttons dismiss it for good - there is no
 * answer here that leaves it hanging around.
 *
 * Plain markup on purpose: new screens should not widen the mirinae surface
 * (DESIGN-MIRINAE "inventory").
 */
import { GUIDED_STEPS } from '../model/steps';

/**
 * Two buttons that do two different things. `Start` takes you to the first step's screen;
 * `Just looking` leaves you on the guide to read it. If both merely closed the dialog they
 * would be the same button twice, and the reader would be left asking what "start" meant.
 */
const emit = defineEmits<{ (e: 'start'): void; (e: 'dismiss'): void }>();
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    data-testid="guided-setup-welcome"
  >
    <div
      class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-setup-welcome-title"
    >
      <h2
        id="guided-setup-welcome-title"
        class="text-lg font-semibold text-gray-900"
      >
        Welcome
      </h2>

      <p class="mt-3 text-sm text-gray-700">
        A migration runs through five steps, in order. Nothing has been done here
        yet, so the first one is where to begin.
      </p>

      <ol
        class="mt-4 flex flex-col gap-1 text-sm text-gray-600"
        data-testid="guided-setup-welcome-steps"
      >
        <li v-for="step in GUIDED_STEPS" :key="step.no" class="flex gap-2">
          <span class="w-4 shrink-0 text-right text-gray-400"
            >{{ step.no }}.</span
          >
          <span>{{ step.title }}</span>
        </li>
      </ol>

      <p class="mt-4 text-sm text-gray-700">
        Selecting <strong>Start</strong> opens the first step. To see how far you
        have got at any time, open <strong>Migration Guide</strong> from the menu
        on the left - this page always shows which step you are on.
      </p>

      <div class="mt-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          data-testid="guided-setup-welcome-dismiss"
          @click="emit('dismiss')"
        >
          Just looking
        </button>
        <button
          type="button"
          class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          data-testid="guided-setup-welcome-start"
          @click="emit('start')"
        >
          Start
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="postcss"></style>
