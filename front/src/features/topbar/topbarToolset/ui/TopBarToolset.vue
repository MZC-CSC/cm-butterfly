<script setup lang="ts">
import { PTooltip } from '@cloudforet-test/mirinae';
import TopBarNotifications from '@/features/topbar/topbarNotifications/ui/TopBarNotifications.vue';
import { logout } from '@/features/auth/model/useLogout';

const props = withDefaults(
  defineProps<{
    openedMenu?: string | null;
  }>(),
  {
    openedMenu: null,
  },
);
const emit = defineEmits<{
  // eslint-disable-next-line no-unused-vars
  (event: 'hide-menu'): void;
  // eslint-disable-next-line no-unused-vars
  (event: 'open-menu', menu: string): void;
}>();

const hideMenu = () => {
  emit('hide-menu');
};
const openMenu = (menu: string) => {
  emit('open-menu', menu);
};
const updateOpenedMenu = (menu: string, visible: boolean) => {
  if (visible) openMenu(menu);
  else hideMenu();
};

const onLogoutClick = () => {
  void logout();
};
</script>

<template>
  <div class="top-bar-toolset">
    <div class="top-bar-icons-wrapper">
      <top-bar-notifications
        :visible="props.openedMenu === 'notifications'"
        @update:visible="updateOpenedMenu('notifications', $event)"
      />
      <!--
        Logout used to be hidden behind the bell icon. Make what it does match how it looks.
        Mirinae has no logout icon, so we inline the svg directly — it stays even when Mirinae is removed.
        The icon itself receives the click. If a wrapping div received it as before, clicking a notification could log you out.
      -->
      <button
        type="button"
        class="logout-button"
        data-testid="topbar-logout"
        title="Logout"
        aria-label="Logout"
        @click="onLogoutClick"
      >
        <!--
          The size, color, and stroke width are matched to the adjacent notification icon
          (Mirinae `ic_gnb_bell`). That icon draws a 32 coordinate system at 22px filled
          with gray (#898995), so its strokes look thin. Here we shrink a 24 coordinate
          system to the same 22px and lower the stroke to 1.3 to match the effective width.
          Changing the numbers makes the two icons' weight and height diverge, so check them together.
        -->
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
    <p-tooltip position="bottom">
      <!-- TODO: TopBar Admin toggle button -->
    </p-tooltip>
  </div>
</template>

<style scoped lang="postcss">
.top-bar-toolset {
  @apply flex items-center;
  gap: 0.5rem;

  .top-bar-icons-wrapper {
    @apply flex items-center gap-2;

    .logout-button {
      @apply flex items-center justify-center;
      /* Same gray as the notification icon (gray.500 = #898995). If inherited, it would take the body text color (near black) and stand out on its own. */
      @apply text-gray-500;
      cursor: pointer;

      &:hover {
        @apply text-blue-600;
      }
    }
  }
}
</style>
