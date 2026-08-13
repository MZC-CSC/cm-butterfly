export {
  CHECK_INTERVAL_SEC,
  FAILURE_THRESHOLD,
  acknowledgeHealthAlert,
  checkHealth,
  failedServiceNames,
  healthAlertOpen,
  healthBannerVisible,
  healthIsChecking,
  healthItems,
  healthLastError,
  healthResult,
  healthSummary,
  resetHealthWatch,
  startHealthWatch,
  stopHealthWatch,
} from './model/serviceHealth';
export type {
  HealthItem,
  HealthResult,
  HealthStatus,
  HealthSummary,
} from './model/serviceHealth';

export { default as ServiceHealthAlert } from './ui/ServiceHealthAlert.vue';
export { default as ServiceHealthBanner } from './ui/ServiceHealthBanner.vue';
