<script setup lang="ts">
import {
  PFieldGroup,
  PTextInput,
  PTextarea,
  PPaneLayout,
  PI,
} from '@cloudforet-test/mirinae';
import { computed, reactive, watchEffect } from 'vue';
// 임포트 경로와 같은 규칙을 쓰도록 공용 모듈에서 가져온다.
import {
  isFilled,
  isIpValid,
  isPortValid,
  CREDENTIAL_HINT,
} from '@/shared/utils/connectionValidation';

interface ConnectionInfo {
  id?: string;
  name: string;
  description?: string;
  ip_address: string;
  user: string;
  private_key?: string;
  ssh_port: string | number;
  password?: string;
}

interface Props {
  sourceConnection?: ConnectionInfo;
  mode?: 'create' | 'edit';
  showDeleteButton?: boolean;
  readonly?: string[]; // readonly로 만들 필드 목록
  // 이미 등록된 연결을 수정할 때, 서버에 저장된 값. 입력란을 채우지 않고
  // placeholder 로만 보여주기 위한 것이라 절대 payload 에 쓰지 않는다.
  existing?: Partial<ConnectionInfo> | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  showDeleteButton: false,
  readonly: () => [],
  existing: null,
  sourceConnection: () => ({
    name: '',
    description: '',
    ip_address: '',
    user: '',
    private_key: '',
    ssh_port: '22',
    password: '',
  }),
});

const emit = defineEmits(['delete', 'update:valid']);

// 이미 등록된 연결의 수정인지. 이 경우 입력란은 비어서 열리고, 사용자가 실제로
// 입력한 항목만 검증·전송한다. 입력하지 않은 항목은 기존 값이 그대로 유지된다.
const isExistingEdit = computed(
  () => props.mode === 'edit' && !!props.existing,
);

const KEEP_HINT = 'Leave blank to keep the current value';

const placeholderFor = (field: keyof ConnectionInfo, fallback: string) => {
  if (!isExistingEdit.value) return fallback;
  const current = props.existing?.[field];
  // 인증 항목은 서버가 암호화해 내려주므로 보여줄 평문이 없다.
  return current !== undefined && current !== null && current !== ''
    ? String(current)
    : KEEP_HINT;
};

const invalidState = reactive({
  isIpAddressValid: false,
  isPortValid: false,
});

watchEffect(() => {
  const conn = props.sourceConnection;
  if (!conn) return;

  const ipFilled = isFilled(conn.ip_address);
  const portFilled = isFilled(conn.ssh_port);

  invalidState.isIpAddressValid = ipFilled && isIpValid(conn.ip_address);
  invalidState.isPortValid = portFilled && isPortValid(conn.ssh_port);

  let isValid: boolean;

  if (isExistingEdit.value) {
    // 사용자가 입력한 항목만 본다. 아무것도 입력하지 않았으면 바꿀 것이 없으므로
    // 유효한 상태이고, 저장 시 이 행은 요청 자체를 보내지 않는다.
    isValid =
      (!ipFilled || invalidState.isIpAddressValid) &&
      (!portFilled || invalidState.isPortValid);
  } else {
    // 신규 등록은 기존 규칙 그대로 — 아이디 필수 + 비밀번호나 개인키 중 하나.
    isValid = Boolean(
      isFilled(conn.name) &&
        invalidState.isIpAddressValid &&
        invalidState.isPortValid &&
        isFilled(conn.user) &&
        (isFilled(conn.password) || isFilled(conn.private_key)),
    );
  }

  emit('update:valid', isValid);
});

// 입력하지 않은 항목까지 빨갛게 보이지 않도록, 값이 있을 때만 오류로 표시한다.
const showIpError = computed(
  () =>
    (isExistingEdit.value
      ? isFilled(props.sourceConnection?.ip_address)
      : true) && !invalidState.isIpAddressValid,
);

const showPortError = computed(
  () =>
    (isExistingEdit.value
      ? isFilled(props.sourceConnection?.ssh_port)
      : true) && !invalidState.isPortValid,
);

const showNameError = computed(
  () => !isExistingEdit.value && !isFilled(props.sourceConnection?.name),
);

const showUserError = computed(
  () => !isExistingEdit.value && !isFilled(props.sourceConnection?.user),
);

