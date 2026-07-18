import { workflowManagementRoutes } from '@/app/providers/router/routes/workflowManagement';
import VueRouter, { RouteConfig } from 'vue-router';
import { ROOT_ROUTE } from '@/app/providers/router/routes/constants';
import authRoutes from '@/pages/auth/auth.route';
import { sourceComputingRoutes } from '@/app/providers/router/routes/sourceComputing';
import { modelRoutes } from '@/app/providers/router/routes/models';
import { workloadsRoutes } from '@/app/providers/router/routes/workloads';
import { cloudResourcesRoutes } from '@/app/providers/router/routes/cloudResources';
import { MainLayout } from '@/app/Layouts';
import { Route } from 'vue-router';
import { AUTH_ROUTE } from '@/pages/auth/auth.route';
import { isSessionAlive } from '@/shared/libs/auth/session';
import { ROLE_TYPE } from '@/shared/libs/accessControl/pageAccessHelper/constant';
import { RoleType } from '@/shared/libs/accessControl/pageAccessHelper/types';
import { tempRoutes } from '@/app/providers/router/routes/temp';
import NotFound from '@/pages/error/404/NotFound.vue';
//TODO admin부분 고려

export class McmpRouter {
  static router: VueRouter | null = null;

  private static rootRoute: RouteConfig[] = [
    {
      path: '/',
      redirect: '/main',
      name: ROOT_ROUTE._NAME,
    },
    {
      path: '/main',
      component: MainLayout,
      // 로그인 없이는 어떤 화면도 열리지 않아야 한다. 하위 라우트마다 붙이지 않고 여기에 한 번
      // 붙이는 것으로 충분하다 — 가드는 `to.matched` 로 부모까지 훑기 때문이다.
      // 새 화면을 추가할 때 표시를 빠뜨려 구멍이 생기는 일도 이 방식이면 없다.
      meta: { requiresAuth: true },
      children: [
        ...sourceComputingRoutes,
        ...modelRoutes,
        ...workflowManagementRoutes,
        ...workloadsRoutes,
        ...tempRoutes,
        ...cloudResourcesRoutes,
      ],
    },
    ...authRoutes,
    {
      path: '/test',
      component: MainLayout,
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
  ];

  public static getRouter(): VueRouter {
    if (McmpRouter.router === null) {
      McmpRouter.initRouter();
    }
    return McmpRouter.router!;
  }

  public static initRouter() {
    if (this.router === null) {
      McmpRouter.router = new VueRouter({
        mode: 'history',
        routes: McmpRouter.rootRoute,
      });

      McmpRouter.router.beforeEach((to: Route, from: Route, next) => {
        const requiresAuth = to.matched.some(
          record => record.meta?.requiresAuth,
        );
        // 판정은 토큰으로 한다. 스토어는 새로고침을 넘기지 못해 멀쩡한 사용자를 쫓아낸다.
        const isAuthenticated = isSessionAlive();

        // TODO: 인증된 유저의 role 목록. (우선 static data)
        const userRoles: RoleType[] = Object.values(ROLE_TYPE); // temporary value

        // userRoles.forEach((userRole: RoleType) => {
        //   const isAccessible = getMinimalPageAccessPermissionList(
        //     userRole,
        //   ).includes(toLower(String(to.name)) as MenuId);

        //   if (requiresAuth) {
        //     if (!isAuthenticated) {
        //       next({ name: AUTH_ROUTE.LOGIN._NAME });
        //       return;
        //       // 2-2. 접근 불가능한 role인 경우 next(false)로 막기 - option: forbidden page로 이동
        //     } else if (isAuthenticated && isAccessible) {
        //       next();
        //     } else if (isAuthenticated && !isAccessible) {
        //       alert('권한이 없습니다.');
        //       next(false);
        //     } else {
        //       next();
        //     }
        //   } else {
        //     next();
        //   }

        // 인증이 필요한 화면인데 로그인 상태가 아니면 로그인 화면으로 보낸다.
        // 역할(role)별 접근 제어는 아직 없다 — 로그인만 확인한다.
        if (requiresAuth && !isAuthenticated) {
          next({ name: AUTH_ROUTE.LOGIN._NAME });
          return;
        }

        next();
      });

      // getMinimalPageAccessPermissionList(userRole).forEach(
      //   (menuId: MenuId) => {
      //     if (toLower(String(to.name)) === toLower(menuId)) {
      //       next({ name: to.name as string });
      //     } else if (toLower(String(to.name)) !== toLower(menuId)) {
      //       // console.log('here');
      //       // alert('권한이 없습니다.');
      //       // next();
      //     }
      //   },
      // );

      // 2. 인증된 사용자가 접근하려 할 때 (authorized)
      // 2-1. 접근 가능한 role인경우 next()
      // });

      // McmpRouter.router.beforeEach((to: Route, from: Route, next) => {
      //   const isLogin = useAuthenticationStore().login;
      //   // const userRole = useAuthorizationStore().role;

      //   console.log(isLogin);
      //   // console.log(userRole);
      //   // console.log(to);

      //   if (!isLogin) {
      //     if (to.name === AUTH_ROUTE.LOGIN._NAME) {
      //       next();
      //       return;
      //     } else {
      //       next({ name: AUTH_ROUTE.LOGIN._NAME });
      //     }
      //   }

      //   /* 역할기반 access control */
      //   const accessibleRoles: AuthorizationType[] = to.meta?.roles || [];

      //   /*
      //    * 1. admin 만 접근가능한 페이지 인지를 판단함.
      //    * 2. admin만 접근 가능하다면 role이 admin인지 판단함.
      //    * 3-1. role이 admin이 아니라면 from으로 돌아가고 alert를 함.
      //    * 3-2. role이 admin이라면 to로 next함.
      //    *
      //    *
      //    * 유저별로 접근가능한 메뉴가 다르다면?
      //    * 1. 서버에서 접근가능한 메뉴목록들을 가져와서 변수에 저장한다음, 페이지를 이동할 때 마다 해당 변수에 값이 들어있는지를 검사하는 로직을 추가.
      //    * */

      //   // if (accessibleRoles.length > 0 && accessibleRoles.includes('admin')) {
      //   //   if (userRole === 'admin') {
      //   //     next();
      //   //   } else {
      //   //     next(false);
      //   //     alert('권한이 없습니다.');
      //   //   }
      //   // } else {
      //   //   next();
      //   // }
      // });
    }
  }
}
