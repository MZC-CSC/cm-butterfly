<script setup lang="ts">
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
import type { IBrokenReference } from '@/entities/workflow/lib/referenceValidation';

defineProps<{
  broken: IBrokenReference[];
}>();

const emit = defineEmits<{ (e: 'close'): void }>();
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
        이 워크플로우에 잘못된 참조가 있습니다
      </h3>
      <p class="broken-ref-lead">
        아래 값은 <strong>앞서 실행되지 않는 태스크</strong>를 가리키고
        있습니다. 이대로 실행하면 값을 찾지 못해 실패합니다. 해당 태스크를 열어
        붉게 표시된 칸을 고쳐 주세요.
      </p>

      <div class="broken-ref-scroll">
        <table class="broken-ref-table">
          <thead>
            <tr>
              <th>태스크</th>
              <th>칸</th>
              <th>가리키는 곳</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in broken"
              :key="`${entry.task}-${entry.field}-${index}`"
              :data-testid="`wf-broken-ref-row-${entry.task}-${entry.field}`"
            >
              <td class="broken-ref-task">{{ entry.task }}</td>
              <td class="broken-ref-field">
                {{ entry.field || '본문 전체' }}
              </td>
              <td class="broken-ref-target">
                {{ entry.referencedTask }}
                <span
                  v-if="entry.reason === 'unknown-task'"
                  class="broken-ref-tag"
                  >없는 태스크</span
                >
                <span v-else class="broken-ref-tag">앞서 실행되지 않음</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="broken-ref-actions">
        <button
          type="button"
          class="broken-ref-close"
          data-testid="wf-broken-ref-close"
          @click="emit('close')"
        >
          확인
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
