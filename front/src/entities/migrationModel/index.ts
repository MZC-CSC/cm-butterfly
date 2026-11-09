/**
 * Migration user models stored in cm-damselfly, handled through its unified APIs
 * (`/infra-model`, `/software-model`, `/model`).
 *
 * A model belongs to one of three stages - source -> planning -> target - and the models derived
 * from one another are linked by `lineage`. On create/update, `parentId` names the model of the
 * previous stage the new model is derived from; cm-damselfly then fills the upstream lineage fields
 * from that parent and sets the field of the model's own stage itself.
 *
 * The legacy APIs (`/onpremmodel`, `/cloudmodel`, `/softwaremodel/*`) know only source and target,
 * so they cannot see or keep planning models and lineage. They are not used here.
 */
import { axiosInstance } from '@/shared/libs/api/instance';

export type ModelStage = 'source' | 'planning' | 'target';
export type ModelCategory = 'infra' | 'software';
export type InfraModelType = 'onprem' | 'cloud';

export interface IMigrationLineage {
  sourceGroupId?: string;
  sourceModelId?: string;
  planningModelId?: string;
  targetModelId?: string;
}

/** The stored-model fields this module relies on. */
export interface IStoredMigrationModel {
  id: string;
  modelType?: string; // OnPremiseModel | CloudModel | SoftwareModel
  modelStage?: ModelStage;
  lineage?: IMigrationLineage;
}

export interface ILineageRequest {
  parentId?: string;
  lineage?: IMigrationLineage;
}

const CREATE_INFRA_MODEL = 'cm-damselfly/CreateInfraModel';
const UPDATE_INFRA_MODEL = 'cm-damselfly/UpdateInfraModel';
const DELETE_INFRA_MODEL = 'cm-damselfly/DeleteInfraModel';
const CREATE_SOFTWARE_MODEL = 'cm-damselfly/CreateSoftwareModel';
const UPDATE_SOFTWARE_MODEL = 'cm-damselfly/UpdateSoftwareModel';
const DELETE_SOFTWARE_MODEL = 'cm-damselfly/DeleteSoftwareModel';

export const MODEL_STAGE_LABEL: Record<ModelStage, string> = {
  source: 'Source',
  planning: 'Planning',
  target: 'Target',
};

/** Category from cm-damselfly's `modelType`. Anything else is an error, not a guess. */
export function modelCategoryOf(model: IStoredMigrationModel): ModelCategory {
  switch (model.modelType) {
    case 'SoftwareModel':
      return 'software';
    case 'OnPremiseModel':
    case 'CloudModel':
      return 'infra';
    default:
      throw new Error(
        `Model ${model.id} has an unknown model type '${model.modelType ?? ''}'`,
      );
  }
}

export function infraModelTypeOf(model: IStoredMigrationModel): InfraModelType {
  if (model.modelType === 'OnPremiseModel') return 'onprem';
  if (model.modelType === 'CloudModel') return 'cloud';
  throw new Error(
    `Model ${model.id} is not an infra model (model type '${model.modelType ?? ''}')`,
  );
}

export function modelStageOf(model: IStoredMigrationModel): ModelStage {
  if (
    model.modelStage === 'source' ||
    model.modelStage === 'planning' ||
    model.modelStage === 'target'
  ) {
    return model.modelStage;
  }
  throw new Error(
    `Model ${model.id} has no model stage ('${model.modelStage ?? ''}')`,
  );
}

/**
 * Lineage for a planning model derived from `model` (a source or a planning model).
 * A planning model's parent must be a source model, so editing a planning model again
 * produces a sibling planning model under the same source.
 */
export function planningLineageFrom(
  model: IStoredMigrationModel,
): ILineageRequest {
  const stage = modelStageOf(model);
  if (stage === 'source') return { parentId: model.id };
  if (stage === 'planning') {
    const sourceModelId = model.lineage?.sourceModelId;
    if (sourceModelId) return { parentId: sourceModelId };
    // A planning model saved without a source keeps whatever upstream it has.
    return { lineage: upstreamOf(model.lineage) };
  }
  throw new Error(
    `A planning model cannot be derived from a target model (${model.id})`,
  );
}

