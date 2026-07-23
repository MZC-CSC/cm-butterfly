<script setup lang="ts">
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useWorkflowListModel } from '@/widgets/workflow/workflows/workflowList/model/workflowListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import {
  insertDynamicComponent,
  showSuccessMessage,
  showErrorMessage,
} from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import {
  onBeforeMount,
  onMounted,
  reactive,
  ref,
  watch,
  computed,
  nextTick,
} from 'vue';
import { useGetWorkflowList, useBulkDeleteWorkflow } from '@/entities';
import { useRunWorkflow } from '@/entities';
import { trackWorkflow } from '@/entities/workflow/lib/workflowTracker';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';

const runWorkflow = useRunWorkflow('');
const getWorkflowList = useGetWorkflowList();

const { tableModel, initToolBoxTableModel, workflowStore } =
  useWorkflowListModel();

const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
  computed(() => tableModel.tableState.items.length),
  computed(() => tableModel.tableOptions.pageSize),
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

interface iProps {
  trigger: boolean;
  selectedWfId: any;
}

const props = defineProps<iProps>();

const emit = defineEmits(['select-row', 'update:trigger']);

const modal = reactive({
  alertModalState: { open: false },
});
const isRunLoading = ref<boolean>(false);
const isDataLoaded = ref(false);
const tableKey = ref(0); // key for forcing a component re-render

onBeforeMount(() => {
  initToolBoxTableModel();
});

onMounted(function (this: any) {
  fetchWorkflowList();
});

watch(isDataLoaded, nv => {
  if (nv && toolboxTableRef.value) {
    nextTick(() => {
      addDeleteIconAtTable.call({
        $refs: { toolboxTable: toolboxTableRef.value },
      });
    });
  }
});

function addDeleteIconAtTable(this: any) {
  const toolboxTable = this.$refs.toolboxTable.$el;
  const targetElement = toolboxTable.querySelector('.right-tool-group');
  const instance = insertDynamicComponent(
    DynamicTableIconButton,
    {
      name: 'ic_delete',
    },
    {
      click: () => {
        if (tableModel.tableState.selectIndex.length > 0) {
          modal.alertModalState.open = true;
        }
      },
    },
    targetElement,
    'prepend',
  );
  return instance;
}

function handleDeleteWorkflow() {
  const selectedWorkflowsIds: any[] = [];

  tableModel.tableState.selectIndex.reduce((acc, selectIndex) => {
    acc.push(tableModel.tableState.displayItems[selectIndex].id);
    return acc;
  }, selectedWorkflowsIds);

  if (selectedWorkflowsIds.length > 0) {
    useBulkDeleteWorkflow(selectedWorkflowsIds)
      .then(res => {
        handleRefreshTable();
        showSuccessMessage('success', 'Delete Success');
      })
      .catch(err => {
        showErrorMessage('Error', err);
      });
  }
}

function handleRefreshTable(keepSelection = false) {
  tableModel.initState();
  if (!keepSelection) {
    emit('select-row', '');
  }
  fetchWorkflowList();
}

function handleSelectedIndex(selectedIndex: number) {
  const selectedData = tableModel.tableState.displayItems[selectedIndex];
  if (selectedData) {
    emit('select-row', selectedData.id);
  } else {
    emit('select-row', '');
  }
}

/**
 * Align the table's highlight to the workflow currently being viewed.
 *
 * When the list is re-fetched the row order can change (a newly created workflow
 * slips in), but the table remembers the selection by *position index*. So if left
 * as-is you get a state where **the table points at A while the detail/run status
 * below shows B** — which is always the case right after a save.
 */
function highlightSelectedRow() {
  if (!props.selectedWfId) return;
  const index = tableModel.tableState.displayItems.findIndex(
    (item: any) => item?.id === props.selectedWfId,
  );
  tableModel.tableState.selectIndex = index >= 0 ? [index] : [];
}

