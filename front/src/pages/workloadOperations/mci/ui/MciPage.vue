<script setup lang="ts">
import MciList from '@/widgets/workload/mci/mciList/ui/MciList.vue';
import { reactive, ref } from 'vue';
import { PButton, PTab } from '@cloudforet-test/mirinae';
import MciDetail from '@/widgets/workload/mci/mciDetail/ui/MciDetail.vue';
import VmList from '@/widgets/workload/vm/vmList/ui/VmList.vue';
import { isNullOrUndefined } from '@/shared/utils';
import { DEFAULT_NAMESPACE } from '@/shared/constants/namespace';

const pageName = 'Infra Workloads';

const tabState = reactive({
  activeTab: 'detail',
  tabs: [
    {
      name: 'detail',
      label: 'Detail',
    },
    {
      name: 'server',
      label: 'Server',
    },
  ],
});

const selectedMciId = ref<string>('');
const selectedVmId = ref<string>('');

function handleSelectMciTableRow(id: string) {
  selectedMciId.value = id;
  selectedVmId.value = '';
}

function handleSelectVmListTableRow(id: string) {
  if (!isNullOrUndefined(id)) selectedVmId.value = id;
  else {
    selectedVmId.value = '';
  }
}
</script>

<template>
  <div :class="`${pageName}-page page`">
    <header :class="`${pageName}-page-header`">
      <p>{{ pageName }}</p>
    </header>
    <section :class="`${pageName}-page-body`">
      <MciList
        :ns-id="DEFAULT_NAMESPACE"
        @selectRow="handleSelectMciTableRow"
      />
      <p
        v-if="!selectedMciId"
        class="flex justify-center text-gray-300 text-sm font-normal"
      >
        Select an item for more details.
      </p>
      <div v-if="selectedMciId">
        <p-tab v-model="tabState.activeTab" :tabs="tabState.tabs">
          <template #detail>
            <div class="tab-section-header">
              <p>Workload Information</p>
              <!--
                **여기 두 버튼은 늘 비활성인 자리표시다.** 실제 기능은 Server 탭 안의
                같은 이름 탭(`Evaluate Perf`·`Estimate Cost`)에 있다. 이름이 같아서
                화면 자동화가 이쪽을 먼저 집어 "버튼이 안 눌린다"로 헤매기 쉬우므로,
                무엇인지 식별자로 밝혀 둔다.
              -->
              <div class="flex gap-1.5">
                <p-button
                  data-testid="workload-detail-evaluate-perf-placeholder"
                  style-type="tertiary"
                  :disabled="true"
                >
                  Evaluate Perf
                </p-button>
                <p-button
                  data-testid="workload-detail-estimate-cost-placeholder"
                  style-type="tertiary"
                  :disabled="true"
                >
                  Estimate Cost
                </p-button>
              </div>
            </div>
            <MciDetail :selected-mci-id="selectedMciId" />
          </template>
          <template #server>
            <div class="tab-section-header">
              <p>Server List</p>
            </div>
            <VmList
              :ns-id="DEFAULT_NAMESPACE"
              :mci-id="selectedMciId"
              :selected-vm-id="selectedVmId"
              @selectCard="handleSelectVmListTableRow"
            />
          </template>
        </p-tab>
      </div>
    </section>
  </div>
</template>

<style scoped lang="postcss"></style>
