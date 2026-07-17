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
      // 검색어를 넣으면 필터 결과를 1페이지부터 보여준다. 이전 페이지 위치(startPage)를
      // 그대로 두면 필터된 항목 수가 그 페이지보다 적을 때 빈 화면이 나온다.
      tableState.currentPage = 1;
      tableState.startPage = 1;

      // 부분 문자열(대소문자 무시) 매칭. 정규식을 쓰지 않는 이유: (1) 사용자가 입력한
      // '.'·'(' 같은 문자가 정규식 메타문자로 해석돼 깨지고, (2) /g 플래그가 붙은 정규식의
      // .test()는 lastIndex를 누적하는 stateful 동작이라 한 행의 값들을 순회하며 테스트하면
      // 결과가 들쭉날쭉해진다. 실제로 검색이 필터에 걸리지 않던 원인이 이것이다.
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

    // 현재 페이지 창을 그대로 잘라 낸다. 기존 endIdx 는 startPage(아이템 오프셋)에
    // pageSize 를 더해 startIdx(페이지 번호 기반)와 의미가 섞여 페이지마다 한 건씩
    // 모자라거나 검색 후 잘못된 구간을 잘랐다. startIdx 기준으로 일관되게 맞춘다.
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
