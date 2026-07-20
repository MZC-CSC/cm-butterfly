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
/** Past 99 the extra digit widens the badge until it pushes the icon aside. */
const countLabel = computed(() =>
  count.value > 99 ? '99+' : String(count.value),
);

/**
 * Makes an arriving notification noticeable *while another screen has the attention*.
 *
 * No sound: browsers block playback without a user gesture, so it cannot be relied on and
 * ends in silence, and an unannounced noise is unwelcome in a work console. If sound is
 * wanted, it belongs behind a setting.
 *
 * Two things instead — the badge shakes briefly, and the count goes into the tab title. A
 * tab in the background hides the screen but not its title.
 */
const justArrived = ref(false);
let arrivalTimer: ReturnType<typeof setTimeout> | null = null;

const baseTitle = document.title;

watch(count, (now, before) => {
  if (now > (before ?? 0)) {
    justArrived.value = true;
    if (arrivalTimer) clearTimeout(arrivalTimer);
    // Shaking on and on wears thin. Announcing the arrival is the point; that something is
    // still waiting is what the number says.
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
    <!--
      **Drop the tooltip once the panel is open.** A tooltip names the icon, which helps
      while pointing at it and stops helping the moment the panel is showing. It used to
      stay on after the click and the dark box covered the panel — over [Mark all read],
      so the one control in the header could not be reached.
    -->
    <p-tooltip :contents="visible ? '' : 'Notifications'" position="absolute">
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
    /* Count badge. Colour separates urgent from informational so one badge can serve both. */
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

    /* Arrival cue — a brief shake so it registers while another screen has the attention. */
    &.arrived .count-badge {
      animation: notification-arrived 0.5s ease-in-out 3;
    }

    .disabled {
      cursor: not-allowed;
    }
  }

  /*
    Placement only — **the panel inside draws the look.**
    This used to carry a background, border, shadow and a width of 27.5rem while the panel
    inside is 25rem, so the wrapper was 40px wider. The panel sat against the left edge and
    the wrapper's right side stayed visible past it, reading as a second, staggered panel.
    Holding the look here as well would mean keeping two widths in step forever.
  */
  .notification-content {
    @apply absolute;
    top: 100%;
    right: 0;
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
