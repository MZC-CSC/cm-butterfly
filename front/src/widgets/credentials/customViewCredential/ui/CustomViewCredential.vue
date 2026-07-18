<script setup lang="ts">
import {
  PButtonModal,
  PPaneLayout,
  PFieldGroup,
  PTextInput,
} from '@cloudforet-test/mirinae';
import { i18n } from '@/app/i18n';
import { reactive, ref, watch } from 'vue';
import { IGetCredentialListResponse } from '@/entities/credentials/model/types';
import { useConfigStore } from '@/entities/credentials/model/stores';
import { useCreateCredentials } from '@/entities/credentials/api/index';
import {
  toErrorMessage,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';
import { storeToRefs } from 'pinia';

interface iProps {
  // selectedcredentialname.value
  // data: string;
  trigger?: boolean;
}

const props = defineProps<iProps>();
const emit = defineEmits([
  'update:close-modal',
  'update:trigger',
  'update:isModalOpened',
]);

const modalState = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

const state = reactive({
  credentialName: '',
  aWSAccessKey: '',
  aWSSecretKey: '',
});

const configStore = useConfigStore();
const targetModel = ref<IGetCredentialListResponse | undefined>(undefined);
const resCreateCredential = useCreateCredentials(null);
const serverCode = ref<string>('');
const { configStoreInfo } = storeToRefs(configStore);

watch(
  () => props.data,
  () => {
    targetModel.value = configStore.getConfigByName(props.data);
    // 옛 스타일 단언(<string>expr)은 SFC 파서가 JSX 태그로 읽어 깨진다.
    serverCode.value =
      (targetModel.value?.onpremiseInfraModel?.nodes as string) || '';
  },
  { immediate: true },
);

// const handleConfirm = async () => {
//     configStore.editConnections.map(sourceConnection => {
//     sourceConnection.ssh_port = String(sourceConnection.ssh_port);
//   });

const handleCancel = () => {
  //   sourceServiceInfo.value = {
  //     name: '',
  //     description: '',
  //   };
  //   sourceConnectionStore.editConnections = [];
  emit('update:isModalOpened', false);
};

const handleConfirm = async () => {
  console.log('handleConfirm');
  const requestData = {
    CredentialName: state.credentialName,
    ProviderName: 'AWS',
    KeyValueInfoList: [
      {
        Key: 'aws_access_key_id',
        Value: state.aWSAccessKey,
      },
      {
        Key: 'aws_secret_access_key',
        Value: state.aWSSecretKey,
      },
    ],
  };

  try {
    const { data } = await resCreateCredential.execute({
      request: requestData,
    });

    if (data.status && data.status.code === 200) {
      showSuccessMessage('success', 'Register Success');

      // configStoreInfo.value = {
      //   CredentialName: state.credentialName,
      //   aWSAccessKey: state.aWSAccessKey,
      //   aWSSecretKey: state.aWSSecretKey,
      // };
      configStore.addCredential(requestData);

      emit('update:trigger');
      console.log('Trigger emitted');
      emit('update:isModalOpened', false);
    }
  } catch (error) {
    // 이 경로는 크리덴셜 등록이다. 소스 그룹 이름 중복 오류를 잡던 분기가
    // 복사돼 있었으나 여기서는 발생할 수 없었고, 조건문 뒤 안내가 무조건
    // 실행돼 안내가 두 번 떴다. 값을 꺼내는 부분에도 방어가 없어 다른 종류의
    // 오류가 오면 예외 처리 안에서 다시 터졌다.
    showErrorMessage(
      'failed',
      toErrorMessage(error, 'Credential Registering Failed'),
    );
  }
};
</script>

<template>
  <div>
    <p-button-modal
      :visible="true"
      header-title="Add Credential"
      size="md"
      data-testid="credential-modal"
      :loading="resCreateCredential.isLoading.value"
      @close="handleCancel"
      @cancel="handleCancel"
      @confirm="handleConfirm"
    >
      <template #body>
        <p-pane-layout class="source-service-button-modal">
          <p-pane-layout class="layout">
            <p-field-group label="Credential Name" required>
              <p-text-input v-model="state.credentialName" :disabled="false" />
            </p-field-group>
            <p-field-group label="AWS ACCESS KEY" required>
              <p-text-input v-model="state.aWSAccessKey" :disabled="false" />
            </p-field-group>
            <p-field-group label="AWS SECRET KEY" required>
              <p-text-input
                v-if="state.aWSSecretKey !== null"
                v-model="state.aWSSecretKey"
                :disabled="false"
              />
            </p-field-group>
          </p-pane-layout>
        </p-pane-layout>
      </template>
      <template #close-button>
        <span>{{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}</span>
      </template>
      <template #confirm-button>
        <span data-testid="credential-modal-confirm">{{
          i18n.t('COMPONENT.BUTTON_MODAL.ADD')
        }}</span>
      </template>
    </p-button-modal>
  </div>
</template>

<style scoped lang="postcss"></style>
