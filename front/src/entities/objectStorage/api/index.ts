import { axiosInstance } from '@/shared/libs/api/instance';
import type {
  IArtifact,
  IBeetleResponse,
  IMigratedBucket,
  IObjectStorageAccessRequest,
  IRecommendedObjectStorage,
  IScannedBucket,
  ISourceObjectStorage,
  ObjectStorageSupport,
} from '@/entities/objectStorage/model/types';
import { OBJECT_STORAGE_SCHEMA } from '@/entities/objectStorage/model/types';

const SCAN = 'cm-beetle/ScanObjectStorage';
const INSPECT = 'cm-beetle/InspectObjectStorage';
const SUPPORT = 'cm-beetle/GetObjectStorageSupport';
const RECOMMEND = 'cm-beetle/RecommendObjectStorage';
const MIGRATE = 'cm-beetle/MigrateObjectStorage';
const LIST = 'cm-beetle/ListObjectStorages';
const GET = 'cm-beetle/GetObjectStorage';
const LIST_OBJECTS = 'cm-beetle/ListObjectStorageObjects';
const DELETE = 'cm-beetle/DeleteObjectStorage';
const LIST_ARTIFACTS = 'cm-beetle/ListArtifacts';
const CREATE_ARTIFACT = 'cm-beetle/CreateArtifact';
const UPDATE_ARTIFACT = 'cm-beetle/UpdateArtifact';
const DELETE_ARTIFACT = 'cm-beetle/DeleteArtifact';

/**
 * Every call goes through the console's proxy, which answers
 * { responseData: <subsystem body>, status }. cm-beetle's own body is
 * { success, data, message }; this unwraps both and fails loudly when cm-beetle
 * says it did not succeed, instead of handing an empty value to the screen.
 */
async function call<T>(
  operation: string,
  body: Record<string, any>,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await axiosInstance.post(operation, body, { headers });
  const payload = res.data?.responseData as IBeetleResponse<T> | T;
  if (payload && typeof payload === 'object' && 'success' in (payload as any)) {
    const wrapped = payload as IBeetleResponse<T>;
    if (!wrapped.success) {
      throw new Error(
        wrapped.error || wrapped.message || `${operation} failed`,
      );
    }
    return wrapped.data as T;
  }
  return payload as T;
}

// cm-beetle direct flow (kept for testing): the account keys are typed in and used for
// this read only.
export function scanSourceBuckets(access: IObjectStorageAccessRequest) {
  return call<IScannedBucket[]>(SCAN, { request: access });
}

export function inspectSourceBuckets(
  access: IObjectStorageAccessRequest,
  selectedBucketNames: string[],
) {
  return call<ISourceObjectStorage>(INSPECT, {
    request: { ...access, selectedBucketNames },
  });
}

export async function getObjectStorageSupport(): Promise<ObjectStorageSupport> {
  const res = await axiosInstance.post(SUPPORT, {});
  const body = res.data?.responseData ?? {};
  // { success, data: { <csp>: {...} } } or the map itself, depending on the version.
  return (body.data ?? body.supports ?? body) as ObjectStorageSupport;
}

export function recommendObjectStorage(
  source: ISourceObjectStorage,
  csp: string,
  region: string,
) {
  return call<IRecommendedObjectStorage>(RECOMMEND, {
    request: {
      desiredCloud: { csp, region },
      sourceObjectStorages: source.sourceObjectStorages,
    },
  });
}

/**
 * Creates the target buckets. With `Prefer: respond-async` cm-beetle answers 202 as soon
 * as it has taken the request and does the work behind it; the outcome is read from
 * GET /request/{reqId} with the id we send as X-Request-Id.
 */
export function migrateObjectStorage(
  nsId: string,
  target: IRecommendedObjectStorage,
  reqId: string,
  nameSeed?: string,
) {
  const body: Record<string, any> = {
    pathParams: { nsId },
    request: target,
  };
  if (nameSeed) body.queryParams = { nameSeed };
  return axiosInstance.post(MIGRATE, body, {
    headers: { Prefer: 'respond-async', 'X-Request-Id': reqId },
  });
}

// cm-beetle 0.6.3 answers { objectStorage: [...] } here, although its swagger
// describes an id list.
export async function listMigratedBuckets(
  nsId: string,
): Promise<IMigratedBucket[]> {
  const data = await call<{ objectStorage?: IMigratedBucket[] }>(LIST, {
    pathParams: { nsId },
  });
  return data?.objectStorage ?? [];
}

export function getMigratedBucket(nsId: string, osId: string) {
  return call<any>(GET, { pathParams: { nsId, osId } });
}

export function listBucketObjects(nsId: string, osId: string) {
  return call<any>(LIST_OBJECTS, { pathParams: { nsId, osId } });
}

export function deleteMigratedBucket(nsId: string, osId: string) {
  return call<any>(DELETE, { pathParams: { nsId, osId } });
}

export function listObjectStorageModels<T>(schemaType: string) {
  return call<IArtifact<T>[]>(LIST_ARTIFACTS, {
    queryParams: { schemaType },
  });
}

/** `sourceGroupId` records which source service the buckets were collected from. */
export function saveSourceModel(
  name: string,
  description: string,
  payload: ISourceObjectStorage,
  sourceGroupId?: string,
) {
  const request: Record<string, any> = {
    name,
    description,
    category: 'infra',
    stage: 'source',
    schemaType: OBJECT_STORAGE_SCHEMA.SOURCE,
    payload,
  };
  if (sourceGroupId) request.sourceGroupId = sourceGroupId;
  return call<IArtifact<ISourceObjectStorage>>(CREATE_ARTIFACT, { request });
}

/** `parentId` links the target model to the source model it was recommended from. */
export function saveTargetModel(
  name: string,
  description: string,
  payload: IRecommendedObjectStorage,
  sourceModelId: string,
) {
  return call<IArtifact<IRecommendedObjectStorage>>(CREATE_ARTIFACT, {
    request: {
      name,
      description,
      category: 'infra',
      stage: 'target',
      schemaType: OBJECT_STORAGE_SCHEMA.TARGET,
      parentId: sourceModelId,
      payload,
    },
  });
}

/** Renames a model; the payload and lineage are sent back unchanged. */
export function updateObjectStorageModel<T>(
  artifact: IArtifact<T>,
  name: string,
  description: string,
) {
  const { id, createTime, updateTime, ...rest } = artifact as any;
  return call<IArtifact<T>>(UPDATE_ARTIFACT, {
    pathParams: { id },
    request: { ...rest, name, description },
  });
}

export function deleteObjectStorageModel(id: string) {
  return call<any>(DELETE_ARTIFACT, { pathParams: { id } });
}
