import { Ref } from 'vue';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface IApiState<T> {
  loading?: boolean;
  success?: boolean;
  error?: string | null;
  data?: T | null;
}

export interface IAxiosResponse<T> {
  responseData?: T;
  status?: {
    code: number;
    message: string;
  };
}

export interface RequestBodyWrapper<D> {
  request?: D;
  queryParams?: D;
  pathParams?: D;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancel';

export interface IUseAxiosWrapperReturnType<T, D> {
  isLoading: Ref<boolean>;
  status: Ref<AsyncStatus>;
  data: Ref<T | null>;
  error: Ref<Error | null>;
  errorMsg: Ref<string | null>;
  execute: (
    payload?: D,
    config?: AxiosRequestConfig,
  ) => Promise<AxiosResponse<T>>;
  reset: () => void;
}

export interface IUseBulkAxiosWrapperReturnType<T, D extends Array<unknown>> {
  isLoading: Ref<boolean>;
  status: Ref<AsyncStatus>;
  data: Ref<T[] | null>; // Check whether it's defined as T[]
  error: Ref<Error | null>;
  errorMsg: Ref<string[] | null>;
  execute: (
    payload?: D,
    config?: AxiosRequestConfig,
  ) => Promise<AxiosResponse<T>[]>; // Check whether it's defined as Promise<AxiosResponse<T[]>>
  reset: () => void;
}

export interface IUseAxiosErrorDetail {
  error: Ref<Error | null>;
  errorMsg: Ref<string | null>;
  status: Ref<AsyncStatus>;
}
