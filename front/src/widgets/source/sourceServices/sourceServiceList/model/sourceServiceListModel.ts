import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import { useSourceServiceStore } from '@/entities/sourceService/model/stores';
import { storeToRefs } from 'pinia';
import { useGetSourceServiceList } from '@/entities/sourceService/api';
import {
  ISourceService,
  SourceServiceTableType,
  isCspSourceGroup,
  sourceTypeLabel,
} from '@/entities/sourceService/model/types';
import { ref, watch } from 'vue';

/** On-premise (SSH) or cloud account (CSP) source groups; '' shows both. */
export type SourceKind = 'onprem' | 'csp';

/**
 * On-premise servers and cloud accounts share one list. cm-honeybee keeps the type on each
 * source group and its group-wide actions work on one type, so the type is chosen at
 * registration and the list can be narrowed to one type.
 */
export const SOURCE_KIND_FILTER_ITEMS = [
  { name: '', label: 'All types' },
  { name: 'onprem', label: 'On-premise' },
  { name: 'csp', label: 'Cloud' },
];

export function useSourceServiceListModel() {
  const kindFilter = ref<'' | SourceKind>('');
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
    return (k === 'csp') === isCspSourceGroup(service.type);
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
