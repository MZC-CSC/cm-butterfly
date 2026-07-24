<script setup lang="ts">
import {
  PButton,
  PIconModal,
  PToolboxTable,
  PSelectDropdown,
  PTooltip,
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

// Helper to validate VM data
function isValidVmData(vm: any): boolean {
  return (
    vm &&
    vm.specId &&
    vm.specId.trim() !== '' &&
    vm.imageId &&
    vm.imageId.trim() !== ''
  );
}

// Helper to render the "empty" text in red
function formatEmptyValue(value: string): string {
  if (!value) return '';

  // Turn the "empty" string red (replace on a whole-word basis)
  return value.replace(
    /\bempty\b/g,
    '<span style="color: red; font-weight: bold;">empty</span>',
  );
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

// Query parameter inputs
const candidateLimit = ref<number>(3);

/*
 * Minimum Match Rate — cm-beetle takes ONE number (query `minMatchRate`, 0-100, default 90.0).
 * There is no "max" counterpart, so this is a single field: a range string such as "90-100"
 * fails ParseFloat on the server, which then silently falls back to 90.0 (BAR-1634).
 *
 * Empty means "send nothing" so the server default applies. The slider therefore rests at
 * MATCH_RATE_DEFAULT while the field is empty, and the hint under the field says which one is in effect.
 */
const MATCH_RATE_MIN = 0;
const MATCH_RATE_MAX = 100;
const MATCH_RATE_DEFAULT = 90;

/** Raw text of the number field. '' means "not specified" (parameter is omitted). */
const matchRateInput = ref<string>('');

/** Parsed value, or null when the field is empty / unparsable. */
const matchRate = computed<number | null>(() => {
  const raw = matchRateInput.value.trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
});

/** Where the slider sits: the entered value, or the server default while the field is empty. */
const matchRateSliderValue = computed<number>(
  () => matchRate.value ?? MATCH_RATE_DEFAULT,
);

const matchRateHelp = `<strong>Minimum Match Rate</strong><br/>
The threshold that <em>classifies</em> the recommended candidates (0-100%, default ${MATCH_RATE_DEFAULT}%).<br/><br/>
&#8226; A VM counts as <b>matched</b> only when its CPU, memory and OS image all reach this rate.<br/>
&#8226; A candidate is <b>highly-matched</b> only when <b>every</b> VM is matched; otherwise it is <b>partially-matched</b>.<br/>
&#8226; This does <b>not</b> filter the results &mdash; both kinds stay in the list. Use <b>Candidate Limit</b> to change how many candidates come back.<br/>
&#8226; Leave it empty to let the server apply its default (${MATCH_RATE_DEFAULT}%).`;

function clampMatchRate(value: number): number {
  return Math.min(MATCH_RATE_MAX, Math.max(MATCH_RATE_MIN, value));
}

/*
 * Keep the field inside 0-100 while it is being typed. Out-of-range values are not merely
 * ugly: cm-beetle answers them by reverting to 90.0 without telling anyone, so a user who
 * typed 150 would silently get the default. The DOM value is written back explicitly because
 * clamping can leave the bound string unchanged (150 -> 100, then 1500 -> 100), and Vue skips
 * the DOM update when the value it holds did not change.
 */
function handleMatchRateInput(event: Event) {
  const el = event.target as HTMLInputElement;
  const raw = el.value.trim();

  if (raw === '') {
    matchRateInput.value = '';
    return;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    // Not a number yet (e.g. a lone '-'); drop it rather than sending garbage.
    matchRateInput.value = '';
    el.value = '';
    return;
  }

  matchRateInput.value = String(clampMatchRate(parsed));
  if (el.value !== matchRateInput.value) el.value = matchRateInput.value;
}

function handleMatchRateSlider(event: Event) {
  const el = event.target as HTMLInputElement;
  matchRateInput.value = String(clampMatchRate(Number(el.value)));
}

/** Back to "not specified" so the server default is used again. */
function resetMatchRate() {
  matchRateInput.value = '';
}

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
    // Send a single number, or nothing at all when the field is empty (server default applies).
    const minimumMatchRateParam =
      matchRate.value === null ? null : clampMatchRate(matchRate.value);

    // Call the Candidates API (fetch multiple candidates)
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

    // API response shape: { responseData: { data: [...] } }
    if (
      res.data?.responseData?.data &&
      Array.isArray(res.data.responseData.data)
    ) {
      const candidates = res.data.responseData.data;
      console.log(`Found ${candidates.length} candidate(s)`);

      // Compute cost and clean up data for each candidate
      const processedCandidates = candidates.map((candidate, index) => {
        console.log(
          `Processing candidate ${index + 1}:`,
          JSON.stringify(candidate, null, 2),
        );

        // Validate and clean up the API response data
        if (candidate.targetInfra?.nodeGroups) {
          const originalLength = candidate.targetInfra.nodeGroups.length;

          // Log invalid data
          const invalidVms = candidate.targetInfra.nodeGroups.filter(
            vm =>
              !vm ||
              !vm.specId ||
              vm.specId.trim() === '' ||
              !vm.imageId ||
              vm.imageId.trim() === '',
          );

          if (invalidVms.length > 0) {
            console.warn(
              `Candidate ${index + 1}: Found ${invalidVms.length} invalid VMs`,
            );
          }

          // Replace empty fields of invalid data with "empty"
          candidate.targetInfra.nodeGroups =
            candidate.targetInfra.nodeGroups.map(vm => {
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

        // Cost calculation (based on targetSpecList)
        try {
          let totalCostPerHour = 0;
          let currency = '';
          let skippedVms: Array<{
            vmName: string;
            specId: string;
            costPerHour: number;
          }> = [];

          candidate.targetInfra.nodeGroups?.forEach(vm => {
            const matchingSpec = candidate.targetSpecList?.find(
              spec => spec.id === vm.specId,
            );
            if (
              matchingSpec &&
              matchingSpec.costPerHour !== undefined &&
              matchingSpec.costPerHour !== null
            ) {
              if (matchingSpec.costPerHour < 0) {
                skippedVms.push({
                  vmName: vm.name,
                  specId: vm.specId,
                  costPerHour: matchingSpec.costPerHour,
                });
                console.warn(
                  `Skipping VM with negative cost: ${vm.name} (${vm.specId})`,
                );
              } else {
                totalCostPerHour += matchingSpec.costPerHour;
                currency = matchingSpec.currency || 'USD';
              }
            } else {
              console.warn(
                `No cost information found for VM: ${vm.name} (${vm.specId})`,
              );
            }
          });

          if (skippedVms.length > 0) {
            console.warn(
              `Candidate ${index + 1}: Skipped ${skippedVms.length} VMs due to invalid cost`,
            );
          }

          const totalCostPerMonth = totalCostPerHour * 24 * 30;

          return {
            ...candidate,
            estimateResponse: {
              result: {
                esimateCostSpecResults: [
                  {
                    estimateForecastCostSpecDetailResults: [
                      {
                        calculatedMonthlyPrice: totalCostPerMonth,
                        calculatedHourlyPrice: totalCostPerHour,
                        currency: currency,
                      },
                    ],
                  },
                ],
              },
            },
          };
        } catch (e) {
          console.error(
            `Error calculating cost for candidate ${index + 1}:`,
            e,
          );
          return {
            ...candidate,
            estimateResponse: {
              result: {
                esimateCostSpecResults: [
                  {
                    estimateForecastCostSpecDetailResults: [
                      {
                        calculatedMonthlyPrice: 0,
                        calculatedHourlyPrice: 0,
                        currency: 'USD',
                      },
                    ],
                  },
                ],
              },
            },
          };
        }
      });

      console.log('Processed candidates:', processedCandidates);
      console.log('=== End Response Log ===');

      // Show all n candidates in the table
      try {
        const tableItems = processedCandidates.map((candidate, index) => {
          console.log(`Organizing table item ${index + 1}:`, candidate);
          const item =
            recommendInfraModel.organizeRecommendedModelTableItem(candidate);
          item.index = index + 1; // add the sequence number
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
    // selectIndex is stored as an array ([0], [1], [2], ...), so extract the first element
    const selectIndex = recommendInfraModel.tableModel.tableState.selectIndex;
    const rowIndex = Array.isArray(selectIndex)
      ? selectIndex[0]
      : (selectIndex as number);

    const displayItem =
      recommendInfraModel.tableModel.tableState.displayItems[rowIndex];
    if (!displayItem) {
      throw new Error(`No display item found at index ${rowIndex}`);
    }

    let selectedModel: IRecommendModelResponse = displayItem.originalData;

    if (
      !selectedModel?.targetInfra?.nodeGroups ||
      selectedModel.targetInfra.nodeGroups.length === 0
    ) {
      throw new Error('Selected model has no VM nodeGroups');
    }

    // Use the selected row's data as-is, without processing.
    // Note: selectIndex is the table row index, and we already got the model from
    // displayItems[rowIndex], so within nodeGroups we should use the first VM
    // (index 0) — for extracting CSP/Region.
    const selectedVm = selectedModel.targetInfra.nodeGroups[0];

    // Use the existing targetInfra as-is (no processing)
    const modifiedTargetVmInfra = {
      ...selectedModel.targetInfra,
      // Keep nodeGroups exactly as the original
    };

    // Build the cloudInfraModel structure per the API spec
    const cloudInfraModel = {
      description: selectedModel.description || '',
      status: selectedModel.status || '',
      targetSecurityGroupList: selectedModel.targetSecurityGroupList || [],
      targetSshKey: selectedModel.targetSshKey || {},
      targetVNet: selectedModel.targetVNet || {},
      targetInfra: modifiedTargetVmInfra, // use the unprocessed targetInfra
      targetOsImageList: selectedModel.targetOsImageList || [],
      targetSpecList: selectedModel.targetSpecList || [],
    };

    // Use defaults if specId is an empty string or has no +
    let csp = 'default-csp';
    let region = 'default-region';

    if (
      selectedVm.specId &&
      selectedVm.specId !== 'empty' &&
      selectedVm.specId.includes('+')
    ) {
      const commonSpecSplitData = selectedVm.specId.split('+');
      csp = commonSpecSplitData[0];
      region = commonSpecSplitData[1];
    } else if (selectedVm.specId === 'empty') {
      console.warn('Selected VM has empty specId, using default values');
    }

    resCreateTargetModel
      .execute({
        request: {
          cloudInfraModel: cloudInfraModel as any, // pass the unprocessed data
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
          <!-- Place the Provider, Region and Search buttons on the same line -->
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
            />
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
            />

            <!-- Push the Search button to the far right -->
            <div class="flex-grow" />
            <p-button
              data-testid="recommend-search"
              :disabled="!provider.selected || !region.selected"
              @click="getRecommendModelList"
            >
              Search
            </p-button>
          </section>
          <!-- Lay out the Query Parameters horizontally -->
          <section class="select-service-box flex w-full items-start gap-6">
            <!-- Candidate Limit with tooltip -->
            <div class="param-field">
              <p
                class="text-label-lg font-bold"
                title="Maximum number of recommended infrastructures to return (default: 3)"
              >
                Candidate Limit
              </p>
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
            </div>

            <!--
              Minimum Match Rate — one value only. cm-beetle exposes a single `minMatchRate`
              (0-100, default 90) and answers anything it cannot parse by silently using 90,
              so the screen must not invent a range. The '?' badge sits at the label's
              bottom-right and opens the detailed explanation on hover/focus; the line under
              the field repeats the essentials for anyone who never hovers. (BAR-1634)
            -->
            <div class="match-rate-field">
              <div class="match-rate-field__label">
                <span class="text-label-lg font-bold"
                  >Minimum Match Rate (%)</span
                >
                <p-tooltip
                  :contents="matchRateHelp"
                  position="bottom"
                  :options="{ classes: ['p-tooltip', 'match-rate-tooltip'] }"
                >
                  <span
                    class="match-rate-field__help"
                    data-testid="recommend-match-rate-help"
                    tabindex="0"
                    aria-label="What Minimum Match Rate means"
                    >?</span
                  >
                </p-tooltip>
              </div>

              <div class="match-rate-field__control">
                <input
                  data-testid="recommend-match-rate-slider"
                  type="range"
                  :min="MATCH_RATE_MIN"
                  :max="MATCH_RATE_MAX"
                  step="1"
                  class="match-rate-field__slider"
                  :value="matchRateSliderValue"
                  :aria-valuenow="matchRateSliderValue"
                  @input="handleMatchRateSlider"
                />
                <input
                  data-testid="recommend-match-rate"
                  type="number"
                  :min="MATCH_RATE_MIN"
                  :max="MATCH_RATE_MAX"
                  step="1"
                  class="p-2 border rounded"
                  style="width: 80px"
                  :placeholder="String(MATCH_RATE_DEFAULT)"
                  :value="matchRateInput"
                  @input="handleMatchRateInput"
                />
                <p-button
                  size="sm"
                  style-type="tertiary"
                  data-testid="recommend-match-rate-reset"
                  :disabled="matchRateInput === ''"
                  @click="resetMatchRate"
                >
                  Use default
                </p-button>
              </div>

              <p
                class="match-rate-field__hint"
                data-testid="recommend-match-rate-hint"
              >
                <template v-if="matchRate === null">
                  Not set — the server default ({{ MATCH_RATE_DEFAULT }}%) is
                  used.
                </template>
                <template v-else>
                  Candidates at {{ matchRate }}% or above are shown as
                  highly-matched.
                </template>
                This only classifies the results; nothing is filtered out.
              </p>
            </div>
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
            :selectable="recommendInfraModel.tableModel.tableOptions.selectable"
            :loading="resGetRecommendCost.isLoading.value"
            :select-index.sync="
              recommendInfraModel.tableModel.tableState.selectIndex
            "
            :multi-select="false"
            @change="recommendInfraModel.tableModel.handleChange"
          >
            <!--
              Carry the candidate's complete/incomplete marker in the first column (No.).
              - For humans: if the spec or image has bad values, prefix the number with
                a red "!", and on hover indicate which columns are actually empty
                (warning only, doesn't block saving).
              - For E2E: use data-complete="true|false" so tests can mechanically pick
                only complete candidates.
              The judgment uses the same criterion as the model's hasMissingRequiredFields
              (item.hasMissingInfo).
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
                    ? `Required information is missing. You must fill in these fields (${item.missingFields || 'Spec, Image'}) when building the workflow.`
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
              <span v-html="formatEmptyValue(item.spec)" />
            </template>
            <template #col-image-format="{ item }">
              <span v-html="formatEmptyValue(item.image)" />
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
      <!--
        Override mirinae's built-in confirm button only to attach an e2e testid
        (model-save-confirm). mirinae renders that button from the `button-text` prop, so a
        data-testid cannot reach it otherwise. The replacement mirrors the default exactly —
        same style-type (tertiary), same label, and the `margin-top` the default carries via
        PIconModal's scoped `.button` rule (which does not reach parent-provided slot content)
        is restored inline so the render is unchanged. (BAR-1595 / CLAUDE.md §12)
      -->
      <template #custom-button>
        <p-button
          style-type="tertiary"
          data-testid="model-save-confirm"
          style="margin-top: 1.5rem"
          @click="handleConfirm"
        >
          Confirm
        </p-button>
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

/* Query parameter fields — label on top, control underneath. */
.param-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.match-rate-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* The '?' sits at the bottom-right of the label, like a footnote marker. */
.match-rate-field__label {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
}

.match-rate-field__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border: 1px solid #6b7280;
  border-radius: 50%;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  user-select: none;
}

.match-rate-field__help:hover,
.match-rate-field__help:focus {
  border-color: #1971c2;
  color: #1971c2;
  outline: none;
}

.match-rate-field__control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.match-rate-field__slider {
  width: 160px;
  cursor: pointer;
}

/* Kept deliberately visible — the tooltip explains the rest, but this line is what a user
   who never hovers still needs to read. */
.match-rate-field__hint {
  color: #1971c2;
  font-size: 12px;
  line-height: 1.4;
  max-width: 460px;
}
</style>

<!-- global: the tooltip renders outside this component's DOM, so a scoped rule cannot reach it.
     .tooltip-inner defaults to white-space:pre and a narrow box, which clips the explanation. -->
<style lang="postcss">
.p-tooltip.match-rate-tooltip .tooltip-inner {
  max-width: 460px;
  white-space: normal;
  word-break: break-word;
  text-align: left;
  line-height: 1.45;
}
</style>
