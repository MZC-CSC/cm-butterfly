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
import { migrationGuideRoutes } from '@/app/providers/router/routes/migrationGuide';
import NotFound from '@/pages/error/404/NotFound.vue';
//TODO consider the admin part

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
      // No screen should open without login. Setting it here once is enough — no need
      // to attach it to every child route, since the guard walks up parents via `to.matched`.
      // This way, adding a new screen can never leave a gap by forgetting to mark it.
      meta: { requiresAuth: true },
      children: [
        ...migrationGuideRoutes,
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
        // Decide based on the token. The store does not survive a refresh, so it would kick out a valid user.
        const isAuthenticated = isSessionAlive();

        // TODO: role list of the authenticated user. (static data for now)
        const userRoles: RoleType[] = Object.values(ROLE_TYPE); // temporary value

        // userRoles.forEach((userRole: RoleType) => {
        //   const isAccessible = getMinimalPageAccessPermissionList(
        //     userRole,
        //   ).includes(toLower(String(to.name)) as MenuId);

        //   if (requiresAuth) {
        //     if (!isAuthenticated) {
        //       next({ name: AUTH_ROUTE.LOGIN._NAME });
        //       return;
        //       // 2-2. block with next(false) for an inaccessible role - option: navigate to a forbidden page
        //     } else if (isAuthenticated && isAccessible) {
        //       next();
        //     } else if (isAuthenticated && !isAccessible) {
        //       alert('You do not have permission.');
        //       next(false);
        //     } else {
        //       next();
        //     }
        //   } else {
        //     next();
        //   }

        // If a screen requires auth and the user is not logged in, send them to the login screen.
        // There is no per-role access control yet — we only check login.
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
      //       // alert('You do not have permission.');
      //       // next();
      //     }
      //   },
      // );

      // 2. when an authenticated user tries to access (authorized)
      // 2-1. call next() for an accessible role
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

      //   /* role-based access control */
      //   const accessibleRoles: AuthorizationType[] = to.meta?.roles || [];

      //   /*
      //    * 1. Determine whether the page is admin-only.
      //    * 2. If admin-only, determine whether the role is admin.
      //    * 3-1. If the role is not admin, go back to `from` and alert.
      //    * 3-2. If the role is admin, next() to `to`.
      //    *
      //    *
      //    * What if the accessible menus differ per user?
      //    * 1. Fetch the accessible menu list from the server and store it in a variable, then add logic that checks whether that variable holds the value each time a page navigates.
      //    * */

      //   // if (accessibleRoles.length > 0 && accessibleRoles.includes('admin')) {
      //   //   if (userRole === 'admin') {
      //   //     next();
      //   //   } else {
      //   //     next(false);
      //   //     alert('You do not have permission.');
      //   //   }
      //   // } else {
      //   //   next();
      //   // }
      // });
    }
  }
}
