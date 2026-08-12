<script setup lang="ts">
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
 *
 * ## The map now says where you are
 *
 * The highlight used to be driven by a `?from=` query that nothing ever set, so it never
 * lit up. It now comes from the data: which steps have actually been done decides which
 * one is current, and the reader is told where they stand without having had to arrive
 * from anywhere in particular. See `useMigrationProgress`.
 *
 * Three states rather than two — done, current, not yet. "You are here" on its own
 * leaves out how far along here is.
 *
 * The steps themselves are no longer written here; they come from one definition shared
 * with everything else that names a step.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router/composables';
import {
  GUIDED_STEPS,
  guideUrlFor,
  stepTitle,
  refreshProgress,
  currentStep,
  progressKnown,
  progressFacts,
  isFinished,
  guidanceOff,
  setGuidanceOff,
  welcomeSeen,
  markWelcomeSeen,
  GuidedSetupWelcome,
  type GuidedStep,
} from '@/features/guidedSetup';
import { requestHelpPanel } from '@/widgets/layout/helpPanel';

const router = useRouter();
const steps = GUIDED_STEPS;

/** Nothing is said until the answer is known — a failed check says nothing at all. */
const guidanceOn = computed(() => progressKnown.value && !guidanceOff.value);

type StepState = 'done' | 'current' | 'upcoming';

function stateOf(step: GuidedStep): StepState {
  if (!guidanceOn.value) return 'upcoming';
  if (isFinished.value) return 'done';
  const at = currentStep.value as number;
  if (step.no < at) return 'done';
  if (step.no === at) return 'current';
  return 'upcoming';
}

/*
  Said in words as well as shown in colour. A border alone disappears in a monochrome
  print-out and for a reader who cannot separate the two colours.
*/
const STATE_LABEL: Record<StepState, string> = {
  done: 'Done',
  current: 'You are here',
  upcoming: 'Not yet',
};

const showWelcome = ref(false);

/** The counts the step rules were applied to, shown beside the condition they answer. */
const facts = computed(() => progressFacts.value);

onMounted(async () => {
  await refreshProgress();
  showWelcome.value =
    guidanceOn.value && currentStep.value === 1 && !welcomeSeen.value;
});

/* Both answers spend the welcome - it is not asked twice. They differ in where they
   leave you: Start at the first step's screen, Just looking here on the guide. */
function dismissWelcome() {
  showWelcome.value = false;
  markWelcomeSeen();
}

function startFromWelcome() {
  dismissWelcome();
  const first = steps[0];
  if (first) router.push({ name: first.routeName }).catch(() => undefined);
}

/** Open the help for the screen this step happens on, rather than for this one. */
function showHelpFor(step: GuidedStep) {
  router.push({ name: step.routeName }).catch(() => undefined);
  requestHelpPanel();
}

function goToStep(step: GuidedStep) {
  router.push({ name: step.routeName }).catch(() => undefined);
}

const guideUrl = guideUrlFor('quick-start-migration.md');
</script>

