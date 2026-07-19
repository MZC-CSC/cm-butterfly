import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  ILastloadtestStateResponse,
  IMci,
  IVm,
} from '@/entities/mci/model/types';

const NAMESPACE = 'MCI';

export const useMCIStore = defineStore(NAMESPACE, () => {
  const mcis = ref<IMci[]>([]);

  // tb-0.12.9 경계 어댑터: cb-tumblebug 응답이 vm→node로 변경됨(infra[].node[]).
  // 내부 코드는 vm 명칭을 광범위하게 쓰므로 경계에서 node→vm 어댑트(내부 전면 rename은 tech-debt).
  function adaptNode(_mci: IMci): IMci {
    if (_mci && !_mci.vm && _mci.node) _mci.vm = _mci.node;
    return _mci;
  }

  function setMcis(_mcis: IMci[]) {
    mcis.value = (_mcis ?? []).map(adaptNode);
  }

  function getMciById(mciId: string) {
    return (
      mcis.value.find((mci: IMci) => {
        return mci.id === mciId;
      }) || null
    );
  }

  function setMci(_mci: IMci) {
    if (!_mci) return;
    adaptNode(_mci);
    const targetMci = mcis.value.find(mci => mci.uid === _mci.uid);
    if (targetMci) {
      Object.assign(targetMci, _mci);
    }
  }

  function setVmsInfo(mciID: string, vm: Array<IVm>) {
    const mci = getMciById(mciID);
    if (mci) {
      mci.vm = vm;
    }
  }

  function setVmInfo(mciID: string, vm: IVm) {
    const mci = getMciById(mciID);
    const targetVm = mci?.vm?.find(_vm => _vm.uid === vm.uid);
    if (targetVm) {
      Object.assign(targetVm, vm);
    }
  }

  /**
   * 노드의 마지막 부하 테스트 상태를 담는다.
   *
   * `undefined` 를 넣으면 *보여줄 결과가 없다*는 뜻이다 — 조회된 실행이 다른 VM 것이라
   * 화면에 내보내면 안 되는 경우에 쓴다(BAR-1547).
   */
  function assignLastLoadTestStateToVm(
    mciID: string,
    vmID: string,
    response: ILastloadtestStateResponse | undefined,
  ) {
    const mci = getMciById(mciID);
    if (mci) {
      const vm = mci.vm.find(_vm => _vm.id === vmID);
      if (vm) {
        vm.lastloadtestStateResponse = response;
      }
    }
  }
  return {
    mcis,
    setMci,
    setMcis,
    getMciById,
    setVmsInfo,
    setVmInfo,
    assignLastLoadTestStateToVm,
  };
});
