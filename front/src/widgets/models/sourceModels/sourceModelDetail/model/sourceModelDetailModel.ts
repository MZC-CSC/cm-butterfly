import { useSourceModelStore, SourceModelTableType } from '@/entities';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { ref, watch } from 'vue';
import {
  MODEL_STAGE_LABEL,
  migrationTypeLabelOf,
} from '@/entities/migrationModel';

export function useSourceModelDetailModel() {
  const sourceModelStore = useSourceModelStore();
  const sourceModelId = ref<string | null>();
  const tableModel =
    useDefinitionTableModel<Record<SourceModelTableType, any>>();

  function setSourceModelId(_sourceModelId: string | null) {
    sourceModelId.value = _sourceModelId;
  }

  function initTable() {
    tableModel.initState();

    tableModel.tableState.fields = [
      { label: 'Source Model Information', name: 'name' },
      { label: 'ID', name: 'id' },
      { label: 'Description', name: 'description' },
      { label: 'Migration Type', name: 'migrationType' },
      { label: 'Stage', name: 'stage' },
      { label: 'Derived From (Source Model)', name: 'parentSourceModel' },
      { label: 'Source Group', name: 'sourceGroup' },
      { label: 'Model Type', name: 'modelType' },
      { label: 'Created Date Time', name: 'createdDateTime' },
      { label: 'Updated Date Time', name: 'updatedDateTime' },
      {
        label: 'Custom & View JSON',
        name: 'customAndViewJSON',
        disableCopy: true,
      },
      { label: 'Recommend Model', name: 'recommendModel', disableCopy: true },
    ];
  }

  function parentName(id: string | undefined) {
    if (!id) return '';
    const parent = sourceModelStore.getSourceModelById(id);
    return parent ? `${parent.userModelName} (${id})` : id;
  }

  function setDefineTableData(sourceModelId: string) {
    const sourceModel = sourceModelStore.getSourceModelById(sourceModelId);
    let data: Partial<Record<SourceModelTableType, any>> = {};

    if (sourceModel) {
      data = {
        name: sourceModel.userModelName,
        id: sourceModel.id,
        description: sourceModel.description,
        migrationType:
          sourceModel['migrationType'] || migrationTypeLabelOf(sourceModel),
        stage: sourceModel.modelStage
          ? MODEL_STAGE_LABEL[sourceModel.modelStage]
          : '',
        // Only a planning model has a parent; a source model is the origin.
        parentSourceModel:
          sourceModel.modelStage === 'planning'
            ? parentName(sourceModel.lineage?.sourceModelId)
            : '',
        sourceGroup: sourceModel.lineage?.sourceGroupId ?? '',
        modelType: sourceModel.modelType || 'Unknown',
        createdDateTime: sourceModel.createTime,
        updatedDateTime: sourceModel.updateTime,
        customAndViewJSON: '',
        recommendModel: '',
      };
    }
    return data;
  }

  function loadSourceModelData(sourceModelId: string | null | undefined) {
    tableModel.tableState.loading = true;
    if (sourceModelId) {
      tableModel.tableState.data = setDefineTableData(sourceModelId);
    }
    tableModel.tableState.loading = false;
  }

  watch(sourceModelId, nv => {
    loadSourceModelData(nv);
  });

  return {
    setSourceModelId,
    sourceModelStore,
    initTable,
    tableModel,
  };
}