/**
 * Whether a target can be recommended from `model`. A source model is the read-only record of what
 * was collected: the user saves it as a planning model and recommends from that. cm-damselfly also
 * refuses a target whose lineage skips the planning stage.
 *
 * Software is the exception for now: cm-damselfly takes a software planning model in the target
 * structure, so an edited source software model cannot become one, and software is still
 * recommended from its source model.
 */
export function canRecommendFrom(model: IStoredMigrationModel): boolean {
  const stage = modelStageOf(model);
  if (stage === 'planning') return true;
  return stage === 'source' && modelCategoryOf(model) === 'software';
}

/**
 * Lineage for a target model recommended from `model` (see canRecommendFrom).
 * From a planning model, the planning model is the parent and cm-damselfly fills the rest.
 * From a source software model only the source group is carried: naming the source model itself
 * would skip the planning stage, which cm-damselfly refuses.
 */
export function targetLineageFrom(
  model: IStoredMigrationModel,
): ILineageRequest {
  const stage = modelStageOf(model);
  if (stage === 'planning') return { parentId: model.id };
  if (stage === 'source' && modelCategoryOf(model) === 'software') {
    const sourceGroupId = model.lineage?.sourceGroupId;
    return sourceGroupId ? { lineage: { sourceGroupId } } : {};
  }
  throw new Error(
    `A target model cannot be recommended from a ${stage} model (${model.id}). Save it as a planning model first.`,
  );
}

/** Lineage for a new target model saved from an edited target model: same upstream, new self. */
export function siblingTargetLineageOf(
  model: IStoredMigrationModel,
): ILineageRequest {
  return { lineage: upstreamOf(model.lineage, 'target') };
}

/** The lineage fields above `stage`, without empty values. */
function upstreamOf(
  lin: IMigrationLineage | undefined,
  stage: ModelStage = 'planning',
): IMigrationLineage {
  const result: IMigrationLineage = {};
  if (lin?.sourceGroupId) result.sourceGroupId = lin.sourceGroupId;
  if (lin?.sourceModelId) result.sourceModelId = lin.sourceModelId;
  if (stage === 'target' && lin?.planningModelId) {
    result.planningModelId = lin.planningModelId;
  }
  return result;
}

/** Lineage for the request bodies sent to cm-beetle (recommendation, migration). */
export function beetleLineageOf(
  model: IStoredMigrationModel,
): IMigrationLineage {
  const result: IMigrationLineage = { ...(model.lineage ?? {}) };
  const stage = modelStageOf(model);
  if (stage === 'source') result.sourceModelId = model.id;
  if (stage === 'planning') result.planningModelId = model.id;
  if (stage === 'target') result.targetModelId = model.id;
  Object.keys(result).forEach(k => {
    if (!result[k]) delete result[k];
  });
  return result;
}

export function createInfraModel(
  modelType: InfraModelType,
  modelStage: ModelStage,
  body: Record<string, any>,
) {
  return axiosInstance.post(CREATE_INFRA_MODEL, {
    queryParams: { modelType, modelStage },
    request: body,
  });
}

export function updateInfraModel(
  id: string,
  modelType: InfraModelType,
  body: Record<string, any>,
) {
  return axiosInstance.post(UPDATE_INFRA_MODEL, {
    pathParams: { id },
    queryParams: { modelType },
    request: body,
  });
}

export function createSoftwareModel(
  modelStage: ModelStage,
  body: Record<string, any>,
) {
  return axiosInstance.post(CREATE_SOFTWARE_MODEL, {
    queryParams: { modelStage },
    request: body,
  });
}

