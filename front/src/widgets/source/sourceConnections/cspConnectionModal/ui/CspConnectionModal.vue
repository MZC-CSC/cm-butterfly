<script setup lang="ts">
import { i18n } from '@/app/i18n';
import {
  PButtonModal,
  PButton,
  PFieldGroup,
  PSelectDropdown,
  PTextInput,
  PTextarea,
  PSpinner,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive } from 'vue';
import { useDiscoverSourceGroupResources } from '@/entities/sourceService/api';
import {
  useCreateConnectionInfo,
  useGetSourceConnectionList,
} from '@/entities/sourceConnection/api';
import { cspConnectionName } from '@/entities/sourceConnection/model/cspConnection';
import type {
  CspResourceType,
  IDiscoveredResource,
} from '@/entities/sourceService/model/types';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Adds connections to a CSP-type source group by picking resources that actually exist
 * in the source account (cm-honeybee GET /source_group/{sgId}/discover). Registering
 * only checks that the CSP can see the resource; data arrives when it is collected.
 */
interface Props {
  sourceServiceId: string;
  providerName?: string;
  regionName?: string;
  // Opened from Detail > Object Storage: start on buckets and read them right away.
  initialResourceType?: CspResourceType;
}
const props = defineProps<Props>();
const emit = defineEmits(['update:is-modal-opened', 'update:trigger']);

const resourceTypeItems: Array<{ name: CspResourceType; label: string }> = [
  { name: 'vm', label: 'Virtual Machine' },
  { name: 'object_storage', label: 'Object Storage (bucket)' },
  { name: 'k8s', label: 'Kubernetes cluster' },
  { name: 'nlb', label: 'Network Load Balancer' },
  { name: 'rdbms', label: 'Managed RDBMS' },
];

const resDiscover = useDiscoverSourceGroupResources(
  props.sourceServiceId,
  null,
);
const resCreate = useCreateConnectionInfo(props.sourceServiceId, null);
const resConnections = useGetSourceConnectionList(null);

// Resources this source service already has as connections. They are shown but cannot
// be picked again (cm-honeybee rejects a second connection with the same name).
const registered = reactive<{ ids: string[] }>({ ids: [] });
async function loadRegistered() {
  try {
    const { data } = await resConnections.execute({
      pathParams: { sgId: props.sourceServiceId },
    } as any);
    registered.ids = ((data.responseData as any)?.connection_info ?? []).map(
      (c: any) => `${c.resource_type}:${c.resource_id}`,
    );
  } catch {
    registered.ids = [];
  }
}
function isRegistered(item: IDiscoveredResource) {
  return registered.ids.includes(`${item.resource_type}:${item.resource_id}`);
}

const state = reactive({
  resourceType: (props.initialResourceType ?? 'vm') as CspResourceType,
  items: [] as IDiscoveredResource[],
  selectedIds: [] as string[],
  discovered: false,
  notice: '',
  saving: false,
  // Optional: SSH access to the VM lets cm-honeybee install its agent and collect the
  // guest OS and software as well. Without it only the CSP metadata is collected.
  withSsh: false,
  sshUser: '',
  sshPort: '22',
  sshPrivateKey: '',
  // Kept for the disabled manual entry; enabled once cm-honeybee verifies a typed-in resource.
  manualId: '',
});

const isVm = computed(() => state.resourceType === 'vm');

async function handleDiscover() {
  state.items = [];
  state.selectedIds = [];
  state.notice = '';
  state.discovered = false;
  try {
    await loadRegistered();
    const { data } = await resDiscover.execute({
      pathParams: { sgId: props.sourceServiceId },
      queryParams: { resource_type: state.resourceType },
    });
    const res = data.responseData;
    if (res?.unsupported) {
      state.notice =
        res.reason ||
        `${props.providerName ?? 'This CSP'} does not support this resource type.`;
    }
    state.items = res?.items ?? [];
    state.discovered = true;
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.errorMsg?.value || 'Could not read resources from the CSP.',
    );
  }
}

