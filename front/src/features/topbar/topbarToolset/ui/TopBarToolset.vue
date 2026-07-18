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
        종 아이콘 자리에 로그아웃을 숨겨 두고 있었다. 하는 일과 보이는 모양을 맞춘다.
        미리내에는 로그아웃 아이콘이 없어 svg 를 직접 넣는다 — 미리내를 걷어낼 때도 그대로 남는다.
        클릭은 아이콘 자신이 받는다. 예전처럼 감싼 div 가 받으면 알림을 눌러도 로그아웃될 수 있다.
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
          크기·색·선 두께는 옆 알림 아이콘(미리내 `ic_gnb_bell`)에 맞춘 값이다. 그 아이콘은
          32 좌표계를 22px 로 그리고 회색(#898995)으로 채우는 방식이라 선이 얇아 보인다.
          여기서는 24 좌표계를 같은 22px 로 줄이고 선을 1.3 으로 낮춰 실효 두께를 비슷하게 맞췄다.
          숫자를 바꾸면 두 아이콘의 굵기·높이가 어긋나니 함께 확인한다.
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
      /* 알림 아이콘과 같은 회색(gray.500 = #898995). 상속하면 본문 글자색(거의 검정)이라 혼자 도드라진다. */
      @apply text-gray-500;
      cursor: pointer;

      &:hover {
        @apply text-blue-600;
      }
    }
  }
}
</style>
