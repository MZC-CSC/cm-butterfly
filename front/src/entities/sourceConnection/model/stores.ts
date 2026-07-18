import { defineStore } from 'pinia';
import {
  ISourceConnection,
  ISourceConnectionInfo,
  ISourceConnectionResponse,
  ISourceInfraInfoResponse,
  ISourceSoftwareCollectResponse,
} from '@/entities/sourceConnection/model/types';
import { ref } from 'vue';
import { formatDate } from '@/shared/utils';

const NAMESPACE = 'SOURCECONNECTION';

export const useSourceConnectionStore = defineStore(NAMESPACE, () => {
  //key : sourceConnection Id , value : sourceConnection Info
  const connections = ref<Record<string, ISourceConnection>>({});
  // ref 여야 한다. 평범한 배열이면 이 값을 읽는 watchEffect 가 갱신에 반응하지
  // 않아, 임포트 결과가 바뀌어도 화면이 이전 내용을 그대로 보여준다.
  const editConnections = ref<any[]>([]);
  const withSourceConnection = ref(false);

  function setEditConnections(value: any) {
    return editConnections.value.push(value);
  }

  function setWithSourceConnection(value: boolean) {
    withSourceConnection.value = value;
  }

  function getConnectionById(connectId: string): ISourceConnection | null {
    return connections.value[connectId] || null;
  }

  function setConnections(res: ISourceConnectionResponse | null | undefined) {
    // A source group with no connections arrives without connection_info at all — that means none, not an error.
    (res?.connection_info ?? []).forEach(el => {
      setConnection(el);
    });
  }

  function setConnection(res: ISourceConnectionInfo) {
    const initAdditionalConnectionInfo = {
      collectSwStatus: '',
      collectSwDateTime: '',
      collectInfraStatus: '',
      collectInfraDateTime: '',
      infraData: '',
      type: '',
      viewSW: false,
      viewInfra: false,
      softwareData: '',
    };

    const existingConnection = connections.value[res.id];
    if (!existingConnection) {
      connections.value[res.id] = {
        ...res,
        ...initAdditionalConnectionInfo,
      };
    }
  }
  function mapSourceConnectionCollectInfraResponse(
    item: ISourceInfraInfoResponse,
  ) {
    const sourceConnection = getConnectionById(item.connection_id);
    if (sourceConnection) {
      sourceConnection.collectInfraStatus = item.status;
      sourceConnection.infraData = item.infra_data;
      sourceConnection.collectInfraDateTime = formatDate(item.saved_time);
    }
  }

  function mapSourceConnectionCollectSWResponse(
    item: ISourceSoftwareCollectResponse,
  ) {
    const sourceConnection = getConnectionById(item.connection_id);
    if (sourceConnection) {
      sourceConnection.collectSwStatus = item.status;
      sourceConnection.softwareData = item.software_data;
      sourceConnection.collectSwDateTime = formatDate(item.saved_time);
    }
  }

  function clear() {
    connections.value = {};
  }

  return {
    setConnection,
    connections,
    editConnections,
    setEditConnections,
    getConnectionById,
    setConnections,
    mapSourceConnectionCollectSWResponse,
    mapSourceConnectionCollectInfraResponse,
    clear,
    withSourceConnection,
    setWithSourceConnection,
  };
});