onMounted(() => {
  if (props.initialResourceType) handleDiscover();
});

function toggle(id: string) {
  const item = state.items.find(i => i.resource_id === id);
  if (item && isRegistered(item)) return;
  const i = state.selectedIds.indexOf(id);
  if (i >= 0) state.selectedIds.splice(i, 1);
  else state.selectedIds.push(id);
}

function summary(item: IDiscoveredResource) {
  const extra = item.extra ?? {};
  return Object.entries(extra)
    .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

const canSave = computed(
  () =>
    state.selectedIds.length > 0 &&
    !state.saving &&
    (!state.withSsh || (!!state.sshUser && !!state.sshPrivateKey)),
);

function connectionName(item: IDiscoveredResource) {
  return cspConnectionName(
    item.resource_type,
    item.resource_id,
    props.sourceServiceId,
  );
}

async function handleConfirm() {
  state.saving = true;
  const failed: string[] = [];
  for (const item of state.items.filter(it =>
    state.selectedIds.includes(it.resource_id),
  )) {
    const request: Record<string, any> = {
      name: connectionName(item),
      description: item.name,
      resource_type: item.resource_type,
      resource_id: item.resource_id,
    };
    if (item.extra?.zone) request.zone = item.extra.zone;
    if (isVm.value && state.withSsh) {
      request.ip_address =
        item.extra?.private_ip || item.extra?.public_ip || '';
      request.ssh_port = state.sshPort;
      request.user = state.sshUser;
      request.private_key = state.sshPrivateKey;
    }
    try {
      await resCreate.execute({
        pathParams: { sgId: props.sourceServiceId },
        request,
      } as any);
    } catch (e) {
      failed.push(`${item.name}: ${(e as any)?.errorMsg?.value ?? 'failed'}`);
    }
  }
  state.saving = false;
  if (failed.length) {
    showErrorMessage('failed', failed.join('\n'));
  } else {
    showSuccessMessage('success', 'Connections added');
  }
  emit('update:trigger');
  if (!failed.length) emit('update:is-modal-opened', false);
}

function handleClose() {
  emit('update:is-modal-opened', false);
}
</script>

<template>
  <p-button-modal
    :visible="true"
    header-title="Add Cloud Resources"
    size="lg"
    :disabled="!canSave"
    :loading="state.saving"
    @confirm="handleConfirm"
    @cancel="handleClose"
    @close="handleClose"
  >
    <template #body>
      <div class="csp-connection" data-testid="csp-connection-modal-body">
        <p class="note" data-testid="csp-connection-account">
          Source account: {{ providerName }} / {{ regionName }}
        </p>
        <div class="discover-row">
          <p-field-group label="Resource Type" required>
            <p-select-dropdown
              :menu="resourceTypeItems"
              :selected.sync="state.resourceType"
              use-fixed-menu-style
              data-testid="csp-connection-resource-type"
              @select="v => (state.resourceType = v)"
            />
          </p-field-group>
          <p-button
            style-type="secondary"
            icon-left="ic_search"
            data-testid="csp-connection-discover"
            :loading="resDiscover.isLoading.value"
            @click="handleDiscover"
          >
            Discover
          </p-button>
        </div>

        <p v-if="state.notice" class="note" data-testid="csp-connection-notice">
          {{ state.notice }}
        </p>
        <div v-if="resDiscover.isLoading.value" class="loading">
          <p-spinner size="md" />
          <span>Reading resources from the CSP...</span>
        </div>
        <p
          v-else-if="state.discovered && !state.items.length"
          class="note"
          data-testid="csp-connection-empty"
        >
          No resources of this type were found in the source account.
        </p>
        <ul
          v-else-if="state.items.length"
          class="resource-list"
          data-testid="csp-connection-resource-list"
        >
          <li
            v-for="item in state.items"
            :key="item.resource_id"
            :data-testid="`csp-connection-resource-${item.resource_id}`"
            :data-selected="state.selectedIds.includes(item.resource_id)"
            :data-registered="isRegistered(item)"
            @click="toggle(item.resource_id)"
          >
            <input
              type="checkbox"
              :checked="
                isRegistered(item) ||
                state.selectedIds.includes(item.resource_id)
              "
              :disabled="isRegistered(item)"
              :data-testid="`csp-connection-pick-${item.resource_id}`"
              @click.stop="toggle(item.resource_id)"
            />
            <div class="resource-text">
              <span class="resource-name"
                >{{ item.name }}
                <span v-if="isRegistered(item)" class="tag">Registered</span>
              </span>
              <span class="resource-id">{{ item.resource_id }}</span>
              <span class="resource-extra">{{ summary(item) }}</span>
            </div>
          </li>
        </ul>

        <div class="manual-row" data-testid="csp-connection-manual">
          <p-field-group
            :label="`Not listed? Enter the ${
              state.resourceType === 'object_storage'
                ? 'bucket name'
                : 'resource ID'
            }`"
          >
            <p-text-input
              v-model="state.manualId"
              disabled
              data-testid="csp-connection-manual-id"
            />
          </p-field-group>
          <p-button
            style-type="tertiary"
            icon-left="ic_plus"
            disabled
            data-testid="csp-connection-manual-add"
          >
            Add to list
          </p-button>
        </div>
        <p class="note" data-testid="csp-connection-manual-note">
          Entering a resource by hand is not available yet: cm-honeybee
          registers the connection without checking that the resource exists, so
          only resources found by Discover can be added.
        </p>

        <div v-if="isVm" class="ssh-section">
          <label class="ssh-toggle" data-testid="csp-connection-with-ssh">
            <input v-model="state.withSsh" type="checkbox" />
            Also collect the guest OS and software over SSH (installs the
            collector agent)
          </label>
          <template v-if="state.withSsh">
            <p-field-group label="User" required>
              <p-text-input
                v-model="state.sshUser"
                data-testid="csp-connection-ssh-user"
              />
            </p-field-group>
            <p-field-group label="SSH Port">
              <p-text-input
                v-model="state.sshPort"
                data-testid="csp-connection-ssh-port"
              />
            </p-field-group>
            <p-field-group label="Private Key" required>
              <p-textarea
                v-model="state.sshPrivateKey"
                data-testid="csp-connection-ssh-private-key"
              />
            </p-field-group>
          </template>
        </div>
        <p class="note" data-testid="csp-connection-selected-count">
          {{ state.selectedIds.length }} resource(s) selected.
        </p>
      </div>
    </template>
    <template #close-button>
      <span data-testid="csp-connection-cancel">{{
        i18n.t('COMPONENT.BUTTON_MODAL.CANCEL')
      }}</span>
    </template>
    <template #confirm-button>
      <span data-testid="csp-connection-confirm">{{
        i18n.t('COMPONENT.BUTTON_MODAL.ADD')
      }}</span>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.csp-connection {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.discover-row,
.manual-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}
/* The field group keeps a bottom margin; without this the button sits lower than the input. */
.discover-row :deep(.p-field-group),
.manual-row :deep(.p-field-group) {
  margin-bottom: 0;
}
.manual-row {
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
}
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.resource-list {
  display: flex;
  flex-direction: column;
  max-height: 20rem;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
}
.resource-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}
.resource-list li[data-selected='true'] {
  background: #e8f0fe;
}
.resource-text {
  display: flex;
  flex-direction: column;
}
.tag {
  margin-left: 0.375rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 400;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}
.resource-list li[data-registered='true'] {
  cursor: default;
  color: #9ca3af;
}
.resource-name {
  font-size: 0.875rem;
  font-weight: 700;
}
.resource-id,
.resource-extra {
  font-size: 0.75rem;
  color: #6b7280;
}
.ssh-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
}
.ssh-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}
</style>
