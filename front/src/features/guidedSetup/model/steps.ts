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
  title: string;
  /** One entry per sentence: each starts on its own line and still wraps on narrow screens. */
  detail: string[];
  routeName: string;
  testId: string;
  /**
   * What to say to someone who has got exactly this far - where they stand and what
   * to do next. Shown only on the step they are on.
   */
  standing: string;
  /**
   * What has to be true for this step to be behind you.
   *
   * Written down because the reader could not see it. A source group on its own left the
   * step unfinished with nothing on screen saying why, which reads as the guidance being
   * broken rather than as work still to do.
   */
  completion: string;
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
    detail: [
      'Register the servers you want to migrate.',
      'Each connection is one source server, reached over SSH.',
    ],
    standing:
      'Nothing is registered yet. Add a source service and put the servers you want to migrate under it.',
    completion:
      'Done when a source service exists and has at least one connection. A service with no connection has nothing to collect from.',
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
      'Read what is actually on the servers you registered.',
      'Collecting happens on the Source Services screen.',
    ],
    standing:
      'The servers are registered but nothing has been read from them yet. Run Collect on the Source Services screen.',
    completion:
      'Done when infrastructure has been collected from at least one registered server.',
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
    standing:
      'Collecting is done. Save the result as a source model on the Source Services screen - everything after this is built from it.',
    completion: 'Done when at least one source model is saved.',
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
    standing:
      'There is a source model to work from. Open it on the Source Models screen, generate a target model from it, and adjust the values you want.',
    completion: 'Done when at least one target model is saved.',
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
      'Change any value it still needs, then run it - the migration happens here.',
    ],
    standing:
      'The target model is ready. Build the workflow from it on the Target Models screen, change any value it still needs, and run it.',
    completion: 'Done when a workflow exists and has been run at least once.',
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

export function guideUrlFor(file: string): string {
  return GUIDE_BASE + file;
}
