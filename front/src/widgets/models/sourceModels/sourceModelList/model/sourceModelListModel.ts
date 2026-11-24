import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import {
  useSourceModelStore,
  SourceModelTableType,
  ISourceModelResponse,
} from '@/entities';
import { watch } from 'vue';
import { formatDate } from '@/shared/utils';
import {
  MODEL_STAGE_LABEL,
  migrationTypeLabelOf,
} from '@/entities/migrationModel';

export function useSourceModelListModel() {
  const tableModel =
    useToolboxTableModel<Partial<Record<SourceModelTableType, any>>>();
  const sourceModelStore = useSourceModelStore();
  const models = sourceModelStore.getModels();

  function initToolBoxTableModel() {
    // Newest first: a model just saved from a collect is what the user looks for next, and with
    // the oldest first it landed on a later page behind models kept from earlier work.
    tableModel.tableOptions.sortBy = 'createdDateTime';
    tableModel.tableState.fields = [
      { name: 'name', label: 'Name' },
      { name: 'id', label: 'ID' },
      { name: 'description', label: 'Description' },
      { name: 'migrationType', label: 'Migration Type' },
      { name: 'stage', label: 'Stage' },
      { name: 'parentSourceModel', label: 'Derived From' },
      { name: 'createdDateTime', label: 'Created Date Time' },
      { name: 'updatedDateTime', label: 'Updated Date Time' },
    ];

    tableModel.querySearchState.keyItemSet = [
      {
        title: 'columns',
        items: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          { name: 'description', label: 'Description' },
          { name: 'migrationType', label: 'Migration Type' },
          { name: 'stage', label: 'Stage' },
          { name: 'parentSourceModel', label: 'Derived From' },
          { name: 'createdDateTime', label: 'Created Date Time' },
          { name: 'updatedDateTime', label: 'Updated Date Time' },
        ],
      },
    ];
  }
  /**
   * A planning model shows the source model it was derived from. That source model is in the same
   * list, so its name is looked up there; the id is shown when it is not (e.g. deleted with force).
   */
  function parentSourceModelOf(
    sourceModel: ISourceModelResponse,
    byId: Map<string, ISourceModelResponse>,
  ) {
    if (sourceModel.modelStage !== 'planning') return '';
    const id = sourceModel.lineage?.sourceModelId;
    if (!id) return '';
    return byId.get(id)?.userModelName || id;
  }

  function organizeSourceModelTableItem(
    sourceModel: ISourceModelResponse,
    byId: Map<string, ISourceModelResponse>,
  ) {
    const organizedDatum: Partial<
      Record<SourceModelTableType | 'originalData', any>
    > = {
      name: sourceModel.userModelName,
      id: sourceModel.id,
      description: sourceModel.description,
      migrationType:
        sourceModel['migrationType'] || migrationTypeLabelOf(sourceModel),
      // A planning model is a source model the user has edited (formerly shown as "Custom").
      stage: sourceModel.modelStage
        ? MODEL_STAGE_LABEL[sourceModel.modelStage]
        : '',
      parentSourceModel: parentSourceModelOf(sourceModel, byId),
      modelType: sourceModel.modelType || 'Unknown',
      createdDateTime: formatDate(sourceModel.createTime),
      updatedDateTime: formatDate(sourceModel.updateTime),
      originalData: sourceModel,
    };
    return organizedDatum;
  }

  watch(models, nv => {
    const byId = new Map<string, ISourceModelResponse>(
      nv.map((m: ISourceModelResponse) => [m.id, m]),
    );
    tableModel.tableState.items = [...nv]
      .sort((a: ISourceModelResponse, b: ISourceModelResponse) =>
        String(b.createTime ?? '').localeCompare(String(a.createTime ?? '')),
      )
      .map((value: ISourceModelResponse) =>
        organizeSourceModelTableItem(value, byId),
      );
  });

  return {
    tableModel,
    models,
    initToolBoxTableModel,
    sourceModelStore,
  };
}
