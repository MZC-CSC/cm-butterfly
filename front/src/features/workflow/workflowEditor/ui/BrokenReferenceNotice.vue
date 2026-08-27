<script setup lang="ts">
import { computed } from 'vue';
/**
 * Tells the user, right after loading, that this workflow reads results from
 * tasks that do not run first.
 *
 * The editor cannot produce one of these — it only offers tasks that run before
 * the one being edited. A definition that came in from an import or another tool
 * can, and the engine takes it: it only checks that a task by that name exists
 * somewhere, so the workflow saves and then fails at run time with no result to
 * pull. Nothing on screen said so until now.
 *
 * Saving is not blocked. The user may be part way through rewiring, and blocking
 * would leave an imported workflow impossible to work on.
 */
import type {
  IBodyProblem,
  IBrokenReference,
} from '@/entities/workflow/lib/referenceValidation';

interface IProps {
  broken: IBrokenReference[];
  /** Bodies the editor cannot draw — malformed, or holding a value of the wrong type. */
  problems?: IBodyProblem[];
  /**
   * Whether every mistyped value could be forced into shape.
   *
   * Offered only when *all* of them can. Fixing some would leave the user thinking
   * the workflow is now sound when a task is still going to be refused.
   */
  canCoerce?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
  problems: () => [],
  canCoerce: false,
});

// ★ A body that will not parse is different in kind from a reference pointing the
//   wrong way. The reference still leaves an editable workflow — the fields are all
//   there, one of them points somewhere it should not. An unreadable body leaves
//   nothing to edit: the panel cannot draw fields it could not read, and saving from
//   that state writes the misreading over the file. So that case offers a way out
//   rather than only an acknowledgement.
const allProblems = computed<IBodyProblem[]>(() => props.problems ?? []);
const brokenList = computed<IBrokenReference[]>(() => props.broken ?? []);
const unreadable = computed(() =>
  allProblems.value.filter(one => one.kind === 'unreadable'),
);
const mistyped = computed(() =>
  allProblems.value.filter(one => one.kind === 'type'),
);
/**
 * 참조가 그 칸이 요구하는 타입에 맞지 않는 모양으로 적혀 있는 것들.
 *
 * 값이 무엇으로 올지는 여기서 알 수 없지만, *어떻게 적혔는지*는 알 수 있다. 엔진은 본문에
 * 글자로 끼워 넣으므로, 문자열이 아닌 칸의 참조는 따옴표 없이 있어야 한다.
 */
const misquoted = computed(() =>
  allProblems.value.filter(one => one.kind === 'reference-quoting'),
);

const emit = defineEmits(['close', 'leave', 'open-json', 'coerce']);
</script>

