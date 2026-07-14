import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { IMci, MciResponseData } from '@/entities/mci/model/types';

export interface IMciRequestParams {
  nsId: string | null;
  infraId: string | null;
  option?: string | null;
}

export interface IDeleteMciParams {
  nsId: string;
  infraId: string;
  option?: string;
}

// 마이그레이션 콘솔은 cb-tumblebug 직접 호출이 아니라 cm-beetle 경유로 인프라를 조회한다.
// (beetle이 내부적으로 tumblebug ReadAllInfra/ReadInfra를 호출하고 응답 모델이 동일)
// GetInfra는 cb-tumblebug·cm-beetle 양쪽에 존재해 operationId만으로는 충돌하므로 서브시스템 명시 라우팅을 쓴다.
const GET_ALL_MCI = 'cm-beetle/ListInfra';
const GET_MCI_INFO = 'cm-beetle/GetInfra';
const DELETE_INFRA = 'cm-beetle/DeleteInfra';

export function useGetMciList(projectId: string | null, option: string | null) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<{ nsId: string | null } | { option: string | null }>,
      'pathParams' | 'queryParams'
    >
  > = {
    pathParams: {
      nsId: projectId,
    },
    queryParams: {
      option: option,
    },
  };

  return useAxiosPost<
    IAxiosResponse<MciResponseData>,
    Required<
      Pick<
        RequestBodyWrapper<{ nsId: string | null } | { option: string | null }>,
        'pathParams' | 'queryParams'
      >
    >
  >(GET_ALL_MCI, requestBodyWrapper);
}

export function useGetMciInfo(params: IMciRequestParams | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<IMciRequestParams>, 'pathParams'>
  > = {
    pathParams: {
      nsId: params?.nsId || null,
      infraId: params?.infraId || null,
    },
  };

  return useAxiosPost<
    IAxiosResponse<IMci>,
    Required<Pick<RequestBodyWrapper<IMciRequestParams>, 'pathParams'>>
  >(GET_MCI_INFO, requestBodyWrapper);
}

export function useDeleteMci(params: IDeleteMciParams) {
  const requestBodyWrapper: any = {
    pathParams: {
      nsId: params.nsId,
      infraId: params.infraId,
    },
  };

  if (params.option) {
    requestBodyWrapper.queryParams = {
      option: params.option,
    };
  }

  return useAxiosPost<IAxiosResponse<any>, any>(
    DELETE_INFRA,
    requestBodyWrapper,
  );
}
