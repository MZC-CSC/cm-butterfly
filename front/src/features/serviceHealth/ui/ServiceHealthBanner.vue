<script setup lang="ts">
/**
 * What is left on screen after the modal has been acknowledged.
 *
 * One line, full width, at the very top. It stays for as long as the failure
 * does, and goes by itself when everything answers again.
 *
 * One line is the whole point: the failure has to remain visible on every screen
 * without taking space from the work being done. Anything taller would be closed,
 * and a closed banner is the same as no banner.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router/composables';
import { MENU_ID } from '@/entities';
import {
  failedServiceNames,
  healthBannerVisible,
} from '../model/serviceHealth';

const router = useRouter();

const visible = computed(() => healthBannerVisible.value);
const names = computed(() => failedServiceNames.value.join(', '));

function onOpen() {
  router.push({ name: MENU_ID.SERVICE_STATUS }).catch(() => {});
}
</script>

<template>
  <div v-if="visible" class="health-banner" data-testid="health-banner">
    <span class="text"> A linked service is not answering ({{ names }}). </span>
    <button
      type="button"
      class="link"
      data-testid="health-banner-link"
      @click="onOpen"
    >
      Check status
    </button>
  </div>
</template>

<style scoped>
.health-banner {
  /*
    Fixed, and above the top bar's stacking order. The top bar is itself fixed at
    the top of the viewport, so a banner left in the document flow is drawn
    underneath it — the line takes up space and shows nothing, which is how this
    first shipped.
  */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 1.75rem;
  padding: 0 1rem;
  background-color: #d32f2f;
  color: #fff;
  font-size: 0.8125rem;
  line-height: 1.75rem;
  /* One line, whatever the names add up to. */
  white-space: nowrap;
  overflow: hidden;
}
.text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.link {
  flex: none;
  text-decoration: underline;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
</style>
