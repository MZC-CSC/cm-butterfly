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
import { watch } from 'vue';

/** Which source groups a list shows: on-premise (SSH) or cloud accounts (CSP). */
export type SourceKind = 'onprem' | 'csp';

// Read lazily: the list component declares its props after it sets up this model.
export function useSourceServiceListModel(kind?: () => SourceKind | undefined) {
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
    const k = kind?.();
    if (!k) return true;
    return (k === 'csp') === isCspSourceGroup(service.type);
  }

  watch(services, nv => {
    tableModel.tableState.items = nv
      .filter(ofKind)
      .map(value => organizeSourceServiceTableItem(value));
  });

  return {
    tableModel,
    services,
    sourceServicesStore,
    resSourceServiceList,
    initToolBoxTableModel,
  };
}
