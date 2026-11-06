/**
 * Which body values were forced into the type their task asks for.
 *
 * ★ Why a store: this is decided when the workflow is *opened*, but it is shown in the property
 *   panel, which opens only when a task is clicked. The designer library opens that panel from its
 *   own step object, so a mark left on the step held at open time never reaches the panel (the
 *   library copies the definition). So it is passed by name, not through the step. Same reason and
 *   same shape as referencePickingStore next to it.
 */

import { computed, ref } from 'vue';

class CoercedFieldsStore {
  /** `<task> <field>`: the task name and the field path. */
  private marked = ref<string[]>([]);

  private key(task: string, field: string): string {
    return `${task} ${field}`;
  }

  get all() {
    return computed(() => this.marked.value);
  }

  /** Replace with what was changed while opening this workflow. */
  replace(entries: Array<{ task: string; field: string }>): void {
    this.marked.value = entries.map(one => this.key(one.task, one.field));
  }

  /** Fields changed in this task. The panel looks only at these. */
  fieldsOf(task: string): string[] {
    const prefix = `${task} `;
    return this.marked.value
      .filter(one => one.startsWith(prefix))
      .map(one => one.slice(prefix.length));
  }

  /**
   * Drop the mark once the user has edited that field.
   *
   * The mark means "we adjusted this, please check it". If it stays after the user has checked
   * and fixed it, nobody can tell what is still left to do.
   */
  release(task: string, field: string): void {
    const key = this.key(task, field);
    this.marked.value = this.marked.value.filter(one => one !== key);
  }

  /** If left over when another workflow opens, the wrong fields get marked. */
  clear(): void {
    this.marked.value = [];
  }
}

const coercedFieldsStore = new CoercedFieldsStore();

export default coercedFieldsStore;
