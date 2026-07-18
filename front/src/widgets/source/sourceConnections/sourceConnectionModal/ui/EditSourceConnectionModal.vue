<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
import { CreateForm } from '@/widgets/layout';
import { i18n } from '@/app/i18n';
import SourceConnectionForm from '@/features/sourceServices/sourceConnection/ui/SourceConnectionForm.vue';
import { ref, watchEffect, computed } from 'vue';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';
import { useCreateConnectionInfo } from '@/entities/sourceConnection/api';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useUpdateConnectionInfo } from '@/entities/sourceConnection/api';

const sourceConnectionStore = useSourceConnectionStore();
const updateConnectionInfo = useUpdateConnectionInfo(null, null, null);

interface iProps {
  selectedConnectionId: any;
  sourceServiceId: string;
  multiSelectedConnectionIds: string[];
}

const props = defineProps<iProps>();

const createConnectionInfo = useCreateConnectionInfo(
  props.sourceServiceId,
  sourceConnectionStore.editConnections[0],
);

const isDisabled = ref<boolean>(false);
const validStates = ref<Map<number | string, boolean>>(new Map());

const handleValidChange = (id: number | string, valid: boolean) => {
  validStates.value.set(id, valid);
  // 모든 connection이 유효한지 확인
  const allValid = Array.from(validStates.value.values()).every(v => v);
  isDisabled.value =
    allValid &&
    validStates.value.size === uniqueSourceConnectionsByIds.value.length;
};

const connectionInfoData = ref<any[]>([]);
const emit = defineEmits([
  'update:is-connection-modal-opened',
  'update:is-service-modal-opened',
  'update:trigger',
]);

const handleConnectionModal = (value: boolean) => {
  !value ? emit('update:is-connection-modal-opened', value) : null;
};

const handleCancel = () => {
  emit('update:is-connection-modal-opened', false);
  emit('update:is-service-modal-opened', false);
};

const saveLoading = ref<boolean>(false);

// Add 모드인지 Edit 모드인지 확인
const isAddMode = computed(
  () =>
    props.multiSelectedConnectionIds.length === 0 &&
    props.selectedConnectionId.length === 0,
);

let connectionIdCounter = 0;

const addSourceConnection = () => {
  const newId = connectionIdCounter++;
  uniqueSourceConnectionsByIds.value.push({
    _id: newId,
    name: '',
    ip_address: '',
    ssh_port: 22,
    user: '',
    password: '',
    private_key: '',
  });
  validStates.value.set(newId, false);
};

const deleteSourceConnection = (id: number | string) => {
  const index = uniqueSourceConnectionsByIds.value.findIndex(
    (conn: any) => (conn._id || conn.id) === id,
  );
  if (index !== -1) {
    uniqueSourceConnectionsByIds.value.splice(index, 1);
    validStates.value.delete(id);
    // 삭제 후 validation 상태 재계산
    const allValid = Array.from(validStates.value.values()).every(v => v);
    isDisabled.value =
      allValid &&
      validStates.value.size === uniqueSourceConnectionsByIds.value.length;
  }
};

// EditSourceConnectionInfo 로직 통합
const sourceConnectionsByIds = ref<any[]>([]);
const uniqueSourceConnectionsByIds = ref<any[]>([]);
let isInitialized = false;

// 이미 등록된 연결은 입력란을 모두 비운 채로 연다. 기존 값은 placeholder 로만
// 보여주고, 사용자가 실제로 입력한 항목만 검증·전송한다. 특히 인증 3항목은
// 서버가 암호화해 내려주므로 그 값을 입력란에 되돌려 넣으면 저장된 평문을
// 암호문으로 덮어써 연결이 깨진다.
const toEditableRow = (connId: string) => {
  const stored = sourceConnectionStore.getConnectionById(connId) as any;
  return {
    _id: connectionIdCounter++,
    id: stored?.id,
    _original: stored,
    name: '',
    description: '',
    ip_address: '',
    ssh_port: '',
    user: '',
    password: '',
    private_key: '',
  };
};