async function fetchWorkflowList() {
  isDataLoaded.value = false;
  try {
    tableModel.tableState.loading = true;
    const { data } = await getWorkflowList.execute();
    if (data.status?.code === 200) {
      // With no workflows the response is [] or null. Both mean "none", not "failed", so keep the
      // list empty and let the empty state show. This used to raise a toast, and since
      // showErrorMessage always renders a red alert regardless of its first argument, a perfectly
      // normal empty list looked like an error.
      workflowStore.setWorkFlows(
        Array.isArray(data.responseData) ? data.responseData : [],
      );
    } else {
      workflowStore.setWorkFlows([]);
      showErrorMessage('Error', 'Failed to load the workflow list.');
    }
    nextTick(() => {
      isDataLoaded.value = true;
      // Re-render the component after data loads
      tableKey.value++;
      highlightSelectedRow();
    });
  } catch (e) {
    workflowStore.setWorkFlows([]);
    showErrorMessage('error', 'An error occurred while loading the workflow list.');
    isDataLoaded.value = true;
  } finally {
    tableModel.tableState.loading = false;
  }
}

async function handleRunWorkflow(e: any) {
  const selectedWfId: string =
    e.target.parentNode.parentNode.children[2].textContent.split(' ')[1];
  try {
    isRunLoading.value = true;

    const { data } = await runWorkflow.execute({
      pathParams: {
        wfId: selectedWfId,
      },
    });

    // @ts-ignore
    if (data.responseData?.message === 'success') {
      isRunLoading.value = false;
      showSuccessMessage(
        'success',
        `Workflow ID: ${selectedWfId} run successfully`,
      );
      // Hand it to the app-wide checker so the outcome is caught after leaving this screen.
      // The name has to be captured here — at completion there is only the run id.
      void trackWorkflow({
        wfId: selectedWfId,
        label:
          workflowStore.getWorkflowById(selectedWfId)?.name || selectedWfId,
        action: 'run',
      });
    }
  } catch (error) {
    console.log(error);
    showErrorMessage('failed', 'Workflow Run Failed');
  }
}

watch(
  () => props.trigger,
  nv => {
    if (nv) {
      // When a trigger fires after saving in WorkflowEditor, keep the selection.
      // Keep the selection if selectedWfId is present, otherwise reset it.
      const keepSelection = !!props.selectedWfId;
      handleRefreshTable(keepSelection);
      emit('update:trigger');
    }
  },
);
</script>

<template>
  <div>
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- Show a spinner while loading -->
        <table-loading-spinner
          :loading="
            getWorkflowList.isLoading.value || tableModel.tableState.loading
          "
          :height="height"
          message="Loading workflows..."
        />

        <!-- Show the table after loading completes -->
        <p-toolbox-table
          v-if="
            !getWorkflowList.isLoading.value && !tableModel.tableState.loading
          "
          ref="toolboxTableRef"
          data-testid="workflow-list-table"
          :items="tableModel.tableState.displayItems"
          :fields="tableModel.tableState.fields"
          :total-count="tableModel.tableState.tableCount"
          :style="{ height: `${height}px` }"
          :sortable="tableModel.tableOptions.sortable"
          :sort-by="tableModel.tableOptions.sortBy"
          :selectable="tableModel.tableOptions.selectable"
          :multi-select="tableModel.tableOptions.multiSelect"
          :search-type="tableModel.tableOptions.searchType"
          :key-item-sets="tableModel.querySearchState.keyItemSet"
          :value-handler-map="tableModel.querySearchState.valueHandlerMap"
          :query-tag="tableModel.querySearchState.queryTag"
          :select-index.sync="tableModel.tableState.selectIndex"
          :page-size="tableModel.tableOptions.pageSize"
          @change="tableModel.handleChange"
          @refresh="handleRefreshTable"
          @select="handleSelectedIndex"
        >
          <template #toolbox-left>
            <p-button disabled icon-left="ic_plus_bold">Add</p-button>
          </template>
          <template #th-run> &nbsp; </template>
          <template #col-run-format>
            <p-button
              data-testid="workflow-run-btn"
              style-type="tertiary"
              size="sm"
              @click="handleRunWorkflow"
            >
              Run
            </p-button>
          </template>
        </p-toolbox-table>
      </template>
    </p-horizontal-layout>
    <p-button-modal
      v-model="modal.alertModalState.open"
      :visible="modal.alertModalState.open"
      size="sm"
      backdrop
      theme-color="alert"
      header-title="Are you sure you want to delete it?"
      :hide-body="true"
      :hide-header-close-button="true"
      @confirm="
        () => {
          modal.alertModalState.open = false;
          handleDeleteWorkflow();
        }
      "
    />
  </div>
</template>
