import { MENU_ID } from '@/entities';
import type { ProgressFacts } from './useMigrationProgress';

/**
 * The five steps of a migration, in the one place that defines them.
 *
 * The guide screen used to hold its own list and the progress rules were written
 * separately, so the two could disagree about what "step 3" meant. Everything that
 * names a step - the guide screen, the progress read-out, the empty-screen hints -
 * reads this.
 *
 * Collecting is a step of its own rather than part of making a source model. It is
 * the place people most often stop: the servers are registered but nothing has been
 * read from them yet, and a model cannot be made until it has. Telling that person
 * to "create a source model" asks for something they cannot do.
 *
 * Creating a workflow and running it are one step. They happen on the same screen,
 * one after the other, and nobody gets stranded between them.
 *
 * ## Where a step sends you
 *
 * To the screen where the work is *done*, which is not the screen the result is listed on.
 * Each screen in this console produces the next thing along: a source model is made on
 * Source Services, a target model is produced on Source Models, a workflow is built on
 * Target Models. The help panel already says as much, screen by screen.
 *
 * Sending someone to the list named after the thing they are trying to create drops them
 * on an empty page with no way to fill it - the exact confusion this is meant to remove.
 */

export type GuidedStepId =
  | 'source-service'
  | 'collect'
  | 'source-model'
  | 'target-model'
  | 'workflow';

export interface GuidedStep {
  no: number;
  id: GuidedStepId;
  /** The name of the step as it stands, when a fixed name would be the wrong one. */
  title: string;
  /**
   * What is left of this step, named for what remains.
   *
   * A step can be part-done, and naming it by the whole leaves the reader looking for
   * something they have already made. With a source service registered but no server
   * under it, "Register Source Service" reads as done and the eye slides past what is
   * actually missing - the connection. Falls back to the fixed name.
   */
  titleFor?: (facts: ProgressFacts) => string;
  /** One entry per sentence: each starts on its own line and still wraps on narrow screens. */
  detail: string[];
  routeName: string;
  testId: string;
  /**
   * What to say to someone who has got exactly this far - where they stand and what
   * to do next. Shown only on the step they are on.
   *
   * Takes the counts because a step can be unfinished for more than one reason, and a
   * sentence written for one of them is wrong for the other. Step 1 said "nothing is
   * registered yet" to someone looking at the source service they had just registered -
   * what they were missing was a connection under it.
   */
  standing: (facts: ProgressFacts) => string;
  /**
   * What finishes *this* step, said as something the reader does.
   *
   * Written down because the reader could not see it - a source group on its own left the
   * step unfinished with nothing on screen saying why. Said in their words, not the
   * check's: "a source service exists and has at least one connection" describes a
   * condition being tested; what they did was register a service and a connection.
   *
   * Takes the counts so that the reason a part is required can wait until the reader is
   * standing in front of that part. Explaining why a connection is needed to someone who
   * has registered nothing is answering a question they have not asked yet.
   */
  completion: (facts: ProgressFacts) => string;
  /** The same condition counted against what is actually there, so the two sit together. */
  progress: (facts: ProgressFacts) => string;
  /** A written guide that goes deeper than this step's one line, when one exists. */
  guide?: { title: string; file: string };
}

