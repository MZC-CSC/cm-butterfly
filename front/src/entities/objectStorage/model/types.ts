// Object storage (bucket) migration through cm-beetle.
//
// The bucket itself is cm-beetle's job: scan and inspect the source account, recommend a
// configuration the target CSP supports, create the bucket. The objects inside a bucket are
// a data migration, which cm-centipede owns, and is not part of this screen.

/** cm-beetle wraps every answer as { success, data, message }. */
export interface IBeetleResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** Credential fields cm-beetle accepts for scan and inspect, per CSP. */
export interface IObjectStorageAccessRequest {
  csp: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  keyId?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  subscriptionId?: string;
  tenantId?: string;
}

export interface IScannedBucket {
  bucketName: string;
  region?: string;
  creationTime?: string;
  sizeBytes?: number;
  objectCount?: number;
  versioningEnabled?: boolean;
  encryptionType?: string;
}

export interface ICorsRule {
  allowedOrigin: string[];
  allowedMethod: string[];
  allowedHeader?: string[];
  exposeHeader?: string[];
  maxAgeSeconds?: number;
}

export interface ISourceBucket {
  bucketName: string;
  totalSizeBytes?: number;
  objectCount?: number;
  accessFrequency?: string;
  versioningEnabled?: boolean;
  encryptionEnabled?: boolean;
  corsEnabled?: boolean;
  corsRule?: ICorsRule[];
  isPublic?: boolean;
  tags?: Record<string, string>;
  creationDate?: string;
}

export interface ICloud {
  csp: string;
  region: string;
}

/** cm-beetle storagemodel.SourceObjectStorage — the source model. */
export interface ISourceObjectStorage {
  description?: string;
  sourceCloud?: ICloud;
  sourceObjectStorages: ISourceBucket[];
}

export interface ITargetBucket {
  sourceBucketName: string;
  bucketName: string;
  versioningEnabled?: boolean;
  corsEnabled?: boolean;
  corsRule?: ICorsRule[];
}

/** cm-beetle storagemodel.RecommendedObjectStorage — the target model. */
export interface IRecommendedObjectStorage {
  status?: string;
  description?: string;
  targetCloud: ICloud;
  targetObjectStorages: ITargetBucket[];
  warnings?: string[];
}

/**
 * A bucket created in the target cloud, as cm-beetle lists it. `id` is the name in the
 * namespace; `cspResourceName` is the actual bucket name cb-tumblebug created, which is
 * made unique and differs from the intended name.
 */
export interface IMigratedBucket {
  id: string;
  name?: string;
  status?: string;
  connectionName?: string;
  cspResourceName?: string;
  description?: string;
}

export type ObjectStorageSupport = Record<
  string,
  { cors: boolean; versioning: boolean; presignedUrl: boolean }
>;

/**
 * cm-beetle artifact envelope. Object storage models have no home in cm-damselfly, so the
 * source and target models are kept in cm-beetle's artifact store (0.6.3+), the same place
 * cm-beetle's own console keeps them.
 */
export interface IArtifact<T> {
  id: string;
  name: string;
  description?: string;
  version?: string;
  category: 'infra' | 'software' | 'data';
  stage: 'source' | 'planning' | 'target';
  schemaType?: string;
  lineage?: {
    sourceGroupId?: string;
    sourceModelId?: string;
    planningModelId?: string;
    targetModelId?: string;
  };
  payload: T;
  createTime?: string;
  updateTime?: string;
}

export const OBJECT_STORAGE_SCHEMA = {
  SOURCE: 'SourceObjectStorage',
  TARGET: 'RecommendedObjectStorage',
} as const;
