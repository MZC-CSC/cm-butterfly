import { defineStore } from 'pinia';
import { IMigratorMenu, MENU_ID, MigratorMenu } from './types';

export const useMigratorMenuStore = defineStore('MIGRATOR_MENU', {
  state: () => ({
    migratorMenu: [] as MigratorMenu[],
  }),
  getters: {},
  actions: {
    setMigratorMenu(apiMenu: IMigratorMenu) {
      if (apiMenu.menus === null) {
        const menus: MigratorMenu[] = [
          {
            category: {
              id: MENU_ID.MIGRATIONS,
              name: 'Migrations',
            },
            menu: [],
          },
        ];
        menus[0].menu = [
          ...menus[0].menu,
          {
            id: apiMenu.id,
            name: apiMenu.displayname,
          },
        ];
        this.migratorMenu = [...this.migratorMenu, ...menus];
      } else if (Array.isArray(apiMenu.menus) && apiMenu.menus?.length > 0) {
        const m_menus = apiMenu.menus?.map(menu => {
          return {
            id: menu.id,
            name: menu.displayname,
          };
        });
        this.migratorMenu = [
          ...this.migratorMenu,
          {
            category: {
              id: apiMenu.id,
              name: apiMenu.displayname,
            },
            menu: m_menus,
          },
        ];
      }
    },
  },
});
