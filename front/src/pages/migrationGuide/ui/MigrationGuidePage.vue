<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router/composables';
import { MENU_ID } from '@/entities';

/**
 * Migration Guide — the in-console entry point for "how do I actually migrate?".
 *
 * This screen is deliberately a *map*, not a manual. It lays out the five steps of a
 * migration in order and sends the user to the screen where each step happens, so a
 * first-time user is never left guessing which menu to open next.
 *
 * The written guide lives in `docs/guide/quick-start-migration.md` and stays the single
 * source of truth; this page links out to it rather than restating it, so the two cannot
 * drift apart.
 *
 * Built with plain markup on purpose — new screens should not widen the mirinae surface
 * (see DESIGN-MIRINAE "inventory": do not pull mirinae into new screens).
 */

type Step = {
  no: number;
  title: string;
  detail: string;
  routeName: string;
  testId: string;
};

const steps: Step[] = [
  {
    no: 1,
    title: 'Register Source Service',
    detail:
      'Register the servers you want to migrate. Each connection is one source server, and the collection agent is installed when you add it.',
    routeName: MENU_ID.SOURCE_SERVICES,
    testId: 'migration-guide-step-source-service',
  },
  {
    no: 2,
    title: 'Create Source Model',
    detail:
      'Collect what is running on those servers and save it as a source model — the inventory the rest of the flow is built on.',
    routeName: MENU_ID.SOURCE_MODELS,
    testId: 'migration-guide-step-source-model',
  },
  {
    no: 3,
    title: 'Create Target Model',
    detail:
      'Get a recommended cloud specification for that source model. Each candidate shows an estimated cost, so you can choose by cost.',
    routeName: MENU_ID.TARGET_MODELS,
    testId: 'migration-guide-step-target-model',
  },
  {
    no: 4,
    title: 'Create Workflow',
    detail:
      'From the target model, generate the migration workflow. This is the entry point — workflows are created from a target model.',
    routeName: MENU_ID.WORKFLOWS,
    testId: 'migration-guide-step-create-workflow',
  },
  {
    no: 5,
    title: 'Edit and Run Workflow',
    detail:
      'Review the values carried over from the target model, adjust what you need, then run it. The migration actually happens here.',
    routeName: MENU_ID.WORKFLOWS,
    testId: 'migration-guide-step-run-workflow',
  },
];

const route = useRoute();

/**
 * Highlight the step matching the screen the user came from, so the guide doubles as a
 * "where am I in the migration?" indicator rather than a static list.
 */
const activeRouteName = computed(() => String(route.query.from ?? ''));

function isActive(step: Step): boolean {
  return (
    activeRouteName.value !== '' && activeRouteName.value === step.routeName
  );
}

const guideUrl =
  'https://github.com/cloud-barista/cm-butterfly/blob/main/docs/guide/quick-start-migration.md';
</script>

<template>
  <div class="p-6" data-testid="migration-guide-page">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Migration Guide</h1>
      <p class="mt-2 text-sm text-gray-600">
        A migration runs through the five steps below, in order. Select a step
        to open the screen where it happens.
      </p>
    </header>

    <ol class="flex flex-col gap-3" data-testid="migration-guide-steps">
      <li v-for="(step, index) in steps" :key="step.no" class="flex flex-col">
        <router-link
          :to="{ name: step.routeName }"
          :data-testid="step.testId"
          class="group flex items-start gap-4 rounded-lg border p-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
          :class="
            isActive(step)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white'
          "
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="
              isActive(step)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            "
          >
            {{ step.no }}
          </span>
          <span class="flex flex-1 flex-col">
            <span class="text-base font-medium text-gray-900">{{
              step.title
            }}</span>
            <span class="mt-1 text-sm text-gray-600">{{ step.detail }}</span>
          </span>
          <span
            class="self-center text-lg text-gray-300 transition-colors group-hover:text-blue-500"
            aria-hidden="true"
            >&rsaquo;</span
          >
        </router-link>

        <span
          v-if="index < steps.length - 1"
          class="my-1 ml-8 h-4 w-0.5 self-start bg-gray-300"
          aria-hidden="true"
        />
      </li>
    </ol>

    <footer class="mt-6 text-sm text-gray-600">
      <span>
        Looking for the full walkthrough, including software migration and load
        testing?
      </span>
      <a
        :href="guideUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-600 underline"
        data-testid="migration-guide-full-doc"
        >Read the Quick Start guide</a
      >
    </footer>
  </div>
</template>

<style scoped lang="postcss"></style>
