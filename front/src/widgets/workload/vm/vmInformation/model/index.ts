import { ref, watch } from 'vue';
import { useDefinitionTableModel } from '@/shared/hooks/table/definitionTable/useDefinitionTableModel';
import { IMci, IVm, useMCIStore } from '@/entities/mci/model';
import { getCloudProvidersInVms } from '@/shared/hooks/vm';

export type vmDetailTableType =
  | 'serverId'
  | 'cspResourceId'
  | 'description'
  | 'serverStatus'
  | 'spec'
  | 'image'
  | 'publicIP'
  | 'publicDNS'
  | 'privateIP'
  | 'privateDNS'
  | 'vNet'
  | 'subnet'
  | 'sshKey'
  | 'securityGroups'
  | 'rootDisk'
  | 'region'
  | 'provider'
  | 'systemMessage'
  | 'loadStatus';

interface IProps {
  nsId: string;
  mciId: string;
  vmId: string;
}

export function useVmInformationModel() {
  const targetVmId = ref<string | null>();
  const mciStore = useMCIStore();
  const targetMci = ref<IMci | null>(null);
  const targetVm = ref<IVm | undefined>(undefined);

  const detailTableModel =
    useDefinitionTableModel<Record<vmDetailTableType, any>>();

  function initTable() {
    detailTableModel.initState();

    // Ordered the way a CSP console lists an instance: what it is, then where it sits on the
    // network, then how you get in, then storage and location. People arrive here already
    // used to that order, so the value they came for is where their eyes go first.
    //
    // Everything here comes from the list response that is already in hand - opening a node
    // costs no extra call. Security group *rules* are the one exception and are fetched only
    // when the reader expands them (SecurityGroupRules).
    detailTableModel.tableState.fields = [
      { label: 'Server ID', name: 'serverId' },
      { label: 'CSP Resource ID', name: 'cspResourceId' },
      { label: 'Description', name: 'description' },
      { label: 'Server Status', name: 'serverStatus' },
      { label: 'Spec', name: 'spec' },
      { label: 'Image', name: 'image' },
      { label: 'Public IP(IPv4)', name: 'publicIP' },
      { label: 'Public DNS(IPv4)', name: 'publicDNS' },
      { label: 'Private IP', name: 'privateIP' },
      { label: 'Private DNS', name: 'privateDNS' },
      { label: 'Virtual Network', name: 'vNet' },
      { label: 'Subnet', name: 'subnet' },
      { label: 'SSH Key', name: 'sshKey' },
      { label: 'Security Groups', name: 'securityGroups' },
      { label: 'Root Disk', name: 'rootDisk' },
      { label: 'Region / Zone', name: 'region' },
      { label: 'Provider', name: 'provider' },
      { label: 'Load Status', name: 'loadStatus' },
    ];
  }

  /**
   * Add the failure reason only when there is one.
   *
   * An empty row that is always there reads as noise, and the reader stops seeing it - which is
   * the opposite of what a failure message is for.
   */
  function applySystemMessageField(message: string | undefined) {
    const fields = detailTableModel.tableState.fields;
    const at = fields.findIndex(f => f.name === 'systemMessage');
    if (message) {
      if (at < 0)
        fields.push({ label: 'System Message', name: 'systemMessage' });
    } else if (at >= 0) {
      fields.splice(at, 1);
    }
  }

  function setMci(mciId: string) {
    targetMci.value = mciStore.getMciById(mciId);
  }

  function setVmId(_vmId: string | null) {
    targetVmId.value = _vmId;
  }

  /** "gp3 · 10 GiB" - one line is all this is worth. */
  function formatRootDisk(vm: IVm): string {
    const type = vm.rootDiskType || '';
    const size = vm.rootDiskSize ? `${vm.rootDiskSize} GiB` : '';
    return [type, size].filter(Boolean).join(' · ') || '--';
  }

  /**
   * "ap-northeast-2 / ap-northeast-2a".
   *
   * The field is read case-insensitively on purpose: cb-tumblebug returns `region`/`zone` in
   * lower case while the declared type has said `Region`/`Zone`. Reading only the declared
   * spelling produced an empty row with nothing to explain it.
   */
  function formatRegion(vm: IVm): string {
    const raw = (vm.region ?? {}) as Record<string, string>;
    const region = raw.region ?? raw.Region ?? '';
    const zone = raw.zone ?? raw.Zone ?? '';
    return [region, zone].filter(Boolean).join(' / ') || '--';
  }

  function organizeVmDefineTableData(vm: IVm) {
    const data: Record<vmDetailTableType, any> = {
      serverId: vm.id,
      // The identifier the CSP itself assigns (i-0a1b... on AWS). Our id does not exist in the
      // CSP console, so this is the only way to find the instance that was actually created -
      // to check it, match it against a bill, or remove a leftover by hand.
      cspResourceId: vm.cspResourceId || '--',
      description: vm.description,
      serverStatus: vm.status,
      // The CSP's own name for the type (t3a.large) says what the machine is; the platform id is
      // kept beside it so the value can be matched against other screens and APIs.
      spec: vm.cspSpecName
        ? `${vm.cspSpecName} (${vm.specId})`
        : vm.specId || '--',
      image: vm.cspImageName || vm.imageId || '--',
      publicIP: vm.publicIP,
      publicDNS: vm.publicDNS,
      privateIP: vm.privateIP,
      privateDNS: vm.privateDNS,
      // vNet and subnet are here because they are what a workflow collides on most often.
      vNet: vm.vNetId || '--',
      subnet: vm.subnetId || '--',
      sshKey: vm.sshKeyId || '--',
      securityGroups: vm.securityGroupIds ?? [],
      rootDisk: formatRootDisk(vm),
      // ★ The response spells these lowercase (region/zone). The declared type used to say
      //   Region/Zone, and reading it that way leaves the row silently blank.
      region: formatRegion(vm),
      provider: getCloudProvidersInVms([vm]),
      systemMessage: vm.systemMessage || '',
      loadStatus: vm.lastloadtestStateResponse?.executionStatus ?? '--',
    };

    applySystemMessageField(data.systemMessage);

    return data;
  }

  function setDefineTableData(vmId: string) {
    let data: Partial<Record<vmDetailTableType, any>> = {};

    targetVm.value = targetMci.value?.vm.find(vm => vm.id === vmId);
    try {
      if (targetVm.value) {
        data = organizeVmDefineTableData(targetVm.value);
      }
    } catch (e) {
      return data;
    }
    return data;
  }

  function remappingData() {
    if (targetVmId.value) {
      detailTableModel.tableState.loading = true;
      detailTableModel.tableState.data = setDefineTableData(targetVmId.value);
      detailTableModel.tableState.loading = false;
    }
  }

  // Map the load-test run status (cm-ant) to user-friendly labels — running/collecting/done/failed at a glance.
  const LOADTEST_STATUS_LABEL: Record<string, string> = {
    on_processing: 'Running',
    on_fetching: 'Collecting results',
    successed: 'Completed',
    test_failed: 'Failed',
  };

  function mappdingLoadConfigStatus(executionStatus: string) {
    if (targetVmId.value) {
      detailTableModel.tableState.loading = true;
      detailTableModel.tableState.data = setDefineTableData(targetVmId.value);
      detailTableModel.tableState.loading = false;
      detailTableModel.tableState.data.loadStatus =
        LOADTEST_STATUS_LABEL[executionStatus] ?? executionStatus;
    }
  }

  watch(targetVmId, nv => {
    detailTableModel.tableState.loading = true;

    if (nv) {
      detailTableModel.tableState.data = setDefineTableData(nv);
    } else {
      initTable();
    }
    detailTableModel.tableState.loading = false;
  });

  return {
    initTable,
    setVmId,
    detailTableModel,
    targetVm,
    setMci,
    mciStore,
    remappingData,
    mappdingLoadConfigStatus,
  };
}
