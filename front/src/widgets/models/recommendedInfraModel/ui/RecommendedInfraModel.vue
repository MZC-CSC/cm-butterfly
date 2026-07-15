<script setup lang="ts">
import {
  PButton,
  PIconModal,
  PToolboxTable,
  PSelectDropdown,
} from '@cloudforet-test/mirinae';
import { CreateForm } from '@/widgets/layout';
import { TargetModelNameSave } from '@/features/models';
import { computed, onMounted, reactive, ref } from 'vue';
import { SimpleEditForm } from '@/widgets/layout';
import { useRecommendedInfraModel } from '@/widgets/models/recommendedInfraModel/model/useRecommendedInfraModel';
import { createTargetModel } from '@/entities';
import {
  getRecommendCost,
  useGetRecommendModelListBySourceModel,
  useGetRecommendModelCandidates,
} from '@/entities/recommendedModel/api';
import {
  showErrorMessage,
  showInfoMessage,
  toErrorMessage,
} from '@/shared/utils';
import { IRecommendModelResponse } from '@/entities/recommendedModel/model/types';
import { useGetProviderList, useGetRegionList } from '@/entities/provider/api';
import { useAuth } from '@/features/auth/model/useAuth.ts';

interface IProps {
  sourceModelName: string;
  sourceModelId: string;
}

const props = defineProps<IProps>();

const emit = defineEmits(['update:close-modal']);

const auth = useAuth();

// VM 데이터 유효성 검사 헬퍼 함수
function isValidVmData(vm: any): boolean {
  return vm && 
         vm.specId && 
         vm.specId.trim() !== '' && 
         vm.imageId && 
         vm.imageId.trim() !== '';
}

// "empty" 문구를 빨간색으로 표시하는 헬퍼 함수
function formatEmptyValue(value: string): string {
  if (!value) return '';
  
  // "empty" 문자열을 빨간색으로 변환 (단어 단위로 대체)
  return value.replace(/\bempty\b/g, '<span style="color: red; font-weight: bold;">empty</span>');
}
const recommendInfraModel = useRecommendedInfraModel();

const modelName = ref<string>('');
const description = ref<string>('');

const resGetProviderList = useGetProviderList();
const resGetRegionList = useGetRegionList(null);

const resCreateTargetModel = createTargetModel(null);
const resGetRecommendCost = getRecommendCost(null);

const provider = reactive({
  menu: [] as any[],
  loading: true,
  selected: '',
});

const region = reactive({
  menu: [] as any[],
  loading: true,
  selected: '',
});

async function handleProviderMenuClick(e: any) {
  if (!e) return;

  provider.loading = true;
  const { data } = await resGetProviderList.execute();

  if (data.responseData) {
    provider.menu = recommendInfraModel.generateProviderSelectMenu(
      data.responseData,
    );
  }

  provider.loading = false;
}

async function handleRegionMenuClick(e: any) {
  if (!e) return;

  region.loading = true;
  const { data } = await resGetRegionList.execute({
    pathParams: {
      providerName: provider.selected,
    },
  });

  if (data.responseData) {
    region.menu = recommendInfraModel.generateRegionSelectMenu(
      data.responseData,
    );
  }

  region.loading = false;
}

const targetSourceModel = computed(() =>
  recommendInfraModel.sourceModelStore.getSourceModelById(props.sourceModelId),
);

// Query parameter 입력값
const candidateLimit = ref<number>(3);
const minimumMatchRateMin = ref<number | null>(null);
const minimumMatchRateMax = ref<number>(100);  // 기본값 100

const modalState = reactive({
  targetModal: false,
  checkModal: false,
});

onMounted(() => {
  recommendInfraModel.initToolBoxTableModel();
  handleProviderMenuClick(true);
});

