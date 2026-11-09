<script setup lang="ts">
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useTargetModelListModel } from '@/widgets/models/targetModels/targetModelList/model/targetModelListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import {
  insertDynamicComponent,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import {
  onBeforeMount,
  onMounted,
  reactive,
  watch,
  computed,
  ref,
  nextTick,
} from 'vue';
import { useGetTargetModelList } from '@/entities';
import { deleteModels, formatDeleteFailures } from '@/entities/migrationModel';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';

const { tableModel, initToolBoxTableModel, targetModelStore } =
  useTargetModelListModel();

const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
  computed(() => tableModel.tableState.displayItems?.length ?? 0),
  computed(() => tableModel.tableOptions.pageSize),
  {
    minTableHeight: 193, // default minimum height (based on 1 row)
  },
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

interface IProps {
  trigger: boolean;
}

const props = defineProps<IProps>();

const emit = defineEmits(['select-row', 'update:trigger']);

const isDataLoaded = ref(false);
const tableKey = ref(0); // key for forcing a component re-render

const modals = reactive({
  alertModalState: { open: false },
  sourceModelAddModalState: { open: false },
});

const resGetTargetModelList = useGetTargetModelList();

onBeforeMount(() => {
  initToolBoxTableModel();
});

onMounted(function () {
  getTableList();
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

watch(
  () => props.trigger,
  () => {
    tableModel.tableState.selectIndex = [];
    getTableList();
    emit('update:trigger', false);
  },
);

function addDeleteIconAtTable() {
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
          modals.alertModalState.open = true;
        }
      },
    },
    targetElement,
    'prepend',
  );
  // The injected delete icon carries no attributes of its own; give it one for e2e.
  instance.$el.setAttribute('data-testid', 'model-list-delete');
  return instance;
}

function getTableList() {
  isDataLoaded.value = false;
  resGetTargetModelList
    .execute()
    .then(res => {
      // cm-damselfly returns 200 with a null body when there are no models, not an empty array.
      // Guarding with `if (responseData)` therefore skipped the update and left the previous fetch's
      // rows on screen — delete the last model and it stayed visible. Always write, coercing to [].
      targetModelStore.setTargetModel(
        Array.isArray(res.data.responseData) ? res.data.responseData : [],
      );
      nextTick(() => {
        isDataLoaded.value = true;
        // Re-render the component after data loads
        tableKey.value++;
      });
    })
    .catch(e => {
      isDataLoaded.value = true;
    });
}

function handleSelectedIndex(selectedIndex: number) {
  const selectedData = tableModel.tableState.displayItems[selectedIndex];
  if (selectedData) {
    emit('select-row', { id: selectedData.id, name: selectedData.name });
  } else {
    emit('select-row', '');
  }
}

/**
 * Delete selected target models
 */
function multiDelete() {
  const selectedModels = tableModel.tableState.selectIndex.map(
    index => tableModel.tableState.displayItems[index].originalData,
  );

  // DeleteInfraModel covers on-premise and cloud models alike; software models are deleted by stage.
  // A model other models were derived from is refused (409) and reported, never force-deleted.
  deleteModels(selectedModels)
    .then(failures => {
      handleRefreshTable();
      tableModel.tableState.selectIndex = [];
      if (failures.length === 0) {
        showSuccessMessage('success', 'Delete Success');
      } else {
        showErrorMessage('Error', formatDeleteFailures(failures));
      }
    })
    .catch(err => {
      showErrorMessage('Error', err?.message ?? String(err));
    });
}

function handleRefreshTable() {
  getTableList();
}

/**
 * Handle delete confirmation
 */
function handleDeleteConfirm() {
  console.log(
    '✅ [TargetModelList] delete-confirm button clicked - running delete',
  );
  multiDelete();
  modals.alertModalState.open = false;
  console.log('🔒 [TargetModelList] closing delete-confirm modal');
}
</script>

<template>
  <div>
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- Show a spinner while loading -->
        <table-loading-spinner
          :loading="resGetTargetModelList.isLoading.value"
          :height="height"
          message="Loading target models..."
        />

        <!-- Show the table after loading completes -->
        <p-toolbox-table
          v-if="!resGetTargetModelList.isLoading.value"
          ref="toolboxTableRef"
          data-testid="model-list-table"
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
          @refresh="getTableList"
          @select="handleSelectedIndex"
        >
          <template #toolbox-left>
            <p-button style-type="primary" icon-left="ic_plus_bold" disabled>
              Add
            </p-button>
          </template>
        </p-toolbox-table>
      </template>
    </p-horizontal-layout>
    <p-button-modal
      v-model="modals.alertModalState.open"
      :visible="modals.alertModalState.open"
      size="sm"
      backdrop
      theme-color="alert"
      header-title="Are you sure you want to delete it?"
      :hide-body="true"
      :hide-header-close-button="true"
      @confirm="handleDeleteConfirm"
    >
      <template #confirm-button>
        <span data-testid="model-list-delete-confirm">OK</span>
      </template>
    </p-button-modal>
  </div>
</template>

<style scoped lang="postcss"></style>