/** "1 connection" reads better than "1 connections", and the count is always in view. */
function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export const GUIDED_STEPS: GuidedStep[] = [
  {
    no: 1,
    id: 'source-service',
    title: 'Register Source Service',
    titleFor: f =>
      f.sourceServices === 0
        ? 'Register Source Service'
        : 'Register Source Connection',
    detail: [
      'Register the servers you want to migrate.',
      'Each connection is one source server, reached over SSH.',
    ],
    standing: f =>
      f.sourceServices === 0
        ? 'Nothing is registered yet. Start by adding a source service.'
        : 'The source service is registered, but it has no connection yet. Open it and add at least one.',
    completion: f =>
      f.sourceServices > 0 && f.connections === 0
        ? 'This step is complete once you have registered a source service and at least one connection under it. With the source service alone there is nothing for the collection to reach.'
        : 'This step is complete once you have registered a source service and at least one connection under it.',
    progress: f =>
      `${plural(f.sourceServices, 'source service')}, ${plural(f.connections, 'connection')}`,
    routeName: MENU_ID.SOURCE_SERVICES,
    testId: 'migration-guide-step-source-service',
    guide: {
      title: 'Bulk import of source connections',
      file: 'source-connection-bulk-import.md',
    },
  },
  {
    no: 2,
    id: 'collect',
    title: 'Collect',
    detail: [
      'Collect the source information for the migration you intend to run.',
      'On the Source Services screen, select a registered source and run the collection that matches it: infrastructure, software, and so on.',
    ],
    standing: () =>
      'The servers are registered but nothing has been collected from them yet. On the Source Services screen, select the source and run the collection for the migration you want, whether infrastructure or software. What is collected is what the migration is built from.',
    completion: () =>
      'This step is complete once you have run a collection against at least one registered server. Which collection to run depends on what you are migrating. The help on the Source Services screen goes through each one.',
    progress: f => (f.collected ? 'collected' : 'nothing collected yet'),
    routeName: MENU_ID.SOURCE_SERVICES,
    testId: 'migration-guide-step-collect',
  },
  {
    no: 3,
    id: 'source-model',
    title: 'Create Source Model',
    detail: [
      'Save what was collected as a source model, on the Source Services screen.',
      'Everything after this is built from that model.',
    ],
    standing: () =>
      'Collecting is done. Save the result as a source model on the Source Services screen. Everything after this is built from it.',
    completion: () =>
      'This step is complete once you have saved at least one source model.',
    progress: f => plural(f.sourceModels, 'source model'),
    routeName: MENU_ID.SOURCE_SERVICES,
    testId: 'migration-guide-step-source-model',
  },
  {
    no: 4,
    id: 'target-model',
    title: 'Create Target Model',
    detail: [
      'A target model is generated from a source model, on the Source Models screen.',
      'Adjust the values you want and save it as a custom model.',
    ],
    standing: () =>
      'There is a source model to work from. Open it on the Source Models screen, generate a target model from it, and adjust the values you want.',
    completion: () =>
      'This step is complete once you have saved at least one target model.',
    progress: f => plural(f.targetModels, 'target model'),
    routeName: MENU_ID.SOURCE_MODELS,
    testId: 'migration-guide-step-target-model',
  },
  {
    no: 5,
    id: 'workflow',
    title: 'Create and Run Workflow',
    detail: [
      'Create the migration workflow from a target model, on the Target Models screen.',
      'Change any value it still needs, then run it. The migration happens here.',
    ],
    standing: f =>
      f.workflows === 0
        ? 'The target model is ready. Build the workflow from it on the Target Models screen, change any value it still needs, and run it.'
        : 'The workflow is built but has not been run. Open it and run it. The migration happens there.',
    completion: () =>
      'This step is complete once you have created a workflow and run it at least once.',
    progress: f =>
      `${plural(f.workflows, 'workflow')}, ${f.runs ? 'run at least once' : 'not run yet'}`,
    routeName: MENU_ID.TARGET_MODELS,
    testId: 'migration-guide-step-run-workflow',
    guide: {
      title: 'Reading the run status screen',
      file: 'workflow-run-status.md',
    },
  },
];

/** The guides live with the source, so they move with it and cannot drift into a stale copy. */
const GUIDE_BASE =
  'https://github.com/cloud-barista/cm-butterfly/blob/main/docs/guide/';

/** The name to show for a step right now. One place, so every screen shows the same one. */
export function stepTitle(step: GuidedStep, facts: ProgressFacts): string {
  return step.titleFor ? step.titleFor(facts) : step.title;
}

export function guideUrlFor(file: string): string {
  return GUIDE_BASE + file;
}
