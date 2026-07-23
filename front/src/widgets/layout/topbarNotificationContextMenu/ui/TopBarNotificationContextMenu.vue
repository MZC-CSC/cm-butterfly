<script setup lang="ts">
import { computed, ref } from 'vue';
import { PButton, PI, PToggleButton } from '@cloudforet-test/mirinae';
import { red, gray } from '@/app/style/colors';
import {
  notifications,
  readNotification,
  readAllNotifications,
  notificationPopupEnabled,
  setNotificationPopupEnabled,
  type NotificationRecord,
} from '@/entities/notification';

/**
 * Notification list
 *
 * Entries **expand as an accordion** within a single layer. Stacking a popup on top of a
 * popup tangles the dismissal flow and hides the list behind it. Expanding right below the
 * clicked item leaves no doubt about which message the detail belongs to.
 *
 * An item is marked read **only when [Confirm] is pressed**. If merely opening it counted
 * as read, items would vanish as you skim past them, and you'd miss what you actually need
 * to see.
 *
 * We render the list and empty state ourselves rather than leaving them to a mirinae
 * component. There was an incident where an empty slot caused the component's default
 * fallback to render instead, producing *the wrong thing with no error*
 * ([DESIGN-MIRINAE](../../../../../design)). This screen is simple enough that drawing it
 * ourselves is safer.
 */

withDefaults(defineProps<{ visible?: boolean }>(), { visible: false });

const errorColor = red[500];
const infoColor = gray[500];

const items = computed<NotificationRecord[]>(() => notifications.value);
const expandedId = ref<string | null>(null);

const toggle = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

const confirm = async (id: string) => {
  if (expandedId.value === id) expandedId.value = null;
  await readNotification(id);
};

const confirmAll = async () => {
  expandedId.value = null;
  await readAllNotifications();
};

/** On-screen text is in English. */
const elapsed = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

/**
 * Truncate messages that don't fit on one line.
 *
 * This value is tuned to the layer width. Increasing it lets lines overflow, making row
 * heights uneven and the list harder to skim. The full text is seen by expanding the item.
 */
const MESSAGE_MAX = 48;
const shortMessage = (message: string): string =>
  message.length > MESSAGE_MAX
    ? `${message.slice(0, MESSAGE_MAX)}...`
    : message;

// Setting: whether new notifications also show as an on-screen popup. Clicking the gear expands one line above the list.
const showSettings = ref(false);
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};
const onPopupToggle = (on: boolean) => setNotificationPopupEnabled(on);
</script>

