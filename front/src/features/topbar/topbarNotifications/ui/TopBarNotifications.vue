<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components';
import { PTooltip, PI } from '@cloudforet-test/mirinae';
import { computed, ref, watch, onUnmounted } from 'vue';
import { TopBarNotificationContextMenu } from '@/widgets/layout';
import {
  notificationCount,
  hasErrorNotification,
  arrivalSeq,
  notificationPopupEnabled,
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

/**
 * Arrival cue — the "you got mail" gesture.
 *
 * An envelope pops up at the screen centre, jitters like a ringing alarm for a beat, then
 * swoops into the notification badge and vanishes. The eye follows the movement to the badge
 * and catches the count going up — that is the whole point. This is only a cue: the message
 * itself lives in the inbox, so nothing is lost if it is missed.
 *
 * Built by hand rather than as a toast. It is appended straight to <body> and driven by the
 * Web Animations API, which keeps it above any open modal (mirinae's stacking tops out at
 * 99999) and free of overflow clipping. Vue 2.7 has no <Teleport>, hence the imperative DOM.
 */
const badgeEl = ref<HTMLElement | null>(null);
let cuePlaying = false;

const playArrivalCue = () => {
  if (typeof document === 'undefined' || cuePlaying) return;
  const badge = badgeEl.value;
  if (!badge) return;
  const r = badge.getBoundingClientRect();
  if (!r.width && !r.height) return; // badge not laid out — nothing to fly to

  cuePlaying = true;
  const dx = r.left + r.width / 2 - window.innerWidth / 2;
  const dy = r.top + r.height / 2 - window.innerHeight / 2;

  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:50%',
    'width:64px',
    'height:64px',
    'margin:-32px 0 0 -32px',
    'z-index:2147483000',
    'pointer-events:none',
    'opacity:0',
    'will-change:transform,opacity',
    'filter:drop-shadow(0 6px 14px rgba(0,0,0,.25))',
  ].join(';');
  el.innerHTML = `
    <svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="14" width="52" height="36" rx="5" fill="#f6c445" stroke="#d9a520" stroke-width="2"/>
      <path d="M8 18 L32 36 L56 18" fill="none" stroke="#d9a520" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="16" r="8" fill="#e5484d"/>
    </svg>`;
  document.body.appendChild(el);

  const done = () => {
    el.remove();
    cuePlaying = false;
  };

  // Phase 1 — appear, then jitter in place like a ringing alarm (~1.2s).
  const ring = el.animate(
    [
      { transform: 'scale(0.3) rotate(0deg)', opacity: 0, offset: 0 },
      { transform: 'scale(1.12) rotate(0deg)', opacity: 1, offset: 0.14 },
      { transform: 'scale(1) rotate(-14deg)', opacity: 1, offset: 0.28 },
      { transform: 'scale(1) rotate(12deg)', opacity: 1, offset: 0.42 },
      { transform: 'scale(1) rotate(-10deg)', opacity: 1, offset: 0.56 },
      { transform: 'scale(1) rotate(9deg)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1) rotate(-5deg)', opacity: 1, offset: 0.84 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 1 },
    ],
    { duration: 1200, easing: 'ease-in-out' },
  );

  ring.finished
    .then(() =>
      // Phase 2 — rise all the way to the badge, then vanish *into* it. Stays fully opaque for
      // most of the trip (fading early made it look like it disappeared mid-air); only the last
      // stretch shrinks and fades as it lands on the badge.
      el.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
          {
            transform: `translate(${dx * 0.9}px, ${dy * 0.9}px) scale(0.55)`,
            opacity: 1,
            offset: 0.8,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.12)`,
            opacity: 0,
            offset: 1,
          },
        ],
        {
          duration: 1000,
          easing: 'cubic-bezier(.35,0,.6,1)',
          fill: 'forwards',
        },
      ).finished,
    )
    .then(done)
    .catch(done);
};

watch(arrivalSeq, () => {
  if (notificationPopupEnabled.value) playArrivalCue();
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
        ref="badgeEl"
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
