<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components';
import { PTooltip, PI } from '@cloudforet-test/mirinae';
import { computed, ref, watch, onUnmounted } from 'vue';
import { TopBarNotificationContextMenu } from '@/widgets/layout';
import {
  notificationCount,
  hasErrorNotification,
} from '@/entities/notification/lib/notificationStore';

interface Props {
  visible: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
});

const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>();

const setVisible = (visible: boolean) => {
  emit('update:visible', visible);
};

const count = computed(() => notificationCount.value);
const hasError = computed(() => hasErrorNotification.value);
/** 99를 넘으면 자릿수가 늘어 배지가 아이콘을 밀어낸다. */
const countLabel = computed(() =>
  count.value > 99 ? '99+' : String(count.value),
);

/**
 * 새 알림이 도착한 것을 *다른 화면을 보고 있어도* 알아채게 한다.
 *
 * 소리는 쓰지 않는다 — 브라우저가 사용자 조작 없는 재생을 막아 신뢰할 수 없고(무음으로 끝난다),
 * 업무 콘솔에서 예고 없는 소리는 방해가 된다. 소리가 필요하면 설정으로 켜는 편이 맞다.
 *
 * 대신 두 가지를 쓴다. 배지를 잠깐 흔들고, 탭 제목에 개수를 붙인다. 탭이 뒤에 있으면 화면은
 * 보이지 않지만 제목은 보인다.
 */
const justArrived = ref(false);
let arrivalTimer: ReturnType<typeof setTimeout> | null = null;

const baseTitle = document.title;

watch(count, (now, before) => {
  if (now > (before ?? 0)) {
    justArrived.value = true;
    if (arrivalTimer) clearTimeout(arrivalTimer);
    // 계속 흔들면 피로하다. 도착을 알리는 것까지가 목적이고, 남아 있다는 사실은 숫자가 말한다.
    arrivalTimer = setTimeout(() => (justArrived.value = false), 2000);
  }
  document.title = now > 0 ? `(${now}) ${baseTitle}` : baseTitle;
});

onUnmounted(() => {
  if (arrivalTimer) clearTimeout(arrivalTimer);
  document.title = baseTitle;
});

const showNotiMenu = () => {
  if (!props.visible) setVisible(true);
};

const hideNotiMenu = () => {
  if (props.visible) setVisible(false);
};

const handleNotiButtonClick = () => {
  setVisible(!props.visible);
};
</script>

<template>
  <div
    v-on-click-outside="hideNotiMenu"
    class="top-bar-notifications"
    @click.stop
    @keydown.esc="hideNotiMenu"
  >
    <p-tooltip contents="Notifications" position="absolute">
      <span
        :class="{ 'menu-button': true, opened: visible, arrived: justArrived }"
        tabindex="0"
        role="button"
        data-testid="notification-badge"
        @click.stop="handleNotiButtonClick"
        @keydown.enter="showNotiMenu"
      >
        <span
          v-if="count > 0"
          class="count-badge"
          :class="{ error: hasError }"
          data-testid="notification-count"
        >
          {{ countLabel }}
        </span>
        <p-i
          class="menu-icon"
          name="ic_gnb_notification"
          width="1.375rem"
          height="1.375rem"
        />
      </span>
    </p-tooltip>
    <div v-show="visible" class="notification-content">
      <top-bar-notification-context-menu :visible="props.visible" />
    </div>
  </div>
</template>

<style scoped lang="postcss">
.top-bar-notifications {
  position: relative;

  .menu-button {
    @apply inline-flex items-center justify-center text-gray-500 rounded-full;
    width: 2rem;
    height: 2rem;
    line-height: $top-bar-height;
    cursor: pointer;

    &:hover {
      @apply text-blue-600 bg-blue-100;
    }

    &.opened {
      @apply text-blue-600 bg-blue-200;
    }

    .menu-icon {
      &:hover {
        @apply text-blue-600;
      }
    }
    /* 숫자 배지. 색으로 급한 것과 그냥 볼 것을 가른다 — 배지를 둘로 나누지 않기 위해서다. */
    .count-badge {
      @apply absolute rounded-full bg-blue-500 text-white font-bold;
      top: 0;
      right: 0;
      min-width: 15px;
      height: 15px;
      padding: 0 3px;
      font-size: 10px;
      line-height: 15px;
      text-align: center;

      &.error {
        @apply bg-red-500;
      }
    }

    /* 도착 신호 — 다른 화면을 보고 있어도 눈에 걸리도록 잠깐 흔든다. */
    &.arrived .count-badge {
      animation: notification-arrived 0.5s ease-in-out 3;
    }

    .disabled {
      cursor: not-allowed;
    }
  }

  .notification-content {
    @apply absolute bg-white rounded-xs border border-gray-200;
    display: flex;
    flex-direction: column;
    width: 27.5rem;
    min-height: auto;
    top: 100%;
    right: 0;
    box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.08);
    margin-right: -0.5rem;
    z-index: 1000;
  }
}

@keyframes notification-arrived {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.35);
  }
}
</style>
