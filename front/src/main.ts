import Vue from 'vue';
import MirinaeDesignSystem from '@cloudforet-test/mirinae';
import '@cloudforet-test/mirinae/dist/style.css';
import { App } from '@/app';
import { createPinia, PiniaVuePlugin } from 'pinia';
import VueRouter from 'vue-router';
import { McmpRouter } from '@/app/providers/router';
import { i18n } from '@/app/i18n';
import '@/app/style/style.pcss';
import JwtTokenProvider from '@/shared/libs/token';
import { AUTH_ROUTE } from '@/pages/auth/auth.route';
import { clearSession } from '@/shared/libs/auth/session';
import { startSessionExpiryWatch } from '@/features/auth/model/useLogout';
import { startTracking } from '@/shared/libs/tracking/runner';
import { startNotificationPolling } from '@/entities/notification/lib/notificationStore';
// Each checker registers itself with the runner the moment it is imported. If no one
// references these modules they get dropped from the bundle entirely, so import them explicitly here.
import '@/entities/mci/lib/deleteTracker';
import '@/entities/vm/lib/loadTestTracker';
import '@/entities/workflow/lib/workflowTracker';

const pinia = createPinia();
Vue.use(PiniaVuePlugin);
Vue.use(MirinaeDesignSystem);
Vue.use(VueRouter);

async function init() {
  const router = McmpRouter.getRouter();

  try {
    await JwtTokenProvider.validateToken();
    // This is a page refresh or a new tab. The login flow does not run again, so hook it up here.
    startSessionExpiryWatch();
    void startTracking();
    void startNotificationPolling();
  } catch (e) {
    // Leaving a server-rejected token in place would make the router guard mistake it for a live session.
    clearSession();
    McmpRouter.getRouter()
      .push({ name: AUTH_ROUTE.LOGIN._NAME })
      .catch(() => {});
  } finally {
    new Vue({
      i18n,
      pinia,
      router: router,
      render: h => h(App),
    }).$mount('#app');
  }
}

init();
