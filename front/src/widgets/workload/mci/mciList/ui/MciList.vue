<script setup lang="ts">
import { useMciListModel } from '@/widgets/workload/mci/mciList/model';
import {
  PButton,
  PHorizontalLayout,
  PToolboxTable,
  PBadge,
  PSelectDropdown,
} from '@cloudforet-test/mirinae';
import {
  onBeforeMount,
  onMounted,
  onUnmounted,
  reactive,
  computed,
  ref,
  watch,
} from 'vue';
import MciDeleteModal from './MciDeleteModal.vue';
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
import { useDynamicTableHeight } from '@/shared/hooks/table/useDynamicTableHeight';
import { useToolboxTableHeight } from '@/shared/hooks/table/useToolboxTableHeight';
import { useGetBeetleRequest } from '@/entities/mci/api';
import {
  allDeleteRecords,
  getDeleteRecord,
  updateDeleteStatus,
  clearDeleteRecord,
  type DeleteRecord,
} from '@/entities/mci/lib/deleteTracker';

interface IProps {
  nsId: string;
}

const props = defineProps<IProps>();
const emit = defineEmits(['selectRow']);

const { mciTableModel, initToolBoxTableModel, fetchMciList, loading } =
  useMciListModel(props);

const { dynamicHeight, minHeight, maxHeight } = useDynamicTableHeight(
  computed(() => mciTableModel.tableState.items.length),
  computed(() => mciTableModel.tableOptions.pageSize),
);

const { toolboxTableRef, adjustedDynamicHeight } = useToolboxTableHeight(
  computed(() => dynamicHeight.value),
);

const tableKey = ref(0); // 컴포넌트 재렌더링을 위한 key

const mciCreateModalState = reactive({
  open: false,
  props: {},
});

const isActionDisabled = computed(() => {
  return mciTableModel.tableState.selectIndex.length === 0;
});

const actionState = reactive({
  actionMenus: computed(() => [
    { name: 'delete', label: 'Delete', disabled: isActionDisabled.value },
  ]),
  selectedActionItem: '',
});

const deleteModalState = reactive({
  visible: false,
});

const selectedMciList = computed(() => {
  return mciTableModel.tableState.selectIndex.map(index => {
    return mciTableModel.tableState.displayItems[index];
  });
});

function handleDelete(item: string) {
  if (item === 'delete') {
    deleteModalState.visible = true;
  }
}

async function handleDeleted() {
  await fetchMciList();
  // 데이터 로드 후 컴포넌트 재렌더링
  tableKey.value++;
}

function handleSelectedIndex(index: number[]) {
  if (index.length === 1) {
    const selectedData = mciTableModel.tableState.displayItems[index[0]];
    if (selectedData) {
      emit('selectRow', selectedData.name);
    } else {
      emit('selectRow', '');
    }
  } else {
    emit('selectRow', '');
  }
}

// ── 삭제 상태 추적 (BAR-1444) ──────────────────────────────────────────────
// 현재 목록에 뜬 인프라 중 삭제 요청이 있는 것의 상태를 `삭제 상태` 컬럼으로 보여준다.
// 삭제 요청이 하나도 없으면 컬럼 자체가 나타나지 않는다.

/** 현재 표시 중인 행 이름 집합에 걸린 삭제 기록만 추린다. */
function activeRecords(): DeleteRecord[] {
  const names = new Set(
    mciTableModel.tableState.displayItems.map((it: any) => it?.name),
  );
  return allDeleteRecords().filter(r => names.has(r.infraId));
}

const hasActiveDeletes = computed(() => activeRecords().length > 0);

/** 슬롯에서 행별 삭제 기록 조회. */
function deleteStatusOf(name: string): DeleteRecord | undefined {
  return getDeleteRecord(name);
}

// 삭제 요청이 있을 때만 `삭제 상태` 컬럼을 넣고, 없으면 뺀다.
const DELETE_STATUS_FIELD = { name: 'deleteStatus', label: '삭제 상태' };
watch(hasActiveDeletes, active => {
  const fields = mciTableModel.tableState.fields;
  const idx = fields.findIndex((f: any) => f.name === 'deleteStatus');
  if (active && idx === -1) {
    // 첫 컬럼(name) 바로 뒤에 끼운다.
    const nameIdx = fields.findIndex((f: any) => f.name === 'name');
    fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, {
      ...DELETE_STATUS_FIELD,
    });
  } else if (!active && idx !== -1) {
    fields.splice(idx, 1);
  }
});

// Handling 상태의 요청을 폴링해 상태를 이어 받는다(화면 이동·새로고침 뒤 복구용).
// 같은 페이지에서 방금 삭제한 건은 모달의 execute() 프라미스가 이미 상태를 갱신하지만,
// 새로고침하면 그 프라미스가 사라지므로 reqId 로 다시 조회한다.
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function pollDeleteStatuses() {
  const handling = activeRecords().filter(r => r.status === 'Handling');
  if (handling.length === 0) return;

  for (const rec of handling) {
    try {
      const res: any = await useGetBeetleRequest(rec.reqId).execute();
      // cm-beetle GET /request/{reqId} 는 RequestDetails 를 ApiResponse 로 감싸고,
      // 그게 다시 우리 프록시(CommonResponse)로 감싸여 온다. 권위 있는 값은
      // RequestDetails.status(Handling|Success|Error) 와 errorResponse(실패 사유)다.
      // 단계(stage)별 진행 정보는 삭제 경로에 없다(cb-tumblebug·cm-beetle 최신 확인) —
      // 그래서 status 만 읽는다.
      const details =
        res?.data?.responseData?.data ??
        res?.data?.data ??
        res?.data?.responseData ??
        res?.data ??
        res;
      const status = String(details?.status ?? '').toLowerCase();
      if (status === 'success') {
        updateDeleteStatus(rec.infraId, 'Success');
      } else if (status === 'error') {
        updateDeleteStatus(
          rec.infraId,
          'Error',
          details?.errorResponse || undefined,
        );
      }
      // handling 이면 그대로 둔다.
    } catch (e: any) {
      // 조회 자체가 실패하면(예: reqId 만료) 진행 상태를 바꾸지 않고 다음 주기에 재시도.
      // 단 그 인프라가 목록에서 사라졌으면 기록을 정리한다.
      const stillListed = mciTableModel.tableState.displayItems.some(
        (it: any) => it?.name === rec.infraId,
      );
      if (!stillListed) clearDeleteRecord(rec.infraId);
    }
  }
}

