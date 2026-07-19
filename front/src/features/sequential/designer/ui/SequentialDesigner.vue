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
  sequentialDesignerModel.value.initDesigner();
  sequentialDesignerModel.value.draw();
});

watch(
  () => props.sequence,
  () => {
    const designer: Designer | null =
      sequentialDesignerModel.value?.getDesigner();
    // 디자이너가 아직 생성되지 않았으면(초기 마운트 전) 건너뜀
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
  병렬 상자의 점선 — 갈래가 둘 이상이면 감춘다.

  점선은 "여기가 병렬 상자다"를 알려주는 유일한 단서다. 라이브러리가 병렬 상자에는
  이름표를 그리지 않아서(TaskGroup 에만 그린다) 달리 표시할 방법이 없다. 그런데
  갈래가 둘 이상이면 **갈라졌다 모이는 모양 자체가** 그 말을 대신하므로, 점선은
  중복이고 상자마다 겹쳐 보여 시끄럽다. 그래서 그때만 감춘다.

  갈래가 없거나 하나면 모양으로는 직선과 구분되지 않으므로 점선을 남긴다.

  갈래는 병렬 상자 <g> 의 **직계 자식**으로 들어간다(placeholder·badge 는 다른
  클래스라 걸리지 않는다). 그래서 자식 step 이 둘 이상인지로 판별한다.
*/
.sqd-step-launch-pad:has(> g[class^='sqd-step-'] ~ g[class^='sqd-step-'])
  > line.sqd-region {
  /*
    감추되 **없애지는 않는다.** `display: none` 으로 지우면 이 선이 병렬 상자의
    유일한 클릭 지점이라 상자를 고르지도 지우지도 못하게 된다. 색만 지우고
    `pointer-events: stroke` 로 집는 자리는 남긴다.
  */
  stroke: transparent;
  pointer-events: stroke;
}

/* 전체 설정 패널(톱니바퀴)의 취향 설정 한 줄 */
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
