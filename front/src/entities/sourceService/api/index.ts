import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { IInfraSourceGroupResponse } from '@/entities/sourceService/model/types';
import { axiosInstance } from '@/shared/libs/api/instance';
import type { ISourceGroup } from '@/entities/sourceService/model/types';

const REGISTER_SOURCE_GROUP = 'cm-honeybee/register-source-group';
const UPDATE_SOURCE_GROUP = 'cm-honeybee/Update-Source-Group';
const GET_SOURCE_SERVICE_LIST = 'cm-honeybee/list-source-group';
const GET_SOURCE_SERVICE = 'cm-honeybee/get-source-group';
const DELETE_SOURCE_SERVICE = 'cm-honeybee/delete-source-group';
const GET_INFRA_SOURCE_GROUP = 'cm-honeybee/import-infra-source-group';
const GET_INFRA_INFO_SOURCE_GROUP_REFINE =
  'cm-honeybee/get-infra-info-source-group-refined';

export function useRegisterSourceGroup<T, D>(
  sourceGroupData: D | ISourceGroup,
) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<D | ISourceGroup>, 'request'>
  > = {
    request: sourceGroupData,
  };

  return useAxiosPost<IAxiosResponse<T>, RequestBodyWrapper<D | ISourceGroup>>(
    REGISTER_SOURCE_GROUP,
    requestBodyWrapper,
  );
}

export function useUpdateSourceGroup(
  sourceGroupId: string | null,
  sourceGroupData: { name: string; description: string } | null,
) {
  const requestBodyWrapper = {
    pathParams: {
      sgId: sourceGroupId,
    },
    request: sourceGroupData,
  };

  return useAxiosPost(UPDATE_SOURCE_GROUP, requestBodyWrapper);
}

export function useGetSourceServiceList() {
  return useAxiosPost<IAxiosResponse<any>, null>(GET_SOURCE_SERVICE_LIST, null);
}

export function useGetSourceService(sgId: string | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: {
      sgId: sgId,
    },
  };
  return useAxiosPost<IAxiosResponse<any>, RequestBodyWrapper<any>>(
    GET_SOURCE_SERVICE,
    requestBodyWrapper,
  );
}

// deprecated

export function useBulkDeleteSourceGroup(sourceGroupIds: string[]) {
  const promiseArr = sourceGroupIds.map(sourceGroupId => {
    return axiosInstance.post(DELETE_SOURCE_SERVICE, {
      pathParams: {
        sgId: sourceGroupId,
      },
    });
  });

  return Promise.all(promiseArr);
}

export function useGetInfraSourceGroup(sourceGroupId: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: { sgId: sourceGroupId },
  };

  return useAxiosPost<
    IAxiosResponse<IInfraSourceGroupResponse>,
    Required<Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>>
  >(GET_INFRA_SOURCE_GROUP, requestWrapper);
}

export function useGetInfraSourceGroupInfraRefine(
  sourceGroupId: string | null,
) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: { sgId: sourceGroupId },
  };

  return useAxiosPost<
    IAxiosResponse<any>,
    Required<Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>>
  >(GET_INFRA_INFO_SOURCE_GROUP_REFINE, requestWrapper);
}
