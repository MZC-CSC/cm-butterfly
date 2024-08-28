import { useAxiosPost } from '@/shared/libs/api/request.ts';
import { IAxiosResponse, RequestBodyWrapper } from '@/shared/libs';

const LOGIN_URL = 'auth/login';
const GET_USER_INFO = 'Getuserinfo';
const GET_USER_LIST = 'getusers';

export function useGetLogin<T, D>(loginData: D | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<D | null>, 'request'>
  > = {
    request: loginData,
  };
  return useAxiosPost<IAxiosResponse<T>, RequestBodyWrapper<D | null>>(
    LOGIN_URL,
    requestBodyWrapper,
  );
}

export function useGetUserRole<T, D = any>() {
  return useAxiosPost<T, D | null>(GET_USER_INFO, null);
}

export function getUserList<T, D>(userId: D | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<D | null>, 'queryParams'>
  > = {
    queryParams: userId,
  };

  return useAxiosPost<IAxiosResponse<T>, RequestBodyWrapper<D | null>>(
    GET_USER_LIST,
    requestBodyWrapper,
  );
}
