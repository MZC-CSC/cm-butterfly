<script setup lang="ts">
/**
 * What every linked service just said.
 *
 * The list is whatever the endpoint returned, not a list kept here — a service
 * joining the lineup has to appear without this screen being edited, and a list
 * maintained by hand is the one that goes stale.
 *
 * Each row carries the release the operations were generated from and where that
 * specification came from. A screen showing nothing because the service is down
 * and one showing nothing because the spec here predates the service look the
 * same until those two are on screen next to the status.
 */
import { computed, onMounted } from 'vue';
import {
  checkHealth,
  healthIsChecking,
  healthItems,
  healthLastError,
  healthSummary,
} from '@/features/serviceHealth';

const summary = computed(() => healthSummary.value);
const items = computed(() => healthItems.value);
const checking = computed(() => healthIsChecking.value);
const lastError = computed(() => healthLastError.value);

onMounted(() => {
  // The watcher may not have looked yet, and someone opening this screen wants
  // the answer for now rather than for up to five minutes ago.
  void checkHealth();
});

function onRecheck() {
  void checkHealth();
}

function statusLabel(status: string): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'unhealthy') return 'Not answering';
  return 'Not checked';
}
</script>

<template>
  <div class="service-status" data-testid="service-status-page">
    <header class="head">
      <h2>Service Status</h2>
      <button
        type="button"
        class="recheck"
        data-testid="service-status-recheck"
        :disabled="checking"
        @click="onRecheck"
      >
        {{ checking ? 'Checking…' : 'Check now' }}
      </button>
    </header>

    <p v-if="lastError" class="error" data-testid="service-status-error">
      The check itself did not complete: {{ lastError }}. The list below is the
      last answer received.
    </p>

    <p v-if="summary" class="summary" data-testid="service-status-summary">
      <span data-testid="service-status-summary-healthy">
        Healthy {{ summary.healthy }}
      </span>
      /
      <span data-testid="service-status-summary-unhealthy">
        Not answering {{ summary.unhealthy }}
      </span>
      /
      <span data-testid="service-status-summary-unknown">
        Not checked {{ summary.unknown }}
      </span>
      <span class="at">· checked at {{ summary.checkedAt }}</span>
    </p>

    <table class="table" data-testid="service-status-table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Status</th>
          <th>Version</th>
          <th>Specification</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.name"
          :data-testid="`service-status-row-${item.name}`"
          :data-status="item.status"
        >
          <td>{{ item.name }}</td>
          <td>
            <span :class="['badge', item.status]">
              {{ statusLabel(item.status) }}
            </span>
          </td>
          <td>{{ item.version || '-' }}</td>
          <td class="spec">
            <a
              v-if="item.swagger"
              :href="item.swagger"
              target="_blank"
              rel="noopener"
            >
              {{ item.swagger }}
            </a>
            <span v-else>-</span>
          </td>
          <td class="detail">{{ item.message || item.endpoint || '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.service-status {
  padding: 1.5rem;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.recheck {
  padding: 0.375rem 0.75rem;
  border: 1px solid #c7c7c7;
  border-radius: 0.25rem;
  background: #fff;
  cursor: pointer;
}
.recheck:disabled {
  opacity: 0.6;
  cursor: default;
}
.error {
  margin-bottom: 0.75rem;
  color: #b3261e;
}
.summary {
  margin-bottom: 1rem;
}
.at {
  margin-left: 0.5rem;
  opacity: 0.7;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th,
.table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #ececec;
  text-align: left;
  vertical-align: top;
}
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
}
.badge.healthy {
  background: #e6f4ea;
  color: #1e7d32;
}
.badge.unhealthy {
  background: #fce8e6;
  color: #b3261e;
}
.badge.unknown {
  background: #eee;
  color: #555;
}
.spec,
.detail {
  word-break: break-all;
}
</style>
