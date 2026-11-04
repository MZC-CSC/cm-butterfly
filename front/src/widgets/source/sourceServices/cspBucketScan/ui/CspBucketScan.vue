<script setup lang="ts">
import { PButton, PSpinner } from '@cloudforet-test/mirinae';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router/composables';
import { useDiscoverSourceGroupResources } from '@/entities/sourceService/api';
import type { IDiscoveredResource } from '@/entities/sourceService/model/types';
import {
  useCreateConnectionInfo,
  useGetSourceConnectionList,
} from '@/entities/sourceConnection/api';
import { cspConnectionName } from '@/entities/sourceConnection/model/cspConnection';
import { MODEL_ROUTE } from '@/app/providers/router/routes/constants';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';

/**
 * Bucket scan for a cloud source service: reads the buckets of the source account with
 * the credential the source service already holds (cm-honeybee discover), and registers
 * the chosen ones as connections in one go. A single bucket can also be added from
 * Connections > Add / Edit. Registered buckets are made into a source model under
 * Models > Object Storage Models.
 */
interface IProps {
  sourceServiceId: string;
}
const props = defineProps<IProps>();
const emit = defineEmits(['update:trigger']);

const router = useRouter();
const resDiscover = useDiscoverSourceGroupResources(null, null);
const resConnections = useGetSourceConnectionList(null);
const resCreate = useCreateConnectionInfo(null, null);

const items = ref<IDiscoveredResource[]>([]);
const registered = ref<string[]>([]);
const state = reactive({
  scanned: false,
  selected: [] as string[],
  registering: false,
  notice: '',
});

watch(
  () => props.sourceServiceId,
  () => {
    items.value = [];
    registered.value = [];
    state.scanned = false;
    state.selected = [];
    state.notice = '';
  },
);

const selectable = computed(() =>
  items.value.filter(i => !registered.value.includes(i.resource_id)),
);

async function loadRegistered() {
  const { data } = await resConnections.execute({
    pathParams: { sgId: props.sourceServiceId },
  } as any);
  registered.value = ((data.responseData as any)?.connection_info ?? [])
    .filter((c: any) => c.resource_type === 'object_storage')
    .map((c: any) => c.resource_id);
}

async function handleScan() {
  state.selected = [];
  state.notice = '';
  try {
    const [{ data }] = await Promise.all([
      resDiscover.execute({
        pathParams: { sgId: props.sourceServiceId },
        queryParams: { resource_type: 'object_storage' },
      } as any),
      loadRegistered(),
    ]);
    const res: any = data.responseData;
    if (res?.unsupported) state.notice = res.reason || 'Not supported.';
    items.value = res?.items ?? [];
    state.scanned = true;
  } catch (e) {
    showErrorMessage(
      'failed',
      (e as any)?.errorMsg?.value || 'Could not read the buckets.',
    );
  }
}

function toggle(id: string) {
  if (registered.value.includes(id)) return;
  const i = state.selected.indexOf(id);
  if (i >= 0) state.selected.splice(i, 1);
  else state.selected.push(id);
}

async function handleRegister() {
  state.registering = true;
  const failed: string[] = [];
  for (const item of items.value.filter(i =>
    state.selected.includes(i.resource_id),
  )) {
    try {
      await resCreate.execute({
        pathParams: { sgId: props.sourceServiceId },
        request: {
          name: cspConnectionName(
            item.resource_type,
            item.resource_id,
            props.sourceServiceId,
          ),
          description: item.name,
          resource_type: item.resource_type,
          resource_id: item.resource_id,
        },
      } as any);
    } catch (e) {
      failed.push(`${item.name}: ${(e as any)?.errorMsg?.value ?? 'failed'}`);
    }
  }
  state.registering = false;
  if (failed.length) showErrorMessage('failed', failed.join('\n'));
  else showSuccessMessage('success', 'Buckets registered as connections');
  state.selected = [];
  await loadRegistered().catch(() => undefined);
  emit('update:trigger');
}

