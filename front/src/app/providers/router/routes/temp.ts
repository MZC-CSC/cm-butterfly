import NotFoundVue from '@/pages/error/404/NotFound.vue';
import { RouteConfig } from 'vue-router';

export const tempRoutes: RouteConfig[] = [
  {
    path: 'source-metas',
    name: 'sourcemetas',
    component: NotFoundVue,
    meta: {
      menuId: 'sourcemetas',
    },
  },
];
