import axios, {
  AxiosError,
  AxiosRequestConfig,
  CancelTokenSource,
} from 'axios';
import { McmpRouter } from '@/app/providers/router';
import { AUTH_ROUTE } from '@/pages/auth/auth.route';
import JwtTokenProvider from '@/shared/libs/token';
import { clearSession, handleSessionExpired } from '@/shared/libs/auth/session';

const url = import.meta.env.VITE_BACKEND_ENDPOINT;
const createInstance = () => {
  return axios.create({
    baseURL: `${url}`,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const axiosInstance = createInstance();
const cancelSourceMap = new Map<AxiosRequestConfig, CancelTokenSource>();
axiosInstance.interceptors.request.use(config => {
  const { access_token } = JwtTokenProvider.getProvider().getTokens();

  const cancelSource: CancelTokenSource = axios.CancelToken.source();
  config.cancelToken = cancelSource.token;

  cancelSourceMap.set(config, cancelSource);

  if (access_token) config.headers.Authorization = `Bearer ${access_token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  response => {
    cancelSourceMap.delete(response.config);
    return response;
  },
  async (error: AxiosError) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
      //@ts-ignore
      error.config || {};

    //@ts-ignore
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const jwtTokenProvider: JwtTokenProvider = JwtTokenProvider.getProvider();
      const { refresh_token } = jwtTokenProvider.getTokens();

      if (!refresh_token) {
        // 되살릴 토큰이 없다 — 로그인 전이거나 이미 세션이 없는 상태다. 폴링을 멈추고(clearSession)
        // 로그인 화면으로 SPA 이동만 한다. 여기서 만료 팝업·전체 리로드를 하면 로그인 화면의 미인증
        // 요청이 다시 401 → 리로드로 무한 반복된다. 만료 안내는 실제 만료(갱신 실패·403)에서만 한다.
        clearSession();
        McmpRouter.getRouter()
          .replace({ name: AUTH_ROUTE.LOGIN._NAME })
          .catch(() => {});
      } else {
        try {
          const refreshRes = await jwtTokenProvider.refreshTokens();
          const { refresh_token, access_token } = refreshRes.data.responseData!;

          if (refresh_token && access_token) {
            jwtTokenProvider.setTokens({ refresh_token, access_token });
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
            }
            return axiosInstance(originalRequest);
          }
        } catch (e) {
          const cancelSource = cancelSourceMap.get(originalRequest);
          if (cancelSource) {
            cancelSource.cancel(
              'Refresh token renewal failed, original request canceled.',
            );
            cancelSourceMap.delete(originalRequest);
          }
          return Promise.reject(e);
        }
      }
    } else if (error.response?.status === 403) {
      handleSessionExpired();
    }
    return Promise.reject(error);
  },
);
