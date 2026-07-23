<script setup lang="ts">
import { ref, onMounted, reactive, watch, onBeforeMount, computed, nextTick } from 'vue';
import {
  PToolboxTable,
  PHorizontalLayout,
  PButton,
  PButtonModal,
} from '@cloudforet-test/mirinae';
import { useCredentialsListModel } from '@/widgets/credentials/credentialsList/model/credentialsListModel';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import {
  useGetCredentialList,
  useDeleteCredentials,
} from '@/entities/credentials/api/index';
import {
  insertDynamicComponent,
  showErrorMessage,
  showSuccessMessage,
  toErrorMessage,
} from '@/shared/utils';
import DynamicTableIconButton from '@/shared/ui/Button/dynamicIconButton/DynamicTableIconButton.vue';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';

interface IProps {
  addModalState: boolean;
  trigger: boolean;
}

const props = defineProps<IProps>();
const emit = defineEmits([
  'select-row',
  'update:addModalState',
  'update:trigger',
  'update:title',
  'update:connection-title',
  'select:multi-row',
]);

const { tableModel, credentials, initToolBoxTableModel, configStore } =
  useCredentialsListModel();

// create the API call instance (uses its loading state)
const credentialListApi = useGetCredentialList();

// define tableOptions first (referenced by useDynamicTableHeight)
const tableOptions = ref({
  sortable: true,
  sortBy: '',
  selectable: true,
  multiSelect: true,
  pageSize: 10,
});

// use displayItems (more reactive than items)
const itemCount = computed(() => {
  const count = tableModel.tableState.displayItems?.length ?? 0;
  return count;
});

const { dynamicHeight, minHeight, maxHeight, config } = useDynamicTableHeight(
  itemCount,
  computed(() => tableOptions.value.pageSize),
  {
    minTableHeight: 193,  // default minimum height (based on 1 row)
  },
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

const isDataLoaded = ref(false);
const tableKey = ref(0); // key to force component re-render

onBeforeMount(() => {
  initToolBoxTableModel();
});

onMounted(function () {
  getCredentialList();
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
  newVal => {
    if (newVal) {
      getCredentialList();
      emit('update:trigger', false);
    }
  },
);

async function getCredentialList() {
  isDataLoaded.value = false;
  try {
    const res = await credentialListApi.execute();

    // When nothing is registered the credential key is null or absent. That is not an error, so
    // treat it as an empty list. Previously null.map() threw here and fell into the catch, which
    // reported a load failure on a perfectly good response.
    const credentials = res.data.responseData?.credential ?? [];
    configStore.setConfig(credentials);
    tableModel.tableState.displayItems = credentials.map((item: any) => ({
      configName: item.CredentialName,
      CredentialName: item.CredentialName,
      ProviderName: item.ProviderName,
    }));

    nextTick(() => {
      isDataLoaded.value = true;
      // re-render the component after data loads
      tableKey.value++;
    });
  } catch (e: any) {
    showErrorMessage(
      'Error',
      toErrorMessage(e, 'Failed to load the credential list.'),
    );
    isDataLoaded.value = true;
  }
}
// function addDeleteIconAtTable() {
//   const toolboxTable = this.$refs.toolboxTable.$el;
//   const targetElement = toolboxTable.querySelector('.right-tool-group');
//   const instance = insertDynamicComponent(
//     DynamicTableIconButton,
//     {
//       name: 'ic_delete',
//     },
//     {
//       click: () => {
//         if (tableModel.tableState.selectIndex.length > 0)
//           modals.alertModalState.open = true;
//       },
//     },
//     targetElement,
//     'prepend',
//   );
//   return instance;
// }
const selectIndex = ref<number[]>([]);

const querySearchState = ref({
  keyItemSet: tableModel.querySearchState.keyItemSet,
  valueHandlerMap: tableModel.querySearchState.valueHandlerMap,
  queryTag: tableModel.querySearchState.queryTag,
});

const modals = reactive({
  alertModalState: { open: false },
  addModalState: { open: props.addModalState },
});

function handleSelectedIndex(selectedIndex: number) {
  const selectedData = tableModel.tableState.displayItems[selectedIndex];
  if (!selectedData) {
    console.error('Invalid index selected:', selectedIndex);
    return;
  }

  // convert the Proxy object to a plain object
  const plainData = { ...selectedData };

  console.log('handleSelectedIndex - plainData:', plainData);

  emit('select-row', { id: plainData.CredentialName ?? '' });
}

function handleChange() {
  // implement when needed
}

function handleAddCredential() {
  emit('update:addModalState', true);
  emit('update:title', 'add');
  emit('update:connection-title', 'add');
}

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
        console.log('123123');
        // if (tableModel.tableState.selectIndex.length > 0) {
        console.log('123123', modals.alertModalState.open);
        modals.alertModalState.open = true;
        // }
      },
    },
    targetElement,
    'prepend',
  );
  return instance;
}
async function handleDeleteCredentials() {
  console.log('1aa23123123');
  const selectedCredentialIds = selectIndex.value.map(
    index => tableModel.tableState.displayItems[index].CredentialName,
  );

  if (selectedCredentialIds.length === 0) {
    showErrorMessage('Error', 'No Credential selected to delete.');
    return;
  }

  try {
    for (const credentialName of selectedCredentialIds) {
      const { data } = await useDeleteCredentials(credentialName).execute();

      if (data.status?.code === 200 && data.responseData?.Result === 'true') {
        // remove the Credential from the store
        configStore.removeCredentials([credentialName]);

        showSuccessMessage(
          'Success',
          `Credential '${credentialName}' deleted successfully.`,
        );
      } else {
        showErrorMessage(
          'Error',
          data.status?.message ||
            `Failed to delete Credential '${credentialName}'.`,
        );
      }
    }

    // refresh the list once all operations are done
    await getCredentialList();

    // reset the selection state
    selectIndex.value = [];
  } catch (error: any) {
    showErrorMessage(
      'Error',
      error.message || 'An error occurred during the delete request.',
    );
  } finally {
    // close the modal
    modals.alertModalState.open = false;
  }
}
</script>