async function getRecommendModelList() {
  recommendInfraModel.initToolBoxTableModel();

  try {
    // minimumMatchRate 파라미터 조합
    let minimumMatchRateParam: string | number | null = null;
    if (minimumMatchRateMin.value !== null && minimumMatchRateMax.value !== null) {
      minimumMatchRateParam = `${minimumMatchRateMin.value}-${minimumMatchRateMax.value}`;
    } else if (minimumMatchRateMin.value !== null) {
      minimumMatchRateParam = minimumMatchRateMin.value;
    } else if (minimumMatchRateMax.value !== null) {
      minimumMatchRateParam = minimumMatchRateMax.value;
    }
    
    // Candidates API 호출 (복수 후보 조회)
    const getRecommendCandidates = useGetRecommendModelCandidates(
      targetSourceModel.value?.onpremiseInfraModel || null,
      provider.selected,
      region.selected,
      candidateLimit.value,
      minimumMatchRateParam,
    );

    const res = await getRecommendCandidates.execute();
    
    console.log('=== Recommend Candidates Response ===');
    console.log('Type of res:', typeof res);
    console.log('Keys of res:', Object.keys(res));
    console.log('res.data type:', typeof res.data);
    console.log('res.data keys:', res.data ? Object.keys(res.data) : 'null');
    
    // API 응답 구조: { responseData: { data: [...] } }
    if (res.data?.responseData?.data && Array.isArray(res.data.responseData.data)) {
      const candidates = res.data.responseData.data;
      console.log(`Found ${candidates.length} candidate(s)`);
      
      // 각 후보에 대해 비용 계산 및 데이터 정제
      const processedCandidates = candidates.map((candidate, index) => {
        console.log(`Processing candidate ${index + 1}:`, JSON.stringify(candidate, null, 2));
        
        // API 응답 데이터 검증 및 정리
        if (candidate.targetInfra?.nodeGroups) {
          const originalLength = candidate.targetInfra.nodeGroups.length;
          
          // 무효한 데이터 로깅
          const invalidVms = candidate.targetInfra.nodeGroups.filter(vm => 
            !vm || !vm.specId || vm.specId.trim() === '' || !vm.imageId || vm.imageId.trim() === ''
          );
          
          if (invalidVms.length > 0) {
            console.warn(`Candidate ${index + 1}: Found ${invalidVms.length} invalid VMs`);
          }
          
          // 무효한 데이터의 빈 필드를 "empty"로 대체
          candidate.targetInfra.nodeGroups = candidate.targetInfra.nodeGroups.map(vm => {
            const updatedVm = { ...vm };
            if (!vm.specId || vm.specId.trim() === '') {
              updatedVm.specId = 'empty';
            }
            if (!vm.imageId || vm.imageId.trim() === '') {
              updatedVm.imageId = 'empty';
            }
            return updatedVm;
          });
        }

        // 비용 계산 (targetSpecList 기반)
        try {
          let totalCostPerHour = 0;
          let currency = '';
          let skippedVms: Array<{ vmName: string; specId: string; costPerHour: number }> = [];
          
          candidate.targetInfra.nodeGroups?.forEach(vm => {
            const matchingSpec = candidate.targetSpecList?.find(spec => spec.id === vm.specId);
            if (matchingSpec && matchingSpec.costPerHour !== undefined && matchingSpec.costPerHour !== null) {
              if (matchingSpec.costPerHour < 0) {
                skippedVms.push({
                  vmName: vm.name,
                  specId: vm.specId,
                  costPerHour: matchingSpec.costPerHour
                });
                console.warn(`Skipping VM with negative cost: ${vm.name} (${vm.specId})`);
              } else {
                totalCostPerHour += matchingSpec.costPerHour;
                currency = matchingSpec.currency || 'USD';
              }
            } else {
              console.warn(`No cost information found for VM: ${vm.name} (${vm.specId})`);
            }
          });
          
          if (skippedVms.length > 0) {
            console.warn(`Candidate ${index + 1}: Skipped ${skippedVms.length} VMs due to invalid cost`);
          }

          const totalCostPerMonth = totalCostPerHour * 24 * 30;

          return {
            ...candidate,
            estimateResponse: {
              result: {
                esimateCostSpecResults: [{
                  estimateForecastCostSpecDetailResults: [{
                    calculatedMonthlyPrice: totalCostPerMonth,
                    calculatedHourlyPrice: totalCostPerHour,
                    currency: currency
                  }]
                }]
              }
            }
          };
        } catch (e) {
          console.error(`Error calculating cost for candidate ${index + 1}:`, e);
          return {
            ...candidate,
            estimateResponse: {
              result: {
                esimateCostSpecResults: [{
                  estimateForecastCostSpecDetailResults: [{
                    calculatedMonthlyPrice: 0,
                    calculatedHourlyPrice: 0,
                    currency: 'USD'
                  }]
                }]
              }
            }
          };
        }
      });

      console.log('Processed candidates:', processedCandidates);
      console.log('=== End Response Log ===');

      // n개의 후보를 모두 테이블에 표시
      try {
        const tableItems = processedCandidates.map((candidate, index) => {
          console.log(`Organizing table item ${index + 1}:`, candidate);
          const item = recommendInfraModel.organizeRecommendedModelTableItem(candidate);
          item.index = index + 1; // 순번 추가
          console.log(`Organized item ${index + 1}:`, item);
          return item;
        });
        
        console.log('Setting table items:', tableItems);
        recommendInfraModel.tableModel.tableState.items = tableItems;
        console.log('Table items set successfully');
      } catch (tableError) {
        console.error('Error organizing table items:', tableError);
        throw tableError;
      }
      
    } else {
      // No matching candidate is a normal outcome — it happens whenever the spec filter is narrow.
      // Leave the table empty and just inform. A red error here makes a 200 OK look like a failure.
      recommendInfraModel.initToolBoxTableModel();
      showInfoMessage(
        'No candidates',
        'No candidate matched these conditions. Try widening them and search again.',
      );
    }
  } catch (err: any) {
    showErrorMessage(
      'Error',
      toErrorMessage(err, 'Failed to get recommendations'),
    );
    recommendInfraModel.initToolBoxTableModel();
  }
}

