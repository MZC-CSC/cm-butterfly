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
        // There's no token to restore — either before login or the session is already gone. Stop polling (clearSession)
        // and just do an SPA navigation to the login screen. Showing an expiry popup or a full reload here would make the
        // login screen's unauthenticated request 401 again → reload, looping forever. Show the expiry notice only on a real expiry (refresh failure/403).
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
