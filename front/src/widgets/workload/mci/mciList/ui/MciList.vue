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
import {
  allDeleteRecords,
  getDeleteRecord,
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

const tableKey = ref(0); // bumped to force the table to re-render

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
  // re-render once the data has loaded
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

// ── Delete status ──────────────────────────────────────────────────────────
// Shows a `Delete Status` column for any listed infra that has a delete request against it.
// With no delete requests at all, the column does not appear.

/** Narrows the delete records to those matching the rows currently on screen. */
function activeRecords(): DeleteRecord[] {
  const uids = new Set(
    mciTableModel.tableState.displayItems.map((it: any) => it?.uid),
  );
  return allDeleteRecords().filter(r => uids.has(r.uid));
}

const hasActiveDeletes = computed(() => activeRecords().length > 0);

/** Looks up one row's delete record from the slot. */
function deleteStatusOf(uid: string): DeleteRecord | undefined {
  return getDeleteRecord(uid);
}

// Add the `Delete Status` column only while delete requests exist; drop it otherwise.
const DELETE_STATUS_FIELD = { name: 'deleteStatus', label: 'Delete Status' };
watch(hasActiveDeletes, active => {
  const fields = mciTableModel.tableState.fields;
  const idx = fields.findIndex((f: any) => f.name === 'deleteStatus');
  if (active && idx === -1) {
    // insert right after the first column (name)
    const nameIdx = fields.findIndex((f: any) => f.name === 'name');
    fields.splice(nameIdx === -1 ? 0 : nameIdx + 1, 0, {
      ...DELETE_STATUS_FIELD,
    });
  } else if (!active && idx !== -1) {
    fields.splice(idx, 1);
  }
});

// This screen does not poll for status. deleteTracker runs app-wide, so results arrive even
// while another screen is open; here they are only displayed.

onBeforeMount(() => {
  initToolBoxTableModel();
});

onMounted(async () => {
  await fetchMciList();
  // re-render after the initial data load
  tableKey.value++;
});
</script>

<template>
  <div>
    <p-horizontal-layout :key="tableKey" :height="adjustedDynamicHeight">
      <template #container="{ height }">
        <!-- spinner while loading -->
        <table-loading-spinner
          :loading="loading"
          :height="height"
          message="Loading Infra list..."
        />

        <!-- table once loading has finished -->
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
              v-if="deleteStatusOf(item.uid)?.status === 'Handling'"
              class="delete-status handling"
              data-testid="wl-row-delete-status"
            >
              <span class="spinner" /> In progress
            </span>
            <!--
              The reason is carried twice. The styled popover can be clipped by the table's
              scroll area, so a native `title` carries it as well — the browser draws that one
              and no container can trap it. With no reason, say where one can be obtained.
            -->
            <span
              v-else-if="deleteStatusOf(item.uid)?.status === 'Error'"
              class="delete-status error-cell"
              data-testid="wl-row-delete-status"
              :title="
                deleteStatusOf(item.uid)?.errorReason ||
                'No reason was returned. Deleting it again shows the reason before it starts.'
              "
            >
              Failed
              <span
                v-if="deleteStatusOf(item.uid)?.errorReason"
                class="error-popover"
                data-testid="wl-delete-error-popover"
                >{{ deleteStatusOf(item.uid)?.errorReason }}</span
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
/* The reason appears on hover with no tooltip delay, and only when there is one. */
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
  /* Anchored left, a long reason runs past the right edge of the table and is clipped. */
  right: 0;
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
