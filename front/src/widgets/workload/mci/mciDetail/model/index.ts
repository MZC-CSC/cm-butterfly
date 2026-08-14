import { McisTableType, useMCIStore } from '@/entities/mci/model';
import { ref, watch } from 'vue';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { getCloudProvidersInVms } from '@/shared/hooks/vm';

export function useMciDetailModel() {
  const mciStore = useMCIStore();
  const mciId = ref<string | null>();
  const nsId = ref<string>('');
  const tableModel = useDefinitionTableModel<Record<McisTableType, any>>();

  function initTable() {
    tableModel.initState();

    // Namespace and infra id come first, and are the two the reader copies rather than reads.
    //
    // Software migration asks for both to say where to install, and neither was on any screen -
    // the id only in the list, the namespace nowhere at all. Copying is left enabled here for the
    // same reason: these are values to carry elsewhere, not to look at.
    tableModel.tableState.fields = [
      { label: 'Namespace', name: 'nsId' },
      { label: 'Infra ID', name: 'id' },
      { label: 'Name', name: 'name', disableCopy: true },
      { label: 'Description', name: 'description', disableCopy: true },
      { label: 'Type', name: 'type', disableCopy: true },
      { label: 'Status', name: 'status', disableCopy: true },
      { label: 'Action', name: 'action', disableCopy: true },
      { label: 'Provider', name: 'provider', disableCopy: true },
      {
        label: 'Deployment Algorithm',
        name: 'deploymentAlgorithm',
        disableCopy: true,
      },
    ];
  }

  function setMciId(_mciId: string | null) {
    mciId.value = _mciId;
  }

  function setNsId(_nsId: string) {
    nsId.value = _nsId;
  }

  function setDefineTableData(mciId: string) {
    const mci = mciStore.getMciById(mciId);
    let data: Partial<Record<McisTableType, any>> = {};

    if (mci) {
      // @ts-ignore
      data = {
        nsId: nsId.value || '',
        id: mci.id || mciId,
        name: mci.name || '',
        description: mci.description || '',
        status: mci.status || '',
        // @ts-ignore
        type: mci.type || 'Infra',
        // @ts-ignore
        action: mci.action || 'Instance',
        provider: getCloudProvidersInVms(mci.vm) || '',
        // @ts-ignore
        deploymentAlgorithm: mci.deploymentAlgorithm || '-',
      };
    }
    return data;
  }

  watch(mciId, nv => {
    if (nv) {
      tableModel.tableState.data = setDefineTableData(nv);
    } else {
      tableModel.initState();
    }
    tableModel.tableState.loading = false;
  });

  return { tableModel, initTable, setMciId, setNsId };
}
