import { defineStore } from 'pinia';
import { IUserLoginResponse } from '@/entities';
import {
  startDeleteTracking,
  stopDeleteTracking,
} from '@/entities/mci/lib/deleteTracker';

export type AuthorizationType = null | 'admin' | 'client';

type IAuthStore = Pick<IUserLoginResponse, 'role'> & {
  id: string;
  isLogin: boolean;
};

export const useAuthStore = defineStore('auth', {
  state: (): IAuthStore => ({
    id: '',
    role: '',
    isLogin: false,
  }),
  actions: {
    onLogin(loginData: Omit<IAuthStore, 'isLogin'>) {
      this.id = loginData.id;
      this.role = loginData.role;
      this.isLogin = true;
      // 로그인 시점이 삭제 추적의 트리거다. 서버에 남아 있는 요청이 있으면 어느 브라우저에서
      // 접속했든 여기서 이어받아 확인한다 — 앞서 다른 자리에서 낸 삭제가 끝났는지 실패했는지를
      // 워크로드 화면에 들어가기 *전에* 정리해 둔다.
      void startDeleteTracking();
    },
    onLogout() {
      this.isLogin = false;
      stopDeleteTracking();
    },
  },
});