<template>
  <div data-testid="credential-list">
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- show a spinner while loading -->
        <table-loading-spinner
          :loading="credentialListApi.isLoading.value"
          :height="height"
          message="Loading credentials..."
        />
        
        <!-- show the table after loading completes -->
        <p-toolbox-table
          v-if="!credentialListApi.isLoading.value"
          ref="toolboxTableRef"
          :items="tableModel.tableState.displayItems"
          :fields="tableModel.tableState.fields"
          :total-count="tableModel.tableState.displayItems.length"
          :style="{ height: `${height}px` }"
          :sortable="tableOptions.sortable"
          :sort-by="tableOptions.sortBy"
          :selectable="tableOptions.selectable"
          :multi-select="tableOptions.multiSelect"
          :key-item-sets="querySearchState.keyItemSet"
          :value-handler-map="querySearchState.valueHandlerMap"
          :query-tag="querySearchState.queryTag"
          :select-index.sync="selectIndex"
          :page-size="tableOptions.pageSize"
          @change="handleChange"
          @refresh="getCredentialList"
          @select="handleSelectedIndex"
        >
          <template #toolbox-left>
            <p-button
              style-type="primary"
              icon-left="ic_plus_bold"
              data-testid="credential-add"
              @click="handleAddCredential"
            >
              Add
            </p-button>
          </template>
        </p-toolbox-table>
      </template>
    </p-horizontal-layout>

    <!-- delete confirmation modal -->
    <p-button-modal
      v-model="modals.alertModalState.open"
      :visible="modals.alertModalState.open"
      size="sm"
      backdrop
      theme-color="alert"
      header-title="Are you sure you want to delete it?"
      :hide-body="true"
      :hide-header-close-button="true"
      @confirm="handleDeleteCredentials"
    />
  </div>
</template>

<style scoped>
</style>
