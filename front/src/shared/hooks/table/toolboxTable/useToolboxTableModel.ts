import { computed, reactive, watch } from 'vue';
import {
  ChangeEvent,
  ITableField,
  ITableItems,
} from '@/shared/hooks/table/toolboxTable/types';
import { isNullOrUndefined } from '@/shared/utils';

type ITableState<T> = {
  loading: boolean;
  fields: ITableField<ITableItems<T>>[];
  items: ITableItems<T>[];
  selectIndex: number[];
  sortedItems: ITableItems<T>[];
  displayItems: ITableItems<T>[];
  currentPage: number;
  startPage: number;
  tableCount: number;
};

export const useToolboxTableModel = <T>() => {
  const tableState: ITableState<T> = reactive({
    loading: true,
    fields: [],
    items: [],
    selectIndex: [],
    sortedItems: [],
    displayItems: [],
    currentPage: 1,
    startPage: 1,
    tableCount: 0,
  });

  tableState.tableCount = computed<number>(
    () => tableState.sortedItems.length,
  ) as unknown as number;

  const tableOptions = reactive({
    sortable: true,
    sortBy: 'name',
    selectable: true,
    multiSelect: true,
    searchType: 'query',
    pageSize: 15,
  });

  const querySearchState = reactive<any>({
    keyItemSets: [],
    valueHandlerMap: {},
    queryTag: [],
  });

  const tableSort = (
    items: any[],
    sortBy: string,
    sortDesc: boolean,
  ): any[] => {
    return [
      ...items.sort((a: any, b: any) => {
        const valA = a[sortBy];
        const valB = b[sortBy];

        let comparison = 0;

        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (valA instanceof Date && valB instanceof Date) {
          comparison = valA.getTime() - valB.getTime();
        } else {
          comparison = JSON.stringify(valA).localeCompare(JSON.stringify(valB));
        }

        return sortDesc ? -comparison : comparison;
      }),
    ];
  };

  const updatePagination = (e: ChangeEvent) => {
    if (e?.pageStart) {
      tableState.startPage = e.pageStart;
      tableState.currentPage =
        Math.floor(e.pageStart / tableOptions.pageSize) + 1;
    }
    if (e?.pageLimit) {
      tableOptions.pageSize = e.pageLimit;
    }
  };

  const matches = (haystack: unknown, needle: string): boolean =>
    typeof haystack === 'string' &&
    haystack.toLowerCase().includes(needle.toLowerCase());

  const applyQueryTags = (e: ChangeEvent) => {
    if (e?.queryTags?.length) {
      // When a search term is entered, show filtered results from page 1. Leaving the previous
      // page position (startPage) as-is produces an empty screen when the filtered item count is
      // smaller than that page.
      tableState.currentPage = 1;
      tableState.startPage = 1;

      // Case-insensitive substring matching. We avoid regex because: (1) characters the user
      // types like '.' or '(' would be interpreted as regex metacharacters and break, and (2)
      // .test() on a regex with the /g flag is stateful and accumulates lastIndex, so iterating
      // over a row's values gives inconsistent results. This was the actual cause of search not
      // filtering correctly.
      tableState.sortedItems = tableState.items.filter((row: any) =>
        e.queryTags!.every(queryTag => {
          const needle = queryTag.value.name;
          if (queryTag.key === null) {
            return Object.values(row).some(value => matches(value, needle));
          }
          return matches(row[queryTag.key.name], needle);
        }),
      );
    } else if (e?.queryTags?.length === 0) {
      tableState.sortedItems = tableState.items;
    }
  };

  const applySorting = (e: ChangeEvent) => {
    if (!isNullOrUndefined(e?.sortBy) && !isNullOrUndefined(e?.sortDesc)) {
      tableState.sortedItems = tableSort(
        tableState.sortedItems,
        e.sortBy!,
        e.sortDesc!,
      );
    }
  };
  const initState = () => {
    tableState.items = [];
    tableState.sortedItems = [];
    tableState.displayItems = [];
  };

  const handleChange = (e: any) => {
    tableState.loading = true;
    updatePagination(e);
    applyQueryTags(e);
    applySorting(e);

    // Slice out the current page window. The old endIdx added pageSize to startPage (an item
    // offset), mixing meaning with startIdx (page-number based), which left each page one item
    // short or sliced the wrong range after a search. Base everything consistently on startIdx.
    const startIdx = tableOptions.pageSize * (tableState.currentPage - 1);
    const endIdx = startIdx + tableOptions.pageSize;

    tableState.displayItems = tableState.sortedItems.slice(startIdx, endIdx);

    tableState.loading = false;
  };

  watch(
    () => tableState.items,
    () => {
      tableState.sortedItems = tableState.items;
      handleChange(null);
    },
  );

  return {
    tableOptions,
    tableState,
    querySearchState,
    handleChange,
    initState,
  };
};
