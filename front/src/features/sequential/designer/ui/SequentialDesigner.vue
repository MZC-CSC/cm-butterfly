<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useSequentialDesignerModel } from '@/features/sequential/designer/model/sequentialDesignerModel';

import { useSequentialToolboxModel } from '@/features/sequential/designer/toolbox/model/toolboxModel';
import { Designer } from 'sequential-workflow-designer';
import { Step } from '@/features/workflow/workflowEditor/model/types';
import { ITaskComponentInfoResponse } from '@/features/sequential/designer/toolbox/model/api';
import { Definition } from 'sequential-workflow-model';

interface IProps {
  sequence: Step[];
  trigger: any;
  taskComponentList: Array<ITaskComponentInfoResponse> | undefined;
  /** Display only — drag-and-drop, deletion, and value entry are all locked */
  readonly?: boolean;
}

const props = defineProps<IProps>();
const emit = defineEmits(['getDesigner']);
const sequentialToolBoxModel = useSequentialToolboxModel();
const sequentialDesignerModel = ref();

onMounted(function () {
  let refs = this.$refs;

  const taskComponents = sequentialToolBoxModel.getTaskComponentStep(
    props.taskComponentList ?? [],
  );
  sequentialDesignerModel.value = useSequentialDesignerModel(refs);
  sequentialDesignerModel.value.setToolboxGroupsSteps(null, null, [
    ...taskComponents,
  ]);
  sequentialDesignerModel.value.setDefaultSequence(props.sequence);
  // Must be set *before* initDesigner builds the configuration — the library
  // freezes the value it reads at build time.
  sequentialDesignerModel.value.setReadonly(props.readonly === true);
  sequentialDesignerModel.value.initDesigner();
  sequentialDesignerModel.value.draw();
});

watch(
  () => props.sequence,
  () => {
    const designer: Designer | null =
      sequentialDesignerModel.value?.getDesigner();
    // Skip if the designer hasn't been created yet (before initial mount)
    if (!designer) return;
    const definition: Definition = {
      properties: designer.getDefinition().properties,
      sequence: props.sequence,
    };
    designer.replaceDefinition(definition);
  },
);

watch(
  () => props.trigger,
  nv => {
    if (nv) emit('getDesigner', sequentialDesignerModel.value.getDesigner());
  },
  { deep: true },
);
</script>

<template>
  <div
    data-testid="workflow-designer"
    class="w-[100%] h-[100%] source-template-workflow-edit-container"
  >
    <section class="w-[100%] h-[100%] workflow-box">
      <div ref="placeholder" class="w-[100%] h-[100%]"></div>
    </section>
  </div>
</template>

<style lang="postcss">
@import 'sequential-workflow-designer/css/designer.css';
@import 'sequential-workflow-designer/css/designer-light.css';
@import 'sequential-workflow-designer/css/designer-dark.css';

/*
  The dashed border of a parallel box — hide it when there are two or more branches.

  The dashed border is the only cue that says "this is a parallel box." The library draws no
  label on parallel boxes (it only labels TaskGroups), so there's no other way to mark them.
  But when there are two or more branches, **the split-then-merge shape itself** conveys that,
  so the dashed border is redundant and, overlapping each box, just adds noise. So we hide it
  only in that case.

  With no branches or a single branch, the shape is indistinguishable from a straight line,
  so we keep the dashed border.

  Branches sit as **direct children** of the parallel box's <g> (placeholder and badge are
  other classes and don't match). So we detect it by whether there are two or more child steps.
*/
.sqd-step-launch-pad:has(> g[class^='sqd-step-'] ~ g[class^='sqd-step-'])
  > line.sqd-region {
  /*
    Hide it but **don't remove it.** Clear only the color and keep the element.

    Selecting a parallel box isn't decided by *hitting a line* but by **clicking inside the
    rectangle those four lines form** (the library's `DefaultRegionView.resolveClick` judges
    it by coordinates). Clicking the split, the gap between branches, or the merge all hit it.
    But since that judgment comes from the line positions, removing them with `display: none`
    makes the rectangle itself disappear. So we don't remove them, just make them transparent.
  */
  stroke: transparent;
}

/*
  While the mouse is hovering, though, show it faintly — with it hidden you can't tell where
  the box ends. The range that lights up is exactly the same as the selectable range.
  (The class is applied by `sequentialDesignerModel` based on coordinates.)
*/
.sqd-step-launch-pad:has(> g[class^='sqd-step-'] ~ g[class^='sqd-step-'])
  > line.sqd-region {
  transition: stroke 0.12s ease-out;
}

.sqd-step-launch-pad.sqd-parallel-hovered:has(
    > g[class^='sqd-step-'] ~ g[class^='sqd-step-']
  )
  > line.sqd-region {
  stroke: #cbd5e1;
}

/* Stays visible while selected — preserve the marker the library applies */
.sqd-step-launch-pad:has(> g[class^='sqd-step-'] ~ g[class^='sqd-step-'])
  > line.sqd-region.sqd-selected {
  stroke: #6366f1;
}

/*
  Picking a task to take a value from.

  While the property panel is looking for a value, the tasks that run before the
  edited one stay lit and everything else fades. Showing the ones that cannot be
  picked, rather than hiding them, is what makes the rule legible: you see there
  are other tasks and that these are the ones on offer.

  Their names are drawn on top as well — task names are hard to read on the
  canvas, and this is exactly the moment you need to tell them apart.
  (Classes are applied by `sequentialDesignerModel` while picking is on.)
*/
.sqd-picking-a-task .sqd-step-task {
  transition: opacity 0.12s ease-out;
  opacity: 0.32;
}

.sqd-picking-a-task .sqd-step-task.sqd-pick-allowed {
  opacity: 1;
  cursor: copy;
}

.sqd-picking-a-task .sqd-step-task.sqd-pick-allowed rect {
  stroke: #4b4ddb;
  stroke-width: 2px;
  stroke-dasharray: 4 3;
}

.sqd-picking-a-task .sqd-step-task.sqd-pick-over rect {
  stroke-dasharray: none;
  filter: drop-shadow(0 0 0 3px rgba(75, 77, 219, 0.35));
}

/* The name of a task that can be picked, drawn above its box. */
.sqd-picking-a-task .sqd-step-task.sqd-pick-allowed::after {
  content: attr(data-pick-name);
}

/* A field whose value points at a task that does not run first. Only an imported
   definition can carry one, and it fails at run time, so it is called out here. */
.sqd-step-task.sqd-reference-broken rect {
  stroke: #d94a4a;
  stroke-width: 2px;
}

/* A preference row in the global settings panel (gear icon) */
.sqd-designer-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}

.source-template-workflow-edit-container {
  .workflow-box {
    @apply border-gray-200;
    width: 100%;
    height: 100%;
    border-style: solid;
    border-width: 1px;
    border-radius: 6px;
    padding: 2px;
    .sqd-toolbox {
      width: 280px;
    }

    .sqd-smart-editor-toggle {
      right: 500px;
    }

    .sqd-smart-editor-toggle.sqd-collapsed {
      right: 0;
    }

    .sqd-smart-editor {
      width: 500px;

      .sqd-editor {
        width: 100%;
        height: 100%;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
      }
    }
  }
}
</style>
