import {
  Designer,
  DesignerConfiguration,
  Sequence,
} from 'sequential-workflow-designer';
import { Definition, Step } from 'sequential-workflow-model';
import getRandomId from '@/shared/utils/uuid';
import { toolboxSteps } from '@/features/sequential/designer/toolbox/model/toolboxSteps';
import { editorProviders } from '@/features/sequential/designer/editor/model/editorProviders';
import testSvg from '@/shared/asset/image/testSvg.svg';
import {
  collectStepNames,
  nextAvailableName,
} from '@/entities/workflow/lib/stepNaming';
import { isAutoOpenPropertiesEnabled } from '@/features/sequential/designer/model/designerPreferences';
import referencePickingStore from '@/features/sequential/designer/editor/store/referencePickingStore';
import { watch } from 'vue';

export function useSequentialDesignerModel(refs: any) {
  let designer: Designer | null = null;
  // Stop auto-naming while a saved workflow is being loaded
  let isLoading = false;
  // Whether it was just dropped from the palette — on drop, the library auto-selects it.
  // We flag this to tell it apart from an item the user selected manually.
  let justDropped = false;
  const placeholder = refs.placeholder;
  const designerOptionsState: any = {
    id: '',
    name: '',
    sequence: [],
    others: {
      theme: 'light',
      isReadonly: false, // optional, default: false
      undoStackSize: 10, // optional, default: 0 - disabled, 1+ - enabled
      controlBar: true,
      contextMenu: true,
    },
    toolbox: {
      isCollapsed: false,
    },
    editors: {
      isCollapsed: true,
    },
  };
  let definition: Definition;
  let configuration: DesignerConfiguration<Definition>;
  let toolBoxGroup: Array<{ name: string; steps: Step[] }> = [
    {
      name: 'Tool',
      steps: [],
    },
    {
      name: 'taskGroup',
      steps: [],
    },
    {
      name: 'Components',
      steps: [],
    },
  ];

  function defineDefaultDefinition(workflowName: string, sequence: Step[]) {
    return {
      properties: {
        workflow: workflowName,
      },
      sequence: sequence,
    };
  }

  function defineStepEvent() {
    return {
      // all properties in this section are optional
      iconUrlProvider: (componentType: any, type: any) => {
        return testSvg;
      },
      //
      // isDraggable: (step, parentSequence) => {
      //   return step.name !== 'y';
      // },
      isDeletable: (step, parentSequence) => {
        return step.properties['isDeletable'];
      },
      isDuplicable: (step, parentSequence) => {
        return true;
      },
      canInsertStep: (step, targetSequence, targetIndex) => {
        // Do not touch names while opening a saved workflow. Other tasks' dependencies
        // point at the current names, so renaming here would break those links.
        if (isLoading) return true;

        // Distinguish a fresh item from the palette (name still equals its type name) from one
        // the user has named. We only touch the latter when it collides.
        const taken = collectStepNames(definition?.sequence);
        const isFreshFromToolbox = step.name === step.type;

        if (isFreshFromToolbox || taken.has(step.name)) {
          step.name = nextAvailableName(step.name, taken);
        }
        // On drop the library immediately selects this and requests the properties panel. Only
        // that one time counts as "just dropped"; every selection after is treated as a manual pick.
        justDropped = true;
        return true;
      },
      // canMoveStep: (sourceSequence, step, targetSequence, targetIndex) => {
      //   return !step.properties['isLocked'];
      // },
      // canDeleteStep: (step, parentSequence) => {
      //   return confirm('Are you sure?');
      // },
    };
  }

  function defineStepValidate() {
    return {
      // Per-box check. Report here any shape that cannot be translated into the save format.
      step: (step: any) => {
        if (step.componentType === 'task') {
          return String(step.name ?? '').trim().length > 0;
        }
        // A box with no task anywhere inside (at any nesting depth) will not be saved.
        // We do not block nesting boxes themselves — only the lines get saved, so we
        // just extract the lines out of the nested shape.
        const countTasks = (node: any): number =>
          node.componentType === 'task'
            ? 1
            : (node.sequence ?? []).reduce(
                (sum: number, child: any) => sum + countTasks(child),
                0,
              );
        return countTasks(step) > 0;
      },
      // Whole-workflow check — names must be unique within the workflow
      root: (currentDefinition: any) => {
        const names: string[] = [];
        const walk = (steps: any[] | undefined) => {
          (steps ?? []).forEach(step => {
            if (step.componentType === 'task') names.push(step.name);
            walk(step.sequence);
          });
        };
        walk(currentDefinition?.sequence);
        return names.length > 0 && new Set(names).size === names.length;
      },
    };
  }

  function setToolboxGroupsSteps(
    toolSteps: Step[] | null,
    taskGroupSteps: Step[] | null,
    componentSteps: Step[],
  ) {
    toolBoxGroup = [
      // The 'Tool' group **has never had any content** — its only caller has always
      // passed null (SequentialDesigner.vue), and there is no record of what it was
      // meant to hold. An empty group in the palette is confusing ("something should be
      // here — is it empty?"), so we hide it for now. Restore it if a use arises.
      // {
      //   name: 'Tool',
      //   steps: toolSteps ?? [],
      // },
      {
        // If the group were named 'TaskGroup', the TaskGroup and Parallel inside it would read
        // as a parent-child relation rather than siblings. Both are *boxes that build the execution
        // flow*, so we group them under 'Flow'.
        name: 'Flow',
        steps: taskGroupSteps ?? [
          toolboxSteps().defineTaskGroupStep(
            getRandomId(),
            'TaskGroup',
            'taskGroup',
            { model: {} },
          ),
          // Parallel box — the tasks placed inside run concurrently, and the next step
          // starts only after all of them finish. The engine could always run this way; the
          // UI just could not express it, so only straight lines were drawn.
          toolboxSteps().defineParrelStep(getRandomId(), 'Parallel', {
            model: {},
          }),
          // Conditional branching (If) has no matching concept in the engine, so we do not offer it yet.
        ],
      },
      {
        name: 'Components',
        steps: componentSteps,
      },
    ];
    // console.log(toolBoxGroup);
  }

  function loadConfiguration() {
    return {
      steps: defineStepEvent(),
      validator: defineStepValidate(),
      toolbox: {
        isCollapsed: designerOptionsState.toolbox.isCollapsed,
        groups: toolBoxGroup,
      },

      editors: {
        isCollapsed: designerOptionsState.editors.isCollapsed,
        rootEditorProvider: (definition, rootContext, isReadonly) => {
          designer?.setIsEditorCollapsed(true);
          return editorProviders().defaultRootEditorProvider(
            definition,
            rootContext,
            isReadonly,
          );
        },
        stepEditorProvider: (step, stepContext, definition, isReadonly) => {
          // We **only open the properties panel, never close it.** If we closed what the user
          // had opened, they would have to reopen it every time.
          //
          //  · **A manual selection** is always opened. The act of selecting means "show me",
          //    and even when there is nothing to fill in (like Parallel) the user selects to read the description.
          //  · **A just-dropped item** is opened selectively. If it has something to enter (task, TaskGroup)
          //    the value must be filled right away, so it opens regardless of width; Parallel has nothing to
          //    fill in, so on a narrow screen it does not open, to avoid covering the canvas.
          const wasDropped = justDropped;
          justDropped = false;

          const hasFieldsToEdit = step.componentType !== 'launchPad';
          const widthWithRoomForEditor = 1100;
          const hasRoom =
            (placeholder?.clientWidth ?? 0) >= widthWithRoomForEditor;
          const worthOpening = !wasDropped || hasFieldsToEdit || hasRoom;
          if (isAutoOpenPropertiesEnabled() && worthOpening) {
            designer?.setIsEditorCollapsed(false);
          }
          return editorProviders().defaultStepEditorProvider(
            step,
            stepContext,
            definition,
            isReadonly,
          );
        },
      },
      ...designerOptionsState.others,
    };
  }

  function setDefaultSequence(sequence: Sequence) {
    designerOptionsState.sequence = [...sequence];
  }

  /**
   * Read-only mode. The library locks drag-and-drop, deletion, and the palette,
   * while the value input fields are locked by `editorProviders` receiving `isReadonly`.
   *
   * Must be called before `initDesigner()` — the library freezes the values it reads at
   * creation time, so changing them afterward makes the UI look locked while the state is
   * actually still editable.
   */
  function setReadonly(isReadonly: boolean) {
    designerOptionsState.others.isReadonly = isReadonly;
  }

  function initDesigner() {
    if (designer) {
      designer.destroy();
    }
    definition = defineDefaultDefinition(
      designerOptionsState.name,
      designerOptionsState.sequence,
    );
    configuration = loadConfiguration();
  }

  function draw() {
    isLoading = true;
    designer = Designer.create(placeholder, definition, configuration);
    isLoading = false;
    designer.onDefinitionChanged.subscribe(newDefinition => {});
    showParallelOutlineOnHover();
    enablePickingATaskOnTheCanvas();
  }

  /**
   * While the property panel is looking for a value, the canvas answers.
   *
   * The tasks that run before the edited one light up and the rest fade, so the
   * rule about which tasks may be referenced is taught by the picture instead of
   * by a name quietly missing from a dropdown. Task names are hard to read on the
   * canvas, so the ones that can be picked get a label while this is going on.
   *
   * The library gives no hook for any of this and owns the DOM it draws, so the
   * handlers go on the root and steps are found by `data-step-id` — the same
   * approach the parallel-box outline above already uses.
   */
  function enablePickingATaskOnTheCanvas() {
    const root: HTMLElement | null = placeholder;
    if (!root) return;

    const stepElementAt = (x: number, y: number): Element | null => {
      const hit = document.elementFromPoint(x, y);
      return hit?.closest('.sqd-step-task[data-step-id]') ?? null;
    };

    const taskNameOf = (element: Element | null): string => {
      const id = element?.getAttribute('data-step-id');
      if (!id) return '';
      const found = findStepById(definition.sequence, id);
      return found?.name ?? '';
    };

    /** Mark every step so css can fade the ones that cannot be picked. */
    const paint = () => {
      const picking = referencePickingStore.isPicking.value;
      root.classList.toggle('sqd-picking-a-task', picking);
      root.querySelectorAll('.sqd-step-task[data-step-id]').forEach(element => {
        const allowed =
          picking && referencePickingStore.isAllowed(taskNameOf(element));
        element.classList.toggle('sqd-pick-allowed', allowed);
        if (allowed) {
          element.setAttribute('data-pick-name', taskNameOf(element));
        } else {
          element.removeAttribute('data-pick-name');
          element.classList.remove('sqd-pick-over');
        }
      });
    };

    watch(() => referencePickingStore.isPicking.value, paint, {
      immediate: true,
    });

    // Dragging the crosshair over a step. `dragover` has to be cancelled or the
    // browser refuses the drop.
    root.addEventListener('dragover', event => {
      if (!referencePickingStore.isPicking.value) return;
      const element = stepElementAt(event.clientX, event.clientY);
      const allowed =
        !!element && referencePickingStore.isAllowed(taskNameOf(element));
      if (allowed) event.preventDefault();
      root
        .querySelectorAll('.sqd-pick-over')
        .forEach(over => over.classList.remove('sqd-pick-over'));
      if (allowed) element?.classList.add('sqd-pick-over');
    });

    root.addEventListener('drop', event => {
      if (!referencePickingStore.isPicking.value) return;
      const name = taskNameOf(stepElementAt(event.clientX, event.clientY));
      if (!name) return;
      event.preventDefault();
      referencePickingStore.pick(name);
      paint();
    });

    // Clicking works too — dragging is not available on touch, and it is the
    // easier motion to reach with a keyboard-driven pointer.
    root.addEventListener(
      'click',
      event => {
        if (!referencePickingStore.isPicking.value) return;
        const name = taskNameOf(stepElementAt(event.clientX, event.clientY));
        if (!name || !referencePickingStore.isAllowed(name)) return;
        // Keep the click from also selecting the step and swapping the panel out.
        event.preventDefault();
        event.stopPropagation();
        referencePickingStore.pick(name);
        paint();
      },
      true,
    );

    // Leaving the canvas mid-drag ends it, so the faded state does not stick.
    root.addEventListener('dragleave', event => {
      if (event.target === root) referencePickingStore.stop();
    });
  }

  /** Depth-first lookup of a step by id, walking into parallel branches. */
  function findStepById(sequence: Sequence, id: string): Step | null {
    for (const step of sequence ?? []) {
      if (step.id === id) return step;
      const branches = (step as any).branches;
      if (branches) {
        for (const key of Object.keys(branches)) {
          const found = findStepById(branches[key], id);
          if (found) return found;
        }
      }
      const nested = (step as any).sequence;
      if (nested) {
        const found = findStepById(nested, id);
        if (found) return found;
      }
    }
    return null;
  }

  // A parallel box with more than one branch hides its dashed outline (it reads from the shape
  // alone), which makes it impossible to tell how far the box extends. Clicking anywhere inside
  // selects it, but you cannot *see where inside is*, so we highlight the border only while the
  // mouse is over it.
  //
  // The library has no hover indicator over a step (`sqd-hover` is only for the drag-time
  // placeholder). So we detect it directly by coordinates — the same method as the selection
  // hit-test, so the visible area and the clickable area do not diverge.
  function showParallelOutlineOnHover() {
    const root: HTMLElement | null = placeholder;
    if (!root) return;
    const HOVERED = 'sqd-parallel-hovered';

    const boxOf = (pad: Element) => {
      const lines = pad.querySelectorAll(':scope > line.sqd-region');
      if (!lines.length) return null;
      const rects = Array.from(lines, line => line.getBoundingClientRect());
      const left = Math.min(...rects.map(r => r.left));
      const right = Math.max(...rects.map(r => r.right));
      const top = Math.min(...rects.map(r => r.top));
      const bottom = Math.max(...rects.map(r => r.bottom));
      return {
        left,
        right,
        top,
        bottom,
        area: (right - left) * (bottom - top),
      };
    };

    let queued = false;
    root.addEventListener('mousemove', event => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const pads = root.querySelectorAll('g.sqd-step-launch-pad');
        // When boxes overlap, highlight **only the innermost one**. If several light up at once,
        // it is unclear which one would get selected.
        let innermost: Element | null = null;
        let smallest = Infinity;
        pads.forEach(pad => {
          const box = boxOf(pad);
          if (!box) return;
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (inside && box.area < smallest) {
            smallest = box.area;
            innermost = pad;
          }
        });
        pads.forEach(pad => pad.classList.toggle(HOVERED, pad === innermost));
      });
    });
    root.addEventListener('mouseleave', () => {
      root
        .querySelectorAll(`.${HOVERED}`)
        .forEach(pad => pad.classList.remove(HOVERED));
    });
  }

  function getDesigner(): Designer | null {
    return designer;
  }

  return {
    designer,
    designerOptionsState,
    setDefaultSequence,
    setReadonly,
    setToolboxGroupsSteps,
    initDesigner,
    draw,
    getDesigner,
  };
}
