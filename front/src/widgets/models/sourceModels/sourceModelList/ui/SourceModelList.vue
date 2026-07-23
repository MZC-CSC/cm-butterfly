<script setup lang="ts">
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useSourceModelListModel } from '@/widgets/models/sourceModels/sourceModelList/model/sourceModelListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import { onBeforeMount, onMounted, reactive, watch, computed, ref, nextTick } from 'vue';
import {
  insertDynamicComponent,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import { useBulkDeleteSourceInfraModel, useBulkDeleteSourceCloudModel, useBulkDeleteSourceSoftwareModel, useGetSourceModelList } from '@/entities';
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
    minTableHeight: 193,  // Default minimum height (based on 1 row)
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
      sourceModelStore.setSourceModel(
        Array.isArray(res.data.responseData) ? res.data.responseData : [],
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
        console.log('📊 [SourceModelList] Number of selected items:', tableModel.tableState.selectIndex.length);
        console.log('📋 [SourceModelList] Selected indices:', tableModel.tableState.selectIndex);

        if (tableModel.tableState.selectIndex.length > 0) {
          console.log('✅ [SourceModelList] Opening delete confirmation modal');
          modals.alertModalState.open = true;
        } else {
          console.log('⚠️ [SourceModelList] No items selected, not opening the modal');
        }
      },
    },
    targetElement,
    'prepend',
  );
  return instance;
}

/**
 * Delete selected source models
 */
function multiDelete() {
  console.log('🗑️ [SourceModelList] multiDelete started');

  const selectedData = tableModel.tableState.selectIndex.map(index => {
    return tableModel.tableState.displayItems[index].id;
  });
  console.log('📋 [SourceModelList] Selected data ID list:', selectedData);

  // Check if any selected models are software models
  // Categorized the same way as View Recommended List on the Detail tab
  const selectedModels = tableModel.tableState.selectIndex.map(index => {
    return tableModel.tableState.displayItems[index];
  });
  console.log('🔍 [SourceModelList] Selected model details:', selectedModels);

  // Classify each model into exactly one category
  const softwareModelIds: string[] = [];
  const cloudModelIds: string[] = [];
  const onPremModelIds: string[] = [];

  selectedModels.forEach(model => {
    const modelType = model?.modelType;
    
    // Classify based on modelType
    if (modelType === 'SoftwareModel') {
      softwareModelIds.push(model.id);
      console.log(`🔧 [SourceModelList] Model ${model?.id} (${model?.name}) - classified as Software (modelType)`);
    } else if (modelType === 'CloudModel') {
      cloudModelIds.push(model.id);
      console.log(`☁️ [SourceModelList] Model ${model?.id} (${model?.name}) - classified as Cloud (modelType)`);
    } else if (modelType === 'OnPremiseModel') {
      onPremModelIds.push(model.id);
      console.log(`🏢 [SourceModelList] Model ${model?.id} (${model?.name}) - classified as OnPrem (modelType)`);
    } else {
      // Fall back to existing properties when modelType is missing
      const isSoftwareByMigrationType = model?.migrationType === 'Software';
      const isSoftwareByIsSoftwareModel = model?.isSoftwareModel;
      const isSoftwareByName = model?.name?.toLowerCase().includes('sw') || false;
      
      const isSoftware = isSoftwareByMigrationType || isSoftwareByIsSoftwareModel || isSoftwareByName;
      
      if (isSoftware) {
        softwareModelIds.push(model.id);
        console.log(`🔧 [SourceModelList] Model ${model?.id} (${model?.name}) - classified as Software (fallback)`, {
          migrationType: model?.migrationType,
          isSoftwareModel: model?.isSoftwareModel,
          nameContainsSw: isSoftwareByName
        });
      } else {
        // If not Software, classify as OnPrem (default)
        onPremModelIds.push(model.id);
        console.log(`🏢 [SourceModelList] Model ${model?.id} (${model?.name}) - classified as OnPrem (fallback)`, {
          migrationType: model?.migrationType,
          isSoftwareModel: model?.isSoftwareModel,
          nameContainsSw: isSoftwareByName
        });
      }
    }
  });

  console.log('📊 [SourceModelList] Classification result:', {
    softwareModelIds,
    cloudModelIds,
    onPremModelIds,
    softwareCount: softwareModelIds.length,
    cloudCount: cloudModelIds.length,
    onPremCount: onPremModelIds.length
  });

  const deletePromises = [];

  if (softwareModelIds.length > 0) {
    console.log('🚀 [SourceModelList] Calling Software model delete API:', softwareModelIds);
    const softwareDeletePromise = useBulkDeleteSourceSoftwareModel(softwareModelIds);
    console.log('📡 [SourceModelList] Software delete Promise object:', softwareDeletePromise);

    // Log network request info before the Promise resolves
    softwareDeletePromise.then(responses => {
      console.log('🌐 [SourceModelList] Software delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [SourceModelList] Software delete response ${index + 1}:`, {
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
      console.error('❌ [SourceModelList] Software delete network error:', error);
      if (error.config) {
        console.log('🔍 [SourceModelList] Software delete request info:', {
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
    console.log('🚀 [SourceModelList] Calling Cloud model delete API (DeleteCloudModel):', cloudModelIds);
    const cloudDeletePromise = useBulkDeleteSourceCloudModel(cloudModelIds);
    console.log('📡 [SourceModelList] Cloud delete Promise object:', cloudDeletePromise);

    // Log network request info before the Promise resolves
    cloudDeletePromise.then(responses => {
      console.log('🌐 [SourceModelList] Cloud delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [SourceModelList] Cloud delete response ${index + 1}:`, {
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
      console.error('❌ [SourceModelList] Cloud delete network error:', error);
      if (error.config) {
        console.log('🔍 [SourceModelList] Cloud delete request info:', {
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
    console.log('🚀 [SourceModelList] Calling OnPrem model delete API (DeleteOnPremModel):', onPremModelIds);
    const onPremDeletePromise = useBulkDeleteSourceInfraModel(onPremModelIds);
    console.log('📡 [SourceModelList] OnPrem delete Promise object:', onPremDeletePromise);

    // Log network request info before the Promise resolves
    onPremDeletePromise.then(responses => {
      console.log('🌐 [SourceModelList] OnPrem delete network response:', responses);
      responses.forEach((response, index) => {
        console.log(`📊 [SourceModelList] OnPrem delete response ${index + 1}:`, {
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
      console.error('❌ [SourceModelList] OnPrem delete network error:', error);
      if (error.config) {
        console.log('🔍 [SourceModelList] OnPrem delete request info:', {
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

  console.log('⏳ [SourceModelList] Running delete API Promises...');
  Promise.all(deletePromises)
    .then(res => {
      console.log('✅ [SourceModelList] Delete succeeded:', res);
      handleRefreshTable();
      tableModel.tableState.selectIndex = [];
      showSuccessMessage('success', 'Delete Success');
    })
    .catch(err => {
      console.error('❌ [SourceModelList] Delete failed:', err);
      showErrorMessage('Error', err);
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
  console.log('✅ [SourceModelList] Delete confirm button clicked - running delete');
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
    />
  </div>
</template>

<style scoped lang="postcss"></style>
