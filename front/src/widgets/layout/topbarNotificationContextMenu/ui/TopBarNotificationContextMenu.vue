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
 * 알림 목록
 *
 * 한 레이어 안에서 **아코디언으로 펼친다.** 팝업 위에 또 팝업을 띄우면 닫는 동선이 꼬이고 뒤 목록이
 * 가려진다. 클릭한 항목 바로 아래에 펼쳐지면 어느 메시지의 상세인지 헷갈릴 일이 없다.
 *
 * 읽음은 **[Confirm] 을 눌렀을 때만**이다. 여는 것만으로 읽음이 되면 스쳐 지나가도 사라져,
 * 정작 봐야 할 것을 못 보게 된다.
 *
 * 목록·빈 상태를 미리내 컴포넌트에 맡기지 않고 직접 그린다. 슬롯이 비면 컴포넌트 기본 폴백이
 * 대신 렌더돼 *에러 없이 엉뚱한 것이 나오는* 사고가 있었다([DESIGN-MIRINAE](../../../../../design)).
 * 이 화면은 구조가 단순해 직접 그리는 편이 안전하다.
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

/** 화면 문구는 영문 기준이다. */
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
 * 한 줄에 들어가지 않는 메시지는 자른다.
 *
 * 레이어 폭에 맞춘 값이다. 늘리면 줄이 넘쳐 행 높이가 들쭉날쭉해지고 목록을 눈으로 훑기 어려워진다.
 * 전체 문구는 펼쳐서 본다.
 */
const MESSAGE_MAX = 48;
const shortMessage = (message: string): string =>
  message.length > MESSAGE_MAX
    ? `${message.slice(0, MESSAGE_MAX)}...`
    : message;

// 설정: 새 알림을 화면 팝업으로도 보여줄지. 기어를 누르면 목록 위에 한 줄로 펼친다.
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

    <!-- 설정: 새 알림 수신 시 화면 팝업 표시 여부 (localStorage, 기본 켜짐) -->
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
              색은 클래스가 아니라 `color` prop 으로 준다. 미리내 아이콘은 색을 아이콘 정의 안에
              칠해 두기 때문에, CSS 로 덮어도 **아무 일도 일어나지 않고 조용히 원래 색으로 나온다.**
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

  /* 설정 한 줄 — 새 알림 화면 팝업 표시 여부 */
  .menu-settings {
    @apply flex items-center justify-between border-b border-gray-200;
    padding: 0.5rem 0.875rem;
    background-color: #fafafc;

    .setting-label {
      @apply text-gray-700;
      font-size: 0.8125rem;
    }
  }

  /* 목록만 스크롤한다 — 헤더와 [Mark all read] 는 늘 보여야 한다. */
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

      /* 카테고리는 폭을 고정한다. 오른쪽에 두거나 폭이 흔들리면 눈으로 훑기 어렵다. */
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
