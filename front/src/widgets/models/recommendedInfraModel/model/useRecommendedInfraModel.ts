import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import {
  IEsimateCostSpecResponse,
  IRecommendModelResponse,
} from '@/entities/recommendedModel/model/types';
import { RecommendedModelTableType } from '@/entities/recommendedModel/model/types';
import { ref, watch } from 'vue';
import { useSourceModelStore } from '@/entities';
import { useAuthStore } from '@/shared/libs/store/auth';
import {
  IProviderResponse,
  IRegionOfProviderResponse,
} from '@/entities/provider/model/types';

interface ISelectMenu {
  name: string;
  label: string;
  type: string;
}

interface IExtendRecommendModelResponse extends IRecommendModelResponse {
  estimateResponse?: IEsimateCostSpecResponse;
}

// Value validation: decides whether a spec/image field holds "an abnormal value
// that is not a real input value". The goal is not to catch input-guidance
// placeholders, but to detect bad values/types that cm-beetle left because it
// could not fill them in (`string`, `npt`, `undefined`, etc.) or empty values.
// Saving such a candidate as a target model does succeed, but later, when the
// infrastructure (MCI) is created, beetle fails to resolve the image and errors out.
//
// Set treated as abnormal (provisional): '' / whitespace / null / undefined (value) /
// the string 'string' / 'npt' / 'undefined' / 'empty' (an earlier stage substitutes
// this for empty values).
// Note: 'default' is not abnormal — in cb-spider `string` is an error, but `default`
// is a legitimately allowed value implemented to "behave as the default", so it counts
// as a complete value.
//
// TODO(cb-spider): which values are a "legitimate default" versus an "error" can differ
// per column. The exact set must be confirmed by inspecting the cb-spider source, and
// INVALID_FIELD_VALUES below is a provisional definition covering only what is currently known.
const INVALID_FIELD_VALUES = new Set(['', 'string', 'npt', 'undefined', 'empty']);

function isInvalidFieldValue(value?: string | null): boolean {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim().toLowerCase();
  // Legitimately allowed values such as 'default' are not caught here (not in the set).
  return INVALID_FIELD_VALUES.has(normalized);
}

// True if any of the candidate's (recommended infra) nodeGroups holds an abnormal value
// in its spec (specId) or image (imageId). It does not block saving; it is only used for
// the on-screen warning (`!`), markers, and tooltips.
function hasMissingRequiredFields(
  model?: IExtendRecommendModelResponse | null,
): boolean {
  const groups = model?.targetInfra?.nodeGroups;
  if (!groups || groups.length === 0) return true;
  return groups.some(
    group =>
      isInvalidFieldValue(group?.specId) || isInvalidFieldValue(group?.imageId),
  );
}

// Returns the on-screen labels (Spec/Image) of the required columns holding an abnormal
// value — so the tooltip text can name the actual empty column. Shares the same
// isInvalidFieldValue criterion as hasMissingRequiredFields.
function getMissingRequiredFieldLabels(
  model?: IExtendRecommendModelResponse | null,
): string[] {
  const groups = model?.targetInfra?.nodeGroups;
  const missing: string[] = [];
  if (!groups || groups.length === 0) {
    return ['Spec', 'Image'];
  }
  if (groups.some(group => isInvalidFieldValue(group?.specId))) {
    missing.push('Spec');
  }
  if (groups.some(group => isInvalidFieldValue(group?.imageId))) {
    missing.push('Image');
  }
  return missing;
}

