import { MENU_ID } from '@/entities';

export const ROOT_ROUTE = {
  _NAME: 'root',
  MAIN: 'main',
  ERROR: '404error',
} as const;

export const SOURCE_COMPUTING_ROUTE = {
  _NAME: MENU_ID.SOURCE_COMPUTING,
  SOURCE_SERVICES: {
    _NAME: MENU_ID.SOURCE_SERVICES,
    SOURCE_CONNECTION: {
      _NAME: MENU_ID.SOURCE_CONNECTIONS,
    },
  },
};

export const MODEL_ROUTE = {
  _NAME: MENU_ID.MODELS,
  SOURCE_MODELS: {
    _NAME: MENU_ID.SOURCE_MODELS,
  },
  TARGET_MODELS: {
    _NAME: MENU_ID.TARGET_MODELS,
  },
};
