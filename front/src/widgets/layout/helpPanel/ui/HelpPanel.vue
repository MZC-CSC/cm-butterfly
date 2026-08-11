<script setup lang="ts">
/**
 * Help for the screen you are on.
 *
 * It lies over the page rather than pushing it aside, so the screen keeps its
 * width while the help is open and you can work with it beside you. The edge can
 * be dragged to widen it, and that width is remembered.
 *
 * The text here is a short orientation. The written guides stay in the
 * repository as the single source, and each entry links to its own.
 */
import { computed, ref, watch, onBeforeUnmount, getCurrentInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router/composables';
import { DOC_LINKS, openDocLink } from '@/shared/constants/docLinks';
import { isJsonEditorOpen } from '@/shared/ui/EnhancedJsonEditor/editorPresence';
import { helpPanelOpenRequests } from '@/widgets/layout/helpPanel/model/helpPanelPresence';
import type { ProgressFacts } from '@/features/guidedSetup';
import {
  refreshProgress,
  currentGuidedStep,
  progressKnown,
  progressFacts,
  isFinished,
  guidanceOff,
} from '@/features/guidedSetup';
import { MENU_ID } from '@/entities';
import { GUIDED_STEPS, stepTitle } from '@/features/guidedSetup';

type Section = {
  heading: string;
  steps: string[];
  /** A guide that belongs to this way of doing it, rather than to the whole job. */
  guide?: { label: string; url: string };
  /**
   * Ways of carrying out one part of this procedure, folded inside it.
   *
   * Adding servers is one step of creating a service, but there are two ways to do it -
   * by hand and from a file - and each is a procedure of its own. Left flat they would
   * either bury the outer steps or be split off into a heading that no longer says which
   * moment it belongs to.
   */
  sub?: Array<{
    heading: string;
    steps: string[];
    guide?: { label: string; url: string };
  }>;
  /**
   * Open this one without being asked, when the reader is in the state it answers.
   *
   * Everything is folded by default so a screen's help is a list of choices rather than
   * a wall. But there is a state where the choice is already made: a service registered
   * with no server under it has exactly one thing left to do, and making the reader
   * hunt for the procedure that does it is the confusion this was built to remove.
   */
  openWhen?: (facts: ProgressFacts) => boolean;
};

/**
 * What this menu lets you do, as one job with its own explanation and the ways
 * of doing it underneath. A menu usually does more than one job, and reading
 * the ways without knowing which job they belong to is where it fell apart.
 */
type Group = {
  id: string;
  title: string;
  /** The guide for this job, offered where it is being read rather than only at the end. */
  guide?: { label: string; url: string };
  /** Why this job exists and what choices it offers, before the ways of doing it. */
  intro: string;
  sections: Section[];
};

/**
 * One button, column or field named on the screen, with what it is for.
 *
 * The procedures say what to do in order; this answers the other question - "what is this
 * column telling me", asked while looking at it rather than while following steps. Kept
 * apart from the procedures so neither buries the other, and folded away by default.
 */
type Reference = {
  /** Exactly as it reads on the screen. */
  item: string;
  kind: 'btn' | 'btn2' | 'field' | 'column' | 'tab';
  meaning: string;
};

type Help = {
  title: string;
  /** What this menu is for, before any of the steps. */
  paragraphs: string[];
  /** Buttons and columns on this screen, for the reader who is looking at one. */
  reference?: Reference[];
  /** The jobs this menu does. Listed at the top, each jumping to its part. */
  groups?: Group[];
  /** Terms someone new to the console will not know yet. Kept last on purpose. */
  terms?: Array<{ term: string; meaning: string }>;
  /** The written guides worth reading for this screen. */
  guides?: Array<{ label: string; url: string }>;
  /**
   * Help for the menu underneath, when something is open over it. Folded away by
   * default - it is background to what is in front of you, not the answer to it.
   */
  deferred?: { label: string; groups: Group[] };
};

/** The same words on every screen - defined once, shown at the end of each entry. */
const TERMS: Help['terms'] = [
  {
    term: 'Source service',
    meaning:
      'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. It is what everything on the first screen is registered into.',
  },
  {
    term: 'Connection',
    meaning:
      'One server, as it is registered here - the address and the login this system uses to reach it over SSH. A source service holds one connection per server, which is why the screen says Connections, Connection # and + Add Source Connection where you might expect it to say servers.',
  },
  {
    term: 'Model',
    meaning:
      'What a machine or its software actually is, written in the shape this system works with. Collecting reads the raw facts; a model is those facts turned into something the migration can act on.',
  },
  {
    term: 'Source model / target model',
    meaning:
      'Both are models - they differ in which side they describe. A source model describes the origin, the servers you are migrating from. A target model describes the same workload for the destination, usually a cloud. A workflow is built from a target model.',
  },
  {
    term: 'Custom model',
    meaning:
      'A model you have changed from what it originally held. Change either kind, give it a name of your own, and it is saved as a custom model - the original is not touched.',
  },
  {
    term: 'Workflow',
    meaning:
      'A workflow is an ordered set of tasks a machine carries out for you. Here it is the migration itself: each task does one part of it - create the infrastructure, install the software - in the order they have to happen. One is normally generated from a target model and then opened in the workflow editor, which starts from a template for the kind of migration you are doing, so the tasks are already laid out and what is left is to fill in or adjust what they need. The same workflow can be written and edited as JSON instead, whichever suits the change. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
  },
  {
    term: 'Where to make changes',
    meaning:
      'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
  },
];

/** Matched against the current path, longest match first. */
const HELP: Array<{ path: string; help: Help }> = [
  {
    path: '/main/migration-guide',
    help: {
      title: 'Migration Guide',
      paragraphs: [
        'A migration goes from the servers you have, through a model of them, to a workflow that creates the result.',
        'Infrastructure and software migration follow the same five steps. Where they differ - a cost estimate for infrastructure, an install target for software - the help on each screen says so.',
        'The words below are the ones the steps use.',
      ],
      terms: TERMS,
      guides: [
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
        {
          label: 'Bulk import of source connections',
          url: DOC_LINKS.sourceConnectionBulkImport,
        },
        {
          label: 'Running workflow tasks in parallel',
          url: DOC_LINKS.workflowParallelSteps,
        },
        {
          label: 'Reading the run status screen',
          url: DOC_LINKS.workflowRunStatus,
        },
      ],
    },
  },
  {
    path: '/main/source-computing/source-services',
    help: {
      title: 'Source Services',
      paragraphs: [
        'This menu does two things: you register the servers you are migrating from into a source service and manage them there, and you turn what is collected from them into a source model.',
        'One server is registered as one source connection, and that is the word this screen uses from here on - the Connections tab, the Connection # column and + Add Source Connection all refer to those.',
        'It is the first screen of a migration and the only one that reaches your machines directly, so everything later is built on what is registered and collected here.',
      ],
      reference: [
        {
          item: '+ Add',
          kind: 'btn',
          meaning:
            'Above the upper list it creates a source service; above the lower list it adds a source connection to the source service you have selected.',
        },
        {
          item: 'Refresh',
          kind: 'btn2',
          meaning:
            'Tries every source connection in the selected source service over SSH and checks its agent, then rewrites the status from what came back.',
        },
        {
          item: 'View Messages',
          kind: 'btn2',
          meaning:
            'One line per source connection - which of the connection and the agent succeeded, and the reason when either did not.',
        },
        {
          item: '+ Add / Edit',
          kind: 'btn',
          meaning:
            'On the Connections tab of a selected source service, opens the same form used when creating one, so source connections can be added or changed there.',
        },
        {
          item: '+ Add Source Connection',
          kind: 'btn',
          meaning:
            'Top left of the source connection form - one more blank entry, so several can be added before saving.',
        },
        {
          item: 'Save',
          kind: 'btn2',
          meaning: 'Bottom right of the source connection form. Stays off until the required fields, marked in red, are filled in.',
        },
        {
          item: 'Name',
          kind: 'column',
          meaning: 'The name you gave the source service. Selecting it opens its source connections below.',
        },
        {
          item: 'Connection #',
          kind: 'column',
          meaning:
            'How many source connections are registered under it. Zero means this source service cannot be collected from yet - that is the usual reason step 1 is not finished.',
        },
        {
          item: 'Status',
          kind: 'column',
          meaning:
            'The result of the last Refresh, taken over all its source connections. success - every one answered. failed - none did. partialSuccess - some did; the source service can still be used, but only the source connections that answered are collected from.',
        },
        {
          item: 'Description',
          kind: 'column',
          meaning: 'Whatever you wrote when creating it, as a note to yourself. Nothing depends on it.',
        },
      ],
      groups: [
        {
          id: 'manage-sources',
          guide: {
            label: 'Bulk import of source connections',
            url: DOC_LINKS.sourceConnectionBulkImport,
          },
          title: 'Managing the servers you migrate from',
          intro:
            'Creating the source service and registering its source connections happen in the same window, but they do not have to happen at once - create the source service on its own and add source connections when their details are ready. Source connections can be entered one at a time or brought in from an Excel or CSV file.',
          sections: [
            {
              heading: 'Create a source service',
              steps: [
                'Press [[btn:+ Add]] above the source service list. The Add Source Service window opens.',
                'Fill in [[field:Source Service Name]]. It is the only thing required - the button at the bottom right stays off until it has something in it.',
                '[[field:Description]] is optional and is only a note to yourself.',
                'To register the source connections later, press [[btn:Add]] at the bottom right now. Only the source service is created, and source connections can be added to it whenever their details are ready - see [[see:manage-sources#1|Add source connections to a source service that already exists]].',
                'To register source connections now, switch [[btn:With Source Connection]] on. Two ways then open up: entering each one in the form, or bringing them in from an Excel or CSV file. Both are below.',
              ],
              sub: [
                {
                  heading: 'Enter each source connection in the form',
                  steps: [
                    'Press [[btn2:Go add Source Connection]]. The form for one source connection opens.',
                    'Fill in the required fields, which are marked in red. They are the address and the login this system will use to reach that machine over SSH.',
                    'The login is either [[field:User]] with [[field:Password]], or [[field:User]] with [[field:Private Key]] - one of the two must be filled in. The private key is the whole key, including its BEGIN and END lines.',
                    'For another one, press [[btn:+ Add Source Connection]] at the top left and fill in the next. Repeat for as many as you have.',
                    'Press [[btn2:Save]] at the bottom right when they are all entered.',
                  ],
                },
                {
                  heading: 'Bring source connections in from an Excel or CSV file',
                  guide: {
                    label: 'Preparing the connection file',
                    url: DOC_LINKS.sourceConnectionBulkImport,
                  },
                  steps: [
                    'If you do not have a file yet, press [[btn2:Download Source Connection Template]]. That is the layout the import expects.',
                    'Fill it in, one row per source connection. Excel (.xlsx) and CSV both import, so use whichever is easier for you.',
                    'Press [[btn2:Import Source Connection]] and choose the file. The name of the file you picked is shown, so a wrong pick can be told from a failed read.',
                    'The rows that were read are listed with a count before anything is registered. Rows that cannot be registered as they stand are counted separately - correct those in the file and import again.',
                    'A source connection name has to be unique across every source service, not just within this one. A name already in use is the usual reason a row is refused.',
                  ],
                },
              ],
            },
            {
              heading: 'Add source connections to a source service that already exists',
              // Registered a service and stopped there: this is the one thing left.
              openWhen: f => f.sourceServices > 0 && f.connections === 0,
              steps: [
                'Select the source service in the list. Its source connections are shown underneath.',
                'Open the [[tab:Connections]] tab and press [[btn:+ Add / Edit]].',
                'From here it is the same form as when creating the source service - required fields in red, [[field:User]] with either [[field:Password]] or [[field:Private Key]], [[btn:+ Add Source Connection]] at the top left for another one, and [[btn2:Save]] at the bottom right.',
                'To change or remove a source connection, open it from the same list and edit or delete it there.',
                'A newly added source connection has no status until it is tried - press [[btn2:Refresh]] on the source service to check it can be reached.',
              ],
            },
            {
              heading: 'Check that the source connections can be reached',
              guide: {
                label: 'Checking that source servers can be reached',
                url: DOC_LINKS.sourceConnectionStatus,
              },
              steps: [
                'Press [[btn2:Refresh]] on the source service. Each source connection is tried over SSH and its agent is checked, and the result is shown as the status.',
                'success means every source connection answered. failed means none did. partialSuccess means some did and some did not - the source service can still be worked with, but only the source connections that answered will be collected from.',
                'Point at the status for a summary - with a couple of source connections it shows each one, and beyond that it counts how many answered.',
                'Select [[btn2:View Messages]], next to [[btn2:Refresh]], for every source connection on its own: whether the connection succeeded, whether the agent succeeded, and what came back when either failed.',
                'When one failed, read that message first - it usually names the cause. Then check the details you registered: address, SSH port, user, and the password or private key.',
                'Check that the machine is reachable from here at all - that it is running, and that its network and firewall allow SSH from this system.',
                'Once the cause is dealt with, press [[btn2:Refresh]] again. The status is read again, so it changes as soon as they answer.',
              ],
            },
          ],
        },
        {
          id: 'make-source-model',
          guide: { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
          title: 'Making a source model',
          intro:
            'Collecting reads what is actually on the servers; saving turns that into a source model the migration can work from. Two choices shape it - infrastructure or software, and a whole group or a single server. Collection reaches each server over SSH, so it has to be reachable at the time.',
          sections: [
            {
              heading: 'Choose what to collect',
              steps: [
                'Decide whether you are migrating infrastructure or software - the collection differs.',
                'Select a whole source service to cover every source connection in it, or a single source connection to cover one machine.',
              ],
            },
            {
              heading: 'Collect and save',
              guide: {
                label: 'Editing a model as JSON',
                url: DOC_LINKS.jsonEditor,
              },
              steps: [
                'Press Refresh first. It re-checks that each server can still be reached and updates Agent Status and Connection Status on the Detail tab.',
                'Run Collect Infra for machines, or Collect SW for the software on them.',
                'The result opens in the JSON editor. Check it, and for software press Convert.',
                'Save it as a source model. It then appears under Models.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },

        {
          label: 'Bulk import of source connections',
          url: DOC_LINKS.sourceConnectionBulkImport,
        },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/models/source-models',
    help: {
      title: 'Source Models',
      paragraphs: [
        'This menu does two things: you manage your source models, and you produce a target model from one of them.',
      ],
      groups: [
        {
          id: 'manage-source-models',
          guide: {
            label: 'Editing a model as JSON',
            url: DOC_LINKS.jsonEditor,
          },
          title: 'Managing source models',
          intro:
            'A source model describes the servers you are migrating from. If collection got something wrong, or you want to try a variation, change it here - saving under a new name gives you a custom copy and leaves the original alone.',
          sections: [
            {
              heading: 'Review and adjust',
              steps: [
                'Open Custom & View to see the model as JSON, and adjust anything the collection got wrong.',
                'Give it a name of your own and it is saved as a custom model, leaving the original as it was.',
                'Models can be renamed and removed here.',
              ],
            },
          ],
        },
        {
          id: 'make-target-model',
          guide: { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
          title: 'Producing a target model',
          intro:
            'This is where the origin turns into a destination. The two kinds part ways here: infrastructure gets candidate machines with a price to choose between, software gets a list of what to install and no price, since software is matched to what is there rather than to a machine.',
          sections: [
            {
              heading: 'Infrastructure',
              steps: [
                'Select an infrastructure source model and run Recommend Model.',
                'Each candidate shows an estimated monthly cost, so you can choose by cost.',
                'Choose one and save it as a target model.',
              ],
            },
            {
              heading: 'Software',
              steps: [
                'Select a software source model and run Recommend Model.',
                'Press Get Migration List. The recommended migration fills the panel on the right.',
                'Save it as a software target model.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/models/target-models',
    help: {
      title: 'Target Models',
      paragraphs: [
        'This menu does two things: you manage your target models, and you build a workflow from one of them.',
      ],
      groups: [
        {
          id: 'manage-target-models',
          guide: {
            label: 'Editing a model as JSON',
            url: DOC_LINKS.jsonEditor,
          },
          title: 'Managing target models',
          intro:
            'A target model describes the workload the way the destination expects it, which makes this a good place to adjust values. The list marks each one as Basic or Custom, and as a CloudModel or a SoftwareModel. A model can be exported and imported, so one that works can be kept and reused.',
          sections: [
            {
              heading: 'Adjust and save',
              steps: [
                'Open Custom & View to see the model as JSON.',
                'The table view edits values and adds or removes list entries; the tree and text views are the same document in another shape, where an array can be filtered or reshaped.',
                'Saving asks for a name and creates a custom model - the original is left as it was.',
              ],
            },
          ],
        },
        {
          id: 'make-workflow',
          guide: { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
          title: 'Building the workflow',
          intro:
            'The workflow is generated from the model, so its values are already in place. What differs is the order: a software migration installs onto infrastructure, so that infrastructure has to exist first.',
          sections: [
            {
              heading: 'Infrastructure',
              steps: [
                'Choose Make Workflow under Workflow Tool on the detail screen.',
                'The infra_migration task already carries the model values.',
              ],
            },
            {
              heading: 'Software',
              steps: [
                'Choose Make Workflow on a software target model.',
                'The run_software_migration task is filled in from the infrastructure you created - the install target namespace and infra are already set.',
                'That means the infrastructure migration should have run first.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/workflow-management/workflows',
    help: {
      title: 'Workflows',
      paragraphs: [
        'This menu is where you manage your workflows and run them. A workflow is the last thing you can change before anything is actually created.',
      ],
      groups: [
        {
          id: 'manage-workflows',
          guide: {
            label: 'Running workflow tasks in parallel',
            url: DOC_LINKS.workflowParallelSteps,
          },
          title: 'Managing workflows',
          intro:
            'Most workflows come from a target model, but one can also be built in the editor or copied from a workflow that already works. They can be exported and imported, so a good one can be kept and reused like a template.',
          sections: [
            {
              heading: 'Create, copy and check',
              guide: {
                label: 'Editing a model as JSON',
                url: DOC_LINKS.jsonEditor,
              },
              steps: [
                'Create one from a target model, build it in the editor, or copy an existing workflow and change its values.',
                'Select the migration task on the canvas. Task Configuration opens on the right with the values carried over from the target model - path and query parameters and the request body.',
                'Review them and edit anything that needs adjusting.',
                'Drag components from the Toolbox on the left to extend what the workflow does.',
                'Give the workflow a name and save it.',
              ],
            },
          ],
        },
        {
          id: 'run-workflows',
          guide: {
            label: 'Reading the run status screen',
            url: DOC_LINKS.workflowRunStatus,
          },
          title: 'Running and checking results',
          intro:
            'Running, watching and re-running all happen on one screen. A failed run does not have to be started over - you can pick up from where it broke.',
          sections: [
            {
              heading: 'Run and watch',
              steps: [
                'Saving takes you to the run view.',
                'The graph shows live progress and where a run failed.',
                'You can re-run one task, everything from a task onward, or only the tasks that failed.',
              ],
            },
            {
              heading: 'After a software migration',
              steps: [
                'Open the Run Status tab and select the run_software_migration task.',
                'Under Result, choose View installed software. It lists each piece of software with its version, install type, status, and the namespace, infra and node it landed on.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
        {
          label: 'Reading the run status screen',
          url: DOC_LINKS.workflowRunStatus,
        },
        {
          label: 'Running workflow tasks in parallel',
          url: DOC_LINKS.workflowParallelSteps,
        },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/workflow-management/workflow-templates',
    help: {
      title: 'Workflow Templates',
      paragraphs: [
        'A template is a workflow shape you can start from, so a migration you run often does not have to be assembled each time.',
      ],
      groups: [
        {
          id: 'use-templates',
          guide: {
            label: 'Running workflow tasks in parallel',
            url: DOC_LINKS.workflowParallelSteps,
          },
          title: 'Using templates',
          intro:
            'Templates hold the same content a workflow does, minus the values that belong to one particular run. Start from one and fill in what is specific to this migration.',
          sections: [
            {
              heading: 'Start from a template',
              guide: {
                label: 'Editing a model as JSON',
                url: DOC_LINKS.jsonEditor,
              },
              steps: [
                'Open a template to see the tasks it contains and how they are ordered.',
                'Create a workflow from it, then adjust the task values for this migration.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
        {
          label: 'Running workflow tasks in parallel',
          url: DOC_LINKS.workflowParallelSteps,
        },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/workflow-management/task-components',
    help: {
      title: 'Task Components',
      paragraphs: [
        'A task component is one step a workflow can take - collect something, create infrastructure, install software, wait.',
      ],
      groups: [
        {
          id: 'use-tasks',
          guide: {
            label: 'Running workflow tasks in parallel',
            url: DOC_LINKS.workflowParallelSteps,
          },
          title: 'Working with task components',
          intro:
            'Components are the pieces a workflow is assembled from. Looking at one shows what it needs and what it returns, which is what the workflow editor asks you to fill in.',
          sections: [
            {
              heading: 'Read a component',
              guide: {
                label: 'Editing a model as JSON',
                url: DOC_LINKS.jsonEditor,
              },
              steps: [
                'Open a component to see the values it takes and the result it produces.',
                'Its JSON can be viewed and edited the same way a model can.',
              ],
            },
            {
              heading: 'Use it in a workflow',
              steps: [
                'In the workflow editor, drag the component from the Toolbox onto the canvas.',
                'Components that do not depend on each other can sit side by side and run together.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [
        { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
        {
          label: 'Running workflow tasks in parallel',
          url: DOC_LINKS.workflowParallelSteps,
        },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/workflow-management',
    help: {
      title: 'Workflow Management',
      paragraphs: [
        'Where you manage workflows, the templates they can be built from, and the task components a workflow is made of.',
      ],
      groups: [
        {
          id: 'workflow-parts',
          title: 'What the parts are',
          intro:
            'A workflow is assembled from smaller pieces, and those pieces are managed here rather than inside a single workflow.',
          sections: [
            {
              heading: 'Tasks and templates',
              steps: [
                'A task component is one step a workflow can take; a template is a workflow shape you can start from.',
                'Tasks that do not depend on each other can be placed side by side to run together.',
              ],
            },
          ],
        },
      ],
      guides: [
        {
          label: 'Running workflow tasks in parallel',
          url: DOC_LINKS.workflowParallelSteps,
        },
        { label: 'Quick start', url: DOC_LINKS.quickStartMigration },
      ],
    },
  },
  {
    path: '/main/cloud-resources/cloud-credentials',
    help: {
      title: 'Cloud Credentials',
      paragraphs: [
        'The accounts this system uses to create things on a cloud. A migration cannot reach a destination without one.',
      ],
      groups: [
        {
          id: 'manage-credentials',
          title: 'Managing credentials',
          intro:
            'Each credential belongs to one cloud provider and is chosen when a target is decided. Registering it here is what lets a workflow act on that provider.',
          sections: [
            {
              heading: 'Register and check',
              steps: [
                'Add a credential for the provider you are migrating to.',
                'A migration that fails to reach its destination is often a credential that is missing, expired, or short of permissions - check here first.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [{ label: 'Quick start', url: DOC_LINKS.quickStartMigration }],
    },
  },
  {
    path: '/main/cloud-resources/apis',
    help: {
      title: 'APIs',
      paragraphs: [
        'The interfaces this console calls, listed so you can see what is available and try a call directly.',
      ],
      groups: [
        {
          id: 'browse-apis',
          title: 'Looking up an API',
          intro:
            'Every screen here is built on these calls. Reading them is useful when you want to know exactly what a screen sends, or to do something the screens do not cover yet.',
          sections: [
            {
              heading: 'Find and try',
              steps: [
                'Find the API by the framework it belongs to.',
                'Its parameters and response shape are shown with it.',
              ],
            },
          ],
        },
      ],
      terms: TERMS,
      guides: [{ label: 'Quick start', url: DOC_LINKS.quickStartMigration }],
    },
  },
  {
    path: '/main/workload-operations',
    help: {
      title: 'Workloads',
      paragraphs: [
        'What a migration produced, and where you check, test or remove it.',
      ],
      groups: [
        {
          id: 'check-workloads',
          title: 'Checking and testing what was created',
          intro:
            'A finished migration leaves real infrastructure behind. This is where you look at it, put load on it, and remove it when it is no longer needed.',
          sections: [
            {
              heading: 'Check what was created',
              steps: [
                'Open Infra Workloads and select the workload.',
                'The Detail tab shows the infrastructure; the Server tab lists its servers.',
              ],
            },
            {
              heading: 'Load-test it',
              steps: [
                'Start a load test on the selected workload.',
                'Progress is shown live, and completion or failure is announced in the notification badge at the top right.',
              ],
            },
          ],
        },
      ],
      guides: [{ label: 'Quick start', url: DOC_LINKS.quickStartMigration }],
    },
  },
];

/*
  No entry for this screen yet. Saying only "Help" left the reader unsure whether
  the panel had failed or the screen simply has none, so the screen is named and
  the gap is stated.
*/
function fallbackFor(title: string): Help {
  return {
    title,
    paragraphs: [
      'Help for this screen has not been written yet - it is on the way.',
      'In the meantime, the quick start guide walks through a migration from beginning to end.',
    ],
    terms: TERMS,
    guides: [{ label: 'Quick start', url: DOC_LINKS.quickStartMigration }],
  };
}

/** Turns a path segment into a screen name, so the panel can title itself. */
function screenNameFrom(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'this screen';
  return last
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const WIDTH_KEY = 'cm.helpPanel.width';
const MODE_KEY = 'cm.helpPanel.mode';
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
/*
  A detached panel is a window, and a window you cannot make taller is a window you
  cannot read. Docked it fills the side, so height only has to be settable once it
  comes away - which is exactly when it was fixed at 70vh with no way to change it.
*/
const HEIGHT_KEY = 'cm.helpPanel.height';
const MIN_HEIGHT = 220;

const route = useRoute();
const { $refs } = getCurrentInstance()!.proxy as unknown as {
  $refs: Record<string, unknown>;
};
const open = ref(false);
const width = ref(readWidth());

/*
  Two ways to show it. Docked, the panel takes a column of its own and the page
  gives up that width - the screen becomes menu, work, help. Detached, it floats
  over the page and the screen keeps its width.

  Which one suits depends on the screen and on the person, so both are offered
  and the choice is remembered.
*/
// Docked unless the reader has chosen otherwise before - taking a column is the
// default because that is where the help sits without hiding anything.
const docked = ref(localStorage.getItem(MODE_KEY) !== 'float');

/* Where the detached panel sits. It opens on the right, which is also where the
   screen keeps its buttons, so it has to be movable. Null means "as opened". */
const offset = ref<{ x: number; y: number } | null>(null);

/* Docking works by reserving the width on the application root, so every screen
   inside it reflows instead of being covered. */
function applyDock() {
  const root = document.getElementById('app');
  if (!root) return;
  const reserve = open.value && docked.value ? `${width.value}px` : '';
  root.style.paddingRight = reserve;
  root.style.boxSizing = 'border-box';
}

function setDocked(next: boolean) {
  docked.value = next;
  if (next) offset.value = null;
  localStorage.setItem(MODE_KEY, next ? 'dock' : 'float');
  applyDock();
}

function readWidth(): number {
  const saved = Number(localStorage.getItem(WIDTH_KEY));
  return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 380;
}

/** The ceiling follows the browser window, so a saved height survives a smaller screen. */
function maxHeight(): number {
  return Math.max(MIN_HEIGHT, window.innerHeight - 40);
}

function readHeight(): number {
  const saved = Number(localStorage.getItem(HEIGHT_KEY));
  return saved >= MIN_HEIGHT ? Math.min(saved, maxHeight()) : Math.round(window.innerHeight * 0.7);
}

const height = ref(readHeight());

const panelStyle = computed(() => {
  const style: Record<string, string> = { width: `${width.value}px` };
  if (!docked.value && offset.value) {
    style.left = `${offset.value.x}px`;
    style.top = `${offset.value.y}px`;
    style.right = 'auto';
    style.bottom = 'auto';
    style.height = `${height.value}px`;
  }
  return style;
});

/*
  The editor opens over the screen it belongs to, so the address stays the same
  and the help would otherwise describe the list behind it. While it is open the
  panel answers the screen in front of you: what you are looking at, enough of
  the editor to work with, and the guide for the rest. The menu underneath is
  folded away rather than mixed in.
*/
type EditorContext = {
  /** What this screen is, said the way a person would say it. */
  lead: string;
  /** What the document holds and why you would change it. */
  detail: string;
  /** What pressing save does - the overlay makes it easy to assume the wrong thing. */
  saving: string;
};

const EDITOR_CONTEXT: Array<{ path: string; ctx: EditorContext }> = [
  {
    path: '/main/models/source-models',
    ctx: {
      lead: 'This screen shows a source model in the JSON editor, where you can read it and change it.',
      detail:
        'A source model is what was collected from the servers you are migrating from - each machine with its CPU, disks and network interfaces. Collection reads what it can reach, and it does not always come back complete, so this is where you correct what it got wrong and fill in what it could not see. What you leave here is what the recommendation works from.',
      saving:
        'Saving asks for a name and creates a custom model; the model you opened stays as it was.',
    },
  },
  {
    path: '/main/models/target-models',
    ctx: {
      lead: 'This screen shows a target model in the JSON editor, where you can read it and change it.',
      detail:
        'A target model describes the same workload the way the destination expects it - the infrastructure to create, with its images, specs, security groups and network. It comes from a recommendation, and a recommendation is a best match rather than a certainty: a spec or an image can come back missing, and the machine it suggests may be larger or smaller than you want. This is where you settle those - fill in what is missing, change a spec up or down, add anything the destination needs. Whatever is left unsettled here has to be dealt with in the workflow instead, which is a harder place to find it.',
      saving:
        'Saving asks for a name and creates a custom model; the model you opened stays as it was.',
    },
  },
  {
    path: '/main/workflow-management/workflows',
    ctx: {
      lead: 'This screen shows a workflow in the JSON editor, where you can read it and change it.',
      detail:
        'A workflow is the tasks the migration runs and the values each one needs. What you change here is what the next run uses.',
      saving: 'Saving updates this workflow.',
    },
  },
  {
    path: '/main/workflow-management/workflow-templates',
    ctx: {
      lead: 'This screen shows a workflow template in the JSON editor, where you can read it and change it.',
      detail:
        'A template is the shape a workflow is built from - which tasks it has and in what order, without the values of any one migration.',
      saving: 'Saving updates this template.',
    },
  },
  {
    path: '/main/workflow-management/task-components',
    ctx: {
      lead: 'This screen shows a task component in the JSON editor, where you can read it and change it.',
      detail:
        'A component is one step a workflow can take. Its JSON says what the step needs and what it gives back, which is what the workflow editor asks you to fill in.',
      saving: 'Saving updates this component.',
    },
  },
  {
    path: '/main/source-computing/source-services',
    ctx: {
      lead: 'This screen shows what was collected from your servers, in the JSON editor.',
      detail:
        'This is the reading taken from each server before it becomes a source model. Check it here, and correct anything that came back wrong.',
      saving: 'What you keep here is what gets saved as the source model.',
    },
  },
];

function editorContextFor(path: string): EditorContext {
  const hit = EDITOR_CONTEXT.filter(e => path.startsWith(e.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return (
    hit?.ctx ?? {
      lead: 'This screen shows a document in the JSON editor, where you can read it and change it.',
      detail: '',
      saving: 'Nothing is written until you save.',
    }
  );
}

function jsonEditorGroup(): Group {
  return {
    id: 'json-editor',
    title: 'Using the editor',
    guide: { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
    intro:
      'The same document is offered three ways - table, tree and text - and nothing is lost by moving between them. The table is the one to start from: it lists every value with its name beside it.',
    sections: [
      {
        heading: 'Change a value, add an entry',
        steps: [
          'In the table view, double-click a value to edit it and press Enter to keep it.',
          'To add an entry to a list, copy one that already exists - the copy lands below it with every field filled in, so only the differences need changing.',
          'Undo takes back anything, including edits made in the table.',
        ],
      },
      {
        heading: 'Find something in a large document',
        steps: [
          'Press the magnifier, or Ctrl+F, and type.',
          'The arrows move between matches and open the branches on the way.',
          'The Filter toggle leaves only the rows that match - useful when one name runs through the document and all of it has to change.',
        ],
      },
      {
        heading: 'Filter or reshape an array',
        steps: [
          'Switch to the tree view and click the array you want to work on - targetSpecList, nodeGroups, firewallRules - so the row is highlighted.',
          'Right-click it, or press Ctrl+Q, and choose Sort or Transform. Both work on one array at a time, so pick the array first and the wizard will offer its fields.',
          'Transform replaces the array with the result, so check the document before saving.',
        ],
      },
    ],
  };
}

const help = computed<Help>(() => {
  const path = route.path;
  const hit = HELP.filter(e => path.startsWith(e.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  const base = hit ? hit.help : fallbackFor(screenNameFrom(path));
  if (!isJsonEditorOpen.value) return base;

  const ctx = editorContextFor(path);
  return {
    ...base,
    title: `${base.title} - JSON`,
    paragraphs: [`${ctx.lead} ${ctx.saving}`, ctx.detail].filter(Boolean),
    groups: [jsonEditorGroup()],
    deferred: base.groups?.length
      ? { label: base.title, groups: base.groups }
      : undefined,
    guides: [
      { label: 'Editing a model as JSON', url: DOC_LINKS.jsonEditor },
      ...(base.guides ?? []).filter(g => g.url !== DOC_LINKS.jsonEditor),
    ],
  };
});

/* Folded by default, and folded again whenever the panel changes what it shows. */
const showDeferred = ref(false);
watch(help, () => {
  showDeferred.value = false;
});

/* The index at the top scrolls to the job it names. */
function jumpTo(id: string) {
  const target = ($refs[`group-${id}`] as HTMLElement[] | undefined)?.[0];
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggle() {
  open.value = !open.value;
  applyDock();
}

function close() {
  open.value = false;
  applyDock();
}

/* Opened from elsewhere - the guide screen offers "Show help" so the reader does not
   have to find the icon. Already open stays open rather than toggling shut. */
watch(helpPanelOpenRequests, () => {
  open.value = true;
  applyDock();
});

/*
  Where you are in the migration, said at the top of the help wherever you open it.

  The guide screen knows this, but only while you are on it - once you leave to do the
  step, nothing follows you and the thread is dropped. The help is the one thing reachable
  from every screen, so it is where the thread can be picked up again.

  Worked out when the help is first opened, not on every screen change: it is the same
  answer either way, and the reader has just asked for an explanation, so a moment's work
  is what they came for.
*/
watch(open, async (isOpen) => {
  // Read again every time, not only the first. Opening the help is the moment the
  // reader most needs the answer to match what is on the screen behind it, and by
  // then they may have registered, collected or saved something.
  if (isOpen) await refreshProgress().catch(() => undefined);
});

const guidedLine = computed(() => {
  if (guidanceOff.value || !progressKnown.value || isFinished.value) return null;
  const step = currentGuidedStep.value;
  if (!step) return null;
  return {
    no: step.no,
    total: GUIDED_STEPS.length,
    title: stepTitle(step, progressFacts.value),
    // The same sentence the guide screen puts on this step. Two wordings for one
    // state made the panel and the guide look like they disagreed.
    standing: step.standing(progressFacts.value),
    completion: step.completion,
    progress: step.progress(progressFacts.value),
  };
});

/*
  Each way of doing a job is folded away until it is asked for.

  Written out in full, one screen's help ran to dozens of numbered lines and the reader
  had to wade through the way they were not using to reach the one they were. The
  headings stay visible so the choice is still in view; only the steps fold.
*/
const openSections = ref<Record<string, boolean>>({});

function sectionKey(groupId: string, index: number): string {
  return `${groupId}#${index}`;
}

function isSectionOpen(groupId: string, index: number): boolean {
  const chosen = openSections.value[sectionKey(groupId, index)];
  if (chosen !== undefined) return chosen;
  return defaultOpen(groupId, index);
}

/** Only the outer procedures carry a rule; a nested one opens with its parent. */
function defaultOpen(groupId: string, index: number): boolean {
  const group = (help.value.groups || []).find(g => g.id === groupId);
  const section = group?.sections?.[index];
  return section?.openWhen ? section.openWhen(progressFacts.value) : false;
}

/**
 * Open a procedure named in someone else's text, and take the reader to it.
 *
 * A cross-reference the reader has to go and find is a cross-reference that does not
 * get followed - and folded away, "see X below" is asking them to hunt for a heading
 * among the ones they closed.
 */
function openReferenced(target: string | undefined): void {
  if (!target) return;
  const [groupId, rawIndex] = target.split('#');
  const index = Number(rawIndex);
  if (!groupId || !Number.isFinite(index)) return;
  openSections.value = { ...openSections.value, [sectionKey(groupId, index)]: true };
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-testid="help-section-toggle-${groupId}-${index}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function toggleSection(groupId: string, index: number): void {
  const key = sectionKey(groupId, index);
  openSections.value = {
    ...openSections.value,
    [key]: !openSections.value[key],
  };
}

/*
  A button named in the text, drawn the way it looks on the screen.

  "Press Add" makes the reader hunt for something whose shape they do not know yet.
  Written as [[btn:+ Add]] the words are drawn as the button itself, so the eye can
  match it against the screen. Screenshots would do the same until the screen changes,
  and then they say something that is no longer true - these cannot go stale that way.

  Kinds: btn (something you press), field (something you fill in), tab, menu (where it is).
*/
type Token = {
  t: 'text' | 'btn' | 'btn2' | 'field' | 'tab' | 'menu' | 'see';
  v: string;
  /** For `see`: which procedure to open, as `groupId#index`. */
  target?: string;
};

const CHIP = /\[\[(btn|btn2|field|tab|menu|see):([^\]]+)\]\]/g;

function tokensOf(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  for (const match of text.matchAll(CHIP)) {
    const start = match.index ?? 0;
    if (start > at) tokens.push({ t: 'text', v: text.slice(at, start) });
    if (match[1] === 'see') {
      // `[[see:group#index|what to call it]]`
      const [target, label] = match[2].split('|');
      tokens.push({ t: 'see', v: label ?? target, target });
    } else {
      tokens.push({ t: match[1] as Token['t'], v: match[2] });
    }
    at = start + match[0].length;
  }
  if (at < text.length) tokens.push({ t: 'text', v: text.slice(at) });
  return tokens;
}

/*
  Taken here, in setup, because that is the only place it can be taken.

  This used to reach for the router through getCurrentInstance() inside the click
  handler. Outside setup that returns null, so the handler threw on its first line and
  the button did nothing at all - no navigation, no error the reader could see.
*/
const router = useRouter();

const onGuideScreen = computed(() =>
  (route.path || '').startsWith('/main/migration-guide'),
);

function openGuide() {
  // Already there: pushing the same route is a no-op, which reads as a dead button.
  if (onGuideScreen.value) return;
  router.push({ name: MENU_ID.MIGRATION_GUIDE }).catch(() => undefined);
}

/* Drag the bottom edge of a detached panel to make it taller or shorter. Same
   document-level tracking as the width, for the same reason. */
function startResizeHeight(event: MouseEvent) {
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = height.value;

  const onMove = (e: MouseEvent) => {
    const next = startHeight + (e.clientY - startY);
    height.value = Math.min(maxHeight(), Math.max(MIN_HEIGHT, next));
  };
  const onUp = () => {
    localStorage.setItem(HEIGHT_KEY, String(height.value));
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* Drag the left edge to resize. The pointer is tracked on the document so the
   drag survives the cursor leaving the narrow handle. */
function startResize(event: MouseEvent) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = width.value;

  const onMove = (e: MouseEvent) => {
    const next = startWidth + (startX - e.clientX);
    width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
    applyDock();
  };
  const onUp = () => {
    localStorage.setItem(WIDTH_KEY, String(width.value));
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* Drag the header to move a detached panel out of the way. */
function startMove(event: MouseEvent) {
  if (docked.value) return;
  if ((event.target as HTMLElement).closest('button')) return;
  event.preventDefault();

  const panel = (event.currentTarget as HTMLElement).closest(
    '.help-panel',
  ) as HTMLElement;
  const box = panel.getBoundingClientRect();
  const grabX = event.clientX - box.left;
  const grabY = event.clientY - box.top;

  const onMove = (e: MouseEvent) => {
    offset.value = {
      x: Math.max(
        0,
        Math.min(window.innerWidth - box.width, e.clientX - grabX),
      ),
      y: Math.max(
        0,
        Math.min(window.innerHeight - box.height, e.clientY - grabY),
      ),
    };
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}
document.addEventListener('keydown', onEscape);
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape);
  const root = document.getElementById('app');
  if (root) root.style.paddingRight = '';
});
</script>

<template>
  <div class="help">
    <button
      class="help-button"
      data-testid="help-toggle"
      :title="`Help for this screen (${help.title})`"
      @click="toggle"
    >
      <svg viewBox="0 0 16 16" class="help-icon" aria-hidden="true">
        <path
          d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2Zm0 9.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM8 4a2.4 2.4 0 0 1 2.4 2.4c0 .86-.42 1.32-1.15 1.85-.5.37-.65.56-.65.95v.3h-1.2v-.4c0-.83.35-1.24 1.02-1.73.55-.4.78-.63.78-1.02A1.2 1.2 0 0 0 8 5.2a1.25 1.25 0 0 0-1.25 1.2H5.6A2.4 2.4 0 0 1 8 4Z"
        />
      </svg>
    </button>

    <aside
      v-if="open"
      class="help-panel"
      :class="docked ? 'is-docked' : 'is-float'"
      :style="panelStyle"
      data-testid="help-panel"
      :data-docked="docked ? 'true' : 'false'"
    >
      <span
        class="help-resizer"
        data-testid="help-resizer"
        title="Drag to resize"
        @mousedown="startResize"
      />
      <!-- Only when detached: docked, the panel already runs the full height. -->
      <div
        v-if="!docked"
        class="help-resizer-bottom"
        data-testid="help-resizer-bottom"
        title="Drag to change the height"
        @mousedown="startResizeHeight"
      />
      <header
        class="help-head"
        :class="{ 'is-movable': !docked }"
        data-testid="help-header"
        @mousedown="startMove"
      >
        <span class="help-title" data-testid="help-title">{{
          help.title
        }}</span>
        <span class="help-actions">
          <button
            v-if="docked"
            class="help-mode"
            data-testid="help-detach"
            title="Detach - float over the page instead of taking a column"
            @click="setDocked(false)"
          >
            <!-- two overlapping windows: the shape that means "come out of the
                 full screen into a window of your own" -->
            <svg viewBox="0 0 16 16" class="help-mode-icon" aria-hidden="true">
              <path
                d="M2 5.5h7.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Zm0 1v7h7.5v-7H2Z"
              />
              <path
                d="M6.5 1.5H14a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1h-2v-1h2V2.5H6.5v2h-1v-2a1 1 0 0 1 1-1Z"
              />
            </svg>
          </button>
          <button
            v-else
            class="help-mode"
            data-testid="help-dock"
            title="Dock - give the panel a column of its own"
            @click="setDocked(true)"
          >
            <!-- one window with its right column filled: back into the screen,
                 taking a side of it -->
            <svg viewBox="0 0 16 16" class="help-mode-icon" aria-hidden="true">
              <path
                d="M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm0 1v8h12V4H2Z"
              />
              <path d="M10 4.5h4.5v7H10v-7Z" />
            </svg>
          </button>
          <button
            class="help-close"
            data-testid="help-close"
            title="Close"
            @click="close"
          >
            &#10005;
          </button>
        </span>
      </header>
      <div class="help-body" data-testid="help-body">
        <!--
          Kept above the screen's own help on purpose: it answers "why am I here at all",
          which comes before "what does this screen do".
        -->
        <button
          v-if="guidedLine"
          class="help-guided"
          :class="{ 'help-guided-static': onGuideScreen }"
          data-testid="help-guided-step"
          @click="openGuide"
        >
          <span class="help-guided-badge"
            >Step {{ guidedLine.no }} of {{ guidedLine.total }}</span
          >
          <span class="help-guided-text">{{ guidedLine.title }}</span>
          <span class="help-guided-standing" data-testid="help-guided-standing">{{
            guidedLine.standing
          }}</span>
          <!--
            What finishes this step, and how far it is met. Without it a step that stays
            put after you have registered something reads as broken rather than as work
            still to do.
          -->
          <span class="help-guided-done" data-testid="help-guided-completion">{{
            guidedLine.completion
          }}</span>
          <span class="help-guided-now" data-testid="help-guided-progress"
            >So far: {{ guidedLine.progress }}</span
          >
          <!-- Offered only where it goes somewhere. On the guide itself it would lie. -->
          <span
            v-if="!onGuideScreen"
            class="help-guided-go"
            data-testid="help-guided-open"
            >Open the migration guide &rsaquo;</span
          >
        </button>

        <p v-for="(line, i) in help.paragraphs" :key="i">{{ line }}</p>

        <!-- What this menu does, as a list you can jump from. -->
        <nav v-if="(help.groups || []).length > 1" class="help-index">
          <button
            v-for="group in help.groups"
            :key="`i-${group.id}`"
            class="help-index-item"
            :data-testid="`help-index-${group.id}`"
            @click="jumpTo(group.id)"
          >
            {{ group.title }}
          </button>
        </nav>

        <section
          v-for="group in help.groups || []"
          :key="group.id"
          :ref="`group-${group.id}`"
          class="help-group"
        >
          <h2 class="help-group-title">{{ group.title }}</h2>
          <p class="help-group-intro">{{ group.intro }}</p>
          <section
            v-for="(sec, x) in group.sections"
            :key="`s${x}`"
            class="help-section"
          >
            <button
              type="button"
              class="help-heading help-heading-toggle"
              :data-testid="`help-section-toggle-${group.id}-${x}`"
              :aria-expanded="isSectionOpen(group.id, x) ? 'true' : 'false'"
              @click="toggleSection(group.id, x)"
            >
              <span class="help-heading-mark" aria-hidden="true">{{
                isSectionOpen(group.id, x) ? '\u25be' : '\u25b8'
              }}</span>
              <span class="help-heading-text">{{ sec.heading }}</span>
            </button>
            <ol
              v-if="isSectionOpen(group.id, x)"
              class="help-steps"
              :data-testid="`help-section-steps-${group.id}-${x}`"
            >
              <li v-for="(step, t) in sec.steps" :key="t">
                <template v-for="(tok, k) in tokensOf(step)">
                  <span v-if="tok.t === 'text'" :key="`t${k}`">{{ tok.v }}</span>
                  <button
                    v-else-if="tok.t === 'see'"
                    :key="`s${k}`"
                    type="button"
                    class="help-see"
                    :data-testid="`help-see-${tok.target}`"
                    @click="openReferenced(tok.target)"
                  >
                    {{ tok.v }}
                  </button>
                  <span v-else :key="`c${k}`" :class="`help-chip help-chip-${tok.t}`">{{
                    tok.v
                  }}</span>
                </template>
              </li>
            </ol>

            <!-- Ways of doing one part of the procedure above, folded inside it. -->
            <div
              v-if="sec.sub && isSectionOpen(group.id, x)"
              class="help-subsections"
            >
              <div v-for="(sub, y) in sec.sub" :key="`sub${y}`" class="help-subsection">
                <button
                  type="button"
                  class="help-subheading"
                  :data-testid="`help-subsection-toggle-${group.id}-${x}-${y}`"
                  :aria-expanded="isSectionOpen(`${group.id}#${x}`, y) ? 'true' : 'false'"
                  @click="toggleSection(`${group.id}#${x}`, y)"
                >
                  <span class="help-heading-mark" aria-hidden="true">{{
                    isSectionOpen(`${group.id}#${x}`, y) ? '\u25be' : '\u25b8'
                  }}</span>
                  <span class="help-subheading-text">{{ sub.heading }}</span>
                </button>
                <ol
                  v-if="isSectionOpen(`${group.id}#${x}`, y)"
                  class="help-steps"
                  :data-testid="`help-subsection-steps-${group.id}-${x}-${y}`"
                >
                  <li v-for="(step, t) in sub.steps" :key="t">
                    <template v-for="(tok, k) in tokensOf(step)">
                      <span v-if="tok.t === 'text'" :key="`t${k}`">{{ tok.v }}</span>
                      <button
                        v-else-if="tok.t === 'see'"
                        :key="`s${k}`"
                        type="button"
                        class="help-see"
                        @click="openReferenced(tok.target)"
                      >
                        {{ tok.v }}
                      </button>
                      <span
                        v-else
                        :key="`c${k}`"
                        :class="`help-chip help-chip-${tok.t}`"
                        >{{ tok.v }}</span
                      >
                    </template>
                  </li>
                </ol>
                <button
                  v-if="sub.guide && isSectionOpen(`${group.id}#${x}`, y)"
                  class="help-guide help-guide-inline"
                  :data-testid="`help-subsection-guide-${group.id}-${x}-${y}`"
                  @click="openDocLink(sub.guide.url)"
                >
                  <svg class="help-doc-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
                    />
                  </svg>
                  <span class="help-guide-text">Guide: {{ sub.guide.label }}</span>
                  <span class="help-guide-out">&#8599;</span>
                </button>
              </div>
            </div>
            <button
              v-if="sec.guide && isSectionOpen(group.id, x)"
              class="help-guide help-guide-inline"
              :data-testid="`help-section-guide-${group.id}-${x}`"
              @click="openDocLink(sec.guide.url)"
            >
              <svg class="help-doc-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
                />
              </svg>
              <span class="help-guide-text">Guide: {{ sec.guide.label }}</span>
              <span class="help-guide-out">&#8599;</span>
            </button>
          </section>
          <button
            v-if="group.guide"
            class="help-guide"
            :data-testid="`help-group-guide-${group.id}`"
            @click="openDocLink(group.guide.url)"
          >
            <svg class="help-doc-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
              />
            </svg>
            <span class="help-guide-text">Guide: {{ group.guide.label }}</span>
            <span class="help-guide-out">&#8599;</span>
          </button>
        </section>

        <!-- The menu underneath, when something is open over it. Behind a line and
             folded away, so it reads as background rather than as the answer. -->
        <div v-if="help.deferred" class="help-more">
          <hr class="help-rule" />
          <button
            class="help-more-toggle"
            data-testid="help-more-toggle"
            :aria-expanded="showDeferred ? 'true' : 'false'"
            @click="showDeferred = !showDeferred"
          >
            <span class="help-more-caret">{{
              showDeferred ? '&#9662;' : '&#9656;'
            }}</span>
            About the menu underneath: {{ help.deferred.label }}
          </button>
          <template v-if="showDeferred">
            <section
              v-for="group in help.deferred.groups"
              :key="`d-${group.id}`"
              class="help-group"
            >
              <h2 class="help-group-title">{{ group.title }}</h2>
              <p class="help-group-intro">{{ group.intro }}</p>
              <section
                v-for="(sec, x) in group.sections"
                :key="`ds${x}`"
                class="help-section"
              >
                <h3 class="help-heading">{{ sec.heading }}</h3>
                <ol class="help-steps">
                  <li v-for="(step, t) in sec.steps" :key="t">{{ step }}</li>
                </ol>
              </section>
            </section>
          </template>
        </div>

        <!--
          What each button and column on this screen is for. Folded away: it answers a
          question asked while looking at the screen, not while following the steps, so
          leaving it open would push the procedures out of view.
        -->
        <section v-if="help.reference" class="help-group">
          <button
            type="button"
            class="help-heading help-heading-toggle"
            data-testid="help-reference-toggle"
            :aria-expanded="isSectionOpen('__reference', 0) ? 'true' : 'false'"
            @click="toggleSection('__reference', 0)"
          >
            <span class="help-heading-mark" aria-hidden="true">{{
              isSectionOpen('__reference', 0) ? '\u25be' : '\u25b8'
            }}</span>
            <span class="help-heading-text">Buttons and columns on this screen</span>
          </button>
          <dl
            v-if="isSectionOpen('__reference', 0)"
            class="help-reference"
            data-testid="help-reference-list"
          >
            <template v-for="(r, k) in help.reference">
              <dt :key="`rt${k}`">
                <span :class="`help-chip help-chip-${r.kind === 'column' ? 'menu' : r.kind}`">{{
                  r.item
                }}</span>
              </dt>
              <dd :key="`rd${k}`">{{ r.meaning }}</dd>
            </template>
          </dl>
        </section>

        <!--
          The same words on every screen, folded like everything else. They are the terms
          the whole product is built on, so they are worth keeping to hand - but a reader
          who already knows them should not have to scroll past them each time.
        -->
        <section v-if="help.terms" class="help-group">
          <button
            type="button"
            class="help-heading help-heading-toggle"
            data-testid="help-terms-toggle"
            :aria-expanded="isSectionOpen('__terms', 0) ? 'true' : 'false'"
            @click="toggleSection('__terms', 0)"
          >
            <span class="help-heading-mark" aria-hidden="true">{{
              isSectionOpen('__terms', 0) ? '\u25be' : '\u25b8'
            }}</span>
            <span class="help-heading-text">Key terms</span>
          </button>
          <dl v-if="isSectionOpen('__terms', 0)" class="help-terms" data-testid="help-terms-list">
            <template v-for="(t, k) in help.terms">
              <dt :key="`t${k}`">{{ t.term }}</dt>
              <dd :key="`d${k}`">{{ t.meaning }}</dd>
            </template>
          </dl>
        </section>

        <section v-if="help.guides" class="help-docs">
          <h2 class="help-group-title">Read more</h2>
          <button
            v-for="(doc, g) in help.guides"
            :key="`g${g}`"
            class="help-guide"
            data-testid="help-guide-link"
            @click="openDocLink(doc.url)"
          >
            <svg class="help-doc-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 1.5h5.2L13 5.3V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Zm1 1V13.5h7V6H8.7V2.5H5Zm4.7.7V5H12L9.7 3.2ZM6 7.5h5v1H6v-1Zm0 2.5h5v1H6v-1Z"
              />
            </svg>
            <span class="help-guide-text">Guide: {{ doc.label }}</span>
            <span class="help-guide-out">&#8599;</span>
          </button>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped lang="postcss">
.help-guided {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  background: #eff6ff;
  text-align: left;
  cursor: pointer;
}
.help-guided:hover {
  background: #dbeafe;
}
.help-guided-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 9999px;
  background: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
.help-guided-text {
  color: #1e40af;
  font-size: 12px;
}

/* On the guide itself the block still explains, but it is no longer a way to get there. */
.help-guided-static {
  cursor: default;
}

.help-guided-standing {
  flex-basis: 100%;
  font-size: 12px;
  line-height: 17px;
  color: #1e40af;
}

.help-guided-go {
  flex-basis: 100%;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  text-decoration: underline;
}

/* The condition and the count sit on their own line, below the step and its title. */
.help-guided-done,
.help-guided-now {
  flex-basis: 100%;
  font-size: 11px;
  line-height: 15px;
  color: #1e3a8a;
}

.help-guided-now {
  font-weight: 600;
}

.help-button {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #6b7280;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.help-icon {
  width: 20px;
  height: 20px;
  fill: currentcolor;
}

/* Lies over the page - the screen underneath keeps its width. */
.help-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
}

/* Detached: floats above the page. */
.help-panel.is-float {
  box-shadow: -4px 0 16px rgb(0 0 0 / 12%);
}

.help-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.help-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  padding: 0;
  font-size: 12px;
  color: #4b5563;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
}

.help-mode-icon {
  width: 14px;
  height: 14px;
  fill: currentcolor;
}

.help-resizer {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;

  &:hover {
    background: #bfdbfe;
  }
}

.help-resizer-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 1;
  width: 100%;
  height: 6px;
  cursor: row-resize;

  &:hover {
    background: #bfdbfe;
  }
}

.help-head.is-movable {
  cursor: move;
}

.help-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.help-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.help-close {
  padding: 2px 8px;
  color: #6b7280;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.help-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
}

.help-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f3f4f6;
}

/* Colour carries the level - the outline was hard to follow in grey alone. */
.help-group-title {
  padding-bottom: 4px;
  font-size: 14px;
  font-weight: 700;
  color: #1d4ed8;
  border-bottom: 2px solid #dbeafe;
}

.help-group-intro {
  color: #4b5563;
}

.help-index {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 4px;
}

.help-index-item {
  padding: 0;
  font-size: 12px;
  color: #2563eb;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

/* A gap and a rule, so the shared words read as a footnote rather than one more
   thing this screen does. */
.help-glossary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 18px;
  margin-top: 8px;
  border-top: 2px solid #e5e7eb;
}

/* The line that says the screen's own help has ended. */
.help-rule {
  margin: 4px 0 10px;
  border: 0;
  border-top: 1px solid #e5e7eb;
}

.help-more-toggle {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 0;
  font-size: 12px;
  color: #6b7280;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover {
    color: #374151;
  }
}

.help-more-caret {
  font-size: 10px;
}

/* A guide that sits inside a section rather than at the foot of the job. */
.help-guide-inline {
  margin-top: 6px;
}

.help-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-heading {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

/* The heading is what opens the steps, so it has to look pressable and span the width. */
.help-heading-toggle {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 6px 4px 0;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 4px;
}

.help-heading-toggle:hover {
  background: #f3f4f6;
}

.help-heading-text {
  flex: 1;
}

/*
  A disclosure triangle rather than a plus.
  On this screen + already means "make a new one" - it is on the button that creates a
  source service - so the same sign at the end of a heading read as "there is more of
  this" rather than "this opens". The triangle points at the text it opens, and turns
  down once it is open, which is the shape people already know from file trees.
*/
.help-heading-mark {
  flex: none;
  width: 12px;
  font-size: 10px;
  line-height: 1;
  color: #2563eb;
  text-align: left;
}

.help-subheading .help-heading-mark {
  color: #7c3aed;
}

/*
  A button as it appears on the screen, small enough to sit inside a sentence.
  Drawn rather than photographed, so it cannot fall out of date on its own.
*/
/* A procedure named inside another one's text, and a way to get straight to it. */
.help-see {
  padding: 0;
  font-size: inherit;
  font-weight: 600;
  color: #7c3aed;
  text-decoration: underline;
  background: none;
  border: 0;
  cursor: pointer;
}

.help-see:hover {
  color: #5b21b6;
}

.help-subsections {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 10px;
  margin-top: 4px;
  border-left: 2px solid #ddd6fe;
}

.help-subsection {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Violet against the outer blue: two depths, told apart at a glance. */
.help-subheading {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 3px 6px 3px 0;
  font-size: 12px;
  font-weight: 600;
  color: #5b21b6;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 4px;
}

.help-subheading:hover {
  background: #f5f3ff;
}

.help-subheading-text {
  flex: 1;
}


.help-chip {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  vertical-align: 1px;
  border-radius: 3px;
}

/* The same violet the console paints a primary button, so the eye can match them. */
.help-chip-btn {
  color: #ffffff;
  background: #341470;
}

/* The plain buttons beside it - white with a border, as they are drawn on screen. */
.help-chip-btn2 {
  color: #232533;
  background: #ffffff;
  border: 1px solid #c2c2c6;
}

.help-chip-field {
  font-weight: 500;
  color: #1f2937;
  background: #ffffff;
  border: 1px solid #9ca3af;
}

.help-chip-tab {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.help-chip-menu {
  font-weight: 500;
  color: #374151;
  background: #f3f4f6;
}

.help-heading:not(.help-heading-toggle)::before {
  display: inline-block;
  width: 3px;
  height: 11px;
  margin-right: 6px;
  vertical-align: -1px;
  content: '';
  background: #60a5fa;
  border-radius: 1px;
}

.help-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 18px;
  margin: 0;
  list-style: decimal;
}

.help-reference {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  align-items: baseline;
  margin: 0;
}

.help-reference dt {
  margin: 0;
}

.help-reference dd {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #4b5563;
}

.help-terms {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.help-terms dt {
  font-weight: 600;
  color: #111827;
}

.help-terms dd {
  margin: 0 0 4px;
}

.help-guide {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 0;
  font-size: 13px;
  color: #2563eb;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.help-docs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid #f3f4f6;
}

.help-doc-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  fill: currentcolor;
}

.help-guide-text {
  text-decoration: underline;
}

.help-guide-out {
  color: #9ca3af;
}
</style>
