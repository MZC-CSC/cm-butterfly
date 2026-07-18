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
import { startDeleteTracking } from '@/entities/mci/lib/deleteTracker';

const pinia = createPinia();
Vue.use(PiniaVuePlugin);
Vue.use(MirinaeDesignSystem);
Vue.use(VueRouter);

async function init() {
  const router = McmpRouter.getRouter();

  try {
    await JwtTokenProvider.validateToken();
    // 새로고침·새 탭으로 들어온 경우다. 로그인 절차를 다시 타지 않으므로 여기서 이어 붙인다.
    startSessionExpiryWatch();
    void startDeleteTracking();
  } catch (e) {
    // 서버가 거절한 토큰을 그대로 두면 라우터 가드가 살아 있는 세션으로 오인한다.
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