<template>
  <div class="max-w-3xl p-6" data-testid="migration-guide-page">
    <guided-setup-welcome
      v-if="showWelcome"
      @start="startFromWelcome"
      @dismiss="dismissWelcome"
    />

    <header class="mb-6">
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-2xl font-semibold text-gray-900">Migration Guide</h1>

        <!--
          Where you are and how to stop being told, in the same place. It lives on this
          screen rather than floating over every screen: a permanent badge competes with
          the notification toast for the same corner and keeps talking to someone who
          finished months ago.
        -->
        <div
          class="flex shrink-0 items-center gap-3 text-sm"
          data-testid="guided-setup-status"
        >
          <span
            v-if="guidanceOn && !isFinished"
            class="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700"
            data-testid="guided-setup-step-indicator"
          >
            Step {{ currentStep }} of {{ steps.length }}
          </span>
          <span
            v-else-if="guidanceOn && isFinished"
            class="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700"
            data-testid="guided-setup-finished"
          >
            All steps done
          </span>

          <button
            v-if="!guidanceOff"
            type="button"
            class="text-gray-500 underline hover:text-gray-700"
            data-testid="guided-setup-turn-off"
            @click="setGuidanceOff(true)"
          >
            Turn off guidance
          </button>
          <button
            v-else
            type="button"
            class="text-blue-600 underline hover:text-blue-700"
            data-testid="guided-setup-turn-on"
            @click="setGuidanceOff(false)"
          >
            Turn on guidance
          </button>
        </div>
      </div>

      <p class="mt-2 text-sm text-gray-600">
        A migration runs through the five steps below, in order. Select a step to
        open the screen where it happens. The help icon at the top right shows
        help for whichever screen you are on.
      </p>
    </header>

    <ol class="flex flex-col" data-testid="migration-guide-steps">
      <li v-for="(step, index) in steps" :key="step.no" class="flex flex-col">
        <router-link
          :to="{ name: step.routeName }"
          :data-testid="step.testId"
          :data-step-state="stateOf(step)"
          :aria-current="stateOf(step) === 'current' ? 'step' : undefined"
          class="group flex items-start gap-4 rounded-lg border p-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
          :class="{
            'border-blue-500 border-l-4 bg-blue-50 ring-2 ring-blue-200':
              stateOf(step) === 'current',
            'border-gray-200 bg-white': stateOf(step) === 'done',
            'border-gray-200 bg-white opacity-70': stateOf(step) === 'upcoming',
          }"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="{
              'bg-blue-500 text-white': stateOf(step) === 'current',
              'bg-green-100 text-green-700': stateOf(step) === 'done',
              'bg-gray-100 text-gray-500': stateOf(step) === 'upcoming',
            }"
          >
            <!--
              The badge carries the state as a shape, not only as a colour: a tick for
              what is behind you, an arrow for where you are, the plain number for what
              has not come yet. A pointing hand was considered and rejected - it reads
              as clip art and its direction is not read the same way everywhere.
            -->
            <span v-if="stateOf(step) === 'done'" aria-hidden="true"
              >&check;</span
            >
            <span
              v-else-if="stateOf(step) === 'current'"
              class="text-base leading-none"
              aria-hidden="true"
              >&#9654;</span
            >
            <span v-else>{{ step.no }}</span>
          </span>

          <span class="flex flex-1 flex-col">
            <span class="flex items-center gap-2">
              <span class="text-base font-medium text-gray-900">{{
                stepTitle(step, facts)
              }}</span>
              <!-- The state in words, so colour is never the only carrier. -->
              <span
                v-if="guidanceOn"
                class="rounded px-1.5 py-0.5 text-xs"
                :class="{
                  'bg-blue-600 font-semibold uppercase tracking-wide text-white':
                    stateOf(step) === 'current',
                  'bg-green-50 text-green-700': stateOf(step) === 'done',
                  'text-gray-500': stateOf(step) === 'upcoming',
                }"
                :data-testid="`${step.testId}-state`"
                >{{ STATE_LABEL[stateOf(step)] }}</span
              >
            </span>

            <span class="mt-1 text-sm text-gray-600">
              <span v-for="(line, l) in step.detail" :key="l" class="block">{{
                line
              }}</span>
            </span>

            <!--
              Only the step you are on says what to do. On every other step it would be
              advice about a moment that has passed or has not arrived.
            -->
            <span
              v-if="stateOf(step) === 'current'"
              class="mt-3 block rounded bg-white/70 p-3 text-sm text-gray-800"
              :data-testid="`${step.testId}-standing`"
              >{{ step.standing(facts) }}</span
            >

            <!--
              What finishes this step, and how far it is met. A step that stays put after
              you have registered something reads as broken until it says what it is still
              waiting for - a source group with no connection was exactly that case.
            -->
            <span
              v-if="stateOf(step) === 'current'"
              class="mt-2 block text-xs text-gray-600"
              :data-testid="`${step.testId}-completion`"
              >{{ step.completion }}</span
            >
            <span
              v-if="stateOf(step) === 'current'"
              class="mt-1 block text-xs font-semibold text-gray-700"
              :data-testid="`${step.testId}-progress`"
              >So far: {{ step.progress(facts) }}</span
            >
          </span>

          <span
            class="self-center text-lg text-gray-300 transition-colors group-hover:text-blue-500"
            aria-hidden="true"
            >&rsaquo;</span
          >
        </router-link>

        <!--
          The two things to do next, kept outside the card. The card is a link, and a
          button inside a link is not valid markup - the inner one stops working.
        -->
        <div
          v-if="stateOf(step) === 'current'"
          class="ml-8 mt-2 flex flex-wrap items-center gap-2"
          :data-testid="`${step.testId}-actions`"
        >
          <button
            type="button"
            class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            :data-testid="`${step.testId}-show-help`"
            @click="showHelpFor(step)"
          >
            Show help
          </button>
          <button
            type="button"
            class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            :data-testid="`${step.testId}-go`"
            @click="goToStep(step)"
          >
            Go to step
          </button>
        </div>

        <!--
          The run between two steps. The line sits under the middle of the number
          badge (badge 2rem wide, inside 1rem of card padding, so its centre is at
          2rem) and carries the guide link beside it, which keeps the column of
          numbers, the line and the links on one axis - the eye then reads the
          steps as a sequence rather than as five separate boxes.

          It sits outside the step because the step itself is a link, and a link
          inside a link does not work.
        -->
        <div class="flex items-center gap-3" :class="step.guide ? 'py-1' : ''">
          <span
            class="ml-8 h-6 w-px shrink-0"
            :class="index < steps.length - 1 ? 'bg-gray-300' : 'bg-transparent'"
            aria-hidden="true"
          />
          <!--
            Say it is a document before it is clicked. On its own the title read
            as a caption, and you only learned it was a link by pressing it.
          -->
          <a
            v-if="step.guide"
            :href="guideUrlFor(step.guide.file)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-blue-600"
            :data-testid="`${step.testId}-guide`"
          >
            <svg
              class="h-3 w-3 shrink-0"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
              />
            </svg>
            <span class="underline">Guide: {{ step.guide.title }}</span>
            <span class="text-gray-400">&#8599;</span>
          </a>
        </div>
      </li>
    </ol>

    <!--
      The boxes give the order; this says what the order is made of. Someone
      arriving here does not yet know what a model is or why there are two of
      them, and that is the question the steps alone leave open.
    -->
    <section class="mt-8 flex flex-col gap-3 text-sm text-gray-700">
      <h2 class="text-base font-semibold text-gray-900">
        What the steps are made of
      </h2>
      <p>
        A migration moves a workload from the servers you have to somewhere
        else, usually a cloud. It does that through models - a machine or its
        software written in the shape this system works with.
      </p>
      <p>
        A <strong>source model</strong> describes the origin: the servers you
        are migrating from. A <strong>target model</strong> describes the same
        workload for the destination. Both are models; they differ only in which
        side they describe. Change either one's values and save it under a new
        name and you have a <strong>custom model</strong>, with the original
        left as it was.
      </p>
      <p>
        A <strong>workflow</strong> is generated from a target model and is what
        actually carries the migration out. It is also the last place values can
        be changed before anything is created, which is why adjusting there is
        often easiest - the target model is already in the destination's shape,
        and the workflow is the final word.
      </p>
      <p>
        Target models and workflows can be exported to a file and imported back,
        so one that works can be kept and reused like a template.
      </p>
      <p>
        Infrastructure and software follow the same five steps. Infrastructure
        recommendations come with an estimated cost to choose by; software
        recommendations come with a list of what to install, and expect the
        infrastructure to exist already.
      </p>
    </section>

    <footer class="mt-6 text-sm text-gray-600">
      <span>
        Looking for the full walkthrough, including software migration and load
        testing?
      </span>
      <a
        :href="guideUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-blue-600"
        data-testid="migration-guide-full-doc"
      >
        <svg class="h-3 w-3 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
          />
        </svg>
        <span class="underline">Guide: Quick start</span>
        <span class="text-gray-400">&#8599;</span>
      </a>
    </footer>
  </div>
</template>

<style scoped lang="postcss"></style>
