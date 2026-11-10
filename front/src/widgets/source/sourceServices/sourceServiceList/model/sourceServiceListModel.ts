import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import { useSourceServiceStore } from '@/entities/sourceService/model/stores';
import { storeToRefs } from 'pinia';
import { useGetSourceServiceList } from '@/entities/sourceService/api';
import {
  ISourceService,
  SourceServiceTableType,
  groupTypeOf,
  SOURCE_GROUP_TYPE_LABEL,
  SourceGroupTypeValue,
  sourceTypeLabel,
} from '@/entities/sourceService/model/types';
import { ref, watch } from 'vue';

/**
 * Every source group type shares one list. cm-honeybee keeps the type on each source group
 * but its list API takes no type filter, so the list is narrowed here from the loaded groups.
 */
export const SOURCE_GROUP_TYPE_FILTER_ITEMS = [
  { name: '', label: 'All types' },
  ...(Object.keys(SOURCE_GROUP_TYPE_LABEL) as SourceGroupTypeValue[]).map(
    t => ({ name: t, label: SOURCE_GROUP_TYPE_LABEL[t] }),
  ),
];

export function useSourceServiceListModel() {
  const kindFilter = ref<'' | SourceGroupTypeValue>('');
  const tableModel =
    useToolboxTableModel<Partial<Record<SourceServiceTableType, any>>>();
  const sourceServicesStore = useSourceServiceStore();
  const { services } = storeToRefs(sourceServicesStore);

  const resSourceServiceList = useGetSourceServiceList();

  function initToolBoxTableModel() {
    tableModel.tableState.fields = [
      { name: 'name', label: 'Name' },
      { name: 'id', label: 'id' },
      { name: 'sourceType', label: 'Type' },
      { name: 'description', label: 'Description' },
      { name: 'connectionCount', label: 'Connection #' },
    ];

    tableModel.querySearchState.keyItemSet = [
      {
        title: 'columns',
        items: [
          { name: 'id', label: 'Id' },
          {
            name: 'name',
            label: 'Name',
          },
          { name: 'description', label: 'Description' },
          { name: 'connection', label: 'Connection' },
        ],
      },
    ];
  }

  function organizeSourceServiceTableItem(sourceService: ISourceService) {
    const organizedDatum: Partial<
      Record<SourceServiceTableType | 'originalData', any>
    > = {
      name: sourceService.name,
      description: sourceService.description || '-',
      connectionCount: sourceService.connectionCount ?? '',
      sourceType: sourceTypeLabel(sourceService),
      id: sourceService.id,
      originalData: sourceService,
    };
    return organizedDatum;
  }

  function ofKind(service: ISourceService) {
    const k = kindFilter.value;
    if (!k) return true;
    return groupTypeOf(service.type) === k;
  }

  watch(
    [services, kindFilter],
    ([nv]) => {
      tableModel.tableState.items = nv
        .filter(ofKind)
        .map(value => organizeSourceServiceTableItem(value));
    },
    { immediate: true },
  );

  return {
    tableModel,
    kindFilter,
    services,
    sourceServicesStore,
    resSourceServiceList,
    initToolBoxTableModel,
  };
}
