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
// cm-beetle 은 X-Request-Id 로 요청을 추적한다(GET /request/{reqId} → Handling|Success|Error).
// 인프라 삭제처럼 오래 걸리는 요청을 비동기로 다루기 위해, 삭제 시 reqId 를 헤더로 보내고
// 이 operationId 로 진행 상태를 폴링한다. tumblebug 에도 GetRequest 가 있어 접두어 필수.
const GET_BEETLE_REQUEST = 'cm-beetle/GetRequest';

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

export function useDeleteMci(params: IDeleteMciParams, reqId?: string) {
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

  // reqId 를 X-Request-Id 로 실어 보내면 백엔드 프록시가 그대로 cm-beetle 에 전달한다.
  // 그 뒤 useGetBeetleRequest(reqId) 로 진행 상태를 조회할 수 있다.
  const config = reqId ? { headers: { 'X-Request-Id': reqId } } : undefined;

  return useAxiosPost<IAxiosResponse<any>, any>(
    DELETE_INFRA,
    requestBodyWrapper,
    config,
  );
}

// 삭제 등 장시간 요청의 진행 상태를 cm-beetle 요청 추적으로 조회한다.
// 응답 status: Handling(진행 중) | Success | Error. 우리가 504 로 끊겨도 기록은 남으므로,
// 화면 이동·새로고침 뒤에도 reqId 만 있으면 결과를 알 수 있다.
export function useGetBeetleRequest(reqId: string) {
  return useAxiosPost<IAxiosResponse<any>, any>(GET_BEETLE_REQUEST, {
    pathParams: { reqId },
  });
}
