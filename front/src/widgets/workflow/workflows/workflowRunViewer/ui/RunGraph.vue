<script setup lang="ts">
import { computed } from 'vue';
import {
  GRAPH_GAP_X,
  GRAPH_GAP_Y,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GRAPH_PADDING,
  IRunGraph,
  IRunGraphNode,
} from '@/entities/workflow/lib/runGraph';
import { ITaskInstance } from '@/entities/workflow/model/types';
import {
  taskStateKind,
  taskStateLabel,
} from '@/entities/workflow/lib/taskState';

interface Props {
  graph: IRunGraph;
  instances: ITaskInstance[];
  selectedTaskId: string | null;
  /**
   * 재실행 미리보기. 값이 있으면 *다시 돌 태스크만* 살리고 나머지는 흐리게 한다.
   * 무엇이 다시 도는지는 엔진이 정하므로, 이 목록도 엔진이 돌려준 것이다.
   */
  rerunPreviewIds?: string[] | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'select', taskId: string): void }>();

/*
  SVG <text>는 상자에 맞춰 접히지도, 잘리지도 않는다 — 이름이 길면 그대로 상자 밖으로
  삐져나온다. 상자 폭(GRAPH_NODE_WIDTH)은 흔한 태스크명을 담도록 잡아 두었고, 그보다
  더 긴 이름은 여기서 말줄임한다. 전체 이름은 노드 툴팁과 우측 상세 패널에 그대로 있다.
*/
const NAME_PADDING_X = 14;
const NAME_CHAR_WIDTH = 7.1; // 13px semibold 기준 평균 글자 폭

function fitName(name: string): string {
  const max = Math.floor(
    (GRAPH_NODE_WIDTH - NAME_PADDING_X * 2) / NAME_CHAR_WIDTH,
  );
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

const NODE_WIDTH = GRAPH_NODE_WIDTH;
const NODE_HEIGHT = GRAPH_NODE_HEIGHT;
const GAP_X = GRAPH_GAP_X;
const GAP_Y = GRAPH_GAP_Y;
const PADDING = GRAPH_PADDING;

const instanceByTaskId = computed(
  () => new Map(props.instances.map(i => [i.task_id, i])),
);

const previewing = computed(() => !!props.rerunPreviewIds);
const previewSet = computed(() => new Set(props.rerunPreviewIds ?? []));

// 같은 level의 노드는 서로 의존하지 않으므로 가로로 나란히 둔다.
// 그래서 병렬이 병렬로 보인다.
const nodesPerLevel = computed(() => {
  const counts = new Map<number, number>();
  props.graph.nodes.forEach(node => {
    counts.set(node.level, (counts.get(node.level) ?? 0) + 1);
  });
  return counts;
});

const widestLevel = computed(() =>
  Math.max(1, ...[...nodesPerLevel.value.values()]),
);

const canvasWidth = computed(
  () =>
    PADDING * 2 +
    widestLevel.value * NODE_WIDTH +
    (widestLevel.value - 1) * GAP_X,
);

const canvasHeight = computed(
  () =>
    PADDING * 2 +
    Math.max(1, props.graph.levelCount) * NODE_HEIGHT +
    Math.max(0, props.graph.levelCount - 1) * GAP_Y,
);

function nodeX(node: IRunGraphNode): number {
  const countInLevel = nodesPerLevel.value.get(node.level) ?? 1;
  const rowWidth = countInLevel * NODE_WIDTH + (countInLevel - 1) * GAP_X;
  const rowLeft = (canvasWidth.value - rowWidth) / 2;
  return rowLeft + node.order * (NODE_WIDTH + GAP_X);
}

function nodeY(node: IRunGraphNode): number {
  return PADDING + node.level * (NODE_HEIGHT + GAP_Y);
}

const positioned = computed(() =>
  props.graph.nodes.map(node => {
    const instance = instanceByTaskId.value.get(node.id);
    const label = taskStateLabel(instance?.state);
    const tryNumber = instance?.try_number ?? 0;
    return {
      node,
      x: nodeX(node),
      y: nodeY(node),
      state: instance?.state,
      kind: taskStateKind(instance?.state),
      label,
      tryNumber,
      tooltip:
        tryNumber > 1
          ? `${node.name} — ${label} (try ${tryNumber})`
          : `${node.name} — ${label}`,
    };
  }),
);

const positionById = computed(
  () => new Map(positioned.value.map(p => [p.node.id, p])),
);

const edgePaths = computed(() =>
  props.graph.edges.flatMap(edge => {
    const from = positionById.value.get(edge.from);
    const to = positionById.value.get(edge.to);
    if (!from || !to) return [];

    const x1 = from.x + NODE_WIDTH / 2;
    const y1 = from.y + NODE_HEIGHT;
    const x2 = to.x + NODE_WIDTH / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;

    return [
      {
        key: `${edge.from}->${edge.to}`,
        d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
      },
    ];
  }),
);
</script>

<template>
  <div class="run-graph">
    <svg
      data-testid="workflow-run-graph-svg"
      :width="canvasWidth"
      :height="canvasHeight"
      :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
    >
      <defs>
        <marker
          id="run-graph-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" class="run-graph__arrow" />
        </marker>
      </defs>

      <path
        v-for="edge in edgePaths"
        :key="edge.key"
        :d="edge.d"
        class="run-graph__edge"
        marker-end="url(#run-graph-arrow)"
      />

      <g
        v-for="item in positioned"
        :key="item.node.id"
        class="run-graph__node"
        data-testid="workflow-run-node"
        :data-preview="
          previewing ? (previewSet.has(item.node.id) ? 'on' : 'off') : undefined
        "
        :data-task-name="item.node.name"
        :data-task-id="item.node.id"
        :data-state="item.state ?? 'none'"
        :class="[
          `run-graph__node--${item.kind}`,
          {
            'run-graph__node--selected': item.node.id === selectedTaskId,
            'run-graph__node--preview':
              previewing && previewSet.has(item.node.id),
            'run-graph__node--dimmed':
              previewing && !previewSet.has(item.node.id),
          },
        ]"
        @click="emit('select', item.node.id)"
      >
        <title>{{ item.tooltip }}</title>
        <rect
          :x="item.x"
          :y="item.y"
          :width="NODE_WIDTH"
          :height="NODE_HEIGHT"
          rx="8"
          class="run-graph__box"
        />
        <text :x="item.x + 14" :y="item.y + 22" class="run-graph__name">
          {{ fitName(item.node.name) }}
        </text>
        <text :x="item.x + 14" :y="item.y + 39" class="run-graph__state">
          {{ item.label }}
          <template v-if="item.tryNumber > 1">
            · try {{ item.tryNumber }}
          </template>
        </text>
      </g>
    </svg>
  </div>
