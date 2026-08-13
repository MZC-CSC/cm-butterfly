<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { LayoutHeader, ConsoleLayout } from '@/widgets/layout';
import { styleVariables, PSidebar } from '@cloudforet-test/mirinae';
import {
  ServiceHealthAlert,
  ServiceHealthBanner,
  startHealthWatch,
  stopHealthWatch,
} from '@/features/serviceHealth';

/*
  Watching the linked services belongs here rather than on the screen that shows
  them: a failure has to be noticed wherever the user happens to be, and someone
  is rarely sitting on the status screen when one happens.
*/
onMounted(() => startHealthWatch());
onBeforeUnmount(() => stopHealthWatch());
</script>

<template>
  <div>
    <!-- Above the top bar, so it is the first line on every screen and covers
         nothing that is being worked on. -->
    <service-health-banner />
    <div class="top-bar">
      <layout-header />
    </div>
    <div>
      <console-layout
        class="app-body"
        :style="{ height: `calc(100vh - ${styleVariables['top-bar-height']})` }"
      >
        <template #main>
          <p-sidebar :visible="false">
            <div class="main-content">
              <!-- <portal-target
                ref="topNotiRef"
                name="top-notification"
                :slot-props="{ hasDefaultMessage: true }"
              /> -->
              <router-view />
            </div>
            <!-- <template #title>
              <portal-target name="info-title" />
            </template>
            <template #sidebar>
              <portal-target name="handbook-contents" />
            </template>
            <template #footer>
              <portal-target name="widget-footer" />
            </template> -->
          </p-sidebar>
        </template>
      </console-layout>
    </div>
    <service-health-alert />
  </div>
</template>

<style scoped lang="postcss">
.console-loading-wrapper {
  position: absolute;
  height: 100%;
  z-index: 10;
  & > .data-loader-container > .loader-wrapper > .loader.spinner {
    max-height: unset;
  }
}

.top-bar {
  position: fixed;
  width: 100%;
  height: $top-bar-height;
  z-index: 100;
  flex-shrink: 0;
  top: 0;
}
.app-body {
  @apply relative flex flex-col;
  margin-top: $top-bar-height;
  overflow-y: hidden;
  width: 100%;
  flex-grow: 1;
  .p-sidebar {
    .sidebar-container {
      @apply bg-gray-100;
    }
    .non-sidebar-wrapper {
      min-height: 100%;
    }
  }
  .main-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    margin: 0;
    overflow-x: hidden;
    /* overflow-y: hidden; */
  }
}
</style>
../../../../widgets/layout/layoutHeader../../../../widgets/layout/consoleLayout
