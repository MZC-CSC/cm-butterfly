<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';

/**
 * Object storage row of a cloud source service's detail. Buckets are discovered with the
 * credential stored on the source service, the same way Connections > Add / Edit reads
 * any resource, so this opens that same window set to object storage instead of keeping
 * a second list here.
 */
const emit = defineEmits(['open-scan']);
</script>

<template>
  <div class="scan-row" data-testid="csp-bucket-scan">
    <div class="scan-label">Object Storage (Buckets)</div>
    <div class="scan-value">
      <span class="note"
        >Discover the account's buckets with this source service's credential
        and add them as connections.</span
      >
      <p-button
        style-type="tertiary"
        size="sm"
        data-testid="csp-bucket-scan-run"
        @click="emit('open-scan')"
      >
        Discover Buckets
      </p-button>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.scan-row {
  display: flex;
  font-size: 0.875rem;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.scan-label {
  flex: 0 0 18rem;
  padding: 0.5rem 1rem;
  font-weight: 700;
}
.scan-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 1rem;
}
.note {
  color: #6b7280;
}
</style>
