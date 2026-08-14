import { RouteConfig } from 'vue-router';
import { MENU_ID } from '@/entities';

/**
 * System — screens about the installation rather than about a migration.
 *
 * Service Status is the first of them: whether the services the migration screens
 * call are answering.
 */
export const systemRoutes: RouteConfig[] = [
  {
    path: 'service-status',
    name: MENU_ID.SERVICE_STATUS,
    component: () =>
      import('@/pages/system/serviceStatus/ui/ServiceStatusPage.vue'),
    meta: {
      menuId: MENU_ID.SERVICE_STATUS,
    },
  },
];
