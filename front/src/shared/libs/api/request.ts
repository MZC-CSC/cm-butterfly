import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Ref, ref } from 'vue';
import {
  AsyncStatus,
  IUseAxiosWrapperReturnType,
} from '@/shared/libs/api/index';
import { axiosInstance } from '@/shared/libs/api/instance';

export function axiosGet<T>(url: string, config?: AxiosRequestConfig) {
  return axiosInstance.get<T>(`/${url}`, config);
}

export function axiosPost<T, D = any>(
  url: string,
  data: D,
  config?: AxiosRequestConfig,
) {
  return axiosInstance.post<T>(`/${url}`, data, config);
}

export function useAxiosWrapper<T, D = any>(
  apiCall: (
    payload?: D,
    config?: AxiosRequestConfig,
  ) => Promise<AxiosResponse<T>>,
): IUseAxiosWrapperReturnType<T, D> {
  const isLoading: Ref<boolean> = ref(false);
  const data: Ref<T | null> = ref(null);
  const error: Ref<Error | null> = ref(null);
  const errorMsg: Ref<string | null> = ref(null);
  const status: Ref<AsyncStatus> = ref<AsyncStatus>('idle');

  const execute = async (
    payload?: D,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    isLoading.value = true;
    status.value = 'loading';
    let result;
    try {
      result = await apiCall(payload, config);
      reset();
      data.value = result.data;
      status.value = 'success';
      return result;
    } catch (e: any) {
      reset();
      error.value = e;
      if (axios.isCancel(e)) {
        status.value = 'cancel';
      } else {
        errorMsg.value = extractErrorMessage(e);
        status.value = 'error';
      }
      return Promise.reject({ error, errorMsg, status });
    } finally {
      isLoading.value = false;
    }
  };

  const reset = () => {
    isLoading.value = false;
    status.value = 'idle';
    data.value = null;
    error.value = null;
    errorMsg.value = null;
  };

  return {
    isLoading,
    data,
    error,
    errorMsg,
    status,
    reset,
    execute,
  };
}

// Function to handle the error message from the server response
export function extractErrorMessage(error: any): string | null {
  if (error.response) {
    if (error.status === 401) {
      return null;
    }
    // Extract the message from the error response returned by the server
    const errorData = error.response.data;

    if (errorData.responseData?.message) {
      return errorData.responseData.message;
    }
    if (errorData.responseData?.errors) {
      return errorData.responseData.errors;
    }
    if (errorData.responseData?.error) {
      return errorData.responseData.error;
    }
    if (errorData.status?.message) {
      return errorData.status.message;
    }
    if (errorData.error) {
      return errorData.error;
    }
    if (errorData.responseData?.errorMessage) {
      return errorData.responseData.errorMessage;
    }
    return errorData.message || error.message || 'Unknown error occurred';
  } else if (error.request) {
    // The request was made but no response was received from the server
    return 'No response received from server';
  } else {
    // Something went wrong while setting up the request
    return error.message || 'Error in setting up request';
  }
}

export function useAxiosGet<T>(
  url: string,
  initialConfig: AxiosRequestConfig = {},
) {
  return useAxiosWrapper<T>((_, dynamicConfig) => {
    const mergedConfig = {
      ...initialConfig,
      ...dynamicConfig,
    };

    return axiosGet<T>(url, mergedConfig);
  });
}

export function useAxiosPost<T, D>(
  url: string,
  data: D,
  initialConfig: AxiosRequestConfig = {},
) {
  return useAxiosWrapper<T, D>((payload, dynamicConfig) => {
    const mergedConfig = {
      ...initialConfig,
      ...dynamicConfig,
    };
    return axiosPost<T, D>(url, payload || data, mergedConfig);
  });
}
