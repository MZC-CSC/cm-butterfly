import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import {
  ISourceConnection,
  SourceConnectionTableTypes,
} from '@/entities/sourceConnection/model/types';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';
import { useGetSourceConnectionList } from '@/entities/sourceConnection/api';
import { computed, ref, watch } from 'vue';
import { useSourceServiceStore } from '@/entities/sourceService/model/stores';
import {
  CONNECTION_TYPE_LABEL,
  CONNECTION_TYPES_BY_GROUP_TYPE,
  ConnectionResourceType,
  connectionTypeOf,
  groupTypeOf,
} from '@/entities/sourceService/model/types';

/**
 * The connection type filter offers the types the selected group's type takes. cm-honeybee's
 * connection list API takes no type filter, so the list is narrowed here.
 */
export function useSourceConnectionListModel(selectedServiceId: () => string) {
  const tableModel =
    useToolboxTableModel<Partial<Record<SourceConnectionTableTypes, any>>>();
  const sourceConnectionStore = useSourceConnectionStore();
  const resSourceConnectionList = useGetSourceConnectionList(null);
  const targetConnections = ref<ISourceConnection[]>([]);
  const sourceServiceStore = useSourceServiceStore();
  const typeFilter = ref<'' | ConnectionResourceType>('');
  const typeFilterItems = computed(() => [
    { name: '', label: 'All connection types' },
    ...(CONNECTION_TYPES_BY_GROUP_TYPE[
      groupTypeOf(sourceServiceStore.getServiceById(selectedServiceId())?.type)
    ]?.map(t => ({ name: t, label: CONNECTION_TYPE_LABEL[t] })) ?? []),
  ]);
  watch(selectedServiceId, () => (typeFilter.value = ''));

  function initToolBoxTableModel() {
    tableModel.tableState.fields = [
      { name: 'name', label: 'Name' },
      { name: 'id', label: 'ID' },
      { name: 'description', label: 'Description' },
      { name: 'type', label: 'Type' },
      { name: 'ip', label: 'IP Address' },
      { name: 'port', label: 'Port' },
    ];
  }

  function organizationSourceConnectionTableItem(
    sourceConnection: ISourceConnection,
  ) {
    const organizedDatum: Partial<
      Record<SourceConnectionTableTypes | 'originalData', any>
    > = {
      name: sourceConnection.name,
      description: sourceConnection.description,
      id: sourceConnection.id,
      ip: sourceConnection.ip_address,
      port: sourceConnection.ssh_port,
      type: CONNECTION_TYPE_LABEL[connectionTypeOf(sourceConnection)] ?? '',
      originalData: sourceConnection,
    };

    return organizedDatum;
  }

  function setTargetConnections(connectionIds: string[]) {
    targetConnections.value = connectionIds
      .map(id => sourceConnectionStore.getConnectionById(id))
      .filter(connection => !!connection);
  }

  watch([targetConnections, typeFilter], ([nv, t]) => {
    tableModel.tableState.items = nv
      .filter(c => !t || connectionTypeOf(c) === t)
      .map(sourceConnection =>
        organizationSourceConnectionTableItem(sourceConnection),
      );
  });

  return {
    tableModel,
    typeFilter,
    typeFilterItems,
    setTargetConnections,
    sourceConnectionStore,
    resSourceConnectionList,
    initToolBoxTableModel,
  };
}
