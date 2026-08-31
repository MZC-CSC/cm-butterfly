/**
 * Shared state for "pick a task on the canvas".
 *
 * The property panel and the canvas live in separate component trees — the panel
 * is mounted into the designer's editor pane at runtime, not rendered as a child
 * of it — so they cannot pass props to each other. This is the channel between
 * them, following the same singleton shape as `taskSchemaStore` next door.
 *
 * The panel says "I am looking for a value, and these tasks are allowed"; the
 * canvas dims everything else and reports back which one was chosen.
 */

import { computed, ref } from 'vue';

class ReferencePickingStore {
  /** True while the user is dragging the crosshair, or after clicking it. */
  private picking = ref(false);

  /** Task names that may be picked — the ones that run before the edited task. */
  private candidates = ref<string[]>([]);

  /** Field the value is going into. Empty string means the whole body. */
  private field = ref('');

  /** Type of that field, used to warn when the shapes do not match. */
  private fieldType = ref<string | undefined>(undefined);

  /** Called with the task name once one is chosen on the canvas. */
  private onPicked: ((task: string) => void) | null = null;

  get isPicking() {
    return computed(() => this.picking.value);
  }

  get allowedTasks() {
    return computed(() => this.candidates.value);
  }

  get targetField() {
    return computed(() => this.field.value);
  }

  get targetFieldType() {
    return computed(() => this.fieldType.value);
  }

  /** Whether this task may be chosen right now. */
  isAllowed(taskName: string): boolean {
    return this.picking.value && this.candidates.value.includes(taskName);
  }

  start(
    allowed: string[],
    targetField: string,
    targetFieldType: string | undefined,
    onPicked: (task: string) => void,
  ): void {
    // Nothing runs before this task, so there is nothing to pick.
    if (!allowed.length) return;
    this.candidates.value = [...allowed];
    this.field.value = targetField;
    this.fieldType.value = targetFieldType;
    this.onPicked = onPicked;
    this.picking.value = true;
  }

  /** Report the chosen task. Ignored when it is not one of the allowed ones. */
  pick(taskName: string): boolean {
    if (!this.isAllowed(taskName)) return false;
    const handler = this.onPicked;
    this.stop();
    handler?.(taskName);
    return true;
  }

  stop(): void {
    this.picking.value = false;
    this.candidates.value = [];
    this.field.value = '';
    this.fieldType.value = undefined;
    this.onPicked = null;
  }
}

const referencePickingStore = new ReferencePickingStore();

export default referencePickingStore;
