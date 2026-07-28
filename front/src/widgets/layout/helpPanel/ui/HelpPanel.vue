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
import { computed, ref, onBeforeUnmount, getCurrentInstance } from 'vue';
import { useRoute } from 'vue-router/composables';
import { DOC_LINKS, openDocLink } from '@/shared/constants/docLinks';

type Section = { heading: string; steps: string[] };

/**
 * What this menu lets you do, as one job with its own explanation and the ways
 * of doing it underneath. A menu usually does more than one job, and reading
 * the ways without knowing which job they belong to is where it fell apart.
 */
type Group = {
  id: string;
  title: string;
  /** Why this job exists and what choices it offers, before the ways of doing it. */
  intro: string;
  sections: Section[];
};

type Help = {
  title: string;
  /** What this menu is for, before any of the steps. */
  paragraphs: string[];
  /** The jobs this menu does. Listed at the top, each jumping to its part. */
  groups?: Group[];
  /** Terms someone new to the console will not know yet. Kept last on purpose. */
  terms?: Array<{ term: string; meaning: string }>;
  guide?: { label: string; url: string };
};

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
      terms: [
        {
          term: 'Source service',
          meaning:
            'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. Each connection under it is one server.',
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
            'Either kind, once you have changed its values and saved it under a new name. The original is left as it was.',
        },
        {
          term: 'Workflow',
          meaning:
            'The steps that carry the migration out, generated from a target model. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
        },
        {
          term: 'Where to make changes',
          meaning:
            'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
        },
      ],
      guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
    },
  },
  {
    path: '/main/source-computing/source-services',
    help: {
      title: 'Source Services',
      paragraphs: [
        'This menu does two things: you register and manage the servers you are migrating from, and you turn what is collected from them into a source model.',
      ],
      groups: [
        {
          id: 'manage-sources',
          title: 'Managing the servers you migrate from',
          intro:
            'A source service is a group of servers, and each connection under it is one server. There is no single order to build it in - create the group first and add servers when their details are ready, create both at once, add or change servers later, or bring them in from a file. Use whichever suits how you got the information.',
          sections: [
            {
              heading: 'Create the group first',
              steps: [
                'Create a source service with a name and description.',
                'It appears in the list with no connections. Add them whenever the server details are ready.',
              ],
            },
            {
              heading: 'Create the group with its servers',
              steps: [
                'While creating the source service, add connections in the same form.',
                'Each connection needs a name, IP address, SSH port, user, and a password or private key.',
              ],
            },
            {
              heading: 'Add or change servers later',
              steps: [
                'Select the group and open its Connections tab to add a server by hand.',
                'Connections can be edited or removed the same way as the group itself.',
              ],
            },
            {
              heading: 'Bring servers in from a file',
              steps: [
                'Download the connection template to see the layout.',
                'Fill it in. The template opens in Excel and saves back as either CSV or .xlsx.',
                'Import the file. The rows to be registered are listed on screen - review them, then confirm.',
                'What is already registered can be exported in the same layout, so a group can be copied or kept as a starting point. Passwords and keys come out blank and have to be filled in again.',
              ],
            },
          ],
        },
        {
          id: 'make-source-model',
          title: 'Making a source model',
          intro:
            'Collecting reads what is actually on the servers; saving turns that into a source model the migration can work from. Two choices shape it - infrastructure or software, and a whole group or a single server. Collection reaches each server over SSH, so it has to be reachable at the time.',
          sections: [
            {
              heading: 'Choose what to collect',
              steps: [
                'Decide whether you are migrating infrastructure or software - the collection differs.',
                'Select a whole group to cover every server in it, or a single connection to cover one server.',
              ],
            },
            {
              heading: 'Collect and save',
              steps: [
                'Press Refresh first. It re-checks that each server can still be reached and updates Agent Status and Connection Status on the Detail tab.',
                'Run Collect Infra for machines, or Collect SW for the software on them.',
                'The result opens in a viewer. Check it, and for software press Convert.',
                'Save it as a source model. It then appears under Models.',
              ],
            },
          ],
        },
      ],
      terms: [
        {
          term: 'Source service',
          meaning:
            'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. Each connection under it is one server.',
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
            'Either kind, once you have changed its values and saved it under a new name. The original is left as it was.',
        },
        {
          term: 'Workflow',
          meaning:
            'The steps that carry the migration out, generated from a target model. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
        },
        {
          term: 'Where to make changes',
          meaning:
            'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
        },
      ],
      guide: {
        label: 'Bulk import of source connections',
        url: DOC_LINKS.sourceConnectionBulkImport,
      },
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
          title: 'Managing source models',
          intro:
            'A source model describes the servers you are migrating from. If collection got something wrong, or you want to try a variation, change it here - saving under a new name gives you a custom copy and leaves the original alone.',
          sections: [
            {
              heading: 'Review and adjust',
              steps: [
                'Open a model to review what was collected, and adjust anything that is wrong.',
                'Saving under a new name gives you a custom copy.',
                'Models can be renamed and removed here.',
              ],
            },
          ],
        },
        {
          id: 'make-target-model',
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
      terms: [
        {
          term: 'Source service',
          meaning:
            'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. Each connection under it is one server.',
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
            'Either kind, once you have changed its values and saved it under a new name. The original is left as it was.',
        },
        {
          term: 'Workflow',
          meaning:
            'The steps that carry the migration out, generated from a target model. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
        },
        {
          term: 'Where to make changes',
          meaning:
            'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
        },
      ],
      guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
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
          title: 'Managing target models',
          intro:
            'A target model describes the workload the way the destination expects it, which makes this a good place to adjust values. The list marks each one as Basic or Custom, and as a CloudModel or a SoftwareModel. A model can be exported and imported, so one that works can be kept and reused.',
          sections: [
            {
              heading: 'Adjust and save',
              steps: [
                'Open Custom & View to see the model as JSON.',
                'The table view edits values and adds or removes list entries; the tree and text views are the same document in another shape.',
                'Saving asks for a name and creates a custom model - the original is left as it was.',
              ],
            },
          ],
        },
        {
          id: 'make-workflow',
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
      terms: [
        {
          term: 'Source service',
          meaning:
            'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. Each connection under it is one server.',
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
            'Either kind, once you have changed its values and saved it under a new name. The original is left as it was.',
        },
        {
          term: 'Workflow',
          meaning:
            'The steps that carry the migration out, generated from a target model. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
        },
        {
          term: 'Where to make changes',
          meaning:
            'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
        },
      ],
      guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
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
          title: 'Managing workflows',
          intro:
            'Most workflows come from a target model, but one can also be built in the editor or copied from a workflow that already works. They can be exported and imported, so a good one can be kept and reused like a template.',
          sections: [
            {
              heading: 'Create, copy and check',
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
      terms: [
        {
          term: 'Source service',
          meaning:
            'A group of the servers you are migrating from - on-premises machines or ones already running on a cloud. Each connection under it is one server.',
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
            'Either kind, once you have changed its values and saved it under a new name. The original is left as it was.',
        },
        {
          term: 'Workflow',
          meaning:
            'The steps that carry the migration out, generated from a target model. It is the last place values can be changed before anything is created, and it is what you run, watch and re-run.',
        },
        {
          term: 'Where to make changes',
          meaning:
            'You can adjust the source model, the target model, or the workflow. Later is usually easier: the target model is already in the destination shape, and the workflow is the last word before anything runs. Target models and workflows can also be exported and imported, so a good one can be kept and reused like a template.',
        },
      ],
      guide: {
        label: 'Reading the run status screen',
        url: DOC_LINKS.workflowRunStatus,
      },
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
      guide: {
        label: 'Running workflow tasks in parallel',
        url: DOC_LINKS.workflowParallelSteps,
      },
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
      guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
    },
  },
];

const FALLBACK: Help = {
  title: 'Help',
  paragraphs: [
    'There is no help written for this screen yet.',
    'The quick start guide walks through a migration from beginning to end.',
  ],
  guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
};

const WIDTH_KEY = 'cm.helpPanel.width';
const MODE_KEY = 'cm.helpPanel.mode';
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

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

const panelStyle = computed(() => {
  const style: Record<string, string> = { width: `${width.value}px` };
  if (!docked.value && offset.value) {
    style.left = `${offset.value.x}px`;
    style.top = `${offset.value.y}px`;
    style.right = 'auto';
    style.bottom = 'auto';
    style.height = '70vh';
  }
  return style;
});

const help = computed<Help>(() => {
  const path = route.path;
  const hit = HELP.filter(e => path.startsWith(e.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return hit ? hit.help : FALLBACK;
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
    >
      <span
        class="help-resizer"
        data-testid="help-resizer"
        title="Drag to resize"
        @mousedown="startResize"
      />
      <header
        class="help-head"
        :class="{ 'is-movable': !docked }"
        data-testid="help-header"
        @mousedown="startMove"
      >
        <span class="help-title">{{ help.title }}</span>
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
      <div class="help-body">
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
            v-for="(section, x) in group.sections"
            :key="`s${x}`"
            class="help-section"
          >
            <h3 class="help-heading">{{ section.heading }}</h3>
            <ol class="help-steps">
              <li v-for="(step, t) in section.steps" :key="t">{{ step }}</li>
            </ol>
          </section>
        </section>

        <!-- Set apart: the same words on every screen, for when one is unfamiliar. -->
        <section v-if="help.terms" class="help-glossary">
          <h2 class="help-group-title">Words used here</h2>
          <dl class="help-terms">
            <template v-for="(t, k) in help.terms">
              <dt :key="`t${k}`">{{ t.term }}</dt>
              <dd :key="`d${k}`">{{ t.meaning }}</dd>
            </template>
          </dl>
        </section>

        <button
          v-if="help.guide"
          class="help-guide"
          data-testid="help-guide-link"
          @click="openDocLink(help.guide.url)"
        >
          {{ help.guide.label }} &rsaquo;
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped lang="postcss">
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

.help-group-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
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

.help-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-heading {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}

.help-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 18px;
  margin: 0;
  list-style: decimal;
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
  align-self: flex-start;
  padding: 0;
  font-size: 13px;
  color: #2563eb;
  text-decoration: underline;
  background: transparent;
  border: 0;
  cursor: pointer;
}
</style>
