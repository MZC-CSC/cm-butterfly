import { RouteConfig } from 'vue-router';
import { MENU_ID } from '@/entities';

/**
 * Migration Guide — moved out of `temp.ts`, where it was wired to the 404 page as a
 * placeholder. It now renders the real guide screen.
 */
export const migrationGuideRoutes: RouteConfig[] = [
  {
    path: 'migration-guide',
    name: MENU_ID.MIGRATION_GUIDE,
    component: () => import('@/pages/migrationGuide/ui/MigrationGuidePage.vue'),
    meta: {
      menuId: MENU_ID.MIGRATION_GUIDE,
    },
  },
];
