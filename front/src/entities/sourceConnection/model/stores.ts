import { defineStore } from 'pinia';
import {
  ISourceConnection,
  ISourceConnectionResponse,
} from '@/entities/sourceConnection/model/types.ts';
import { ref } from 'vue';

const NAMESPACE = 'SOURCECONNECTION';

export const useSourceConnectionStore = defineStore(NAMESPACE, () => {
  const connections = ref<ISourceConnection[]>([]);

  function getConnectionById(connectId: string) {
    return (
      connections.value.find((connection: ISourceConnection) => {
        return connection.id === connectId;
      }) || null
    );
  }

  function setConnections(res: ISourceConnectionResponse[]) {
    const initAdditionalConnectionInfo = {
      collectStatus: '',
      collectDateTime: '',
      viewSW: '',
      collectInfra: '',
      collectInfraDateTime: '',
      viewInfra: '',
      type: '',
    };

    connections.value = res.map(el => ({
      ...el,
      ...initAdditionalConnectionInfo,
    }));
  }

  return {
    connections,
    getConnectionById,
    setConnections,
  };
});
