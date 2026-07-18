import { defineStore } from 'pinia';
import {
  startDeleteTracking,
  stopDeleteTracking,
} from '@/entities/mci/lib/deleteTracker';

export const useAuthenticationStore = defineStore('authentication', {
  state: () => ({
    accessToken: null,
    refreshToken: null,
    login: false,
  }),
  actions: {
    onLogin() {
      this.login = true;
      // 로그인 시점이 삭제 추적의 트리거다. 서버에 남아 있는 요청이 있으면 어느 브라우저에서
      // 접속했든 여기서 이어받아 확인한다 — 앞서 다른 자리에서 낸 삭제가 끝났는지 실패했는지를
      // 워크로드 화면에 들어가기 *전에* 정리해 둔다.
      void startDeleteTracking();
    },
    onLogout() {
      this.login = false;
      stopDeleteTracking();
    },
  },
});