<template>
  <div
    class="broken-ref-backdrop"
    data-testid="wf-broken-ref-notice"
    role="dialog"
    aria-modal="true"
    aria-labelledby="broken-ref-title"
  >
    <div class="broken-ref-panel">
      <h3 id="broken-ref-title" class="broken-ref-title">
        {{
          unreadable.length
            ? 'Part of this workflow could not be read'
            : 'This workflow has values that will not work'
        }}
      </h3>

      <div v-if="unreadable.length" class="broken-ref-block">
        <p class="broken-ref-lead">
          The request body of the task below is not valid, so its fields cannot
          be drawn. Editing here would save this screen over what is in the
          file, and what is written there would be lost.
        </p>
        <div class="broken-ref-scroll">
          <table class="broken-ref-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>What is stored</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in unreadable"
                :key="`unreadable-${entry.task}-${index}`"
                :data-testid="`wf-body-unreadable-${entry.task}`"
              >
                <td class="broken-ref-task">{{ entry.task }}</td>
                <td class="broken-ref-target">
                  <code>{{ entry.found }}</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="misquoted.length" class="broken-ref-block">
        <p class="broken-ref-lead">
          The references below are stored in a form their field cannot take.
          What they point at is right; only the quoting is wrong, and that is
          what decides whether the value arrives as a number, a list, or text.
        </p>
        <div class="broken-ref-scroll">
          <table class="broken-ref-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Field</th>
                <th>Needs</th>
                <th>Stored as</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in misquoted"
                :key="`quote-${entry.task}-${entry.field}-${index}`"
                :data-testid="`wf-body-misquoted-${entry.task}-${entry.field}`"
              >
                <td class="broken-ref-task">{{ entry.task }}</td>
                <td class="broken-ref-field">{{ entry.field }}</td>
                <td class="broken-ref-type">{{ entry.expected }}</td>
                <td class="broken-ref-target">
                  a reference, {{ entry.found }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="mistyped.length" class="broken-ref-block">
        <p class="broken-ref-lead">
          The values below are not the type their field takes. Sent as they
          stand, the task is refused when it runs.
        </p>
        <div class="broken-ref-scroll">
          <table class="broken-ref-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Field</th>
                <th>Needs</th>
                <th>Stored as</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in mistyped"
                :key="`type-${entry.task}-${entry.field}-${index}`"
                :data-testid="`wf-body-mistyped-${entry.task}-${entry.field}`"
              >
                <td class="broken-ref-task">{{ entry.task }}</td>
                <td class="broken-ref-field">{{ entry.field }}</td>
                <td class="broken-ref-type">{{ entry.expected }}</td>
                <td class="broken-ref-target">{{ entry.found }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="brokenList.length" class="broken-ref-lead">
        The values below read <strong>a task that does not run first</strong>.
        Run as it stands, the workflow will fail: there is nothing to take. Open
        each task and fix the fields marked in red.
      </p>

      <div v-if="brokenList.length" class="broken-ref-scroll">
        <table class="broken-ref-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Field</th>
              <th>Points at</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in brokenList"
              :key="`${entry.task}-${entry.field}-${index}`"
              :data-testid="`wf-broken-ref-row-${entry.task}-${entry.field}`"
            >
              <td class="broken-ref-task">{{ entry.task }}</td>
              <td class="broken-ref-field">
                {{ entry.field || 'the whole body' }}
              </td>
              <td class="broken-ref-target">
                {{ entry.referencedTask }}
                <span
                  v-if="entry.reason === 'unknown-task'"
                  class="broken-ref-tag"
                  >No such task</span
                >
                <span v-else class="broken-ref-tag">Does not run first</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="broken-ref-actions">
        <template v-if="unreadable.length">
          <button
            type="button"
            class="broken-ref-secondary"
            data-testid="wf-broken-ref-leave"
            @click="emit('leave')"
          >
            Close the editor
          </button>
          <button
            type="button"
            class="broken-ref-close"
            data-testid="wf-broken-ref-open-json"
            @click="emit('open-json')"
          >
            Fix it as JSON
          </button>
        </template>
        <!-- ★ 경우마다 할 수 있는 일이 다르다.
             본문을 읽지 못하면 여기서 고칠 자리가 없으니 나갈 길만 준다.
             형식이 어긋난 것은 여기서 바로잡을 수 있으니 그 버튼을 더한다. "OK" 는 두지
             않는다 — 무엇을 승낙한다는 뜻인지 알 수 없고, 그대로 두면 실행할 때 거절당한다.
             참조가 엉뚱한 곳을 가리키는 것뿐이라면 이야기가 다르다. 칸은 다 있고 여기서
             고치면 되므로, 알림을 닫고 이어서 손보는 것이 맞다. -->
        <template v-else-if="mistyped.length || misquoted.length">
          <p v-if="canCoerce" class="broken-ref-hint">
            These can be put right here. The fields are marked afterwards so you
            can look them over before saving.
          </p>
          <button
            type="button"
            class="broken-ref-secondary"
            data-testid="wf-broken-ref-leave"
            @click="emit('leave')"
          >
            Close the editor
          </button>
          <button
            type="button"
            class="broken-ref-secondary"
            data-testid="wf-broken-ref-open-json"
            @click="emit('open-json')"
          >
            Fix it as JSON
          </button>
          <button
            v-if="canCoerce"
            type="button"
            class="broken-ref-close"
            data-testid="wf-broken-ref-coerce"
            @click="emit('coerce')"
          >
            Put them right
          </button>
        </template>
        <button
          v-else
          type="button"
          class="broken-ref-close"
          data-testid="wf-broken-ref-close"
          @click="emit('close')"
        >
          OK
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.broken-ref-type {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #4b5563;
}
.broken-ref-hint {
  flex: 1;
  margin: 0;
  font-size: 11.5px;
  color: #6b7280;
  text-align: left;
}
.broken-ref-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.broken-ref-secondary {
  padding: 7px 14px;
  border: 1px solid #c7cbd4;
  border-radius: 5px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
}
.broken-ref-secondary:hover {
  background: #f3f4f6;
}

.broken-ref-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(16, 19, 25, 0.42);
}
.broken-ref-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(620px, 100%);
  /* Never taller than the window — the list can be long and it must not run off
     the bottom where the confirm button would be out of reach. */
  max-height: min(70vh, 640px);
  padding: 20px 22px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 24px 60px -20px rgba(16, 19, 25, 0.5);
}
.broken-ref-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: #b02a2a;
}
.broken-ref-lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #3d4655;
}
.broken-ref-scroll {
  overflow: auto;
  border: 1px solid #dfe3ea;
  border-radius: 8px;
}
.broken-ref-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.broken-ref-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 8px 10px;
  background: #f1f3f7;
  border-bottom: 1px solid #dfe3ea;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6b7688;
}
.broken-ref-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #ebeef3;
  vertical-align: top;
}
.broken-ref-task,
.broken-ref-field,
.broken-ref-target {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}
.broken-ref-task {
  color: #141821;
  font-weight: 600;
}
.broken-ref-field {
  color: #3d4655;
}
.broken-ref-target {
  color: #b02a2a;
}
.broken-ref-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #fdecec;
  color: #b02a2a;
  font-family: inherit;
  font-size: 10px;
  font-weight: 650;
}
.broken-ref-actions {
  display: flex;
  justify-content: flex-end;
}
.broken-ref-close {
  border: 1px solid #dfe3ea;
  background: #fff;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 12.5px;
  color: #3d4655;
  cursor: pointer;
}
.broken-ref-close:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: 1px;
}
</style>
