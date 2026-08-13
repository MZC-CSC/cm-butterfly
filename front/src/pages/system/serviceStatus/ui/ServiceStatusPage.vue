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
  healthIntervalSec,
  healthIsChecking,
  healthItems,
  healthLastError,
  healthSummary,
} from '@/features/serviceHealth';

const summary = computed(() => healthSummary.value);
const items = computed(() => healthItems.value);
const checking = computed(() => healthIsChecking.value);
const lastError = computed(() => healthLastError.value);
const intervalSec = computed(() => healthIntervalSec.value);

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
      <span class="at">
        · checked at {{ summary.checkedAt }} · every {{ intervalSec }}s
      </span>
    </p>

    <table class="table" data-testid="service-status-table">
      <thead>
        <tr>
          <th class="col-service">Service</th>
          <th class="col-status">Status</th>
          <th class="col-version">Version</th>
          <th>Health check URL</th>
        </tr>
      </thead>
      <!--
        Two rows per service on purpose. Putting the specification address in a
        column of its own left every other column fighting it for width - the
        service name wrapped and the status and version were pushed across the
        screen. On its own line, spanning everything but the name column, the
        first line stays readable and the address still has room.
      -->
      <tbody
        v-for="item in items"
        :key="item.name"
        :data-testid="`service-status-row-${item.name}`"
        :data-status="item.status"
      >
        <tr class="row-main">
          <td class="col-service">{{ item.name }}</td>
          <td class="col-status">
            <span :class="['badge', item.status]">
              {{ statusLabel(item.status) }}
            </span>
          </td>
          <td class="col-version">{{ item.version || '-' }}</td>
          <td class="url">{{ item.endpoint || '-' }}</td>
        </tr>
        <tr class="row-sub">
          <td class="col-service" />
          <td colspan="3">
            <span class="label">Specification</span>
            <a
              v-if="item.swagger"
              :href="item.swagger"
              target="_blank"
              rel="noopener"
              >{{ item.swagger }}</a
            >
            <span v-else>-</span>
            <span
              v-if="item.message"
              class="reason"
              :data-testid="`service-status-reason-${item.name}`"
            >
              {{ item.message }}
            </span>
          </td>
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
  text-align: left;
  vertical-align: top;
}
.row-main td {
  padding-bottom: 0.125rem;
}
.row-sub td {
  padding-top: 0;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid #ececec;
  font-size: 0.8125rem;
  color: #555;
}
/* The name column keeps its width so a service name never wraps. */
.col-service {
  white-space: nowrap;
  width: 1%;
}
.col-status,
.col-version {
  white-space: nowrap;
  width: 1%;
}
.label {
  display: inline-block;
  margin-right: 0.5rem;
  color: #888;
}
.reason {
  display: block;
  margin-top: 0.25rem;
  color: #b3261e;
}
.url {
  word-break: break-all;
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
</style>
