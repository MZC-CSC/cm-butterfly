<script setup lang="ts">
import { useVmInformationModel } from '@/widgets/workload/vm/vmInformation/model';
import { PBadge, PButton, PDefinitionTable } from '@cloudforet-test/mirinae';
import { onBeforeMount, watch } from 'vue';
import {
  ILastloadtestStateResponse,
  ILoadTestExecutionStep,
} from '@/entities/mci/model';
import LoadTestProgress from '@/widgets/workload/vm/loadTestProgress/ui/LoadTestProgress.vue';
import SecurityGroupRules from '@/widgets/workload/vm/securityGroupRules/ui/SecurityGroupRules.vue';

interface IProps {
  nsId: string;
  mciId: string;
  vmId: string;
  lastloadtestStateResponse?: ILastloadtestStateResponse;
  // For the progress display — draw the bar in the Load Status cell and block Load Config while running.
  loadTestStatus?: string;
  loadTestStartAt?: string;
  loadTestFinishAt?: string;
  loadTestFailureMessage?: string;
  loadTestSteps?: ILoadTestExecutionStep[];
  loadTestExpectedSeconds?: number;
  isLoadTestRunning?: boolean;
  isLoadTestPolling?: boolean;
}

const props = defineProps<IProps>();
const emit = defineEmits(['openLoadconfig']);

// Guard the handler as well as disabling the button: mirinae's disabled is a class only and
// still lets the click reach the element (DESIGN-MIRINAE §1.6).
function handleOpenLoadconfig() {
  if (props.isLoadTestRunning) return;
  emit('openLoadconfig');
}
const {
  initTable,
  setVmId,
  detailTableModel,
  setMci,
  remappingData,
  mappdingLoadConfigStatus,
} = useVmInformationModel();

onBeforeMount(() => {
  initTable();
  setMci(props.mciId);
  setVmId(props.vmId);
});

watch(
  () => props.vmId,
  newVmId => {
    setMci(props.mciId); // Refresh MCI data when VM changes
    setVmId(newVmId);
    remappingData();
  },
  { immediate: true },
);

watch(
  () => props.lastloadtestStateResponse?.executionStatus,
  executionStatus => {
    if (executionStatus) {
      mappdingLoadConfigStatus(executionStatus);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p-definition-table
      :fields="detailTableModel.tableState.fields"
      :data="detailTableModel.tableState.data"
      :loading="detailTableModel.tableState.loading"
      block
    >
      <template #extra="{ name }">
        <div v-if="name === 'loadStatus'">
          <p-button
            data-testid="vm-info-load-config"
            style-type="tertiary"
            size="sm"
            :disabled="props.isLoadTestRunning"
            @click="handleOpenLoadconfig"
          >
            Load Config
          </p-button>
        </div>
      </template>
      <!--
        Load Status cell. While a run is in progress, show the same progress bar as the
        Evaluate Perf tab instead of a bare status word. The slot MUST always render an
        element (v-else) — a slot left as an empty comment makes PDefinitionTable fall back
        to its default cell, which dumps the raw value (DESIGN-MIRINAE §1.7).
      -->
      <template #data-loadStatus="{ data }">
        <!-- running → fixed-height compact bar (no vertical shake); terminal → status badge
             (failed in red) with the step tree on hover; none → the plain value. -->
        <load-test-progress
          v-if="props.isLoadTestRunning"
          variant="compact"
          :status-label="props.loadTestStatus"
          :steps="props.loadTestSteps"
          :start-at="props.loadTestStartAt"
          :expected-seconds="props.loadTestExpectedSeconds"
          :is-polling="props.isLoadTestPolling"
        />
        <load-test-progress
          v-else-if="props.loadTestStatus"
          variant="badge"
          :status-label="props.loadTestStatus"
          :steps="props.loadTestSteps"
          :start-at="props.loadTestStartAt"
          :finish-at="props.loadTestFinishAt"
          :failure-message="props.loadTestFailureMessage"
        />
        <span v-else>{{ data }}</span>
      </template>
      <!--
        Security groups. The names come free with the node; the rules behind each one are
        fetched when the reader expands it (SecurityGroupRules).

        The slot always renders an element - a slot left as an empty comment makes
        PDefinitionTable fall back to its default cell and dump the raw value
        (DESIGN-MIRINAE §1.7).
      -->
      <template #data-securityGroups="{ data }">
        <div v-if="data && data.length" class="flex flex-col gap-1">
          <security-group-rules
            v-for="sgId in data"
            :key="sgId"
            :ns-id="props.nsId"
            :security-group-id="sgId"
          />
        </div>
        <span v-else>--</span>
      </template>
      <template #data-spec="{ data }">
        <span data-testid="node-info-spec">{{ data }}</span>
      </template>
      <template #data-image="{ data }">
        <span data-testid="node-info-image">{{ data }}</span>
      </template>
      <template #data-vNet="{ data }">
        <span data-testid="node-info-vnet">{{ data }}</span>
      </template>
      <template #data-subnet="{ data }">
        <span data-testid="node-info-subnet">{{ data }}</span>
      </template>
      <template #data-sshKey="{ data }">
        <span data-testid="node-info-sshkey">{{ data }}</span>
      </template>
      <template #data-rootDisk="{ data }">
        <span data-testid="node-info-disk">{{ data }}</span>
      </template>
      <template #data-region="{ data }">
        <span data-testid="node-info-region">{{ data }}</span>
      </template>
      <template #data-cspResourceId="{ data }">
        <span data-testid="node-info-csp-resource-id">{{ data }}</span>
      </template>
      <template #data-provider="{ data }">
        <p-badge
          v-for="(provider, index) in data"
          :key="index"
          :background-color="provider.color"
          class="mr-1"
        >
          {{ provider.name }}
        </p-badge>
      </template>
    </p-definition-table>
  </div>
</template>

<style scoped lang="postcss"></style>
