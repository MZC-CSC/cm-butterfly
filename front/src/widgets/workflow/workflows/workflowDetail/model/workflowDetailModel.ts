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
      // 'Workflow Tool'·'Workflow JSON' 링크는 여기서 뺐다. 편집이냐 실행이냐는
      // **실행 상태 화면 한 곳에서** 정한다 — 거기서만 실행 이력을 보고 원본 편집·
      // 복제 편집·JSON 편집을 갈라 줄 수 있다. 상세에서 곧장 열면 그 판단을 건너뛰고,
      // 그것을 막으려 상세에도 같은 판정을 복제해 두면 두 곳이 어긋난다.
      // 상세는 *이 워크플로우가 무엇인지*만 적고, 할 수 있는 일은 실행 상태에 모은다.
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
