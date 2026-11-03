import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import {
  IInfraSourceGroupResponse,
  ICspInfo,
  ICspListResponse,
  ICspRegionListResponse,
  IDiscoverResponse,
  CspResourceType,
} from '@/entities/sourceService/model/types';
import { axiosInstance } from '@/shared/libs/api/instance';
import type { ISourceGroup } from '@/entities/sourceService/model/types';

const REGISTER_SOURCE_GROUP = 'cm-honeybee/register-source-group';
const UPDATE_SOURCE_GROUP = 'cm-honeybee/Update-Source-Group';
const GET_SOURCE_SERVICE_LIST = 'cm-honeybee/list-source-group';
const GET_SOURCE_SERVICE = 'cm-honeybee/get-source-group';
const DELETE_SOURCE_SERVICE = 'cm-honeybee/delete-source-group';
const GET_INFRA_SOURCE_GROUP = 'cm-honeybee/import-infra-source-group';
const GET_INFRA_INFO_SOURCE_GROUP = 'cm-honeybee/get-infra-info-source-group';
const GET_SOFTWARE_INFO_SOURCE_GROUP =
  'cm-honeybee/get-software-info-source-group';
const GET_INFRA_INFO_SOURCE_GROUP_REFINE =
  'cm-honeybee/get-infra-info-source-group-refined';
const LIST_CSP = 'cm-honeybee/list-csp';
const GET_CSP = 'cm-honeybee/get-csp';
const LIST_SOURCE_GROUP_REGIONS = 'cm-honeybee/list-source-group-regions';
const DISCOVER_SOURCE_GROUP_RESOURCES =
  'cm-honeybee/discover-source-group-resources';

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

// Structured (non-refined) view of the collected infra for a source group —
// the JSON form of the data collected by import-infra-source-group.
export function useGetInfraInfoSourceGroup(sourceGroupId: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: { sgId: sourceGroupId },
  };

  return useAxiosPost<
    IAxiosResponse<any>,
    Required<Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>>
  >(GET_INFRA_INFO_SOURCE_GROUP, requestWrapper);
}

// Structured (non-refined) view of the collected software for a source group.
export function useGetSoftwareInfoSourceGroup(sourceGroupId: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: { sgId: sourceGroupId },
  };

  return useAxiosPost<
    IAxiosResponse<any>,
    Required<Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>>
  >(GET_SOFTWARE_INFO_SOURCE_GROUP, requestWrapper);
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

// CSP-type source groups (cm-honeybee 0.6.0+). The source account's credential is
// stored by cm-honeybee in its own OpenBao and is never returned, so the console
// only ever sends it.

export function useGetCspList() {
  return useAxiosPost<IAxiosResponse<ICspListResponse>, null>(LIST_CSP, null);
}

// The credential keys, examples and default region of one CSP — the form is
// built from this instead of a per-CSP layout in the console.
export function useGetCspInfo(name: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ name: string | null }>, 'pathParams'>
  > = {
    pathParams: { name },
  };
  return useAxiosPost<
    IAxiosResponse<ICspInfo>,
    Required<Pick<RequestBodyWrapper<{ name: string | null }>, 'pathParams'>>
  >(GET_CSP, requestWrapper);
}

// Regions and zones, queried live with the credential stored for the group.
export function useListSourceGroupRegions(sgId: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>
  > = {
    pathParams: { sgId },
  };
  return useAxiosPost<
    IAxiosResponse<ICspRegionListResponse>,
    Required<Pick<RequestBodyWrapper<{ sgId: string | null }>, 'pathParams'>>
  >(LIST_SOURCE_GROUP_REGIONS, requestWrapper);
}

// What actually exists in the source account, read from the CSP rather than
// from anything the platform registered.
export function useDiscoverSourceGroupResources(
  sgId: string | null,
  resourceType: CspResourceType | null,
) {
  const requestWrapper = {
    pathParams: { sgId },
    queryParams: { resource_type: resourceType },
  };
  return useAxiosPost<IAxiosResponse<IDiscoverResponse>, any>(
    DISCOVER_SOURCE_GROUP_RESOURCES,
    requestWrapper,
  );
}
