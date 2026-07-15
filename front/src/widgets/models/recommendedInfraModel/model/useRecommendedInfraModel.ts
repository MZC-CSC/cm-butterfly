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

// 값 검증(value validation): 스펙·이미지 필드에 "실제 입력값이 아닌 이상값"이
// 들어갔는지 판정한다. 입력 안내용 placeholder를 잡는 것이 아니라, cm-beetle이
// 값을 채우지 못해 남긴 잘못된 값/타입(`string`·`npt`·`undefined` 등)이나 빈 값을
// 탐지하는 것이 목적이다. 이런 후보를 타깃 모델로 저장하면 저장 자체는 되지만
// 이후 인프라(MCI) 생성 시 beetle이 이미지를 못 풀어 실패한다.
//
// 이상값으로 보는 집합(잠정): '' / 공백 / null / undefined(값) / 문자열 'string' /
// 'npt' / 'undefined' / (앞단에서 빈 값을 치환한) 'empty'.
// 주의: 'default'는 이상값이 아니다 — cb-spider에서 `string`은 에러지만 `default`는
// "기본값으로 동작"하도록 구현된 정당한 허용값이므로 완전한 값으로 간주한다.
//
// TODO(cb-spider): 어떤 값이 컬럼별로 "정당한 default"이고 어떤 게 "에러"인지는
// 컬럼마다 다를 수 있다. 정확한 집합은 cb-spider 소스 조사로 확정해야 하며,
// 아래 INVALID_FIELD_VALUES 는 현재 알려진 범위만 담은 잠정(provisional) 정의다.
const INVALID_FIELD_VALUES = new Set(['', 'string', 'npt', 'undefined', 'empty']);

function isInvalidFieldValue(value?: string | null): boolean {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim().toLowerCase();
  // 'default' 등 정당한 허용값은 여기서 걸리지 않는다(집합에 미포함).
  return INVALID_FIELD_VALUES.has(normalized);
}

// 후보(추천 인프라)의 nodeGroups 중 하나라도 스펙(specId) 또는 이미지(imageId)에
// 이상값이 들어 있으면 true. 저장을 막지는 않고 화면 경고(`!`)·마커·툴팁에만 쓴다.
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

// 이상값이 든 필수 컬럼의 화면 라벨(Spec/Image)을 돌려준다 — 툴팁 문구에 실제
// 빈 컬럼명을 넣기 위함. hasMissingRequiredFields 와 동일한 isInvalidFieldValue 기준 공유.
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
    // 입력 데이터 유효성 검사
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
            // specId가 "empty"인 경우도 포함
            if (!cur.specId || cur.specId.trim() === '') {
              return acc;
            }
            // specId가 "empty"면 그대로 사용
            if (cur.specId === 'empty') {
              return `${acc}empty / `;
            }
            // specId에 +가 있으면 마지막 부분을, 없으면 전체를 사용
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
            // imageId가 "empty"인 경우도 포함
            if (!cur.imageId || cur.imageId.trim() === '') {
              return acc;
            }
            // imageId가 "empty"면 그대로 사용
            if (cur.imageId === 'empty') {
              return `${acc}empty / `;
            }
            // imageId에 +가 있으면 마지막 부분을, 없으면 전체를 사용
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
