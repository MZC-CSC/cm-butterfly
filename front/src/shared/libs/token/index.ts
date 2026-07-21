import axios from 'axios';
import { McmpRouter } from '@/app/providers/router';
import { AUTH_ROUTE } from '@/pages/auth/auth.route';
import { axiosPost, IAxiosResponse } from '@/shared/libs/api/index';
import { IUserLoginResponse } from '@/entities';
import { jwtDecode } from 'jwt-decode';
import LocalStorageConnector from '@/shared/libs/access-localstorage/localStorageConnector';
import { clearSession } from '@/shared/libs/auth/session';

interface IJwtToken {
  access_token: string;
  refresh_token: string;
}

const url = import.meta.env.VITE_BACKEND_ENDPOINT;

export default class JwtTokenProvider {
  private static tokenProvider: JwtTokenProvider | null = null;
  private localstorage: LocalStorageConnector<IJwtToken>;
  private REFRESH_TOKEN_URL = 'auth/refresh';
  private TOKEN_STORAGE = 'MCMP_TOEKN';
  private static TOKEN_VALIDATION_URL = 'auth/validate';
  private refresh_token = '';
  private access_token = '';

  constructor() {
    this.localstorage = new LocalStorageConnector<IJwtToken>(
      this.TOKEN_STORAGE,
    );

    const storeValue = this.localstorage.getValue();
    if (storeValue) {
      this.access_token = storeValue.access_token;
      this.refresh_token = storeValue.refresh_token;
    }
  }

  static getProvider() {
    if (this.tokenProvider === null) {
      this.tokenProvider = new JwtTokenProvider();
    }

    return this.tokenProvider;
  }

  public getTokens(): IJwtToken {
    return {
      refresh_token: this.refresh_token,
      access_token: this.access_token,
    };
  }

  public setTokens(token: IJwtToken) {
    this.refresh_token = token.refresh_token;
    this.access_token = token.access_token;
    this.localstorage.setItem(token);
  }

  public removeToken() {
    this.localstorage.removeItem();
  }

  public static async validateToken() {
    await axiosPost(this.TOKEN_VALIDATION_URL, null);
  }

  public async refreshTokens() {
    try {
      const refreshRes = await axios.post<IAxiosResponse<IUserLoginResponse>>(
        url + `/${this.REFRESH_TOKEN_URL}`,
        {
          request: {
            refresh_token: this.refresh_token,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.access_token}`,
          },
        },
      );

      if (!refreshRes.data || !refreshRes.data.responseData) {
        throw new Error('Token refresh error');
      }
      return refreshRes;
    } catch (error: any) {
      // A failed refresh means the session is over. Clear it fully — not just the token —
      // so the background polling (job tracking, notifications, activity watch) stops. If it
      // keeps running it hits the API again, gets another 401, fails to refresh, and shows
      // this same popup on a loop, even on the login screen where there is no session left.
      clearSession();

      alert('User Session Expired.\n Please login again');
      McmpRouter.getRouter()
        .replace({ name: AUTH_ROUTE.LOGIN._NAME })
        .catch(() => {});

      return Promise.reject(error);
    }
  }

  public parseAccessToken() {
    let decodedToken: any = {};
    try {
      decodedToken = jwtDecode(this.access_token);
    } catch (e) {
      console.log(e);
    }
    return decodedToken;
  }
}