<template>
  <div class="notification-menu" data-testid="notification-menu">
    <div class="menu-header">
      <span class="title">Notifications ({{ items.length }})</span>
      <div class="header-actions">
        <button
          type="button"
          class="settings-gear"
          :class="{ active: showSettings }"
          data-testid="notification-settings-gear"
          title="Notification settings"
          @click="toggleSettings"
        >
          <p-i name="ic_settings-filled" width="1rem" height="1rem" :color="gray[600]" />
        </button>
        <p-button
          v-if="items.length > 0"
          size="sm"
          style-type="tertiary"
          data-testid="notification-mark-all"
          @click="confirmAll"
        >
          Mark all read
        </p-button>
      </div>
    </div>

    <!-- Setting: whether to show an on-screen popup when a new notification arrives (localStorage, on by default) -->
    <div
      v-if="showSettings"
      class="menu-settings"
      data-testid="notification-settings"
    >
      <span class="setting-label">Show a popup when a notification arrives</span>
      <p-toggle-button
        :value="notificationPopupEnabled"
        data-testid="notification-popup-toggle"
        @update:value="onPopupToggle"
      />
    </div>

    <div class="menu-body">
      <div
        v-if="items.length === 0"
        class="no-data"
        data-testid="notification-empty"
      >
        No notifications
      </div>

      <ul v-else class="notification-list">
        <li
          v-for="item in items"
          :key="item.id"
          class="notification-item"
          :class="{ error: item.level === 'Error' }"
          data-testid="notification-item"
          :data-notification-id="item.id"
        >
          <button type="button" class="item-row" @click="toggle(item.id)">
            <!--
              Set the color via the `color` prop, not a class. mirinae icons bake the color
              into the icon definition, so overriding it with CSS **does nothing and silently
              renders the original color.**
            -->
            <p-i
              class="level-icon"
              :name="
                item.level === 'Error' ? 'ic_error-filled' : 'ic_info-circle'
              "
              :color="item.level === 'Error' ? errorColor : infoColor"
              width="1rem"
              height="1rem"
            />
            <span class="category">{{ item.category }}</span>
            <span class="message">{{ shortMessage(item.message) }}</span>
            <span class="elapsed">{{ elapsed(item.created_at) }}</span>
          </button>

          <div
            v-if="expandedId === item.id"
            class="item-detail"
            data-testid="notification-detail"
          >
            <p class="detail-message">{{ item.message }}</p>
            <p v-if="item.detail" class="detail-extra">{{ item.detail }}</p>
            <div class="detail-actions">
              <p-button
                size="sm"
                style-type="primary"
                data-testid="notification-confirm"
                @click="confirm(item.id)"
              >
                Confirm
              </p-button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.notification-menu {
  @apply bg-white border border-gray-200 rounded-md;
  width: 25rem;
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);

  .menu-header {
    @apply flex items-center justify-between border-b border-gray-200;
    padding: 0.625rem 0.875rem;

    .title {
      @apply font-bold text-gray-900;
      font-size: 0.875rem;
    }

    .header-actions {
      @apply flex items-center;
      gap: 0.25rem;
    }

    .settings-gear {
      @apply flex items-center justify-center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 4px;
      cursor: pointer;

      &:hover,
      &.active {
        @apply bg-gray-100;
      }
    }
  }

  /* Settings row — whether to show an on-screen popup for new notifications */
  .menu-settings {
    @apply flex items-center justify-between border-b border-gray-200;
    padding: 0.5rem 0.875rem;
    background-color: #fafafc;

    .setting-label {
      @apply text-gray-700;
      font-size: 0.8125rem;
    }
  }

  /* Only the list scrolls — the header and [Mark all read] must always stay visible. */
  .menu-body {
    max-height: 24rem;
    overflow-y: auto;
  }

  .notification-list {
    @apply flex flex-col;
  }

  .notification-item {
    @apply border-b border-gray-100;

    &:last-child {
      @apply border-b-0;
    }

    .item-row {
      @apply flex items-center w-full text-left;
      gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      cursor: pointer;

      &:hover {
        @apply bg-gray-100;
      }

      .level-icon {
        @apply flex-shrink-0;
      }

      /* Fix the category width. Placing it on the right or letting the width vary makes it hard to skim. */
      .category {
        @apply flex-shrink-0 text-gray-500;
        width: 4.5rem;
        font-size: 0.75rem;
      }

      .message {
        @apply flex-1 text-gray-900 truncate;
        font-size: 0.8125rem;
      }

      .elapsed {
        @apply flex-shrink-0 text-gray-400;
        font-size: 0.75rem;
      }
    }

    .item-detail {
      @apply bg-gray-100;
      padding: 0.625rem 0.875rem 0.75rem 2.75rem;

      .detail-message {
        @apply text-gray-900;
        font-size: 0.8125rem;
      }

      .detail-extra {
        @apply text-gray-600;
        margin-top: 0.25rem;
        font-size: 0.75rem;
        word-break: break-word;
      }

      .detail-actions {
        @apply flex justify-end;
        margin-top: 0.5rem;
      }
    }
  }

  .no-data {
    @apply text-gray-400 text-center;
    padding: 2rem 0;
    font-size: 0.8125rem;
  }
}
</style>