// Success 로 바뀐 기록이 있으면 목록을 새로 불러온다(행이 사라지고 기록도 정리).
watch(
  () =>
    allDeleteRecords()
      .map(r => `${r.infraId}:${r.status}`)
      .join(','),
  async () => {
    const done = activeRecords().filter(r => r.status === 'Success');
    if (done.length > 0) {
      done.forEach(r => clearDeleteRecord(r.infraId));
      await fetchMciList();
      tableKey.value++;
    }
  },
);

onBeforeMount(() => {
  initToolBoxTableModel();
});

onMounted(async () => {
  await fetchMciList();
  // 초기 데이터 로드 후 컴포넌트 재렌더링
  tableKey.value++;
  pollTimer = setInterval(pollDeleteStatuses, 5000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div>
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- 로딩 중일 때 스피너 표시 -->
        <table-loading-spinner
          :loading="loading"
          :height="height"
          message="Loading Infra list..."
        />

        <!-- 로딩 완료 후 테이블 표시 -->
        <p-toolbox-table
          v-if="!loading"
          ref="toolboxTableRef"
          data-testid="mci-list-table"
          :items="mciTableModel.tableState.displayItems"
          :fields="mciTableModel.tableState.fields"
          :total-count="mciTableModel.tableState.tableCount"
          :style="{ height: `${height}px` }"
          :sortable="mciTableModel.tableOptions.sortable"
          :sort-by="mciTableModel.tableOptions.sortBy"
          :selectable="mciTableModel.tableOptions.selectable"
          :multi-select="mciTableModel.tableOptions.multiSelect"
          :search-type="mciTableModel.tableOptions.searchType"
          :key-item-sets="mciTableModel.querySearchState.keyItemSet"
          :value-handler-map="mciTableModel.querySearchState.valueHandlerMap"
          :query-tag="mciTableModel.querySearchState.queryTag"
          :select-index.sync="mciTableModel.tableState.selectIndex"
          :page-size="mciTableModel.tableOptions.pageSize"
          @change="mciTableModel.handleChange"
          @refresh="fetchMciList"
          @select="handleSelectedIndex"
        >
          <template #toolbox-left>
            <p-select-dropdown
              data-testid="mci-action-dropdown"
              placeholder="Action"
              :menu="actionState.actionMenus"
              :selected.sync="actionState.selectedActionItem"
              reset-selected-on-unmounted
              class="mr-2"
              @select="handleDelete"
            />
            <p-button
              style-type="primary"
              icon-left="ic_plus_bold"
              disabled
              @click="mciCreateModalState.open = true"
            >
              Create
            </p-button>
          </template>
          <template #col-provider-format="{ item, field }">
            <p-badge
              v-for="(provider, index) in item.provider"
              :key="index"
              :background-color="provider.color"
              class="mr-1"
            >
              {{ provider.name }}
            </p-badge>
          </template>
          <template #col-deleteStatus-format="{ item }">
            <span
              v-if="deleteStatusOf(item.name)?.status === 'Handling'"
              class="delete-status handling"
              data-testid="wl-row-delete-status"
            >
              <span class="spinner" /> 진행 중
            </span>
            <span
              v-else-if="deleteStatusOf(item.name)?.status === 'Error'"
              class="delete-status error-cell"
              data-testid="wl-row-delete-status"
            >
              에러
              <span
                v-if="deleteStatusOf(item.name)?.errorReason"
                class="error-popover"
                data-testid="wl-delete-error-popover"
                >{{ deleteStatusOf(item.name)?.errorReason }}</span
              >
            </span>
          </template>
        </p-toolbox-table>
      </template>
    </p-horizontal-layout>
    <mci-delete-modal
      :visible.sync="deleteModalState.visible"
      :selected-mci-list="selectedMciList"
      :ns-id="nsId"
      @deleted="handleDeleted"
    />
  </div>
</template>

<style scoped lang="postcss">
.delete-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
}
.delete-status.handling {
  color: #6b7280;
}
.delete-status .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #d1d5db;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: wl-delete-spin 0.8s linear infinite;
}
@keyframes wl-delete-spin {
  to {
    transform: rotate(360deg);
  }
}
/* 에러 사유는 마우스오버 즉시 레이어 팝업으로(툴팁 지연 없이). 사유가 있을 때만 표시된다. */
.delete-status.error-cell {
  position: relative;
  color: #dc2626;
  font-weight: 600;
  cursor: default;
}
.delete-status.error-cell .error-popover {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  max-width: 360px;
  padding: 8px 10px;
  background: #1f2937;
  color: #f9fafb;
  font-weight: 400;
  border-radius: 6px;
  white-space: normal;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
.delete-status.error-cell:hover .error-popover {
  display: block;
}
</style>
