import { useWorkflowStore } from '@/entities';
import { WorkflowTableType } from '@/entities';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { ref, watch } from 'vue';

export function useWorkflowDetailModel() {
  // const workflowsStore = useWorkflowsStore();
  const workflowStore = useWorkflowStore();
  const workflowId = ref<string | null>();
  const tableModel = useDefinitionTableModel<Record<WorkflowTableType, any>>();

  function setWorkflowId(_workflowId: string | null) {
    workflowId.value = _workflowId;
  }

  function initTable() {
    tableModel.initState();

    tableModel.tableState.fields = [
      { label: 'Workflow Name', name: 'name' },
      { label: 'ID', name: 'id' },
      { label: 'Description', name: 'description', disableCopy: true },
      { label: 'Created Date Time', name: 'created_at' },
      { label: 'Updated Date Time', name: 'updated_at' },
      // The 'Workflow Tool' and 'Workflow JSON' links were removed here. Whether to edit or run is
      // decided **in one place, the run-status screen** — only there can we look at the run history and
      // split between editing the original, editing a clone, and editing the JSON. Opening straight from
      // the detail view skips that decision, and duplicating the same logic in the detail view to prevent
      // that would let the two places drift apart. The detail view only states *what this workflow is*;
      // the things you can do are gathered on the run-status screen.
    ];
  }

  function setDefineTableData(workflowId: string) {
    const workflow = workflowStore.getWorkflowById(workflowId);
    let data: Partial<Record<WorkflowTableType, any>> = {};

    if (workflow) {
      data = {
        name: workflow.name,
        id: workflow.id,
        description: '-',
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
      };
    }
    return data;
  }

  function loadWorkflowData(workflowId: string | null | undefined) {
    tableModel.tableState.loading = true;
    if (workflowId) {
      tableModel.tableState.data = setDefineTableData(workflowId);
    }
    tableModel.tableState.loading = false;
  }

  watch(workflowId, nv => {
    loadWorkflowData(nv);
  });

  return {
    setWorkflowId,
    workflowStore,
    initTable,
    tableModel,
    workflowId,
  };
}
