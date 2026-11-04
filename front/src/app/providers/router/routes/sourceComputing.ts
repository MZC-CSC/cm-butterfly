import { RouteConfig } from 'vue-router';
import { SOURCE_COMPUTING_ROUTE } from '@/app/providers/router/routes/constants';
import SourceServicePage from '@/pages/sourceServices/ui/SourceServicePage.vue';

export const sourceComputingRoutes: RouteConfig[] = [
  {
    path: 'source-computing',
    name: SOURCE_COMPUTING_ROUTE._NAME,
    // Keyed by route: Source Services and Cloud Sources share one page component, which
    // the router would otherwise reuse (and keep the other kind's state) when switching.
    component: { template: '<router-view :key="$route.name"/>' },
    children: [
      {
        path: 'source-services',
        name: SOURCE_COMPUTING_ROUTE.SOURCE_SERVICES._NAME,
        component: SourceServicePage,
        meta: {
          menuId: SOURCE_COMPUTING_ROUTE.SOURCE_SERVICES._NAME,
          category: SOURCE_COMPUTING_ROUTE._NAME,
          sourceKind: 'onprem',
        },
      },
      {
        // Same screen, for cloud accounts: only CSP source groups, registered as such.
        path: 'cloud-sources',
        name: SOURCE_COMPUTING_ROUTE.CLOUD_SOURCES._NAME,
        component: SourceServicePage,
        meta: {
          menuId: SOURCE_COMPUTING_ROUTE.CLOUD_SOURCES._NAME,
          category: SOURCE_COMPUTING_ROUTE._NAME,
          sourceKind: 'csp',
        },
      },
    ],
  },
];