</template>

<style lang="postcss" scoped>
.run-graph {
  overflow: auto;
  padding: 0.5rem;
}

.run-graph__edge {
  fill: none;
  stroke: #b8bcc4;
  stroke-width: 1.5;
}

.run-graph__arrow {
  fill: #b8bcc4;
}

.run-graph__node {
  cursor: pointer;
}

.run-graph__box {
  fill: #ffffff;
  stroke: #d4d7dc;
  stroke-width: 1.5;
}

.run-graph__name {
  font-size: 0.8125rem;
  font-weight: 600;
  fill: #232533;
}

.run-graph__state {
  font-size: 0.6875rem;
  fill: #6b6e78;
}

/* 재실행 미리보기 — 다시 돌 태스크만 살리고 나머지는 물러나게 한다 */
.run-graph__node--dimmed {
  opacity: 0.25;
}

.run-graph__node--preview .run-graph__box {
  stroke: #4e42d4;
  stroke-width: 3;
}

.run-graph__node--preview .run-graph__name {
  fill: #4e42d4;
}

.run-graph__node--selected .run-graph__box {
  stroke-width: 2.5;
  stroke: #4e42d4;
}

.run-graph__node--success .run-graph__box {
  fill: #f2fbf5;
  stroke: #34a853;
}

.run-graph__node--failed .run-graph__box {
  fill: #fdf3f3;
  stroke: #e14f4f;
}

/* 앞 태스크가 실패해 돌지 못한 것 — 이 태스크가 잘못된 게 아니므로 실패와 구분한다 */
.run-graph__node--upstreamFailed .run-graph__box {
  fill: #fff8ef;
  stroke: #f4a63c;
}

.run-graph__node--retry .run-graph__box {
  fill: #fffbe9;
  stroke: #e6c229;
}

.run-graph__node--skipped .run-graph__box {
  fill: #f7f7f8;
  stroke: #c2c5cb;
}

.run-graph__node--running .run-graph__box {
  fill: #eef2ff;
  stroke: #3e6ee8;
  animation: run-graph-pulse 1.2s ease-in-out infinite;
}

@keyframes run-graph-pulse {
  0%,
  100% {
    stroke-opacity: 1;
  }
  50% {
    stroke-opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .run-graph__node--running .run-graph__box {
    animation: none;
  }
}
</style>
