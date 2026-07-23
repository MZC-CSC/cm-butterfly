<script setup lang="ts">
import { PDataTable, PButton } from '@cloudforet-test/mirinae';
import { useWorkflowHistoryModel } from '@/widgets/workflow/workflows/workflowHistory/model/workflowHistoryModel';
import WorkflowRunDetailOverlay from './WorkflowRunDetailOverlay.vue';
import SoftwareMigrationOverlay from './SoftwareMigrationOverlay.vue';
import { onBeforeMount, watch, ref } from 'vue';
import { IWorkflowRun } from '@/entities/workflow/model/types';
import { useGetTaskInstances } from '@/entities/workflow/api/index';

interface iProps {
  selectedWorkflowId: string;
}

const props = defineProps<iProps>();

const { initTable, tableModel, workflowId } = useWorkflowHistoryModel();

// Overlay state
const isOverlayVisible = ref(false);
const selectedRun = ref<IWorkflowRun | null>(null);

// SW overlay state
const isSwOverlayVisible = ref(false);
const selectedSwRun = ref<IWorkflowRun | null>(null);

// Store each run's task instances and whether it has an SW migration task
const runTaskInstances = ref<Map<string, any[]>>(new Map());
const runHasSwTask = ref<Record<string, boolean>>({});
const runExecutionIds = ref<Record<string, string[]>>({});

onBeforeMount(() => {
  initTable();
});

watch(
  props,
  () => {
    workflowId.value = props.selectedWorkflowId;
    // Reset existing data when the workflow changes
    runTaskInstances.value.clear();
    runHasSwTask.value = {};
    runExecutionIds.value = {};
  },
  { immediate: true },
);

// Once table items load, fetch task instances for each run (processed sequentially)
watch(
  () => tableModel.value.tableState.items,
  async runs => {
    if (runs && runs.length > 0 && props.selectedWorkflowId) {
      for (const run of runs) {
        // Skip if we already fetched this data
        if (!runTaskInstances.value.has(run.workflow_run_id)) {
          await fetchTaskInstancesForRun(run);
          // Small delay between requests to reduce server load
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  },
  { immediate: true },
);

// Fetch task instances for a single run
async function fetchTaskInstancesForRun(run: IWorkflowRun) {
  try {
    const { data, execute } = useGetTaskInstances(
      run.workflow_id,
      run.workflow_run_id,
    );
    await execute();

    if (data.value?.responseData) {
      const tasks = data.value.responseData;

      runTaskInstances.value.set(run.workflow_run_id, tasks);

      // Find all tasks where is_software_migration_task is true
      const swTasks = tasks.filter(
        (task: any) => task.is_software_migration_task === true,
      );

      if (swTasks.length > 0) {
        // Reassign the whole object so reactivity picks it up.
        runHasSwTask.value = {
          ...runHasSwTask.value,
          [run.workflow_run_id]: true,
        };

        // A task without an execution id has nothing to show. This used to fall back to a hardcoded
        // id, so the screen would render some other migration's status as if it belonged to this run.
        const executionIds = swTasks
          .map((task: any) => task.software_migration_execution_id)
          .filter(Boolean);

        runExecutionIds.value = {
          ...runExecutionIds.value,
          [run.workflow_run_id]: executionIds,
        };
      } else {
        runHasSwTask.value = {
          ...runHasSwTask.value,
          [run.workflow_run_id]: false,
        };
      }
    }
  } catch (error) {
    // On error, set to false so the next run can still be processed
    runHasSwTask.value = {
      ...runHasSwTask.value,
      [run.workflow_run_id]: false,
    };
  }
}

// Action button click handler
const handleViewDetail = (run: IWorkflowRun) => {
  selectedRun.value = run;
  isOverlayVisible.value = true;
};

// Overlay close handler
const handleCloseOverlay = () => {
  isOverlayVisible.value = false;
  selectedRun.value = null;
};

// SW button click handler
const handleViewSw = (run: IWorkflowRun) => {
  selectedSwRun.value = run;
  isSwOverlayVisible.value = true;
};

// SW overlay close handler
const handleCloseSwOverlay = () => {
  isSwOverlayVisible.value = false;
  selectedSwRun.value = null;
};
</script>

<template>
  <div>
    <p-data-table
      :fields="tableModel.tableState.fields"
      :items="tableModel.tableState.items"
      :loading="tableModel.tableState.loading"
    >
      <template #col-state-format="{ item }">
        <span data-testid="workflow-run-state">{{ item.state }}</span>
      </template>
      <template #col-tasks-format="{ item }">
        <p-button
          style-type="tertiary"
          size="sm"
          @click="handleViewDetail(item)"
        >
          View Tasks
        </p-button>
      </template>
      <template #col-sw-format="{ item }">
        <p-button
          v-if="runHasSwTask[item.workflow_run_id]"
          style-type="tertiary"
          size="sm"
          data-testid="workflow-view-sw"
          @click="handleViewSw(item)"
        >
          View SW
        </p-button>
      </template>
    </p-data-table>

    <workflow-run-detail-overlay
      :is-visible="isOverlayVisible"
      :selected-run="selectedRun"
      @close="handleCloseOverlay"
    />

    <software-migration-overlay
      :is-visible="isSwOverlayVisible"
      :selected-run="selectedSwRun"
      :execution-ids="
        selectedSwRun
          ? runExecutionIds[selectedSwRun.workflow_run_id] || []
          : []
      "
      @close="handleCloseSwOverlay"
    />
  </div>
</template>
