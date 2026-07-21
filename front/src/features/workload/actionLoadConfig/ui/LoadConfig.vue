<script setup lang="ts">
import {
  PButtonModal,
  PFieldGroup,
  PTextInput,
  PSelectDropdown,
  PTextarea,
  PRadio,
  PRadioGroup,
  PToggleButton,
  PDivider,
} from '@cloudforet-test/mirinae';
import {
  useLoadConfigModel,
  ILoadConfigInitialValues,
} from '@/features/workload/actionLoadConfig/model';
import { watch, ref, onMounted } from 'vue';
import { showErrorMessage } from '@/shared/utils';
import {
  useRunLoadTest,
  useGetAllLoadTestScenarioCatalogs,
} from '@/entities/vm/api/api';

interface IProps {
  isOpen: boolean;
  nsId: string;
  mciId: string;
  vmId: string;
  ip: string;
  initialConfig?: ILoadConfigInitialValues | null;
}

const props = defineProps<IProps>();
const emit = defineEmits(['close', 'success']);

const loadConfigModel = useLoadConfigModel();
const resRunLoadTest = useRunLoadTest(null);

// API 훅
const { data: catalogsData, execute: fetchCatalogs } =
  useGetAllLoadTestScenarioCatalogs();

// 템플릿 관련 상태
const savedTemplates = ref<any[]>([]);
const selectedTemplate = ref<string>('');

// 템플릿 로드
async function loadTemplates() {
  try {
    await fetchCatalogs();
    if (catalogsData.value?.responseData?.result?.loadTestScenarioCatalogs) {
      savedTemplates.value =
        catalogsData.value.responseData.result.loadTestScenarioCatalogs;
    } else {
      savedTemplates.value = [];
    }
  } catch (error) {
    console.error('Failed to load templates:', error);
    showErrorMessage('failed', 'Failed to load templates. Please try again.');
  }
}

// 템플릿 선택 시 필드 자동 채우기
function applyTemplate(templateName: string) {
  if (!templateName) return;

  // 선택된 템플릿 찾기
  const template = savedTemplates.value.find(t => t.name === templateName);
  if (!template) return;

  // 템플릿 데이터를 폼에 적용
  loadConfigModel.inputModels.virtualUsers.value = template.virtualUsers;
  loadConfigModel.inputModels.testDuration.value = template.duration;
  loadConfigModel.inputModels.rampUpTime.value = template.rampUpTime;
  loadConfigModel.inputModels.rampUpSteps.value = template.rampUpSteps;
}

// Re-run 초기값을 폼에 반영(마지막 실행 파라미터 pre-fill).
// host(agent/target)는 선택된 VM IP를 그대로 쓰므로 여기서 덮어쓰지 않는다.
function applyInitialConfig(cfg: ILoadConfigInitialValues) {
  const im = loadConfigModel.inputModels;
  if (cfg.scenarioName !== undefined) im.scenarioName.value = cfg.scenarioName;
  if (cfg.virtualUsers !== undefined) im.virtualUsers.value = cfg.virtualUsers;
  if (cfg.testDuration !== undefined) im.testDuration.value = cfg.testDuration;
  if (cfg.rampUpTime !== undefined) im.rampUpTime.value = cfg.rampUpTime;
  if (cfg.rampUpSteps !== undefined) im.rampUpSteps.value = cfg.rampUpSteps;
  if (cfg.port !== undefined && cfg.port !== '') im.port.value = cfg.port;
  if (cfg.path !== undefined) im.path.value = cfg.path;
  if (cfg.bodyData !== undefined) im.bodyData.value = cfg.bodyData;
  if (cfg.method) loadConfigModel.methods.selected = cfg.method.toLowerCase();
  if (cfg.protocol)
    loadConfigModel.protocol.selected = cfg.protocol.toLowerCase();
}

// 템플릿 적용을 위한 expose
defineExpose({
  applyTemplate,
});

// 컴포넌트 마운트 시 템플릿 로드
onMounted(() => {
  loadTemplates();
});

