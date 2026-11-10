<script setup lang="ts">
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useSourceModelListModel } from '@/widgets/models/sourceModels/sourceModelList/model/sourceModelListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import {
  onBeforeMount,
  onMounted,
  reactive,
  watch,
  computed,
  ref,
  nextTick,
} from 'vue';
import {
  insertDynamicComponent,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import {
  useGetSourceModelList,
  isSourceSideModel,
  isInfraOrSoftwareModel,
} from '@/entities';
import { deleteModels, formatDeleteFailures } from '@/entities/migrationModel';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';

interface IProps {
  trigger: boolean;
}

const props = defineProps<IProps>();
const emit = defineEmits(['select-row', 'update:trigger']);

const { tableModel, initToolBoxTableModel, sourceModelStore } =
  useSourceModelListModel();

const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
  computed(() => tableModel.tableState.displayItems?.length ?? 0),
  computed(() => tableModel.tableOptions.pageSize),
  {
    minTableHeight: 193, // Default minimum height (based on 1 row)
  },
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

const modals = reactive({
  alertModalState: { open: false },
  sourceModelAddModalState: { open: false },
});

const resSourceList = useGetSourceModelList();
const isDataLoaded = ref(false);
const tableKey = ref(0); // key used to force the component to re-render

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
    getTableList();
    emit('update:trigger', false);
  },
);

function getTableList() {
  isDataLoaded.value = false;
  resSourceList
    .execute()
    .then(res => {
      // cm-damselfly returns 200 with a null body when there are no models, not an empty array.
      // Guarding with `if (responseData)` therefore skipped the update and left the previous fetch's
      // rows on screen. Always write, coercing to [].
      // Source and planning models share this list (GetModels is asked for every stage).
      sourceModelStore.setSourceModel(
        Array.isArray(res.data.responseData)
          ? res.data.responseData.filter(
              m => isSourceSideModel(m) && isInfraOrSoftwareModel(m),
            )
          : [],
      );
      nextTick(() => {
        isDataLoaded.value = true;
        // Re-render the component after data loads
        tableKey.value++;
      });
    })
    .catch(e => {
      showErrorMessage('error', e.errorMsg);
      isDataLoaded.value = true;
    });
}

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
        console.log('🔘 [SourceModelList] Delete button clicked');
        console.log(
          '📊 [SourceModelList] Number of selected items:',
          tableModel.tableState.selectIndex.length,
        );
        console.log(
          '📋 [SourceModelList] Selected indices:',
          tableModel.tableState.selectIndex,
        );

        if (tableModel.tableState.selectIndex.length > 0) {
          console.log('✅ [SourceModelList] Opening delete confirmation modal');
          modals.alertModalState.open = true;
        } else {
          console.log(
            '⚠️ [SourceModelList] No items selected, not opening the modal',
          );
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

/**
 * Delete selected source models
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

function handleSelectedIndex(selectedIndex: number) {
  const selectedData = tableModel.tableState.displayItems[selectedIndex];
  if (selectedData) {
    emit('select-row', { id: selectedData.id, name: selectedData.name ?? '' });
  } else {
    emit('select-row', { id: '', name: '' });
  }
}

function handleDeleteConfirm() {
  console.log(
    '✅ [SourceModelList] Delete confirm button clicked - running delete',
  );
  multiDelete();
  modals.alertModalState.open = false;
  console.log('🔒 [SourceModelList] Closing delete confirmation modal');
}
</script>

<template>
  <div>
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- Show a spinner while loading -->
        <table-loading-spinner
          :loading="resSourceList.isLoading.value"
          :height="height"
          message="Loading source models..."
        />

        <!-- Show the table once loading is done -->
        <p-toolbox-table
          v-if="!resSourceList.isLoading.value"
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
          @refresh="handleRefreshTable"
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
