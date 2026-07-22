import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import {
  IEsimateCostSpecResponse,
  IRecommendModelResponse,
} from '@/entities/recommendedModel/model/types';
import { ref, watch } from 'vue';
import { useSourceModelStore } from '@/entities';
import { useAuthStore } from '@/shared/libs/store/auth';
import {
  IProviderResponse,
  IRegionOfProviderResponse,
} from '@/entities/provider/model/types';
import {
  useAxiosPost,
  IAxiosResponse,
  RequestBodyWrapper,
} from '@/shared/libs';

interface ISelectMenu {
  name: string;
  label: string;
  type: string;
}

interface IExtendRecommendModelResponse extends IRecommendModelResponse {
  estimateResponse?: IEsimateCostSpecResponse;
}

// Software Migration List API response type
interface ISoftwareMigrationListResponse {
  // Needs to be defined to match the API response structure
  [key: string]: any;
}

// Software-specific table type
type SoftwareMigrationTableType = 
  | 'migrationType'
  | 'description'
  | 'status'
  | 'createdAt'
  | 'originalData';

export function useRecommendedSoftwareModel() {
  const tableModel =
    useToolboxTableModel<
      Partial<Record<SoftwareMigrationTableType, any>>
    >();
  const sourceModelStore = useSourceModelStore();
  const targetRecommendModel = ref<IExtendRecommendModelResponse | null>(null);
  const userStore = useAuthStore();
  
  // Call the Software Migration List API
  const getSoftwareMigrationList = useAxiosPost<
    IAxiosResponse<ISoftwareMigrationListResponse>,
    RequestBodyWrapper<{ sourceSoftwareModel: any }>
  >('cm-grasshopper/Get-Migration-List', {
    request: {
      sourceSoftwareModel: null
    }
  });

  function initToolBoxTableModel() {
    tableModel.initState();
    // Switch to Software-specific table columns
    tableModel.tableState.fields = [
      { name: 'migrationType', label: 'Migration Type' },
      { name: 'description', label: 'Description' },
      { name: 'status', label: 'Status' },
      { name: 'createdAt', label: 'Created At' },
    ];

    tableModel.querySearchState.keyItemSet = [
      {
        title: 'columns',
        items: [
          { name: 'migrationType', label: 'Migration Type' },
          { name: 'description', label: 'Description' },
          { name: 'status', label: 'Status' },
          { name: 'createdAt', label: 'Created At' },
        ],
      },
    ];

    tableModel.tableState.selectIndex = [0];
  }

  // Fetch the Software Migration List
  async function getSoftwareMigrationListData(sourceSoftwareModel: any) {
    const requestWrapper: RequestBodyWrapper<{ sourceSoftwareModel: any }> = {
      request: {
        sourceSoftwareModel: sourceSoftwareModel
      }
    };
    
    const response = await getSoftwareMigrationList.execute(requestWrapper);
    
    if (response.data.responseData) {
      // Convert the response data into table format
      const migrationData = response.data.responseData;
      // Needs to be adjusted to match the actual API response structure
      const tableData = {
        migrationType: migrationData.migrationType || 'N/A',
        description: migrationData.description || 'N/A',
        status: migrationData.status || 'N/A',
        createdAt: migrationData.createdAt || 'N/A',
        originalData: migrationData
      };
      
      tableModel.tableState.items = [tableData];
    }
    
    return response;
  }

  // Build the provider select menu (kept from the existing function)
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

  // Build the region select menu (kept from the existing function)
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

  // The existing functions are either adapted for Software use or removed
  function setTargetRecommendModel(
    _targetRecommendModel: IExtendRecommendModelResponse,
  ) {
    targetRecommendModel.value = _targetRecommendModel;
  }

  function setTableStateItem() {
    // Set up the Software-specific table state
    if (targetRecommendModel.value) {
      // Adjust to match the Software data
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
    setTargetRecommendModel,
    getSoftwareMigrationListData, // newly added function
    getSoftwareMigrationList,     // added API function
    generateProviderSelectMenu,    // kept existing function
    generateRegionSelectMenu,      // kept existing function
  };
}
