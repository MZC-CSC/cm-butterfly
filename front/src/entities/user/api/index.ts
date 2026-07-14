import { useAxiosPost } from '@/shared/libs/api/request';
import { IAxiosResponse, RequestBodyWrapper } from '@/shared/libs';

const LOGIN_URL = 'auth/login';

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

