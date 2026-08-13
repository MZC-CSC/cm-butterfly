<script setup lang="ts">
/**
 * The one interruption a service failure gets.
 *
 * It does not close on its own, on the backdrop, or on ESC — an operator who was
 * away from the desk has to find the failure still on screen when they come back.
 * `PButtonModal` closes only through its buttons, and the header close button is
 * hidden, so the only ways out are the two below.
 *
 * Two buttons, because there are only two things to do when told a service is
 * down: carry on with what you were doing, or go and look. Both count as having
 * seen it — the modal reappearing on the very screen that explains the failure
 * would make it unreadable.
 *
 * The footer cannot be replaced, only its two button slots
 * (design/07-DESIGN/DESIGN-MIRINAE.md §1.1), which is why the labels are set
 * through `close-button` and `confirm-button` rather than a footer of our own.
 */
import { PButtonModal } from '@cloudforet-test/mirinae';
import { computed } from 'vue';
import { useRouter } from 'vue-router/composables';
import { MENU_ID } from '@/entities';
import {
  acknowledgeHealthAlert,
  failedServiceNames,
  healthAlertOpen,
  healthSummary,
} from '../model/serviceHealth';

const router = useRouter();

const open = computed(() => healthAlertOpen.value);
const names = computed(() => failedServiceNames.value.join(', '));
const checkedAt = computed(() => healthSummary.value?.checkedAt ?? '');

function onAcknowledge() {
  acknowledgeHealthAlert();
}

function onInspect() {
  acknowledgeHealthAlert();
  router.push({ name: MENU_ID.SERVICE_STATUS }).catch(() => {});
}
</script>

<template>
  <p-button-modal
    :visible="open"
    size="md"
    backdrop
    theme-color="alert"
    header-title="A linked service is not answering"
    :hide-header-close-button="true"
    @cancel="onInspect"
    @confirm="onAcknowledge"
  >
    <template #body>
      <div data-testid="health-alert-body">
        <p class="lead">
          The following services did not answer their readiness check.
        </p>
        <p data-testid="health-alert-services" class="services">
          {{ names }}
        </p>
        <p data-testid="health-alert-checked-at" class="checked-at">
          Checked at {{ checkedAt }}
        </p>
      </div>
    </template>

    <template #close-button>
      <span data-testid="health-alert-inspect">Check status</span>
    </template>
    <template #confirm-button>
      <span data-testid="health-alert-confirm">OK</span>
    </template>
  </p-button-modal>
</template>

<style scoped>
/* One line — a sentence broken across two reads as an error message about the
   error message. */
.lead {
  white-space: nowrap;
}
.services {
  margin-top: 0.5rem;
  font-weight: 700;
  word-break: break-all;
}
.checked-at {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
