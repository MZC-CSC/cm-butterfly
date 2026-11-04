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
 * Edits a connection of a cloud source service. cm-honeybee updates a CSP connection's
 * name, description, resource type and resource ID; the resource itself is kept read-only
 * here because cm-honeybee does not check that a typed-in resource exists. Pointing at a
 * different resource is done by adding it (Discover) and deleting this connection.
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
  () => !!state.name.trim() && !resUpdate.isLoading.value,
);

async function handleSave() {
  try {
    await resUpdate.execute({
      pathParams: { sgId: props.sourceServiceId, connId: props.connectionId },
      request: { name: state.name.trim(), description: state.description },
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
</style>
