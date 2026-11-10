import { RouteConfig } from 'vue-router';
import { WORKLOAD_OPERATIONS_ROUTE } from '@/app/providers/router/routes/constants';
import { MciPage } from '@/pages/workloadOperations';
import { MENU_ID } from '@/entities';

export const workloadsRoutes: RouteConfig[] = [
  {
    path: 'workload-operations',
    name: WORKLOAD_OPERATIONS_ROUTE._NAME,
    component: { template: '<router-view/>' },
    children: [
      {
        path: 'mci-wls',
        name: WORKLOAD_OPERATIONS_ROUTE.MCI_WLS._NAME,
        component: MciPage,
        meta: {
          menuId: WORKLOAD_OPERATIONS_ROUTE.MCI_WLS._NAME,
          category: WORKLOAD_OPERATIONS_ROUTE._NAME,
        },
      },
      // The list used to live one level deeper, under a "Workloads" page with its own
      // side list. Bookmarks and published guides still carry that address.
      {
        path: 'workloads/mci-wls',
        redirect: { name: WORKLOAD_OPERATIONS_ROUTE.MCI_WLS._NAME },
      },
      {
        path: 'workloads',
        redirect: { name: WORKLOAD_OPERATIONS_ROUTE.MCI_WLS._NAME },
      },
      {
        path: 'object-storages',
        name: MENU_ID.OBJECT_STORAGES,
        component: () =>
          import(
            '@/pages/workloadOperations/objectStorages/ui/ObjectStoragesPage.vue'
          ),
        meta: {
          lsbVisible: true,
          menuId: MENU_ID.OBJECT_STORAGES,
          category: WORKLOAD_OPERATIONS_ROUTE._NAME,
        },
      },
    ],
  },
];
