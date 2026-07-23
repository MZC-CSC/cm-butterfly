import { defineStore } from 'pinia';
import { IUserLoginResponse } from '@/entities';
import { startTracking, stopTracking } from '@/shared/libs/tracking/runner';
import {
  startNotificationPolling,
  stopNotificationPolling,
} from '@/entities/notification/lib/notificationStore';
// Side-effect imports so the checkers self-register (prevents tree-shaking).
import '@/entities/mci/lib/deleteTracker';
import '@/entities/vm/lib/loadTestTracker';

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
      // Login is the trigger for delete tracking. If requests remain on the server, we pick
      // them up and check them here regardless of which browser signed in — resolving whether
      // a delete issued elsewhere finished or failed *before* entering the workload screen.
      void startTracking();
      void startNotificationPolling();
    },
    onLogout() {
      this.isLogin = false;
      stopTracking();
      stopNotificationPolling();
    },
  },
});
