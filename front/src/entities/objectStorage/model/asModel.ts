import type {
  IArtifact,
  IRecommendedObjectStorage,
  ISourceObjectStorage,
} from '@/entities/objectStorage/model/types';

/**
 * Object storage models live in cm-beetle's artifact store, not in cm-damselfly, but the
 * console shows them in the same Source Models / Target Models lists as the infra and
 * software models so that bucket migration follows the same steps. This turns an artifact
 * into the row shape those lists already use; `objectStorage` keeps the artifact itself.
 */
export const OBJECT_STORAGE_MODEL_TYPE = 'ObjectStorageModel';
export const OBJECT_STORAGE_MIGRATION_TYPE = 'Object Storage';

export interface IObjectStorageModelRow<T> {
  id: string;
  userModelName: string;
  description: string;
  modelType: typeof OBJECT_STORAGE_MODEL_TYPE;
  migrationType: typeof OBJECT_STORAGE_MIGRATION_TYPE;
  isInitUserModel: boolean;
  createTime: string;
  updateTime: string;
  objectStorage: IArtifact<T>;
}

export function artifactToModelRow<T>(
  artifact: IArtifact<T>,
): IObjectStorageModelRow<T> {
  return {
    id: artifact.id,
    userModelName: artifact.name,
    description: artifact.description ?? '',
    modelType: OBJECT_STORAGE_MODEL_TYPE,
    migrationType: OBJECT_STORAGE_MIGRATION_TYPE,
    isInitUserModel: true,
    createTime: artifact.createTime ?? '',
    updateTime: artifact.updateTime ?? artifact.createTime ?? '',
    objectStorage: artifact,
  };
}

export function isObjectStorageModel(model: any): boolean {
  return model?.modelType === OBJECT_STORAGE_MODEL_TYPE;
}

export type SourceObjectStorageRow =
  IObjectStorageModelRow<ISourceObjectStorage>;
export type TargetObjectStorageRow =
  IObjectStorageModelRow<IRecommendedObjectStorage>;
