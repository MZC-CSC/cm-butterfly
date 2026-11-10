import { useTargetModelStore, TargetModelTableType } from '@/entities';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { ref, watch } from 'vue';
import { formatDate } from '@/shared/utils';
import {
  isObjectStorageModel,
  migrationTypeLabelOf,
} from '@/entities/migrationModel';

export function useTargetModelDetailModel() {
  const targetModelStore = useTargetModelStore();
  const targetModelId = ref<string | null>();
  const tableModel =
    useDefinitionTableModel<Record<TargetModelTableType, any>>();

  function setTargetModelId(_targetModelId: string | null) {
    targetModelId.value = _targetModelId;
  }

  function initTable() {
    tableModel.initState();

    tableModel.tableState.fields = [
      { label: 'Target Model Information', name: 'name' },
      { label: 'ID', name: 'id' },
      { label: 'Description', name: 'description' },
      { label: 'Migration Type', name: 'migrationType' },
      { label: 'Custom', name: 'custom' },
      { label: 'Derived From (Planning Model)', name: 'parentPlanningModel' },
      { label: 'Model Type', name: 'modelType' },
      { label: 'Created Date Time', name: 'createdDateTime' },
      { label: 'Updated Date Time', name: 'updatedDateTime' },
      {
        label: 'Custom & View JSON',
        name: 'customAndViewJSON',
        disableCopy: true,
      },
      { label: 'Workflow Tool', name: 'workflowTool', disableCopy: true },
    ];
  }

  /**
   * An object storage target model has no workflow: cm-cicada has no bucket task, so its buckets
   * are created from the model directly. The same row then reads as that step.
   */
  function setNextStepLabel(objectStorage: boolean) {
    const field = tableModel.tableState.fields.find(
      f => f.name === 'workflowTool',
    );
    if (field) field.label = objectStorage ? 'Bucket Migration' : 'Workflow Tool';
  }

  function setDefineTableData(targetModelId: string) {
    const targetModel = targetModelStore.getTargetModelById(targetModelId);
    let data: Partial<Record<TargetModelTableType | 'originalData', any>> = {};

    if (targetModel) {
      data = {
        name: targetModel.userModelName,
        id: targetModel.id,
        description: targetModel.description,
        migrationType:
          targetModel['migrationType'] || migrationTypeLabelOf(targetModel),
        custom: targetModel.isInitUserModel ? 'Basic' : 'Custom',
        // The planning model this target was recommended from (cm-damselfly lineage).
        parentPlanningModel: targetModel.lineage?.planningModelId ?? '',
        modelType: targetModel.modelType || 'Unknown',
        createdDateTime: formatDate(targetModel.createTime),
        updatedDateTime: formatDate(targetModel.updateTime),
        customAndViewJSON: '',
        workflowTool: '',
        originalData: targetModel,
      };
    }
    return data;
  }

  function loadTargetModelData(targetModelId: string | null | undefined) {
    tableModel.tableState.loading = true;
    if (targetModelId) {
      const model = targetModelStore.getTargetModelById(targetModelId);
      setNextStepLabel(!!model && isObjectStorageModel(model));
      tableModel.tableState.data = setDefineTableData(targetModelId);
    }
    tableModel.tableState.loading = false;
  }

  watch(targetModelId, nv => {
    loadTargetModelData(nv);
  });

  return {
    setTargetModelId,
    targetModelStore,
    initTable,
    tableModel,
  };
}
