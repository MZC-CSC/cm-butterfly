<script setup lang="ts">
/**
 * A field whose value comes from a previous task, shown as a chip.
 *
 * The stored value is `${task.path}`, which is a perfectly ordinary JSON string
 * — so left as a text box a user edits it by accident and the reference is gone
 * with nothing to say it broke. The chip is read-only; clearing is explicit.
 */
import { computed } from 'vue';

const props = defineProps<{
  task: string;
  path: string;
  /** Dotted field path, used to build the test ids */
  field: string;
  /** The value may arrive as a list — worth saying before the run does */
  multiple?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'clear'): void;
}>();

/** `$.cloudInfraModel.targetVNet.id` is too long for the row; keep the tail. */
const shortPath = computed(() => {
  const parts = props.path.split('.');
  return parts.length > 3 ? `…${parts.slice(-2).join('.')}` : props.path;
});

const title = computed(() => `${props.task}.${props.path}`);
</script>

<template>
  <div class="binding-chip-row">
    <span
      class="binding-chip"
      :data-testid="`wf-field-chip-${field}`"
      :title="title"
    >
      <svg viewBox="0 0 16 16" class="chip-icon" aria-hidden="true">
        <path
          d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
      <span class="chip-task">{{ task }}</span>
      <span class="chip-sep">▸</span>
      <span class="chip-path">{{ shortPath }}</span>
      <span
        v-if="multiple"
        class="chip-multi"
        title="여러 건이면 목록으로 들어옵니다"
        >목록</span
      >
    </span>
    <button
      type="button"
      class="chip-action"
      :data-testid="`wf-field-rebind-${field}`"
      title="다시 고르기"
      @click="emit('edit')"
    >
      ✎
    </button>
    <button
      type="button"
      class="chip-action"
      :data-testid="`wf-field-unbind-${field}`"
      title="연결 끊기"
      @click="emit('clear')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.binding-chip-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.binding-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #c6c7f5;
  border-radius: 5px;
  background: #eeeefc;
  color: #4b4ddb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}
.chip-icon {
  width: 11px;
  height: 11px;
  flex: none;
}
.chip-task {
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip-sep {
  color: #9092e6;
  flex: none;
}
.chip-path {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.chip-multi {
  flex: none;
  margin-left: auto;
  padding: 0 5px;
  border-radius: 3px;
  background: #fbf0de;
  color: #9a5b08;
  font-size: 9.5px;
  font-weight: 700;
}
.chip-action {
  flex: none;
  border: 0;
  background: transparent;
  color: #8b93a5;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 3px 4px;
  border-radius: 4px;
}
.chip-action:hover {
  background: #eef0f4;
  color: #3d4655;
}
.chip-action:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: 1px;
}
</style>