export function updateSoftwareModel(id: string, body: Record<string, any>) {
  return axiosInstance.post(UPDATE_SOFTWARE_MODEL, {
    pathParams: { id },
    request: body,
  });
}

/**
 * The editable body of a stored model, for PUT. Only the fields of the create/update request
 * are sent, so that the stored record's server-side fields (stage, version, times) are not
 * pushed back. Lineage is left out: cm-damselfly keeps the stored lineage when neither
 * `lineage` nor `parentId` is given.
 */
export function updateBodyOf(
  model: Record<string, any>,
  changes: Record<string, any>,
): Record<string, any> {
  const category = modelCategoryOf(model as IStoredMigrationModel);
  const keys =
    category === 'software'
      ? [
          'description',
          'isInitUserModel',
          'nodeId',
          'sourceSoftwareModel',
          'targetSoftwareModel',
          'userId',
          'userModelName',
          'userModelVersion',
        ]
      : [
          'cloudInfraModel',
          'csp',
          'description',
          'isInitUserModel',
          'onpremiseInfraModel',
          'region',
          'userId',
          'userModelName',
          'userModelVersion',
          'zone',
        ];
  const body: Record<string, any> = {};
  keys.forEach(k => {
    if (model[k] !== undefined && model[k] !== null) body[k] = model[k];
  });
  return { ...body, ...changes };
}

/** Update the name and description of any stored model. */
export function updateModelInfo(
  model: Record<string, any>,
  changes: { userModelName: string; description: string },
) {
  const stored = model as IStoredMigrationModel;
  const body = updateBodyOf(model, changes);
  return modelCategoryOf(stored) === 'software'
    ? updateSoftwareModel(stored.id, body)
    : updateInfraModel(stored.id, infraModelTypeOf(stored), body);
}

export function deleteModel(model: IStoredMigrationModel) {
  if (modelCategoryOf(model) === 'software') {
    return axiosInstance.post(DELETE_SOFTWARE_MODEL, {
      pathParams: { id: model.id },
      queryParams: { modelStage: modelStageOf(model) },
    });
  }
  // DeleteInfraModel works for both on-premise and cloud models.
  return axiosInstance.post(DELETE_INFRA_MODEL, {
    pathParams: { id: model.id },
  });
}

export interface IDeleteFailure {
  id: string;
  name: string;
  message: string;
  /** The models whose lineage refers to this one (409 Conflict). */
  referrers: string[];
}

/**
 * Delete the given models one by one and report each failure. A model referred to by the lineage of
 * other models is refused by cm-damselfly (409); it is reported as is and never force-deleted.
 */
export async function deleteModels(
  models: Array<
    IStoredMigrationModel & { userModelName?: string; name?: string }
  >,
): Promise<IDeleteFailure[]> {
  const results = await Promise.allSettled(models.map(m => deleteModel(m)));
  const failures: IDeleteFailure[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') return;
    const m = models[i];
    failures.push({
      id: m.id,
      name: m.userModelName ?? m.name ?? m.id,
      ...describeModelError(r.reason),
    });
  });
  return failures;
}

/** cm-damselfly answers with `{ text, list }`; the console proxy puts it under `responseData`. */
export function describeModelError(e: any): {
  message: string;
  referrers: string[];
} {
  const body = e?.response?.data?.responseData ?? e?.response?.data ?? {};
  const list: any[] = Array.isArray(body?.list) ? body.list : [];
  const referrers = list.map(item =>
    String(item?.userModelName ?? item?.name ?? item?.id ?? ''),
  );
  const message =
    body?.text ||
    body?.message ||
    e?.response?.data?.status?.message ||
    e?.message ||
    'Unknown error';
  return { message, referrers };
}

export function formatDeleteFailures(failures: IDeleteFailure[]): string {
  return failures
    .map(f =>
      f.referrers.length > 0
        ? `${f.name}: used by ${f.referrers.join(', ')} - delete those first`
        : `${f.name}: ${f.message}`,
    )
    .join('\n');
}