function handleModal() {
  emit('update:close-modal', false);
  modalState.targetModal = false;
  modalState.checkModal = true;
}

function handleConfirm() {
  modalState.targetModal = false;
  modalState.checkModal = false;
  emit('update:close-modal', false);
}

function handleSave(e: { name: string; description: string }) {
  modelName.value = e.name;
  description.value = e.description;

  try {
    // selectIndex는 배열 형태([0], [1], [2], ...)로 저장되므로 첫 번째 요소를 추출
    const selectIndex = recommendInfraModel.tableModel.tableState.selectIndex;
    const rowIndex = Array.isArray(selectIndex) ? selectIndex[0] : selectIndex as number;

    const displayItem = recommendInfraModel.tableModel.tableState.displayItems[rowIndex];
    if (!displayItem) {
      throw new Error(`No display item found at index ${rowIndex}`);
    }

    let selectedModel: IRecommendModelResponse = displayItem.originalData;

    if (!selectedModel?.targetInfra?.nodeGroups || selectedModel.targetInfra.nodeGroups.length === 0) {
      throw new Error('Selected model has no VM nodeGroups');
    }

    // 선택된 Row의 데이터를 가공 없이 그대로 사용
    // 주의: selectIndex는 테이블 행의 인덱스이고, 이미 displayItems[rowIndex]에서 해당 모델을 가져왔으므로
    // nodeGroups에서는 첫 번째 VM(인덱스 0)을 사용해야 함 (CSP/Region 추출용)
    const selectedVm = selectedModel.targetInfra.nodeGroups[0];
    
    // 기존 targetInfra를 그대로 사용 (가공 없이)
    const modifiedTargetVmInfra = {
      ...selectedModel.targetInfra
      // nodeGroups는 원본 그대로 유지
    };

    // API 스펙에 맞는 cloudInfraModel 구조 생성
    const cloudInfraModel = {
      description: selectedModel.description || '',
      status: selectedModel.status || '',
      targetSecurityGroupList: selectedModel.targetSecurityGroupList || [],
      targetSshKey: selectedModel.targetSshKey || {},
      targetVNet: selectedModel.targetVNet || {},
      targetInfra: modifiedTargetVmInfra, // 가공되지 않은 targetInfra 사용
      targetOsImageList: selectedModel.targetOsImageList || [],
      targetSpecList: selectedModel.targetSpecList || []
    };

    // specId가 빈 문자열이거나 +가 없는 경우 기본값 사용
    let csp = 'default-csp';
    let region = 'default-region';
    
    if (selectedVm.specId && selectedVm.specId !== 'empty' && selectedVm.specId.includes('+')) {
      const commonSpecSplitData = selectedVm.specId.split('+');
      csp = commonSpecSplitData[0];
      region = commonSpecSplitData[1];
    } else if (selectedVm.specId === 'empty') {
      console.warn('Selected VM has empty specId, using default values');
    }

    resCreateTargetModel
      .execute({
        request: {
          cloudInfraModel: cloudInfraModel as any, // 가공되지 않은 데이터 전달
          csp: csp,
          description: description.value,
          isInitUserModel: true,
          isTargetModel: true,
          region: region,
          userModelName: modelName.value,
          userModelVersion: '1',
          zone: '',
          userId: auth.getUser().id,
        },
      })
      .then(res => {
        modalState.targetModal = false;
        modalState.checkModal = true;
      })
      .catch();
  } catch (e: any) {
    showErrorMessage('error', e?.message || 'An error occurred');
  }
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      data-testid="recommend-modal"
      title="Recommend Model"
      :need-widget-layout="true"
      :badge-title="sourceModelName"
      first-title="Recommend Model List"
      @update:modal-state="handleModal"
    >
      <template #add-info>
        <div class="flex gap-4 flex-col w-full">
          <!-- Provider, Region, Search 버튼을 같은 라인에 배치 -->
          <section class="select-service-box flex w-full items-center gap-4">
            <p class="text-label-lg font-bold">Provider</p>
            <p-select-dropdown
              data-testid="recommend-provider-select"
              :menu="provider.menu"
              :loading="provider.loading"
              @update:visible-menu="handleProviderMenuClick"
              @select="
                e => {
                  provider.selected = e;
                  handleRegionMenuClick(true);
                }
              "
            ></p-select-dropdown>
            <p class="text-label-lg font-bold">Region</p>
            <p-select-dropdown
              data-testid="recommend-region-select"
              :menu="region.menu"
              :loading="region.loading"
              :disabled="provider.selected === ''"
              @update:visible-menu="handleRegionMenuClick"
              @select="
                e => {
                  region.selected = e;
                }
              "
            ></p-select-dropdown>
            
            <!-- Search 버튼을 오른쪽 끝으로 -->
            <div class="flex-grow"></div>
            <p-button
              data-testid="recommend-search"
              :disabled="!provider.selected || !region.selected"
              @click="getRecommendModelList"
            >
              Search
            </p-button>
          </section>
          <!-- Query Parameters를 가로로 배치 -->
          <section class="select-service-box flex w-full items-center gap-4">
            <!-- Candidate Limit with tooltip -->
            <p class="text-label-lg font-bold" title="Maximum number of recommended infrastructures to return (default: 3)">Candidate Limit</p>
            <input
              v-model.number="candidateLimit"
              data-testid="recommend-candidate-limit"
              type="number"
              :min="1"
              :max="10"
              class="p-2 border rounded"
              style="width: 80px"
              placeholder="3"
              title="Maximum number of recommended infrastructures to return (default: 3)"
            />
            
            <!-- Minimum Match Rate with tooltip -->
            <p class="text-label-lg font-bold" title="Minimum match rate threshold for highly-matched classification (default: 90.0, range: 0-100)">Minimum Match Rate(%)</p>
            <input
              v-model.number="minimumMatchRateMin"
              type="number"
              :min="1"
              :max="100"
              step="1"
              class="p-2 border rounded"
              style="width: 80px"
              placeholder="Min"
              title="Minimum match rate threshold for highly-matched classification (default: 90.0, range: 0-100)"
            />
            <span class="text-label-lg">~</span>
            <input
              v-model.number="minimumMatchRateMax"
              type="number"
              :min="1"
              :max="100"
              step="1"
              class="p-2 border rounded"
              style="width: 80px"
              placeholder="Max"
              title="Maximum match rate threshold for highly-matched classification (default: 100, range: 0-100)"
            />
          </section>
          <p-toolbox-table
            ref="toolboxTable"
            data-testid="recommend-result-table"
            :items="recommendInfraModel.tableModel.tableState.displayItems"
            :fields="recommendInfraModel.tableModel.tableState.fields"
            :total-count="recommendInfraModel.tableModel.tableState.tableCount"
            :style="{ height: '500px' }"
            :sortable="recommendInfraModel.tableModel.tableOptions.sortable"
            :sort-by="recommendInfraModel.tableModel.tableOptions.sortBy"
            :selectable="
              recommendInfraModel.tableModel.tableOptions.selectable
            "
            :loading="resGetRecommendCost.isLoading.value"
            :select-index.sync="
              recommendInfraModel.tableModel.tableState.selectIndex
            "
            :multi-select="false"
            @change="recommendInfraModel.tableModel.handleChange"
          >
            <!--
              첫 컬럼(No.)에 후보의 완전/불완전 마커를 함께 싣는다.
              - 사람용: 스펙·이미지에 이상값이 있으면 번호 앞에 빨간 "!" 를 붙이고,
                호버 시 실제로 빈 컬럼명을 안내한다(경고만, 저장은 막지 않는다).
              - E2E용: data-complete="true|false" 로 완전한 후보만 기계적으로 선택하게 한다.
              판정은 model의 hasMissingRequiredFields 와 동일 기준(item.hasMissingInfo).
            -->
            <template #col-index-format="{ item }">
              <span
                class="recommend-candidate"
                :class="{
                  'recommend-candidate--invalid': item.hasMissingInfo,
                }"
                data-testid="recommend-candidate"
                :data-complete="item.hasMissingInfo ? 'false' : 'true'"
                :data-id="item.name || ''"
                :title="
                  item.hasMissingInfo
                    ? `필수정보가 누락돼 있습니다. 워크플로우 구현할 때 해당 항목(${item.missingFields || 'Spec, Image'})을 채워야 합니다`
                    : undefined
                "
              >
                <span
                  v-if="item.hasMissingInfo"
                  class="recommend-candidate__flag"
                  data-testid="recommend-candidate-invalid"
                  >!</span
                >{{ item.index }}
              </span>
            </template>
            <template #col-spec-format="{ item }">
              <span v-html="formatEmptyValue(item.spec)"></span>
            </template>
            <template #col-image-format="{ item }">
              <span v-html="formatEmptyValue(item.image)"></span>
            </template>
          </p-toolbox-table>
        </div>
      </template>
      <template #buttons>
        <p-button style-type="tertiary" @click="handleModal">cancel</p-button>
        <p-button
          data-testid="recommend-save-target"
          @click="modalState.targetModal = true"
        >
          Save as a Target Model
        </p-button>
      </template>
    </create-form>
    <simple-edit-form
      v-if="modalState.targetModal"
      header-title="Save Target Model"
      name=""
      name-label="Model name"
      name-placeholder="Model name"
      @update:save-modal="handleSave"
      @update:close-modal="modalState.targetModal = false"
    />
    <p-icon-modal
      size="md"
      :visible="modalState.checkModal"
      icon-name="ic_check-circle"
      header-title="The Target Model was successfully saved."
      button-text="Confirm"
      @clickButton="handleConfirm"
    >
      <template #body>
        <target-model-name-save :model-name="modelName" />
      </template>
    </p-icon-modal>
  </div>
</template>

<style scoped lang="postcss">
.layout {
  padding: 32px 16px;

  .title {
    font-size: 18px;
    font-weight: 400;
  }
}

.model-name {
  font-size: 14px;
  font-weight: 700;
}

.divider {
  margin: 7.5px 0 16px 0;
}

:deep(.menu-container) {
  max-height: 190px;
  overflow-y: auto;
}

.parameters-section {
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.parameter-input input {
  width: 120px;
}

.recommend-candidate--invalid {
  color: red;
  font-weight: bold;
}

.recommend-candidate__flag {
  margin-right: 2px;
}
</style>