// 선택된 Connection ID에 따라 데이터 로드
watchEffect(() => {
  if (props.multiSelectedConnectionIds.length === 1) {
    sourceConnectionsByIds.value = [
      toEditableRow(props.multiSelectedConnectionIds[0]),
    ];
  } else if (props.multiSelectedConnectionIds.length > 1) {
    sourceConnectionsByIds.value =
      props.multiSelectedConnectionIds.map(toEditableRow);
  } else if (
    props.multiSelectedConnectionIds.length === 0 &&
    props.selectedConnectionId.length === 0
  ) {
    // 새 Connection 추가인 경우
    sourceConnectionsByIds.value = [
      {
        _id: connectionIdCounter++,
        name: '',
        ip_address: '',
        ssh_port: 22,
        user: '',
        password: '',
        private_key: '',
      },
    ];
  }
});

// 중복 제거
watchEffect(() => {
  uniqueSourceConnectionsByIds.value = Array.from(
    new Map(
      sourceConnectionsByIds.value.map((item, index) => [
        item.id || `new-${index}`,
        item,
      ]),
    ).values(),
  );
});

// connectionInfoData 업데이트 및 validStates 초기화 (한 번만)
watchEffect(
  () => {
    if (uniqueSourceConnectionsByIds.value.length > 0) {
      // connectionInfoData를 uniqueSourceConnectionsByIds와 동일하게 유지
      connectionInfoData.value = uniqueSourceConnectionsByIds.value;

      // validStates가 아직 초기화되지 않았거나 크기가 다를 때만 초기화
      if (
        !isInitialized ||
        validStates.value.size !== uniqueSourceConnectionsByIds.value.length
      ) {
        validStates.value.clear();
        uniqueSourceConnectionsByIds.value.forEach(conn => {
          const connId = conn._id || conn.id;
          if (!validStates.value.has(connId)) {
            validStates.value.set(connId, false);
          }
        });
        isInitialized = true;
      }
    }
  },
  { flush: 'sync' },
);

// 입력란이 비어 있으면 "그대로 두겠다"는 뜻이므로 요청에 담지 않는다.
//
// 이름은 뺀다. 연계 시스템이 커넥션 이름에 전역 유니크 제약을 걸어 두어
// (`connection_infos.name`, 대소문자 무시) 다른 소스 그룹의 커넥션과도 부딪히는데,
// 이 화면은 여러 건을 한 번에 저장하므로 중간에 실패하면 어디까지 반영됐는지
// 알기 어렵다. 이름은 목록·상세의 개별 수정에서 한 건씩 처리한다.
const UPDATABLE_FIELDS = [
  'description',
  'ip_address',
  'ssh_port',
  'user',
  'password',
  'private_key',
] as const;

const buildUpdateRequest = (info: any) => {
  const request: Record<string, unknown> = {};
  UPDATABLE_FIELDS.forEach(field => {
    const value = info[field];
    if (value === undefined || value === null) return;
    const trimmed = String(value).trim();
    if (trimmed === '') return;
    // 입력했지만 기존 값과 같으면 보낼 이유가 없다.
    const current = info._original?.[field];
    if (current !== undefined && String(current) === trimmed) return;
    request[field] = trimmed;
  });
  return request;
};

// 이미 등록된 연결은 이름을 잠근다. 이름 충돌은 저장 시점에야 서버가 알려주는데,
// 이 화면은 여러 건을 순차 저장하므로 한 건이 실패해도 나머지가 이미 반영된
// 뒤일 수 있다. 이름 변경은 목록·상세의 개별 수정에서 한 건씩 처리한다.
const getReadonlyFields = (connection: any) => {
  // 새로 추가하는 연결은 이름을 입력해야 하므로 잠그지 않는다.
  if (!connection.id) return [] as string[];
  return ['name'];
};

