// src/entities/credentials/model/credentialsDetailModel.ts
import { useConfigStore } from '@/entities/credentials/model/stores';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { ref, watch } from 'vue';
import { showErrorMessage } from '@/shared/utils'; // import showErrorMessage

type CredentialDetailTableType = 'Provider' | 'CredentialName' | 'KeyValueInfo';

export function useCredentialsDetailModel() {
  const configStore = useConfigStore();
  const credentialName = ref<string | null>(null);
  const tableModel =
    useDefinitionTableModel<Record<CredentialDetailTableType, any>>();

  // Sets the credential name
  function setCredentialName(name: string | null) {
    credentialName.value = name;
  }

  // Initialize the table
  function initTable() {
    tableModel.initState();

    tableModel.tableState.fields = [
      { label: 'Provider', name: 'Provider' },
      { label: 'Credential Name', name: 'CredentialName' },
      { label: 'Key-Value Info', name: 'KeyValueInfo' },
    ];
  }

  // Sets the table data
  function setDefineTableData(name: string) {
    const credential = configStore.getConfigByName(name);
    if (credential) {
      const keyValueInfo = credential.KeyValueInfoList.map(
        (item: { Key: string; Value: string }) => `${item.Key}: ${item.Value}`,
      ).join(', ');
      tableModel.tableState.data = {
        Provider: credential.ProviderName,
        CredentialName: credential.CredentialName,
        KeyValueInfo: keyValueInfo,
      };
    } else {
      tableModel.tableState.data = {};
      showErrorMessage('Error', 'The selected Credential could not be found.');
    }
    tableModel.tableState.loading = false;
  }

  // Loads the credential data
  function loadCredentialData(name: string | null) {
    tableModel.tableState.loading = true;
    if (name) {
      setDefineTableData(name);
    } else {
      tableModel.tableState.data = {};
      tableModel.tableState.loading = false;
    }
  }

  // Watch for credential name changes
  watch(credentialName, newName => {
    loadCredentialData(newName);
  });

  return {
    setCredentialName,
    configStore,
    initTable,
    tableModel,
  };
}
