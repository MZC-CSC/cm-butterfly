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
  // Must be a ref. With a plain array, the watchEffect reading this value would
  // not react to updates, so the view would keep showing the old content even
  // after the import result changes.
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

  // Store the structured (get-infra-info / get-software-info) JSON for a
  // connection so the viewer shows it as a JSON tree instead of the raw string.
  function setConnectionInfraModel(connId: string, data: any) {
    const sourceConnection = getConnectionById(connId);
    if (sourceConnection) {
      sourceConnection.infraData = data;
    }
  }

  function setConnectionSoftwareModel(connId: string, data: any) {
    const sourceConnection = getConnectionById(connId);
    if (sourceConnection) {
      sourceConnection.softwareData = data;
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
    setConnectionInfraModel,
    setConnectionSoftwareModel,
    clear,
    withSourceConnection,
    setWithSourceConnection,
  };
});