watch(
  () => props.ip,
  () => {
    loadConfigModel.inputModels.agentHostName.value = props.ip;
    loadConfigModel.inputModels.targetHostName.value = props.ip;
  },
  { immediate: true },
);

watch(
  () => props.isOpen,
  isOpen => {
    if (isOpen) {
      loadTemplates();
      selectedTemplate.value = '';
      // Re-run: 마지막 실행 파라미터로 pre-fill (일반 열기 시 initialConfig 없음)
      if (props.initialConfig) {
        applyInitialConfig(props.initialConfig);
      }
    }
  },
);

async function validate() {
  const inputModels = loadConfigModel.inputModels;
  const validationPromises = Object.keys(inputModels).map(key =>
    inputModels[key].exeValidation(inputModels[key].value),
  );

  await Promise.all(validationPromises);
  return Object.keys(inputModels).every(key => inputModels[key].isValid);
}

async function handleConfirm() {
  const isValid = await validate();

  if (isValid && !resRunLoadTest.isLoading.value) {
    resRunLoadTest
      .execute({
        request: {
          agentHostName: loadConfigModel.inputModels.agentHostName.value,
          collectAdditionalSystemMetrics: loadConfigModel.isMetrics.value,
          httpReqs: [
            {
              method: loadConfigModel.methods.selected,
              protocol: loadConfigModel.protocol.selected,
              bodyData: loadConfigModel.inputModels.bodyData.value,
              hostName: loadConfigModel.inputModels.targetHostName.value,
              port: loadConfigModel.inputModels.port.value,
              path: loadConfigModel.inputModels.path.value,
            },
          ],
          installLoadGenerator: {
            installLocation: loadConfigModel.location.selected,
          },
          testName: loadConfigModel.inputModels.scenarioName.value,
          virtualUsers: loadConfigModel.inputModels.virtualUsers.value,
          duration: loadConfigModel.inputModels.testDuration.value,
          rampUpTime: loadConfigModel.inputModels.rampUpTime.value,
          rampUpSteps: loadConfigModel.inputModels.rampUpSteps.value,
          infraId: props.mciId,
          nsId: props.nsId,
          nodeId: props.vmId,
        },
      })
      .then(res => {
        // cm-ant returns the execution key, and this response was being discarded. Without
        // that key the only way left to ask how the run turned out is by name, and names are
        // reused, so the answer can come back describing another VM's run.
        const loadTestKey = res?.data?.responseData?.result ?? '';
        emit(
          'success',
          loadConfigModel.inputModels.scenarioName.value,
          loadTestKey,
        );
      })
      .catch(e => {
        showErrorMessage('error', e.errorMsg);
      });
  } else if (!resRunLoadTest.isLoading.value) {
    // Before this the OK press failed validation silently to the console, so an enabled
    // button that did nothing read as a broken button. Tell the user what is missing and
    // take them to the first field that needs input (the fields also show their invalid
    // state now that validation has run).
    const order = [
      ['scenarioName', 'load-config-scenario-name'],
      ['targetHostName', 'load-config-target-host'],
      ['port', 'load-config-port'],
      ['path', 'load-config-path'],
      ['virtualUsers', 'load-config-virtual-users'],
      ['testDuration', 'load-config-duration'],
      ['rampUpTime', 'load-config-rampup-time'],
      ['rampUpSteps', 'load-config-rampup-steps'],
    ];
    const first = order.find(
      ([k]) =>
        loadConfigModel.inputModels[k] &&
        !loadConfigModel.inputModels[k].isValid,
    );
    showErrorMessage('error', 'Please fill in all required fields.');
    if (first) {
      const el = document.querySelector(
        `input[data-testid="${first[1]}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus();
      }
    }
  }
}

function handelClose() {
  // 폼 리셋
  loadConfigModel.inputModels.scenarioName.value = '';
  loadConfigModel.inputModels.targetHostName.value = '';
  loadConfigModel.inputModels.port.value = '';
  loadConfigModel.protocol.selected = 'HTTP';
  loadConfigModel.inputModels.path.value = '';
  loadConfigModel.methods.selected = 'GET';
  loadConfigModel.inputModels.bodyData.value = '';
  loadConfigModel.inputModels.virtualUsers.value = '';
  loadConfigModel.inputModels.testDuration.value = '';
  loadConfigModel.inputModels.rampUpTime.value = '';
  loadConfigModel.inputModels.rampUpSteps.value = '';
  loadConfigModel.location.selected = 'remote';
  loadConfigModel.isMetrics.value = true;
  loadConfigModel.inputModels.agentHostName.value = '';
  loadConfigModel.installed.selected = 'True';
  selectedTemplate.value = '';
  emit('close');
}
</script>

<template>
  <PButtonModal
    data-testid="load-config-modal"
    :visible="isOpen"
    :v-model="isOpen"
    size="sm"
    :loading="false"
    header-title="Load Config"
    @confirm="handleConfirm"
    @cancel="handelClose"
    @close="handelClose"
  >
    <template #body>
      <div class="config-form">
        <div class="title">
          <p-field-group
            :label="'Test Scenario Name'"
            required
            :invalid="!loadConfigModel.inputModels.scenarioName.isValid"
          >
            <template #default="{ invalid }">
              <p-text-input
                v-model="loadConfigModel.inputModels.scenarioName.value"
                data-testid="load-config-scenario-name"
                :invalid="invalid"
                :placeholder="'Test Scenario Name'"
                block
              />
            </template>
          </p-field-group>
        </div>

        <section class="section">
          <p-field-group
            :invalid="!loadConfigModel.inputModels.targetHostName.isValid"
            :label="'Target Host Name'"
            required
          >
            <template #default="{ invalid }">
              <p-text-input
                v-model="loadConfigModel.inputModels.targetHostName.value"
                data-testid="load-config-target-host"
                :invalid="invalid"
                :placeholder="'Host Name'"
                block
              />
            </template>
          </p-field-group>
          <p-field-group
            :invalid="!loadConfigModel.inputModels.port.isValid"
            :label="'Port'"
            required
          >
            <template #default="{ invalid }">
              <p-text-input
                v-model="loadConfigModel.inputModels.port.value"
                data-testid="load-config-port"
                :invalid="invalid"
                :type="'number'"
                :placeholder="'1~65535'"
                block
              />
            </template>
          </p-field-group>
          <p-field-group
            :invalid="!loadConfigModel.inputModels.path.isValid"
            :label="'URI'"
            required
          >
            <template #default="{ invalid }">
              <div class="flex gap-1">
                <p-select-dropdown
                  class="flex-1 min-w-0"
                  :menu="loadConfigModel.protocol.menu"
                  :selected="loadConfigModel.protocol.selected"
                  :placeholder="'Protocol'"
                  @select="e => (loadConfigModel.protocol.selected = e)"
                />
                <p-text-input
                  v-model="loadConfigModel.inputModels.path.value"
                  data-testid="load-config-path"
                  :invalid="invalid"
                  class="flex-2 min-w-0"
                  :placeholder="'Path'"
                  block
                />
              </div>
            </template>
          </p-field-group>
          <p-field-group :label="'Method'" required>
            <template #default="{ invalid }">
              <p-select-dropdown
                class="block"
                :menu="loadConfigModel.methods.menu"
                :selected="loadConfigModel.methods.selected"
                :placeholder="'Method'"
                @select="e => (loadConfigModel.methods.selected = e)"
              />
            </template>
          </p-field-group>
          <p-field-group class="!m-0" :label="'Body Data'">
            <template #default="{ invalid }">
              <p-textarea
                v-model="loadConfigModel.inputModels.bodyData.value"
                class="min-h-12"
                :placeholder="'Copy and Paste the data.'"
              />
            </template>
          </p-field-group>
        </section>
        <section class="section">
          <p-field-group label="Load Template">
            <template #default="{ invalid }">
              <p-select-dropdown
                v-model="selectedTemplate"
                :menu="
                  savedTemplates.map(template => ({
                    name: template.name,
                    label: template.name,
                  }))
                "
                placeholder="Choose a saved template"
                block
                @select="applyTemplate"
              />
            </template>
          </p-field-group>
          <p-field-group
            :invalid="!loadConfigModel.inputModels.virtualUsers.isValid"
            :label="'Virtual Users'"
            required
          >
            <template #default="{ invalid }">
              <p-text-input
                v-model="loadConfigModel.inputModels.virtualUsers.value"
                data-testid="load-config-virtual-users"
                :invalid="invalid"
                :type="'number'"
                :placeholder="'Number of virtual users'"
                block
              />
            </template>
          </p-field-group>
          <p-field-group
            :invalid="!loadConfigModel.inputModels.testDuration.isValid"
            :label="'Test Duration'"
            required
          >
            <template #default="{ invalid }">
              <p-text-input
                v-model="loadConfigModel.inputModels.testDuration.value"
                data-testid="load-config-duration"
                :invalid="invalid"
                :type="'number'"
                :placeholder="'Test Run Time'"
                block
              >
                <template #input-right>sec</template>
              </p-text-input>
            </template>
          </p-field-group>
          <div class="flex gap-1">
            <p-field-group
              :invalid="!loadConfigModel.inputModels.rampUpTime.isValid"
              class="flex-1 !m-0 min-w-0"
              :label="'RampUp Time'"
              required
            >
              <template #default="{ invalid }">
                <p-text-input
                  v-model="loadConfigModel.inputModels.rampUpTime.value"
                  data-testid="load-config-rampup-time"
                  :invalid="invalid"
                  :placeholder="'Time'"
                  :type="'number'"
                  block
                />
              </template>
            </p-field-group>
            <p-field-group
              :invalid="!loadConfigModel.inputModels.rampUpSteps.isValid"
              class="flex-1 !m-0 min-w-0"
              :label="'RampUp Steps'"
              required
            >
              <template #default="{ invalid }">
                <p-text-input
                  v-model="loadConfigModel.inputModels.rampUpSteps.value"
                  data-testid="load-config-rampup-steps"
                  :invalid="invalid"
                  :placeholder="'Number of steps'"
                  :type="'number'"
                  block
                />
              </template>
            </p-field-group>
          </div>
        </section>
        <section class="section">
          <p-field-group class="!m-0" :label="'Install Location'" required>
            <template #default>
              <p-radio-group>
                <p-radio
                  v-for="value in loadConfigModel.location.values"
                  :key="value.key"
                  v-model="loadConfigModel.location.selected"
                  :value="value.key"
                >
                  {{ value.label }}
                </p-radio>
              </p-radio-group>
            </template>
          </p-field-group>
        </section>
        <section class="section">
          <div class="flex gap-2">
            <p-toggle-button
              :value="loadConfigModel.isMetrics.value"
              @update:value="e => (loadConfigModel.isMetrics.value = e)"
            />
            <p>Collect Additional System Metrics</p>
          </div>
          <p-divider class="mt-2 mb-2" />
          <div class="flex flex-col w-full gap-2">
            <p-field-group
              :invalid="!loadConfigModel.inputModels.agentHostName.isValid"
              class="!m-0"
              :label="'Agent Hostname'"
            >
              <template #default="{ invalid }">
                <p-text-input
                  v-model="loadConfigModel.inputModels.agentHostName.value"
                  :invalid="invalid"
                  :placeholder="'Agent Host Name'"
                  block
                />
              </template>
            </p-field-group>
            <p-field-group
              class="!m-0"
              :label="'Agent Installed'"
              required
            >
              <template #default="{ invalid }">
                <p-select-dropdown
                  class="block"
                  :menu="loadConfigModel.installed.menu"
                  :selected="loadConfigModel.installed.selected"
                  :placeholder="'select'"
                  @select="e => (loadConfigModel.installed.selected = e)"
                />
              </template>
            </p-field-group>
          </div>
        </section>
      </div>
    </template>
  </PButtonModal>
</template>

<style scoped lang="postcss">
.config-form {
  @apply bg-gray-100;
  padding: 16px;

  .section {
    background: white;
    margin: 8px 0 8px 0;
    padding: 12px;
    border-radius: 6px;
  }
}
</style>
