import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import { useConfigStore } from '@/entities/credentials/model/stores';
import { watch } from 'vue';

// Credential table field type definition
type CredentialTableType = 'checkbox' | 'CredentialName' | 'ProviderName';

export function useCredentialsListModel() {
  // Initialize the Toolbox table model
  const tableModel =
    useToolboxTableModel<
      Partial<Record<CredentialTableType | 'originalData', any>>
    >();

  // Access the credentials store
  const configStore = useConfigStore();

  // Get the credential list from the store
  const credentials = configStore.getConfig();

  // Initialize the table fields and search settings
  function initToolBoxTableModel() {
    tableModel.tableState.fields = [
      { name: 'checkbox', label: 'Check' },
      { name: 'CredentialName', label: 'Credential Name' },
      { name: 'ProviderName', label: 'Provider' },
    ];

    tableModel.querySearchState.keyItemSet = [
      {
        title: 'Columns',
        items: [
          { name: 'CredentialName', label: 'Credential Name' },
          { name: 'ProviderName', label: 'Provider' },
        ],
      },
    ];
  }

  // Organize credential data into a table-friendly shape
  function organizeCredentialTableItem(credential: any) {
    const organizedDatum: Partial<
      Record<CredentialTableType | 'originalData', any>
    > = {
      checkbox: '', // placeholder for checkbox selection
      CredentialName: credential.CredentialName,
      ProviderName: credential.ProviderName,
      originalData: credential,
    };
    return organizedDatum;
  }

  // Watch for changes to the store's credential list and update the table
  watch(
    credentials,
    newCredentials => {
      tableModel.tableState.items = newCredentials.map(credential =>
        organizeCredentialTableItem(credential),
      );
    },
    { immediate: true },
  );

  return {
    tableModel,
    credentials,
    initToolBoxTableModel,
    configStore,
  };
}
