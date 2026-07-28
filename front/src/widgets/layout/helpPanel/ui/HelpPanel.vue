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
import { computed, ref, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router/composables';
import { DOC_LINKS, openDocLink } from '@/shared/constants/docLinks';

type Help = {
  title: string;
  paragraphs: string[];
  guide?: { label: string; url: string };
};

/** Matched against the current path, longest match first. */
const HELP: Array<{ path: string; help: Help }> = [
  {
    path: '/main/migration-guide',
    help: {
      title: 'Migration Guide',
      paragraphs: [
        'The five steps a migration runs through, in order. Selecting a step opens the screen where it happens.',
        'The help icon at the top right shows help for whichever screen you are on.',
      ],
      guide: { label: 'Quick start guide', url: DOC_LINKS.quickStartMigration },
    },
  },
  {
    path: '/main/source-computing/source-services',
    help: {
      title: 'Source Services',
      paragraphs: [
        'Register the servers you want to migrate. Each connection is one source server, and the collection agent is installed when you add it.',
        'Several connections can be registered at once from a CSV or Excel file.',
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
        'What was collected from the registered servers, saved as a model. The rest of the flow is built on this inventory.',
        'Open a model to review the collected values, and adjust them if the collection missed something.',
      ],
    },
  },
  {
    path: '/main/models/target-models',
    help: {
      title: 'Target Models',
      paragraphs: [
        'A target model is generated from a source model. Adjust the values you want and save it as a custom model.',
        'Custom & View opens the model as JSON. The table view edits values and adds or removes list entries; the tree and text views are the same document in another shape.',
      ],
    },
  },
  {
    path: '/main/workflow-management/workflows',
    help: {
      title: 'Workflows',
      paragraphs: [
        'Create a workflow from a target model, or build one yourself in the editor.',
        'Open a workflow to change any value it needs, then run it. The run status screen shows what is happening while it runs.',
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
        'Workflows, the templates they can be built from, and the task components a workflow is made of.',
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
        'What a migration produced, and where you go to check or remove it.',
      ],
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
  localStorage.setItem(MODE_KEY, next ? 'dock' : 'float');
  applyDock();
}

function readWidth(): number {
  const saved = Number(localStorage.getItem(WIDTH_KEY));
  return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : 380;
}

const help = computed<Help>(() => {
  const path = route.path;
  const hit = HELP.filter(e => path.startsWith(e.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return hit ? hit.help : FALLBACK;
});

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
      :style="{ width: width + 'px' }"
      data-testid="help-panel"
    >
      <span
        class="help-resizer"
        data-testid="help-resizer"
        title="Drag to resize"
        @mousedown="startResize"
      />
      <header class="help-head">
        <span class="help-title">{{ help.title }}</span>
        <span class="help-actions">
          <button
            v-if="docked"
            class="help-mode"
            data-testid="help-detach"
            title="Detach - float over the page instead of taking a column"
            @click="setDocked(false)"
          >
            <!-- a small pane lifted off the edge: the shape used for "open in a
                 floating window" across editors and browsers -->
            <svg viewBox="0 0 16 16" class="help-mode-icon" aria-hidden="true">
              <path
                d="M2.5 3.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Zm0 1v7h7v-7h-7Z"
              />
              <path d="M6.5 2.5h7a1 1 0 0 1 1 1v7h-1v-7h-7v-1Z" />
            </svg>
          </button>
          <button
            v-else
            class="help-mode"
            data-testid="help-dock"
            title="Dock - give the panel a column of its own"
            @click="setDocked(true)"
          >
            <!-- a pane split with the right column filled: the shape used for
                 "dock to the side" in editors -->
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
