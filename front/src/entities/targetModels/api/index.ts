import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { IRecommendModelResponse } from '@/entities/recommendedModel/model/types';
import { ITargetModelResponse } from '@/entities';
import { ISourceConnectionResponse } from '@/entities/sourceConnection/model/types';
import { axiosInstance } from '@/shared/libs/api/instance';

const CREATE_TARGET_MODEL = 'cm-damselfly/CreateCloudModel';
const CREATE_TARGET_SOFTWARE_MODEL = 'cm-damselfly/CreateTargetSoftwareModel';
const GET_SOURCE_MODEL_LIST = 'cm-damselfly/GetModels';
const UPDATE_TARGET_MODEL = 'cm-damselfly/UpdateCloudModel';
const DELETE_TARGET_MODEL = 'cm-damselfly/DeleteCloudModel';
const DELETE_TARGET_ONPREM_MODEL = 'cm-damselfly/DeleteOnPremModel';
const DELETE_TARGET_SOFTWARE_MODEL = 'cm-damselfly/DeleteTargetSoftwareModel';

interface ICreateTargetModelPayload {
  cloudInfraModel: IRecommendModelResponse['targetInfra'];
  csp: string;
  description: string;
  isInitUserModel: boolean;
  isTargetModel: true;
  region: string;
  userId: string;
  userModelName: string;
  userModelVersion: string;
  zone: string;
}

interface ICreateTargetSoftwareModelPayload {
  description: string;
  isInitUserModel: boolean;
  targetSoftwareModel: any;
  userId: string;
  userModelName: string;
  userModelVersion: string;
}

export function createTargetModel(data: ICreateTargetModelPayload | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<ICreateTargetModelPayload | null>, 'request'>
  > = {
    request: data,
  };
  return useAxiosPost<
    IAxiosResponse<any>,
    Required<
      Pick<RequestBodyWrapper<ICreateTargetModelPayload | null>, 'request'>
    >
  >(CREATE_TARGET_MODEL, requestWrapper);
}

export function createTargetSoftwareModel(data: ICreateTargetSoftwareModelPayload | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<ICreateTargetSoftwareModelPayload | null>, 'request'>
  > = {
    request: data,
  };
  return useAxiosPost<
    IAxiosResponse<any>,
    Required<
      Pick<RequestBodyWrapper<ICreateTargetSoftwareModelPayload | null>, 'request'>
    >
  >(CREATE_TARGET_SOFTWARE_MODEL, requestWrapper);
}

export function useGetTargetModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'pathParams'>> =
    {
      pathParams: { isTargetModel: 'true' },
    };
  return useAxiosPost<
    IAxiosResponse<ITargetModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'pathParams'>>
  >(GET_SOURCE_MODEL_LIST, requestWrapper);
}

export function useUpdateTargetModel(
  modelId: string | null,
  requestData: ICreateTargetModelPayload | null,
) {
  const requestBodyWrapper: Pick<
    RequestBodyWrapper<
      Partial<{
        id: string | null;
        requestData: ICreateTargetModelPayload | null;
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
          requestData: ICreateTargetModelPayload | null;
        }>
      >,
      'pathParams' | 'request'
    >
  >(UPDATE_TARGET_MODEL, requestBodyWrapper);
}

/**
 * Delete target models in bulk
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteTargetModel(['model1', 'model2']);
 */
export function useBulkDeleteTargetModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_TARGET_MODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}

/**
 * Delete target software models in bulk
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteTargetSoftwareModel(['model1', 'model2']);
 */
export function useBulkDeleteTargetSoftwareModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_TARGET_SOFTWARE_MODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}

/**
 * Delete target on-premise models in bulk
 *
 * @param {string[]} modelIds - Array of model IDs to delete
 * @returns {Promise<any[]>} Promise resolving to array of delete responses
 * 
 * @example
 * const result = await useBulkDeleteTargetOnPremModel(['model1', 'model2']);
 */
export function useBulkDeleteTargetOnPremModel(modelIds: string[]) {
  const promiseArr = modelIds.map(modelId => {
    return axiosInstance.post(DELETE_TARGET_ONPREM_MODEL, {
      pathParams: {
        id: modelId,
      },
    });
  });

  return Promise.all(promiseArr);
}