// 신규 등록에서 인증 조합이 성립하지 않는 경우. 아이디 없이 비밀번호만,
// 또는 아이디 없이 개인키만은 서버가 거부한다.
const showCredentialError = computed(
  () =>
    !isExistingEdit.value &&
    !(
      isFilled(props.sourceConnection?.password) ||
      isFilled(props.sourceConnection?.private_key)
    ),
);

const isFieldReadonly = (fieldName: string) => {
  return props.readonly.includes(fieldName);
};

const handleDelete = () => {
  emit('delete');
};
</script>

<template>
  <div class="source-connection-layout">
    <p-pane-layout class="source-connection-info">
      <div class="left-layer">
        <p-field-group
          label="Source Connection Name"
          :invalid="showNameError"
          :required="!isExistingEdit"
        >
          <p-text-input
            v-model="sourceConnection.name"
            data-testid="source-connection-name"
            :placeholder="placeholderFor('name', 'Source Connection Name')"
            :invalid="showNameError"
            :disabled="isFieldReadonly('name')"
          />
        </p-field-group>
        <p-field-group label="Description">
          <p-textarea
            v-model="sourceConnection.description"
            data-testid="source-connection-description"
            :placeholder="placeholderFor('description', '')"
            :disabled="isFieldReadonly('description')"
          />
        </p-field-group>
      </div>
      <div class="right-layer">
        <p-field-group
          label="IP Address"
          :invalid="showIpError"
          :required="!isExistingEdit"
        >
          <p-text-input
            v-model="sourceConnection.ip_address"
            data-testid="source-connection-ip"
            :invalid="showIpError"
            :placeholder="placeholderFor('ip_address', '###.###.###.###')"
            :disabled="isFieldReadonly('ip_address')"
          />
        </p-field-group>
        <p-field-group
          label="Port (for SSH)"
          :invalid="showPortError"
          :required="!isExistingEdit"
        >
          <p-text-input
            v-model="sourceConnection.ssh_port"
            data-testid="source-connection-ssh-port"
            :placeholder="placeholderFor('ssh_port', '1~65535')"
            :invalid="showPortError"
            :disabled="isFieldReadonly('ssh_port')"
          />
        </p-field-group>
        <p-field-group
          label="User"
          :invalid="showUserError"
          :required="!isExistingEdit"
        >
          <p-text-input
            v-model="sourceConnection.user"
            data-testid="source-connection-user"
            :placeholder="isExistingEdit ? KEEP_HINT : 'User ID'"
            :invalid="showUserError"
            :disabled="isFieldReadonly('user')"
          />
        </p-field-group>
        <p-field-group
          label="Password"
          :invalid="showCredentialError"
          :invalid-text="showCredentialError ? CREDENTIAL_HINT : ''"
        >
          <p-text-input
            v-model="sourceConnection.password"
            data-testid="source-connection-password"
            :placeholder="isExistingEdit ? KEEP_HINT : 'Password'"
            :invalid="showCredentialError"
            :disabled="isFieldReadonly('password')"
          />
        </p-field-group>
        <p-field-group
          class="private-key"
          label="Private Key"
          :invalid="showCredentialError"
        >
          <p-textarea
            v-model="sourceConnection.private_key"
            data-testid="source-connection-private-key"
            :placeholder="isExistingEdit ? KEEP_HINT : ''"
            :rows="5"
            :disabled="isFieldReadonly('private_key')"
          />
        </p-field-group>
      </div>
    </p-pane-layout>
    <button
      v-if="showDeleteButton"
      data-testid="source-connection-remove-row"
      @click="handleDelete"
    >
      <p-i name="ic_close" />
    </button>
  </div>
</template>

<style scoped lang="postcss">
.source-connection-layout {
  @apply flex mb-[1rem];
}
.source-connection-info {
  @apply flex p-[1.5rem] border-[0.0625rem] border-[#DDDDDF];
  width: 100%;
  min-height: 15.125rem;
  border-radius: 0.25rem 0 0 0.25rem;
  .left-layer {
    .p-text-input {
      @apply w-[450px];
    }
  }
  .right-layer {
    @apply grid grid-cols-2 gap-x-[1.5rem] ml-[1.5rem];
    .private-key {
      @apply col-span-2;
      .p-textarea {
        @apply w-full;
      }
    }
  }
}

button {
  @apply bg-[#EDEDEF] w-[2.5rem];
}

:deep(.p-text-input) {
  @apply w-[19.25rem];
}
</style>
