import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import { IMci, McisTableType, useMCIStore } from '@/entities/mci/model';
import { useGetMciInfo, useGetMciList } from '@/entities/mci/api';
import { getCloudProvidersInVms } from '@/shared/hooks/vm';
import { showErrorMessage, toErrorMessage } from '@/shared/utils';
import { AxiosResponse } from 'axios';
import { IAxiosResponse } from '@/shared/libs';

interface IProps {
  nsId: string;
}

export function useMciListModel(props: IProps) {
  const mciTableModel =
    useToolboxTableModel<Partial<Record<McisTableType, any>>>();

  const mciStore = useMCIStore();
  const { mcis } = storeToRefs(mciStore);

  // tb-0.12.9 update: the MCI list goes through cm-beetle ListInfra. Only "" (all) or "id" are
  // valid options; the old tumblebug 'normal' is rejected (400 "invalid option") → '' (fetch all).
  const resMciList = useGetMciList(props.nsId, '');
  const loading = ref<boolean>(true);

  function initToolBoxTableModel() {
    mciTableModel.tableState.fields = [
      { name: 'name', label: 'Name' },
      { name: 'id', label: 'ID' },
      { name: 'status', label: 'Status' },
      { name: 'provider', label: 'Provider' },
      { name: 'countTotal', label: 'Total Servers' },
      { name: 'countRunning', label: 'Running' },
      { name: 'countSuspended', label: 'Suspended' },
      { name: 'countTerminated', label: 'Terminated' },
    ];

    mciTableModel.querySearchState.keyItemSet = [
      {
        title: 'columns',
        items: [
          { name: 'id', label: 'Id' },
          {
            name: 'name',
            label: 'Name',
          },
        ],
      },
    ];
  }

  function organizeResponseMciList(mciRes: IMci) {
    // An infra with no nodes omits node/statusCount entirely. Absent means zero, not broken,
    // so render it as empty rather than throwing.
    const statusCount = mciRes.statusCount ?? ({} as IMci['statusCount']);
    const organizedDatum: Partial<Record<McisTableType | 'originalData', any>> =
      {
        name: mciRes.name,
        description: mciRes.description,
        id: mciRes.id,
        // Key for delete tracking. id is effectively the name, so deleting and recreating with
        // the same name collides; uid is needed to point to a row uniquely.
        uid: mciRes.uid,
        status: mciRes.status,
        provider: getCloudProvidersInVms(mciRes.vm),
        countTotal: statusCount.countTotal ?? '',
        countRunning: statusCount.countRunning ?? '',
        countSuspended: statusCount.countSuspended ?? '',
        countTerminated: statusCount.countTerminated ?? '',
        originalData: mciRes,
      };

    return organizedDatum;
  }

  function fetchMciList() {
    loading.value = true;
    resMciList
      .execute()
      .then(res => {
        if (res.data.responseData) {
          // tb-0.12.9 update: the MCI list now goes through cm-beetle ListInfra, so the response
          // arrives in the cm-beetle standard wrapper (responseData.data.infra[]). The old direct
          // tumblebug response (responseData.infra) is also allowed as a fallback to read both
          // safely. (mci→infra key change + data wrapper applied)
          const infraList = res.data.responseData.data?.infra ?? [];
          mciStore.setMcis(infraList);

          const PromiseArr: any = [];
          infraList.forEach(mci => {
            PromiseArr.push(fetchMciById(mci.id)());
          });

          Promise.all<Promise<AxiosResponse<IAxiosResponse<any>>>>(PromiseArr)
            .then(res => {
              res.forEach(el => {
                // Skip infras whose detail comes back empty (just deleted, or not ready yet).
                const detail = el?.data?.responseData;
                if (detail) mciStore.setMci(detail);
              });
            })
            .catch(e => {
              showErrorMessage(
                'Error',
                toErrorMessage(e, 'Failed to load infrastructure details.'),
              );
            });
        } else {
          // Having no infrastructure at all is not an error — leave the list empty.
          mciStore.setMcis([]);
        }
      })
      .catch(e => {
        showErrorMessage(
          'Error',
          toErrorMessage(e, 'Failed to load the infrastructure list.'),
        );
      })
      .finally(() => {
        loading.value = false;
      });
  }

  function fetchMciById(mciId: string) {
    const resGetMciById = useGetMciInfo({ nsId: props.nsId, infraId: mciId });

    return resGetMciById.execute;
  }

  watch(
    mcis,
    nv => {
      mciTableModel.tableState.items = nv.map(value =>
        organizeResponseMciList(value),
      );
      mciTableModel.handleChange(null);
    },
    { deep: true },
  );

  return {
    mciTableModel,
    initToolBoxTableModel,
    mciStore,
    fetchMciById,
    fetchMciList,
    resMciList,
    loading,
  };
}
