<script setup lang="ts">
import { PButton } from '@cloudforet-test/mirinae';
import { CreateForm } from '@/widgets/layout';
import { i18n } from '@/app/i18n';
import SourceConnectionForm from '@/features/sourceServices/sourceConnection/ui/SourceConnectionForm.vue';
import { ref, watchEffect, onBeforeMount } from 'vue';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';

const sourceConnectionStore = useSourceConnectionStore();
interface iProps {
  selectedConnectionId: any;
}

const props = defineProps<iProps>();

const isDisabled = ref<boolean>(false);
const validStates = ref<Map<number, boolean>>(new Map());
let connectionIdCounter = 0;

// Add one connection if there are none when the modal opens
onBeforeMount(() => {
  if (sourceConnectionStore.editConnections.length === 0) {
    sourceConnectionStore.editConnections.push({
      _id: connectionIdCounter++,
      name: '',
      description: '',
      ip_address: '',
      user: '',
      private_key: '',
      ssh_port: '22',
      password: '',
    });
  } else {
    // Assign IDs to existing connections
    sourceConnectionStore.editConnections.forEach((conn: any) => {
      if (!conn._id) {
        conn._id = connectionIdCounter++;
      }
    });
  }
});

const handleValidChange = (id: number, valid: boolean) => {
  console.log('[SourceConnectionModal] handleValidChange called:', {
    id,
    valid,
  });
  validStates.value.set(id, valid);
  // Check whether every connection is valid
  const allValid = Array.from(validStates.value.values()).every(v => v);
  isDisabled.value =
    allValid &&
    validStates.value.size === sourceConnectionStore.editConnections.length;
  console.log(
    '[SourceConnectionModal] isDisabled updated:',
    isDisabled.value,
    'editConnections:',
    sourceConnectionStore.editConnections,
  );
};

const addSourceConnection = () => {
  sourceConnectionStore.editConnections.push({
    _id: connectionIdCounter++,
    name: '',
    description: '',
    ip_address: '',
    user: '',
    private_key: '',
    ssh_port: '22',
    password: '',
  });
};

const deleteSourceConnection = (id: number) => {
  const index = sourceConnectionStore.editConnections.findIndex(
    (conn: any) => conn._id === id,
  );
  if (index !== -1) {
    sourceConnectionStore.editConnections.splice(index, 1);
    validStates.value.delete(id);
    // Recompute validation state after deletion
    const allValid = Array.from(validStates.value.values()).every(v => v);
    isDisabled.value =
      allValid &&
      validStates.value.size === sourceConnectionStore.editConnections.length;
  }
};

const emit = defineEmits([
  'update:is-connection-modal-opened',
  'update:is-service-modal-opened',
]);

const handleCancel = () => {
  emit('update:is-connection-modal-opened', false);
};

const handleAddSourceConnection = () => {
  emit('update:is-connection-modal-opened', false);
  emit('update:is-service-modal-opened', true);
};

</script>

<template>
  <div class="page-modal-layout">
    <create-form
      class="modal-layer"
      title="Source Connection"
      subtitle="Add or register a source connection."
      add-button-text="Add Source Connection"
      :need-widget-layout="true"
      @addSourceConnection="addSourceConnection"
      @update:modal-state="
        () => {
          emit('update:is-connection-modal-opened', false);
          emit('update:is-service-modal-opened', true);
        }
      "
    >
      <template #add-info>
        <div
          v-for="(value, i) in sourceConnectionStore.editConnections"
          :key="value._id"
        >
          <source-connection-form
            v-if="sourceConnectionStore.editConnections[i]"
            :source-connection="sourceConnectionStore.editConnections[i]"
            mode="create"
            :show-delete-button="
              sourceConnectionStore.editConnections.length > 1
            "
            @delete="deleteSourceConnection(value._id)"
            @update:valid="valid => handleValidChange(value._id, valid)"
          />
        </div>
      </template>
      <template #buttons>
        <p-button style-type="tertiary" @click="handleCancel">
          {{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}
        </p-button>
        <p-button
          data-testid="source-connection-apply"
          :disabled="!isDisabled"
          @click="handleAddSourceConnection"
        >
          {{ i18n.t('COMPONENT.BUTTON_MODAL.APPLY') }}
        </p-button>
      </template>
    </create-form>
  </div>
</template>
