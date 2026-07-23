import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { ISourceConnectionResponse } from '@/entities/sourceConnection/model/types';
import { IOnpremModelPayload, ISourceModelResponse } from '@/entities';
import { axiosInstance } from '@/shared/libs/api/instance';

const GET_SOURCE_MODEL_LIST = 'cm-damselfly/GetModels';
const UPDATE_SOURCE_MODEL = 'cm-damselfly/UpdateOnPremModel';
const CREATE_ONPREMMODEL = 'cm-damselfly/CreateOnPremModel';
const DELETE_ONPREMMODEL = 'cm-damselfly/DeleteOnPremModel';
const DELETE_CLOUD_MODEL = 'cm-damselfly/DeleteCloudModel';
const DELETE_SOURCE_SOFTWARE_MODEL = 'cm-damselfly/DeleteSourceSoftwareModel';
const CREATE_SOURCE_SOFTWARE_MODEL = 'cm-damselfly/CreateSourceSoftwareModel';

export function useGetSourceModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'pathParams'>> =
    {
      pathParams: { isTargetModel: 'false' },
    };
  return useAxiosPost<
    IAxiosResponse<ISourceModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'pathParams'>>
  >(GET_SOURCE_MODEL_LIST, requestWrapper);
}

interface ICreateSourceModelPayload {
  onpremiseInfraModel: ISourceModelResponse['onpremiseInfraModel'];
  description: string;
  isInitUserModel: true;
  userId: string;
  userModelName: string;
  userModelVersion: string;
}
export function useUpdateSourceModel(
  modelId: string | null,
  requestData: ICreateSourceModelPayload | null,
) {
  const requestBodyWrapper: Pick<
    RequestBodyWrapper<
      Partial<{
        id: string | null;
        requestData: ICreateSourceModelPayload | null;
      }>
    >,
    'pathParams' | 'request'
  > = {
    pathParams: {
      id: modelId,
    },
    request: { requestData },
  };

  return useAxiosPost<
    IAxiosResponse<ISourceConnectionResponse>,
    Pick<
      RequestBodyWrapper<
        Partial<{
          id: string | null;
          requestData: ICreateSourceModelPayload | null;
        }>
      >,
      'pathParams' | 'request'
    >
  >(UPDATE_SOURCE_MODEL, requestBodyWrapper);
}

export function useCreateOnpremmodel(data: IOnpremModelPayload | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<IOnpremModelPayload | null>, 'request'>
  > = {
    request: data,
  };
  return useAxiosPost<
    IAxiosResponse<any>,
    Required<Pick<RequestBodyWrapper<IOnpremModelPayload | null>, 'request'>>
  >(CREATE_ONPREMMODEL, requestWrapper);
}

interface ICreateSourceSoftwareModelPayload {
  description: string;
  isInitUserModel: boolean;
  sourceSoftwareModel: any;
  userId: string;
  userModelName: string;
  userModelVersion: string;
}

export function useCreateSourceSoftwareModel(data: ICreateSourceSoftwareModelPayload | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<ICreateSourceSoftwareModelPayload | null>, 'request'>
  > = {
    request: data,
  };
  return useAxiosPost<
    IAxiosResponse<any>,
    Required<Pick<RequestBodyWrapper<ICreateSourceSoftwareModelPayload | null>, 'request'>>
  >(CREATE_SOURCE_SOFTWARE_MODEL, requestWrapper);
}

/**
 * Delete source software models in bulk.
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteSourceSoftwareModel(['model1', 'model2']);
 */
export function useBulkDeleteSourceSoftwareModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_SOURCE_SOFTWARE_MODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}

/**
 * Delete source infra models in bulk (legacy function).
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteSourceInfraModel(['model1', 'model2']);
 */
export function useBulkDeleteSourceInfraModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_ONPREMMODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}

/**
 * Delete source cloud models in bulk.
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteSourceCloudModel(['model1', 'model2']);
 */
export function useBulkDeleteSourceCloudModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_CLOUD_MODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}

// Legacy function name for backward compatibility
export function useBulkAddWorkspaceList(modelIds: string[]) {
  return useBulkDeleteSourceInfraModel(modelIds);
}
