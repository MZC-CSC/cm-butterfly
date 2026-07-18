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

  // tb-0.12.9 현행화: MCI 목록은 cm-beetle ListInfra 경유. option은 ""(전체) 또는 "id"만 유효하며,
  // 구 tumblebug의 'normal'은 거부(400 "invalid option")된다 → ''(전체 조회).
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
        // 삭제 추적의 키. id 는 곧 이름이라 지우고 같은 이름으로 다시 만들면 겹치므로,
        // 행을 고유하게 가리키려면 uid 가 필요하다(BAR-1531).
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
          // tb-0.12.9 현행화: MCI 목록이 cm-beetle ListInfra 경유로 바뀌며 응답이 cm-beetle 표준
          // 래퍼(responseData.data.infra[])로 온다. 구 tumblebug 직접 응답(responseData.infra)도
          // fallback으로 허용해 양쪽을 안전하게 읽는다. (mci→infra 키 전환 + data 래퍼 반영)
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
