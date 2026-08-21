export {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_INTERVAL_SEC,
  acknowledgeHealthAlert,
  checkHealth,
  failedServiceNames,
  healthAlertOpen,
  healthBannerVisible,
  healthFailureThreshold,
  healthIntervalSec,
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
  HealthSettings,
  HealthResult,
  HealthStatus,
  HealthSummary,
} from './model/serviceHealth';

export { default as ServiceHealthAlert } from './ui/ServiceHealthAlert.vue';
export { default as ServiceHealthBanner } from './ui/ServiceHealthBanner.vue';
