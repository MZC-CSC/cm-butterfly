<script setup lang="ts">
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useTargetModelListModel } from '@/widgets/models/targetModels/targetModelList/model/targetModelListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import { insertDynamicComponent, showErrorMessage, showSuccessMessage } from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import { onBeforeMount, onMounted, reactive, watch, computed, ref, nextTick } from 'vue';
import { useGetTargetModelList, useBulkDeleteTargetModel, useBulkDeleteTargetSoftwareModel, useBulkDeleteTargetOnPremModel } from '@/entities';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';

const { tableModel, initToolBoxTableModel, targetModelStore } =
  useTargetModelListModel();

const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
  computed(() => tableModel.tableState.displayItems?.length ?? 0),
  computed(() => tableModel.tableOptions.pageSize),
  {
    minTableHeight: 193,  // default minimum height (based on 1 row)
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

watch(isDataLoaded, (nv) => {
  if (nv && toolboxTableRef.value) {
    nextTick(() => {
      addDeleteIconAtTable.call({ $refs: { toolboxTable: toolboxTableRef.value } });
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
  return instance;
}

function getTableList() {
  isDataLoaded.value = false;
  resGetTargetModelList.execute().then(res => {
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
  }).catch(e => {
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
  console.log('🗑️ [TargetModelList] multiDelete start');

  const selectedData = tableModel.tableState.selectIndex.map(index => {
    return tableModel.tableState.displayItems[index].id;
  });
  console.log('📋 [TargetModelList] selected data ID list:', selectedData);

  // Check if any selected models are software models
  const selectedModels = tableModel.tableState.selectIndex.map(index => {
    return tableModel.tableState.displayItems[index];
  });
  console.log('🔍 [TargetModelList] selected model details:', selectedModels);

  // Classify each model into exactly one category
  const softwareModelIds: string[] = [];
  const cloudModelIds: string[] = [];
  const onPremModelIds: string[] = [];

  selectedModels.forEach(model => {
    const modelType = model?.modelType;
    
    // Classify based on modelType
    if (modelType === 'SoftwareModel') {
      softwareModelIds.push(model.id);
      console.log(`🔧 [TargetModelList] model ${model?.id} (${model?.name}) - Software classification (modelType)`);
    } else if (modelType === 'CloudModel') {
      cloudModelIds.push(model.id);
      console.log(`☁️ [TargetModelList] model ${model?.id} (${model?.name}) - Cloud classification (modelType)`);
    } else if (modelType === 'OnPremiseModel') {
      onPremModelIds.push(model.id);
      console.log(`🏢 [TargetModelList] model ${model?.id} (${model?.name}) - OnPrem classification (modelType)`);
    } else {
      // Fall back to legacy properties when modelType is missing
      const isSoftwareByTargetSoftwareModel = model?.targetSoftwareModel;
      const isSoftwareByMigrationType = model?.migrationType === 'software';
      const isSoftwareByName = model?.name?.toLowerCase().includes('sw') || false;
      
      const isSoftware = isSoftwareByTargetSoftwareModel || isSoftwareByMigrationType || isSoftwareByName;
      
      if (isSoftware) {
        softwareModelIds.push(model.id);
        console.log(`🔧 [TargetModelList] model ${model?.id} (${model?.name}) - Software classification (fallback)`, {
          targetSoftwareModel: model?.targetSoftwareModel,
          migrationType: model?.migrationType,
          nameContainsSw: isSoftwareByName
        });
      } else {
        // If not Software, classify as Cloud (default)
        cloudModelIds.push(model.id);
        console.log(`☁️ [TargetModelList] model ${model?.id} (${model?.name}) - Cloud classification (fallback)`, {
          targetSoftwareModel: model?.targetSoftwareModel,
          migrationType: model?.migrationType,
          nameContainsSw: isSoftwareByName
        });
      }
    }
  });

  console.log('📊 [TargetModelList] classification result:', {
    softwareModelIds,
    cloudModelIds,
    onPremModelIds,
    softwareCount: softwareModelIds.length,
    cloudCount: cloudModelIds.length,
    onPremCount: onPremModelIds.length
  });

  const deletePromises = [];

  if (softwareModelIds.length > 0) {
    console.log('🚀 [TargetModelList] Software model delete API call:', softwareModelIds);
    const softwareDeletePromise = useBulkDeleteTargetSoftwareModel(softwareModelIds);
    console.log('📡 [TargetModelList] Software delete Promise object:', softwareDeletePromise);

    // Log network request info before running the Promise
    softwareDeletePromise.then(responses => {
      console.log('🌐 [TargetModelList] Software delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [TargetModelList] Software delete response ${index + 1}:`, {
          status: response.status,
          statusText: response.statusText,
          method: response.config?.method?.toUpperCase(),
          url: response.config?.url,
          baseURL: response.config?.baseURL,
          fullURL: `${response.config?.baseURL}${response.config?.url}`,
          data: response.data
        });
      });
    }).catch(error => {
      console.error('❌ [TargetModelList] Software delete network error:', error);
      if (error.config) {
        console.log('🔍 [TargetModelList] Software delete request info:', {
          method: error.config.method?.toUpperCase(),
          url: error.config.url,
          baseURL: error.config.baseURL,
          fullURL: `${error.config.baseURL}${error.config.url}`,
          data: error.config.data
        });
      }
    });
    
    deletePromises.push(softwareDeletePromise);
  }

  if (cloudModelIds.length > 0) {
    console.log('🚀 [TargetModelList] Cloud model delete API call (DeleteCloudModel):', cloudModelIds);
    const cloudDeletePromise = useBulkDeleteTargetModel(cloudModelIds);
    console.log('📡 [TargetModelList] Cloud delete Promise object:', cloudDeletePromise);

    // Log network request info before running the Promise
    cloudDeletePromise.then(responses => {
      console.log('🌐 [TargetModelList] Cloud delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [TargetModelList] Cloud delete response ${index + 1}:`, {
          status: response.status,
          statusText: response.statusText,
          method: response.config?.method?.toUpperCase(),
          url: response.config?.url,
          baseURL: response.config?.baseURL,
          fullURL: `${response.config?.baseURL}${response.config?.url}`,
          data: response.data
        });
      });
    }).catch(error => {
      console.error('❌ [TargetModelList] Cloud delete network error:', error);
      if (error.config) {
        console.log('🔍 [TargetModelList] Cloud delete request info:', {
          method: error.config.method?.toUpperCase(),
          url: error.config.url,
          baseURL: error.config.baseURL,
          fullURL: `${error.config.baseURL}${error.config.url}`,
          data: error.config.data
        });
      }
    });
    
    deletePromises.push(cloudDeletePromise);
  }

  if (onPremModelIds.length > 0) {
    console.log('🚀 [TargetModelList] OnPrem model delete API call (DeleteOnPremModel):', onPremModelIds);
    const onPremDeletePromise = useBulkDeleteTargetOnPremModel(onPremModelIds);
    console.log('📡 [TargetModelList] OnPrem delete Promise object:', onPremDeletePromise);

    // Log network request info before running the Promise
    onPremDeletePromise.then(responses => {
      console.log('🌐 [TargetModelList] OnPrem delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [TargetModelList] OnPrem delete response ${index + 1}:`, {
          status: response.status,
          statusText: response.statusText,
          method: response.config?.method?.toUpperCase(),
          url: response.config?.url,
          baseURL: response.config?.baseURL,
          fullURL: `${response.config?.baseURL}${response.config?.url}`,
          data: response.data
        });
      });
    }).catch(error => {
      console.error('❌ [TargetModelList] OnPrem delete network error:', error);
      if (error.config) {
        console.log('🔍 [TargetModelList] OnPrem delete request info:', {
          method: error.config.method?.toUpperCase(),
          url: error.config.url,
          baseURL: error.config.baseURL,
          fullURL: `${error.config.baseURL}${error.config.url}`,
          data: error.config.data
        });
      }
    });
    
    deletePromises.push(onPremDeletePromise);
  }

  console.log('⏳ [TargetModelList] delete API Promises running...');
  Promise.all(deletePromises)
    .then(res => {
      console.log('✅ [TargetModelList] delete succeeded:', res);
      handleRefreshTable();
      tableModel.tableState.selectIndex = [];
      showSuccessMessage('success', 'Delete Success');
    })
    .catch(err => {
      console.error('❌ [TargetModelList] delete failed:', err);
      showErrorMessage('Error', err);
    });
}

/**
 * Refresh table data
 */
function handleRefreshTable() {
  getTableList();
}

/**
 * Handle delete confirmation
 */
function handleDeleteConfirm() {
  console.log('✅ [TargetModelList] delete-confirm button clicked - running delete');
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
    />
  </div>
</template>

<style scoped lang="postcss"></style>