export function useRecommendedInfraModel() {
  const tableModel =
    useToolboxTableModel<
      Partial<
        Record<
          | RecommendedModelTableType
          | 'originalData'
          | 'hasMissingInfo'
          | 'missingFields',
          any
        >
      >
    >();
  const sourceModelStore = useSourceModelStore();
  const targetRecommendModel = ref<IExtendRecommendModelResponse | null>(null);
  const userStore = useAuthStore();

  function initToolBoxTableModel() {
    tableModel.initState();
    tableModel.tableState.fields = [
      { name: 'index', label: 'No.' },
      //{ name: 'name', label: 'Name' },
      //{ name: 'id', label: 'ID' },
      //{ name: 'description', label: 'Description' },
      { name: 'spec', label: 'Spec' },
      { name: 'vCpu', label: 'vCPU' },
      { name: 'memory', label: 'Memory' },
      { name: 'disk', label: 'Disk' },
      { name: 'image', label: 'Image' },
      { name: 'os', label: 'OS' },
      { name: 'architecture', label: 'Architecture' },
      { name: 'estimateCost', label: 'Total Estimate Cost' },
    ];

    tableModel.querySearchState.keyItemSet = [
      {
        title: 'columns',
        items: [
          //{ name: 'id', label: 'ID' },
          //{ name: 'name', label: 'Name' },
          //{ name: 'description', label: 'Description' },
          { name: 'spec', label: 'Spec' },
          { name: 'vCpu', label: 'vCPU' },
          { name: 'memory', label: 'Memory' },
          { name: 'disk', label: 'Disk' },
          { name: 'image', label: 'Image' },
          { name: 'os', label: 'OS' },
          { name: 'architecture', label: 'Architecture' },
          { name: 'estimateCost', label: 'Total Estimate Cost' },
        ],
      },
    ];

    tableModel.tableState.selectIndex = [0];
  }

  function organizeRecommendedModelTableItem(
    recommendedModel: IExtendRecommendModelResponse,
  ) {
    // Validate the input data
    if (!recommendedModel || !recommendedModel.targetInfra || !recommendedModel.targetInfra.nodeGroups) {
      console.warn('Invalid recommendedModel data:', recommendedModel);
      return {
        name: 'Invalid Data',
        spec: 'n/a',
        vCpu: 'n/a',
        memory: 'n/a',
        disk: 'n/a',
        image: 'n/a',
        os: 'n/a',
        architecture: 'n/a',
        estimateCost: 'n/a',
        hasMissingInfo: true,
        missingFields: 'Spec, Image',
        originalData: recommendedModel,
      };
    }
    let estimateCost: string;
    try {
      const monthlyPrice = recommendedModel?.estimateResponse?.result?.esimateCostSpecResults?.reduce(
        (acc, cur) => {
          return (
            acc +
            cur.estimateForecastCostSpecDetailResults[0].calculatedMonthlyPrice
          );
        },
        0,
      );
      
      const hourlyPrice = recommendedModel?.estimateResponse?.result?.esimateCostSpecResults?.[0]
        ?.estimateForecastCostSpecDetailResults[0]?.calculatedHourlyPrice;
      
      const currency = recommendedModel?.estimateResponse?.result?.esimateCostSpecResults[0]
        ?.estimateForecastCostSpecDetailResults[0]?.currency || '';
      
      if (monthlyPrice !== undefined && hourlyPrice !== undefined) {
        estimateCost = `${monthlyPrice.toFixed(4)}/mon (${hourlyPrice.toFixed(5)}/hour)${currency}`;
      } else {
        estimateCost = 'n/a';
      }
    } catch (error) {
      console.error('Error calculating estimateCost:', error);
      estimateCost = 'n/a';
    }

    // Extract vCPU, memory, and disk from targetSpecList
    const vCpuValues: string[] = [];
    const memoryValues: string[] = [];
    const diskValues: string[] = [];
    
    recommendedModel.targetInfra.nodeGroups?.forEach(subGroup => {
      // Find matching spec
      const matchingSpec = recommendedModel.targetSpecList?.find(
        spec => spec.id === subGroup.specId
      );
      
      if (matchingSpec) {
        // Extract vCPU
        if (matchingSpec.vCPU !== undefined && matchingSpec.vCPU !== -1) {
          vCpuValues.push(String(matchingSpec.vCPU));
        }
        
        // Extract memory
        if (matchingSpec.memoryGiB !== undefined && matchingSpec.memoryGiB !== -1) {
          memoryValues.push(`${matchingSpec.memoryGiB} GB`);
        }
      }
      
      // Extract disk from rootDiskSize
      if (subGroup.rootDiskSize && subGroup.rootDiskSize !== '' && subGroup.rootDiskSize !== '-1') {
        diskValues.push(`${subGroup.rootDiskSize} GB`);
      }
    });

    // Extract OS and Architecture from targetOsImageList
    const osValues: string[] = [];
    const archValues: string[] = [];
    
    recommendedModel.targetInfra.nodeGroups?.forEach(subGroup => {
      // Find matching image
      const matchingImage = recommendedModel.targetOsImageList?.find(
        image => image.cspImageName === subGroup.imageId
      );
      
      if (matchingImage) {
        // Extract OS from description (e.g., "Canonical, Ubuntu, 22.04, amd64 jammy image")
        if (matchingImage.description) {
          // Try to parse OS name from description
          const desc = matchingImage.description;
          // Common patterns: "Ubuntu 22.04", "Canonical, Ubuntu, 22.04", etc.
          const osMatch = desc.match(/Ubuntu\s+[\d.]+|Windows\s+Server\s+[\d]+|CentOS\s+[\d.]+|RHEL\s+[\d.]+|Amazon\s+Linux\s+[\d]+/i);
          if (osMatch) {
            osValues.push(osMatch[0]);
          } else {
            // Fallback: use first part of description
            const parts = desc.split(',').map(p => p.trim());
            if (parts.length >= 2) {
              osValues.push(`${parts[1]} ${parts[2] || ''}`.trim());
            } else {
              osValues.push(parts[0] || 'Unknown');
            }
          }
        }
        
        // Extract Architecture from details
        if (matchingImage.details && Array.isArray(matchingImage.details)) {
          const archDetail = matchingImage.details.find(
            (detail: any) => detail.key === 'Architecture'
          );
          if (archDetail && archDetail.value) {
            archValues.push(archDetail.value);
          }
        }
      }
    });

    const organizedDatum: Partial<
      Record<
        | RecommendedModelTableType
        | 'originalData'
        | 'hasMissingInfo'
        | 'missingFields',
        any
      >
    > = {
      name: recommendedModel.targetInfra.name,
      //id: recommendedModel['id'] || '',
      //description: recommendedModel['description'] || '',
      spec:
        recommendedModel.targetInfra.nodeGroups
          ?.reduce((acc, cur) => {
            // Also covers the case where specId is "empty"
            if (!cur.specId || cur.specId.trim() === '') {
              return acc;
            }
            // If specId is "empty", use it as-is
            if (cur.specId === 'empty') {
              return `${acc}empty / `;
            }
            // If specId contains a '+', use the last part; otherwise use the whole value
            const specValue = cur.specId.includes('+') ? cur.specId.split('+').at(-1) : cur.specId;
            return `${acc}${specValue} / `;
          }, '')
          .replace(/\/\s$/g, '') || 'n/a',
      vCpu: vCpuValues.length > 0 ? vCpuValues.join(' / ') : 'n/a',
      memory: memoryValues.length > 0 ? memoryValues.join(' / ') : 'n/a',
      disk: diskValues.length > 0 ? diskValues.join(' / ') : 'n/a',
      image:
        recommendedModel.targetInfra.nodeGroups
          ?.reduce((acc, cur) => {
            // Also covers the case where imageId is "empty"
            if (!cur.imageId || cur.imageId.trim() === '') {
              return acc;
            }
            // If imageId is "empty", use it as-is
            if (cur.imageId === 'empty') {
              return `${acc}empty / `;
            }
            // If imageId contains a '+', use the last part; otherwise use the whole value
            const imageValue = cur.imageId.includes('+') ? cur.imageId.split('+').at(-1) : cur.imageId;
            return `${acc}${imageValue} / `;
          }, '')
          .replace(/\/\s$/g, '') || 'n/a',
      os: osValues.length > 0 ? osValues.join(' / ') : 'n/a',
      architecture: archValues.length > 0 ? archValues.join(' / ') : 'n/a',
      estimateCost: estimateCost || 'n/a',
      hasMissingInfo: hasMissingRequiredFields(recommendedModel),
      missingFields:
        getMissingRequiredFieldLabels(recommendedModel).join(', ') ||
        'Spec, Image',
      originalData: recommendedModel,
    };

    return organizedDatum;
  }

  function setTargetRecommendInfraModel(
    _targetRecommendModel: IExtendRecommendModelResponse,
  ) {
    targetRecommendModel.value = _targetRecommendModel;
  }

  function generateProviderSelectMenu(
    providerResponse: IProviderResponse,
  ): Array<ISelectMenu> {
    const menu: Array<ISelectMenu> = [];

    // With no registered provider the output is empty — that is an empty menu, not an error.
    (providerResponse?.output ?? []).forEach(provider => {
      menu.push({
        name: provider,
        label: provider,
        type: 'item',
      });
    });
    menu.sort((a, b) => a.label.localeCompare(b.label));

    return menu;
  }

  function generateRegionSelectMenu(
    regionOfProviderResponse: IRegionOfProviderResponse,
  ): Array<ISelectMenu> {
    const menu: Array<ISelectMenu> = [];

    regionOfProviderResponse.regions.forEach(region => {
      menu.push({
        name: region.regionId,
        label: `${region.location.display} / ${region.regionName}`,
        type: 'item',
      });
    });
    menu.sort((a, b) => a.label.localeCompare(b.label));
    return menu;
  }

  function setTableStateItem() {
    if (targetRecommendModel.value) {
      tableModel.tableState.items = [
        organizeRecommendedModelTableItem(targetRecommendModel.value),
      ];
    }
  }

  watch(targetRecommendModel, nv => {
    if (nv) setTableStateItem();
  });

  return {
    userStore,
    tableModel,
    initToolBoxTableModel,
    targetRecommendModel,
    sourceModelStore,
    setTableStateItem,
    setTargetRecommendInfraModel,
    generateProviderSelectMenu,
    generateRegionSelectMenu,
    organizeRecommendedModelTableItem,
  };
}