function goToModels() {
  router.push({ name: MODEL_ROUTE.OBJECT_STORAGE_MODELS._NAME });
}
</script>

<template>
  <div class="bucket-scan" data-testid="csp-bucket-scan">
    <!-- Laid out as one more row of the detail table above, so it reads as part of the
         source service's details rather than a separate section further down. -->
    <div class="scan-row">
      <div class="scan-label">Object Storage (Buckets)</div>
      <div class="scan-value">
        <span class="note"
          >Scan the account's buckets with this source service's credential and
          register them as connections.</span
        >
        <div class="row">
          <button
            type="button"
            class="link"
            data-testid="csp-bucket-scan-go-models"
            @click="goToModels"
          >
            Object Storage Models ->
          </button>
          <p-button
            style-type="tertiary"
            size="sm"
            :loading="resDiscover.isLoading.value"
            data-testid="csp-bucket-scan-run"
            @click="handleScan"
          >
            Scan Buckets
          </p-button>
          <p-button
            style-type="primary"
            size="sm"
            :disabled="!state.selected.length"
            :loading="state.registering"
            data-testid="csp-bucket-scan-register"
            @click="handleRegister"
          >
            Register {{ state.selected.length }} Bucket(s)
          </p-button>
        </div>
      </div>
    </div>
    <p v-if="state.notice" class="note" data-testid="csp-bucket-scan-notice">
      {{ state.notice }}
    </p>
    <div v-if="resDiscover.isLoading.value" class="note loading">
      <p-spinner size="sm" />
      Reading buckets from the source account...
    </div>
    <p
      v-else-if="state.scanned && !items.length"
      class="note"
      data-testid="csp-bucket-scan-empty"
    >
      No buckets in the source account.
    </p>
    <table
      v-else-if="items.length"
      class="table"
      data-testid="csp-bucket-scan-list"
    >
      <thead>
        <tr>
          <th />
          <th>Bucket</th>
          <th>Details</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.resource_id"
          :data-testid="`csp-bucket-scan-${item.resource_id}`"
          :data-selected="state.selected.includes(item.resource_id)"
          :data-registered="registered.includes(item.resource_id)"
          @click="toggle(item.resource_id)"
        >
          <td>
            <input
              type="checkbox"
              :checked="
                state.selected.includes(item.resource_id) ||
                registered.includes(item.resource_id)
              "
              :disabled="registered.includes(item.resource_id)"
            />
          </td>
          <td>{{ item.name }}</td>
          <td>
            {{
              Object.entries(item.extra ?? {})
                .filter(
                  ([, v]) => v !== null && v !== '' && typeof v !== 'object',
                )
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ') || '-'
            }}
          </td>
          <td>
            {{ registered.includes(item.resource_id) ? 'Registered' : '-' }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="items.length" class="note" data-testid="csp-bucket-scan-count">
      {{ selectable.length }} not registered · {{ state.selected.length }}
      selected.
    </p>
  </div>
</template>

<style scoped lang="postcss">
.bucket-scan {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.scan-row {
  display: flex;
  font-size: 0.875rem;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.scan-label {
  flex: 0 0 18rem;
  padding: 0.5rem 1rem;
  font-weight: 700;
}
.scan-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 1rem;
}
.note {
  font-size: 0.875rem;
  color: #6b7280;
}
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.link {
  color: #1d4ed8;
  font-size: 0.875rem;
}
.table {
  width: 100%;
  font-size: 0.875rem;
  border: 1px solid #e5e7eb;
  border-collapse: collapse;
}
.table th,
.table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
}
.table tbody tr {
  cursor: pointer;
}
.table tbody tr[data-selected='true'] {
  background: #e8f0fe;
}
.table tbody tr[data-registered='true'] {
  color: #9ca3af;
  cursor: default;
}
</style>
