/**
 * Migration user models stored in cm-damselfly, handled through its unified APIs
 * (`/infra-model`, `/software-model`, `/object-storage-model`, `/model`).
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
export type ModelCategory = 'infra' | 'software' | 'objectStorage';
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
  modelType?: string; // OnPremiseModel | CloudModel | SoftwareModel | RDBMSModel | ObjectStorageModel
  /** cm-damselfly's classification of the model; the same values as GetModels' 'category' filter. */
  category?: string; // infra | software | rdbms | objectStorage
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
const CREATE_OBJECT_STORAGE_MODEL = 'cm-damselfly/CreateObjectStorageModel';
const UPDATE_OBJECT_STORAGE_MODEL = 'cm-damselfly/UpdateObjectStorageModel';
const DELETE_OBJECT_STORAGE_MODEL = 'cm-damselfly/DeleteObjectStorageModel';

/** cm-damselfly's modelType values of the infra models, which tell on-premise from cloud. */
const INFRA_MODEL_TYPE = {
  ONPREM: 'OnPremiseModel',
  CLOUD: 'CloudModel',
} as const;

export const MODEL_STAGE_LABEL: Record<ModelStage, string> = {
  source: 'Source',
  planning: 'Planning',
  target: 'Target',
};

/**
 * Category from cm-damselfly's `category`, which it derives from the stored model and returns with
 * every model. It is read instead of `modelType`: `modelType` mixes the category with the on-premise
 * or cloud kind of an infra model, and its spelling has changed between releases. Anything else is
 * an error, not a guess.
 */
export function modelCategoryOf(model: IStoredMigrationModel): ModelCategory {
  switch (model.category) {
    case 'infra':
    case 'software':
    case 'objectStorage':
      return model.category;
    default:
      throw new Error(
        `Model ${model.id} has a category the console does not handle ('${model.category ?? ''}')`,
      );
  }
}

/**
 * Whether the console has screens for this model. cm-damselfly's GetModels returns every
 * category when none is asked for, including RDBMS models, which the console does not handle
 * yet; those are left out of the model lists instead of breaking them.
 */
export function isConsoleModel(model: IStoredMigrationModel): boolean {
  try {
    modelCategoryOf(model);
    return true;
  } catch {
    return false;
  }
}

/** Category filter of the Source Models / Target Models lists ('' shows every category). */
export const MODEL_CATEGORY_FILTER_ITEMS: {
  name: '' | ModelCategory;
  label: string;
}[] = [
  { name: '', label: 'All types' },
  { name: 'infra', label: 'Infra' },
  { name: 'software', label: 'Software' },
  { name: 'objectStorage', label: 'Object Storage' },
];

export function isObjectStorageModel(model: IStoredMigrationModel): boolean {
  return model.category === 'objectStorage';
}

/** Shown in the Migration Type column: cm-damselfly's modelType as it returns it. */
export function migrationTypeLabelOf(model: IStoredMigrationModel): string {
  return model.modelType ?? '';
}

/** On-premise or cloud: the infra category does not tell them apart, so `modelType` does. */
export function infraModelTypeOf(model: IStoredMigrationModel): InfraModelType {
  if (model.modelType === INFRA_MODEL_TYPE.ONPREM) return 'onprem';
  if (model.modelType === INFRA_MODEL_TYPE.CLOUD) return 'cloud';
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
    // A planning model saved without a source model keeps only its source group.
    const sourceGroupId = model.lineage?.sourceGroupId;
    return sourceGroupId ? { lineage: { sourceGroupId } } : {};
  }
  throw new Error(
    `A planning model cannot be derived from a target model (${model.id})`,
  );
}

/**
 * Whether a target can be recommended from `model`. A source model is the read-only record of what
 * was collected: the user saves it as a planning model and recommends from that. cm-damselfly also
 * refuses a target whose lineage skips the planning stage. This holds for every category: software
 * planning models are stored in the source structure as well.
 */
export function canRecommendFrom(model: IStoredMigrationModel): boolean {
  return modelStageOf(model) === 'planning';
}

/**
 * Lineage for a target model recommended from `model` (see canRecommendFrom): the planning model
 * is the parent and cm-damselfly fills the rest.
 */
export function targetLineageFrom(
  model: IStoredMigrationModel,
): ILineageRequest {
  const stage = modelStageOf(model);
  if (stage === 'planning') return { parentId: model.id };
  throw new Error(
    `A target model cannot be recommended from a ${stage} model (${model.id}). Save it as a planning model first.`,
  );
}

/**
 * Lineage for a new target model saved from an edited target model: a sibling under the same
 * planning model. The parent is named by `parentId` and cm-damselfly derives the rest from it, as its
 * lineage guide recommends, rather than the upstream ids being copied by hand. A target always has
 * a planning model; one without it cannot get a sibling, as cm-damselfly refuses a target whose
 * lineage skips the planning stage.
 */
