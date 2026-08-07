<script setup lang="ts">
/**
 * Picking a value out of a previous task's result.
 *
 * Every previous task is laid out at once rather than behind a task dropdown.
 * People usually look for a value without knowing which task produces it, and
 * opening tasks one at a time to find out is the tiring part; a search box that
 * cuts across all of them ends it in one go.
 */
import type {
  IOutputSource,
  TypeVerdict,
} from '../composables/useTaskReference';

const props = defineProps<{
  /** Field this value is going into. Empty string means the whole body. */
  targetField: string;
  sources: IOutputSource[];
  search: string;
  selectedTask: string;
  selectedPath: string;
  preview: string;
  typeVerdict: TypeVerdict;
  targetType?: string;
  selectedType?: string;
  selectedMultiple?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'pick', task: string, path: string): void;
  (e: 'manual', task: string, path: string): void;
  (e: 'apply'): void;
  (e: 'cancel'): void;
}>();

const title = (): string =>
  props.targetField ? `값 고르기 — ${props.targetField}` : '넘길 값 고르기';
</script>

<template>
  <div class="rp-pop" data-testid="wf-ref-popover">
    <div class="rp-head">{{ title() }}</div>

    <label class="rp-search">
      <svg viewBox="0 0 16 16" class="rp-mag" aria-hidden="true">
        <circle
          cx="7"
          cy="7"
          r="4.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="M10.2 10.2 14 14"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <input
        data-testid="wf-ref-search"
        :value="search"
        placeholder="이름으로 찾기"
        @input="
          emit('update:search', ($event.target as HTMLInputElement).value)
        "
      />
    </label>

    <div class="rp-tree">
      <div
        v-for="(source, index) in sources"
        :key="source.task"
        class="rp-source"
      >
        <div class="rp-group">
          <span class="rp-ord">{{ index + 1 }}</span>
          <span class="rp-task">{{ source.task }}</span>
          <span class="rp-anc">앞선 태스크</span>
        </div>

        <p v-if="!source.hasSchema" class="rp-empty">
          이 태스크는 결과 정보를 알려 주지 않습니다. 아래에서 경로를 직접 적어
          주세요.
        </p>

        <button
          v-for="node in source.nodes"
          v-else
          :key="`${source.task}:${node.path}`"
          type="button"
          class="rp-node"
          :class="{
            on: selectedTask === source.task && selectedPath === node.path,
          }"
          :style="{ paddingLeft: `${10 + node.depth * 13}px` }"
          :data-testid="`wf-ref-node-${source.task}-${node.path}`"
          :title="node.description || node.path"
          @click="emit('pick', source.task, node.path)"
        >
          <span class="rp-name">{{ node.label }}</span>
          <span class="rp-type">{{ node.type }}</span>
          <span class="rp-ex">{{ node.example ?? '' }}</span>
        </button>
      </div>

      <p v-if="!sources.length" class="rp-empty">앞선 태스크가 없습니다.</p>
    </div>

    <div class="rp-foot">
      <div class="rp-kv">
        <span class="rp-k">저장될 값</span>
        <span class="rp-v strong" data-testid="wf-ref-preview">{{
          preview || '값을 고르세요'
        }}</span>
      </div>
      <div class="rp-kv">
        <span class="rp-k">형식</span>
        <span class="rp-v" data-testid="wf-ref-typecheck">
          {{ selectedType || '—' }} → {{ targetType || '—' }}
          <span v-if="typeVerdict === 'match'" class="rp-pill ok">맞음</span>
          <span v-else-if="typeVerdict === 'mismatch'" class="rp-pill warn"
            >안 맞음</span
          >
          <span v-else class="rp-pill">확인 못 함</span>
        </span>
      </div>

      <p v-if="typeVerdict === 'mismatch'" class="rp-warn">
        덩어리를 글자 칸에 넣으면 모양이 깨질 수 있습니다. 그대로 넣으려면
        넣기를 누르세요.
      </p>
      <p v-if="selectedMultiple" class="rp-warn">
        여러 건이 잡히면 목록으로 들어옵니다.
      </p>

      <details class="rp-manual">
        <summary>경로 직접 입력</summary>
        <p class="rp-manual-help">
          트리로 표현되지 않는 값은 여기에 적습니다. 고른 것과 같은 모양으로
          저장됩니다.
        </p>
        <div class="rp-manual-row">
          <input
            data-testid="wf-ref-manual-task"
            class="rp-manual-task"
            placeholder="태스크 이름"
            :value="selectedTask"
            @input="
              emit(
                'manual',
                ($event.target as HTMLInputElement).value,
                selectedPath,
              )
            "
          />
          <input
            data-testid="wf-ref-path-input"
            class="rp-manual-path"
            placeholder="$.result.id"
            :value="selectedPath"
            @input="
              emit(
                'manual',
                selectedTask,
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </div>
      </details>
    </div>

    <div class="rp-btns">
      <button
        type="button"
        class="rp-btn"
        data-testid="wf-ref-cancel"
        @click="emit('cancel')"
      >
        취소
      </button>
      <button
        type="button"
        class="rp-btn primary"
        data-testid="wf-ref-apply"
        :disabled="!preview"
        @click="emit('apply')"
      >
        넣기
      </button>
    </div>
  </div>
</template>

<style scoped>
.rp-pop {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border: 1px solid #dfe3ea;
  border-radius: 9px;
  box-shadow: 0 18px 44px -14px rgba(16, 19, 25, 0.42);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.rp-head {
  padding: 9px 11px;
  border-bottom: 1px solid #ebeef3;
  font-size: 12px;
  font-weight: 650;
  color: #141821;
}
.rp-search {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 9px 11px;
  padding: 4px 8px;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
}
.rp-mag {
  width: 12px;
  height: 12px;
  color: #98a2b3;
  flex: none;
}
.rp-search input {
  border: 0;
  outline: 0;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #141821;
}
.rp-tree {
  max-height: 230px;
  overflow: auto;
  padding: 0 4px 6px;
}
.rp-source {
  display: contents;
}
.rp-group {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px 3px;
  font-size: 11px;
  font-weight: 700;
  color: #3d4655;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.rp-ord {
  background: #f1f3f7;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 9.5px;
  color: #6b7688;
}
.rp-task {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-anc {
  margin-left: auto;
  font-family: inherit;
  font-size: 9.5px;
  color: #98a2b3;
  flex: none;
}
.rp-node {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 76px);
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  text-align: left;
  font-size: 11.5px;
  cursor: pointer;
}
.rp-node:hover {
  background: #f5f6fa;
}
.rp-node.on {
  background: #eeeefc;
}
.rp-node.on .rp-name {
  color: #4b4ddb;
  font-weight: 650;
}
.rp-node:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: -2px;
}
.rp-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #3d4655;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-type,
.rp-ex {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  color: #98a2b3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-ex {
  color: #6b7688;
}
.rp-empty {
  margin: 4px 8px 8px;
  padding: 8px 9px;
  background: #f1f3f7;
  border-radius: 6px;
  font-size: 11.5px;
  color: #6b7688;
  line-height: 1.5;
}
.rp-foot {
  border-top: 1px solid #ebeef3;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-kv {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 11px;
}
.rp-k {
  color: #6b7688;
  flex: none;
  width: 60px;
}
.rp-v {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #3d4655;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-v.strong {
  color: #4b4ddb;
}
.rp-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 650;
  background: #f1f3f7;
  color: #6b7688;
  font-family: inherit;
}
.rp-pill.ok {
  background: #e7f4ed;
  color: #1b7a4b;
}
.rp-pill.warn {
  background: #fbf0de;
  color: #9a5b08;
}
.rp-warn {
  margin: 0;
  font-size: 11px;
  color: #9a5b08;
  line-height: 1.5;
}
.rp-manual > summary {
  font-size: 11.5px;
  color: #6b7688;
  cursor: pointer;
}
.rp-manual-help {
  margin: 6px 0 5px;
  font-size: 11px;
  color: #98a2b3;
  line-height: 1.5;
}
.rp-manual-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 6px;
}
.rp-manual-row input {
  border: 1px solid #dfe3ea;
  border-radius: 5px;
  padding: 4px 7px;
  font-size: 11.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  min-width: 0;
}
.rp-btns {
  display: flex;
  gap: 7px;
  justify-content: flex-end;
  padding: 0 11px 10px;
}
.rp-btn {
  font-size: 11.5px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #dfe3ea;
  background: #fff;
  color: #3d4655;
  cursor: pointer;
}
.rp-btn.primary {
  background: #4b4ddb;
  border-color: #4b4ddb;
  color: #fff;
  font-weight: 600;
}
.rp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rp-btn:focus-visible {
  outline: 2px solid #4b4ddb;
  outline-offset: 1px;
}
</style>
