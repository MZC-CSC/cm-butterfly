<script setup lang="ts">
import { i18n } from '@/app/i18n';
import {
  PButtonModal,
  PFieldGroup,
  PTextInput,
  PTextarea,
} from '@cloudforet-test/mirinae';
import { computed, reactive } from 'vue';
import { useUpdateConnectionInfo } from '@/entities/sourceConnection/api';
import { useSourceConnectionStore } from '@/entities/sourceConnection/model/stores';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Edits a connection of a cloud source service: its name and description, and for a VM
 * the SSH access that lets cm-honeybee collect the guest OS and software as well. A blank
 * SSH field keeps what is stored (cm-honeybee keeps the stored value for an empty one), so
 * a stored key is never shown or sent back. The resource itself is kept read-only;
 * pointing at a different resource is done by adding it and deleting this connection.
 */
interface IProps {
  sourceServiceId: string;
  connectionId: string;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:is-modal-opened', 'update:trigger', 'add']);

const store = useSourceConnectionStore();
const connection = computed(() => store.getConnectionById(props.connectionId));
const resUpdate = useUpdateConnectionInfo(null, null, null);

const state = reactive({
  name: connection.value?.name ?? '',
  description: connection.value?.description ?? '',
  ipAddress: connection.value?.ip_address ?? '',
  sshPort: connection.value?.ssh_port ? String(connection.value.ssh_port) : '',
  user: connection.value?.user ?? '',
  privateKey: '',
});

const isVm = computed(() => connection.value?.resource_type === 'vm');
const hadSsh = computed(() => !!connection.value?.ip_address);
// cm-honeybee needs a user and a key with an address. A key already stored counts.
const sshError = computed(() => {
  if (!isVm.value || !state.ipAddress.trim()) return '';
  if (!state.user.trim()) return 'Enter the SSH user.';
  if (!hadSsh.value && !state.privateKey.trim())
    return 'Enter the SSH private key.';
  const port = state.sshPort.trim();
  if (port && !(/^\d+$/.test(port) && +port >= 1 && +port <= 65535))
    return 'The SSH port must be between 1 and 65535.';
  return '';
});

const typeLabels: Record<string, string> = {
  vm: 'Virtual Machine',
  object_storage: 'Object Storage (bucket)',
  k8s: 'Kubernetes cluster',
  nlb: 'Network Load Balancer',
  rdbms: 'Managed RDBMS',
};
const typeLabel = computed(() => {
  const t = connection.value?.resource_type ?? '';
  return typeLabels[t] ?? (t || '-');
});

const canSave = computed(
  () => !!state.name.trim() && !sshError.value && !resUpdate.isLoading.value,
);

async function handleSave() {
  try {
    await resUpdate.execute({
      pathParams: { sgId: props.sourceServiceId, connId: props.connectionId },
      request: {
        name: state.name.trim(),
        description: state.description,
        ...(isVm.value && state.ipAddress.trim()
          ? {
              ip_address: state.ipAddress.trim(),
              user: state.user.trim(),
              ...(state.sshPort.trim()
                ? { ssh_port: state.sshPort.trim() }
                : {}),
              ...(state.privateKey.trim()
                ? { private_key: state.privateKey }
                : {}),
            }
          : {}),
      },
    } as any);
    showSuccessMessage('success', 'Connection updated');
    emit('update:trigger');
    emit('update:is-modal-opened', false);
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.errorMsg?.value || 'Could not update the connection.',
    );
  }
}
</script>

<template>
  <p-button-modal
    :visible="true"
    header-title="Edit Cloud Resource Connection"
    size="md"
    :disabled="!canSave"
    :loading="resUpdate.isLoading.value"
    @confirm="handleSave"
    @cancel="emit('update:is-modal-opened', false)"
    @close="emit('update:is-modal-opened', false)"
  >
    <template #body>
      <div class="csp-edit" data-testid="csp-connection-edit-body">
        <dl class="rows">
          <dt>Resource Type</dt>
          <dd data-testid="csp-connection-edit-type">
            {{ typeLabel }}
          </dd>
          <dt>Resource</dt>
          <dd data-testid="csp-connection-edit-resource">
            {{ connection?.resource_id || '-' }}
          </dd>
        </dl>
        <p class="note">
          The resource is not changed here. To use a different resource, add it
          with
          <button
            type="button"
            class="link"
            data-testid="csp-connection-edit-go-add"
            @click="emit('add')"
          >
            Add Cloud Resources
          </button>
          and delete this connection.
        </p>
        <p-field-group label="Name" required>
          <p-text-input
            v-model="state.name"
            data-testid="csp-connection-edit-name"
          />
        </p-field-group>
        <p-field-group label="Description">
          <p-textarea
            v-model="state.description"
            data-testid="csp-connection-edit-description"
          />
        </p-field-group>
        <div v-if="isVm" class="ssh" data-testid="csp-connection-edit-ssh">
          <p class="note">
            SSH access lets the source collector install its agent and collect
            the guest OS and software as well. A blank field keeps what is
            stored; a stored address cannot be removed here.
          </p>
          <p-field-group label="IP Address">
            <p-text-input
              v-model="state.ipAddress"
              data-testid="csp-connection-edit-ip"
            />
          </p-field-group>
          <p-field-group label="SSH Port">
            <p-text-input
              v-model="state.sshPort"
              placeholder="22"
              data-testid="csp-connection-edit-ssh-port"
            />
          </p-field-group>
          <p-field-group label="User">
            <p-text-input
              v-model="state.user"
              data-testid="csp-connection-edit-ssh-user"
            />
          </p-field-group>
          <p-field-group label="Private Key">
            <p-textarea
              v-model="state.privateKey"
              :placeholder="hadSsh ? 'Leave blank to keep the stored key' : ''"
              data-testid="csp-connection-edit-ssh-private-key"
            />
          </p-field-group>
          <p
            v-if="sshError"
            class="note error"
            data-testid="csp-connection-edit-ssh-error"
          >
            {{ sshError }}
          </p>
        </div>
      </div>
    </template>
    <template #close-button>
      <span>{{ i18n.t('COMPONENT.BUTTON_MODAL.CANCEL') }}</span>
    </template>
    <template #confirm-button>
      <span data-testid="csp-connection-edit-save">{{
        i18n.t('COMPONENT.BUTTON_MODAL.SAVE')
      }}</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.csp-edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}
.rows {
  display: grid;
  grid-template-columns: 9rem 1fr;
  font-size: 0.875rem;
  border-top: 1px solid #e5e7eb;
}
.rows dt,
.rows dd {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}
.rows dt {
  font-weight: 700;
  background: #f9fafb;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.link {
  color: #1d4ed8;
}
.note.error {
  color: #dc2626;
}
.ssh {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
}
</style>