export function siblingTargetLineageOf(
  model: IStoredMigrationModel,
): ILineageRequest {
  const planningModelId = model.lineage?.planningModelId;
  if (planningModelId) return { parentId: planningModelId };
  throw new Error(
    `Target model ${model.id} has no planning model in its lineage, so a new target cannot be saved from it`,
  );
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
 * Object storage models: `sourceObjectStorageModel` for a source or planning model,
 * `targetObjectStorageModel` for a target model (cm-beetle imdl storage-model structs).
 */
export function createObjectStorageModel(
  modelStage: ModelStage,
  body: Record<string, any>,
) {
  return axiosInstance.post(CREATE_OBJECT_STORAGE_MODEL, {
    queryParams: { modelStage },
    request: body,
  });
}

export function updateObjectStorageModel(
  id: string,
  body: Record<string, any>,
) {
  return axiosInstance.post(UPDATE_OBJECT_STORAGE_MODEL, {
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
      : category === 'objectStorage'
        ? [
            'description',
            'isInitUserModel',
            'nodeId',
            'sourceObjectStorageModel',
            'targetObjectStorageModel',
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

/**
 * userModelVersion is the console's own counter; cm-damselfly stores it as given and keeps no
 * history. It follows the MAJOR.MINOR.PATCH form cm-beetle's UX Lab uses. Every new model starts
 * at INITIAL_MODEL_VERSION, and each update of a stored model raises the minor number
 * (0.1.0 -> 0.2.0), so the version tells how many times the model was edited.
 */
export const INITIAL_MODEL_VERSION = '0.1.0';

/**
 * The version after `version`. The earlier 'vMAJOR.MINOR' values are read as well (v0.1 -> 0.2.0);
 * anything else (e.g. a legacy '1') is kept as it is.
 */
export function nextModelVersion(version: string | undefined): string {
  const m = /^v?(\d+)\.(\d+)(?:\.\d+)?$/.exec((version ?? '').trim());
  if (!m) return version ?? '';
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

/** The id of the model cm-damselfly returned for a create call (behind the console proxy). */
export function createdModelIdOf(res: any): string {
  const id = res?.data?.responseData?.id;
  if (!id)
    throw new Error('cm-damselfly did not return the id of the created model');
  return id;
}

/**
 * Save a collected source group as models. The source model keeps what was collected, as the
 * conversion returned it: it is the record the system refers to and is never edited. What the user
 * saves - the shown model, edited or not, with the name and description they gave - becomes a
 * planning model derived from it.
 *
 * This is the same for every category: infra, software and object storage.
 */
export async function saveCollectedModels(params: {
  category: 'infra' | 'software' | 'objectStorage';
  sourceGroupId: string;
  userId: string;
  name: string;
  description: string;
  /** The model as the conversion returned it. */
  original: Record<string, any>;
  /** The model as shown when the user saved it. */
  edited: Record<string, any>;
}): Promise<{ source: string; derived: string }> {
  const { category, sourceGroupId, userId, name, description } = params;
  const sourceName = `${name}-source`;
  const sourceDescription = `Collected from source group ${sourceGroupId}`;
  const common = { userId, userModelVersion: INITIAL_MODEL_VERSION };

  if (category === 'software') {
    // The collected software is the source model and the shown (possibly edited) one the planning
    // model; the migration list is asked from the planning model.
    const softwareOf = (m: Record<string, any>) => m?.sourceSoftwareModel || m;
    const source = createdModelIdOf(
      await createSoftwareModel('source', {
        ...common,
        sourceSoftwareModel: softwareOf(params.original),
        lineage: { sourceGroupId },
        isInitUserModel: true,
        userModelName: sourceName,
        description: sourceDescription,
      }),
    );
    const derived = createdModelIdOf(
      await createSoftwareModel('planning', {
        ...common,
        sourceSoftwareModel: softwareOf(params.edited),
        parentId: source,
        isInitUserModel: false,
        userModelName: name,
        description,
      }),
    );
    return { source, derived };
  }

  if (category === 'objectStorage') {
    // The collected buckets are the source model and the shown (possibly edited) ones the
    // planning model, as for infra; recommendations run from the planning model.
    const storageOf = (m: Record<string, any>) =>
      m?.sourceObjectStorageModel || m;
    const source = createdModelIdOf(
      await createObjectStorageModel('source', {
        ...common,
        sourceObjectStorageModel: storageOf(params.original),
        lineage: { sourceGroupId },
        isInitUserModel: true,
        userModelName: sourceName,
        description: sourceDescription,
      }),
    );
    const derived = createdModelIdOf(
      await createObjectStorageModel('planning', {
        ...common,
        sourceObjectStorageModel: storageOf(params.edited),
        parentId: source,
        isInitUserModel: false,
        userModelName: name,
        description,
      }),
    );
    return { source, derived };
  }

  const source = createdModelIdOf(
    await createInfraModel('onprem', 'source', {
      ...common,
      ...params.original,
      lineage: { sourceGroupId },
      isInitUserModel: true,
      userModelName: sourceName,
      description: sourceDescription,
    }),
  );
  const derived = createdModelIdOf(
    await createInfraModel('onprem', 'planning', {
      ...common,
      ...params.edited,
      parentId: source,
      isInitUserModel: false,
      userModelName: name,
      description,
    }),
  );
  return { source, derived };
}

/** Update the name and description of any stored model; its version is raised (nextModelVersion). */
export function updateModelInfo(
  model: Record<string, any>,
  changes: { userModelName: string; description: string },
) {
  const stored = model as IStoredMigrationModel;
  const body = updateBodyOf(model, {
    ...changes,
    userModelVersion: nextModelVersion(model.userModelVersion),
  });
  const category = modelCategoryOf(stored);
  if (category === 'software') return updateSoftwareModel(stored.id, body);
  if (category === 'objectStorage')
    return updateObjectStorageModel(stored.id, body);
  return updateInfraModel(stored.id, infraModelTypeOf(stored), body);
}

export function deleteModel(model: IStoredMigrationModel) {
  if (modelCategoryOf(model) === 'objectStorage') {
    return axiosInstance.post(DELETE_OBJECT_STORAGE_MODEL, {
      pathParams: { id: model.id },
      queryParams: { modelStage: modelStageOf(model) },
    });
  }
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
