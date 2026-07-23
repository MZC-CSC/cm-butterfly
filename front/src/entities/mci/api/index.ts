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

// The migration console queries infrastructure through cm-beetle rather than calling cb-tumblebug directly.
// (beetle internally calls tumblebug ReadAllInfra/ReadInfra and the response models are identical.)
// GetInfra exists on both cb-tumblebug and cm-beetle, so operationId alone collides — we use explicit subsystem routing.
const GET_ALL_MCI = 'cm-beetle/ListInfra';
const GET_MCI_INFO = 'cm-beetle/GetInfra';
const DELETE_INFRA = 'cm-beetle/DeleteInfra';
// cm-beetle tracks requests by X-Request-Id (GET /request/{reqId} → Handling|Success|Error).
// To handle long-running requests such as infra deletion asynchronously, we send reqId as a header on delete
// and poll progress with this operationId. tumblebug also has GetRequest, so the prefix is required.
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

  // Sending reqId as X-Request-Id makes the backend proxy forward it as-is to cm-beetle.
  // Progress can then be polled with useGetBeetleRequest(reqId).
  const config = reqId ? { headers: { 'X-Request-Id': reqId } } : undefined;

  return useAxiosPost<IAxiosResponse<any>, any>(
    DELETE_INFRA,
    requestBodyWrapper,
    config,
  );
}

// Queries the progress of long-running requests (such as deletion) via cm-beetle request tracking.
// Response status: Handling (in progress) | Success | Error. The record persists even if we time out with 504,
// so the result can be retrieved with just the reqId after navigating away or refreshing.
export function useGetBeetleRequest(reqId: string) {
  return useAxiosPost<IAxiosResponse<any>, any>(GET_BEETLE_REQUEST, {
    pathParams: { reqId },
  });
}