const handleAddSourceConnection = async () => {
  saveLoading.value = true;

  try {
    // connection들을 기존(id 있음)과 신규(id 없음)로 분리
    const existingConnections = connectionInfoData.value.filter(
      info => info.id,
    );
    const newConnections = connectionInfoData.value.filter(info => !info.id);

    // 기존 connection 업데이트 — 사용자가 실제로 입력한 항목만 담는다.
    // 연계 시스템은 전달된 항목만 반영하고 나머지는 기존 값을 유지하므로,
    // 빈 값을 함께 보낼 필요가 없다.
    for (const info of existingConnections) {
      const request = buildUpdateRequest(info);
      // 바꾼 것이 없으면 요청을 보내지 않는다.
      if (Object.keys(request).length === 0) continue;

      await updateConnectionInfo.execute({
        pathParams: {
          sgId: props.sourceServiceId,
          connId: info.id,
        },
        request,
      });
    }

    // 새 connection 생성
    for (const info of newConnections) {
      await createConnectionInfo.execute({
        pathParams: {
          sgId: props.sourceServiceId,
        },
        request: {
          description: info.description,
          ip_address: info.ip_address,
          name: info.name,
          password: info.password,
          private_key: info.private_key,
          ssh_port: info.ssh_port,
          user: info.user,
        },
      });
    }

    saveLoading.value = false;
    showSuccessMessage('success', 'Connection(s) Saved Successfully');
    emit('update:trigger');
    emit('update:is-connection-modal-opened', false);
    emit('update:is-service-modal-opened', false);
  } catch (error) {
    saveLoading.value = false;
    if (
      (error as any).errorMsg?.value ===
      'constraint failed: UNIQUE constraint failed: connection_infos.name (2067)'
    ) {
      // 이름 유니크 제약은 소스 그룹 단위가 아니라 전체 범위이고 대소문자를
      // 구분하지 않는다. 지금 보고 있는 그룹에 같은 이름이 없어도 다른 그룹의
      // 연결과 부딪힐 수 있어, 어디서 충돌했는지 알 수 없는 채로 막힌다.
      showErrorMessage(
        'failed',
        'Connection name already in use. Names must be unique across all source groups, ignoring case.',
      );
    } else {
      showErrorMessage('failed', 'Connection Save Failed');
    }
  }
};
</script>

<template>
  <div class="page-modal-layout">
    <!-- :badge-title="sourceServiceId" -->
    <create-form
      class="modal-layer"
      title="Source Connection"
      subtitle="Add or edit a source connection."
      add-button-text="Add Source Connection"
      :need-widget-layout="true"
      :loading="saveLoading"
      @addSourceConnection="addSourceConnection"
      @update:is-connection-modal-opened="handleConnectionModal"
      @update:modal-state="
        () => {
          emit('update:is-service-modal-opened', false);
          emit('update:is-connection-modal-opened', false);
        }
      "
    >
      <template #add-info>
        <div
          v-for="(info, i) in uniqueSourceConnectionsByIds"
          :key="info._id || info.id || i"
        >
          <source-connection-form
            :source-connection="uniqueSourceConnectionsByIds[i]"
            mode="edit"
            :existing="info._original ?? null"
            :show-delete-button="uniqueSourceConnectionsByIds.length > 1"
            :readonly="getReadonlyFields(info)"
            @delete="deleteSourceConnection(info._id || info.id)"
            @update:valid="
              valid => handleValidChange(info._id || info.id, valid)
            "
          />
        </div>
      </template>
      <template #buttons>
        <p-button
          style-type="tertiary"
          :disabled="saveLoading"
          @click="handleCancel"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button
          :disabled="!isDisabled"
          :loading="saveLoading"
          @click="handleAddSourceConnection"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.SAVE') }}
        </p-button>
      </template>
    </create-form>
  </div>
</template>
