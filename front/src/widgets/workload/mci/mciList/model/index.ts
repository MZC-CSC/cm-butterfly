import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useToolboxTableModel } from '@/shared/hooks/table/toolboxTable/useToolboxTableModel';
import { IMci, McisTableType, useMCIStore } from '@/entities/mci/model';
import { useGetMciList } from '@/entities/mci/api';
import { getCloudProvidersInVms } from '@/shared/hooks/vm';
import { showErrorMessage, toErrorMessage } from '@/shared/utils';

interface IProps {
  nsId: string;
}

/**
 * Whether the lookup was turned away because too many arrived at once.
 *
 * cb-tumblebug caps the infra lookup at two in-flight requests and answers 429 beyond that.
 * cm-beetle relays that as a 500 whose message still carries the original status, so the status
 * code alone never says "rate limited" — the text is the only signal. Worth telling apart because
 * the fix is simply to try again, which a generic failure message gives no hint of.
 */
function isRateLimited(e: any): boolean {
  if (e?.error?.value?.response?.status === 429) return true;
  const msg = toErrorMessage(e, '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('status: 429');
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

          // The list is all the screen needs — do NOT follow up with a per-infra detail lookup.
          //
          // cb-tumblebug builds the list by walking the infra ids and calling the very same
          // function the single lookup uses, so every field the detail would return is already
          // here. Asking again once per infra therefore adds nothing, and it breaks the screen:
          // the lookup allows only two in-flight requests, so from the third infra on the extra
          // requests come back 429 and the whole list fails with a message about details.
          mciStore.setMcis(infraList);
        } else {
          // Having no infrastructure at all is not an error — leave the list empty.
          mciStore.setMcis([]);
        }
      })
      .catch(e => {
        // The lookup is shared: the rate limit is counted per caller, and to cb-tumblebug the
        // caller is always cm-beetle — so other users and other tabs draw from the same budget.
        // Being turned away is not a broken list, and saying so keeps the user from hunting a
        // problem that is not there.
        showErrorMessage(
          'Error',
          isRateLimited(e)
            ? 'The infrastructure list could not be loaded because too many lookups arrived at once. Please try again in a moment.'
            : toErrorMessage(e, 'Failed to load the infrastructure list.'),
        );
      })
      .finally(() => {
        loading.value = false;
      });
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
    fetchMciList,
    resMciList,
    loading,
  };
}
