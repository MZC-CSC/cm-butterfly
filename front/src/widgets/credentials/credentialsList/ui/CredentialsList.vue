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

// API 호출 인스턴스 생성 (loading 상태 활용)
const credentialListApi = useGetCredentialList();

// tableOptions를 먼저 정의 (useDynamicTableHeight에서 참조하므로)
const tableOptions = ref({
  sortable: true,
  sortBy: '',
  selectable: true,
  multiSelect: true,
  pageSize: 10,
});

// displayItems를 사용 (items보다 반응성이 좋음)
const itemCount = computed(() => {
  const count = tableModel.tableState.displayItems?.length ?? 0;
  return count;
});

const { dynamicHeight, minHeight, maxHeight, config } = useDynamicTableHeight(
  itemCount,
  computed(() => tableOptions.value.pageSize),
  {
    minTableHeight: 193,  // 기본 최소 높이 (1개 row 기준)
  },
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

const isDataLoaded = ref(false);
const tableKey = ref(0); // 컴포넌트 재렌더링을 위한 key

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
      // 데이터 로드 후 컴포넌트 재렌더링
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

  // Proxy 객체를 일반 객체로 변환
  const plainData = { ...selectedData };

  console.log('handleSelectedIndex - plainData:', plainData);

  emit('select-row', { id: plainData.CredentialName ?? '' });
}

function handleChange() {
  // 필요 시 구현
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
        // Store에서 해당 Credential 제거
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

    // 모든 작업이 완료되면 리스트 새로고침
    await getCredentialList();

    // 선택 상태 초기화
    selectIndex.value = [];
  } catch (error: any) {
    showErrorMessage(
      'Error',
      error.message || 'An error occurred during the delete request.',
    );
  } finally {
    // 모달 닫기
    modals.alertModalState.open = false;
  }
}
</script>

<template>
  <div data-testid="credential-list">
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- 로딩 중일 때 스피너 표시 -->
        <table-loading-spinner
          :loading="credentialListApi.isLoading.value"
          :height="height"
          message="Loading credentials..."
        />
        
        <!-- 로딩 완료 후 테이블 표시 -->
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

    <!-- 삭제 확인 모달 -->
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
