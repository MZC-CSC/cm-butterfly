<script setup lang="ts">
import {
  PPaneLayout,
  PFieldGroup,
  PTextInput,
  PTextarea,
  PSelectDropdown,
  PButton,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, watch } from 'vue';
import {
  useGetCspInfo,
  useGetCspList,
  useListCspRegions,
} from '@/entities/sourceService/api';
import RegionSelect from '@/entities/provider/ui/RegionSelect.vue';
import {
  ICspCredentialField,
  ICspSourceGroupRequest,
  SourceGroupType,
} from '@/entities/sourceService/model/types';

/**
 * Registration form for a CSP-type source group: the customer's cloud account that
 * the migration reads from. The credential fields come from cm-honeybee
 * (GET /csp/{name}), so a CSP the console has never heard of still gets a form.
 *
 * Optional keys (the S3 keys some CSPs read buckets with) are asked for separately and
 * only for the CSPs whose spec lists them: they are given both or neither, and they are
 * required to collect buckets, though not to register the group. Regions
 * are read live from the CSP with the typed-in credential (POST /csp/{name}/region), so
 * the list is the account's own and needs the required keys first.
 */
const emit = defineEmits<{
  (e: 'update:value', value: ICspSourceGroupRequest | null): void;
}>();

const resCspList = useGetCspList();
const resCspInfo = useGetCspInfo(null);
const resRegions = useListCspRegions();

const state = reactive({
  name: '',
  description: '',
  provider: '',
  region: '',
  fields: [] as ICspCredentialField[],
  values: {} as Record<string, string>,
  defaultRegion: '',
  regions: null as { name: string; label: string }[] | null,
  regionError: '',
  providerError: '',
  specError: '',
});

const requiredFields = computed(() => state.fields.filter(f => !f.optional));
const optionalFields = computed(() => state.fields.filter(f => f.optional));
const filled = (key: string) => !!state.values[key]?.trim();
const requiredFilled = computed(
  () =>
    !!requiredFields.value.length &&
    requiredFields.value.every(f => filled(f.key)),
);
// cm-honeybee takes the optional keys both or neither.
const optionalPartial = computed(() => {
  const n = optionalFields.value.filter(f => filled(f.key)).length;
  return n > 0 && n < optionalFields.value.length;
});
const optionalForText = computed(() =>
  optionalFor.value
    .map(t => (t === 'object_storage' ? 'buckets' : t))
    .join(', '),
);
const regionOptions = computed(() => state.regions ?? []);
const optionalFor = computed(() => [
  ...new Set(optionalFields.value.flatMap(f => f.resource_types ?? [])),
]);

// `mock` is cb-spider's test driver, not a cloud a customer migrates from.
const providerItems = computed(() =>
  (resCspList.data.value?.responseData?.csp ?? [])
    .filter(name => name !== 'mock')
    .map(name => ({ name, label: name })),
);

onMounted(async () => {
  try {
    await resCspList.execute();
  } catch (e) {
    state.providerError =
      (e as any)?.errorMsg?.value ?? 'Could not load the CSP list.';
  }
});

async function handleProviderChange(provider: string) {
  state.provider = provider;
  state.fields = [];
  state.values = {};
  state.specError = '';
  state.regions = null;
  state.regionError = '';
  state.region = '';
  try {
    const { data } = await resCspInfo.execute({
      pathParams: { name: provider },
    });
    const info = data.responseData;
    state.fields = info?.credentials ?? [];
    // Replace the object rather than adding keys to it: Vue 2 does not track keys
    // added to a reactive object afterwards, so the typed values would never reach
    // the computed request and the Add button would stay disabled.
    state.values = Object.fromEntries(
      state.fields.map(field => [field.key, '']),
    );
    // honeybee's default region, picked once the account's regions are read.
    state.defaultRegion = info?.default_region ?? '';
  } catch (e) {
    state.specError =
      (e as any)?.errorMsg?.value ??
      `Could not load the credential fields for ${provider}.`;
  }
}

function credentialOf(fields: ICspCredentialField[]) {
  return fields
    .filter(field => filled(field.key))
    .map(field => ({ key: field.key, value: state.values[field.key] }));
}

// The typed-in keys decide which regions are offered, so a change drops the list read
// with the previous ones.
watch(
  () => requiredFields.value.map(f => state.values[f.key]).join('\u0000'),
  () => {
    state.regions = null;
    state.regionError = '';
  },
);

async function handleLoadRegions() {
  const provider = state.provider;
  state.regionError = '';
  try {
    const { data } = await resRegions.execute({
      pathParams: { name: provider },
      request: { credential: credentialOf(requiredFields.value) },
    });
    if (provider !== state.provider) return;
    state.regions = (data.responseData?.regions ?? []).map(r => ({
      name: r.name,
      label:
        r.display_name && r.display_name !== r.name
          ? `${r.name} (${r.display_name})`
          : r.name,
    }));
    if (
      !state.region &&
      state.regions.some(r => r.name === state.defaultRegion)
    )
      state.region = state.defaultRegion;
  } catch (e) {
    state.regions = [];
    state.regionError =
      (e as any)?.errorMsg?.value ??
      `Could not read the regions of ${provider} with this credential.`;
  }
}

function isMultiline(key: string) {
  return key.toLowerCase().includes('private_key');
}

const request = computed<ICspSourceGroupRequest | null>(() => {
  if (!state.name.trim() || !state.provider || !state.region.trim())
    return null;
  if (!requiredFilled.value || optionalPartial.value) return null;
  return {
    name: state.name.trim(),
    description: state.description,
    type: SourceGroupType.Csp,
    provider_name: state.provider,
    region_name: state.region.trim(),
    credential: credentialOf(state.fields),
  };
});

watch(request, value => emit('update:value', value), { immediate: true });
</script>

<template>
  <p-pane-layout class="csp-source-group-form">
    <p-pane-layout class="layout">
      <p-field-group label="Source Service Name" required>
        <p-text-input
          v-model="state.name"
          data-testid="csp-source-service-name"
          placeholder="Source Service Name"
          :invalid="!state.name"
        />
      </p-field-group>
      <p-field-group label="Description">
        <p-textarea
          v-model="state.description"
          data-testid="csp-source-service-description"
        />
      </p-field-group>
    </p-pane-layout>

    <p-pane-layout class="layout">
      <p class="field-note">
        Enter the credential of the cloud account to migrate from. It is stored
        by the source collector (cm-honeybee) and is not shown again. The target
        cloud account is configured separately.
      </p>
      <p-field-group label="Provider" required>
        <!-- PSelectDropdown reports the choice through @select only. -->
        <p-select-dropdown
          :menu="providerItems"
          :selected.sync="state.provider"
          placeholder="Select a provider"
          use-fixed-menu-style
          data-testid="csp-source-provider"
          @select="handleProviderChange"
        />
      </p-field-group>
      <p class="field-note error" data-testid="csp-source-provider-error">
        {{ state.providerError }}
      </p>

      <p class="field-note" data-testid="csp-source-spec-status">
        <template v-if="resCspInfo.isLoading.value">
          Loading the credential fields for {{ state.provider }}...
        </template>
        <template v-else-if="state.specError">{{ state.specError }}</template>
        <template v-else-if="state.fields.length">
          {{ requiredFields.length }} field(s) required by {{ state.provider }}.
        </template>
        <template v-else>Select a provider first.</template>
      </p>

      <p-field-group
        v-for="field in requiredFields"
        :key="field.key"
        :label="field.key"
        :help-text="field.description"
        required
      >
        <p-textarea
          v-if="isMultiline(field.key)"
          v-model="state.values[field.key]"
          :placeholder="field.example"
          :data-testid="`csp-source-credential-${field.key}`"
        />
        <p-text-input
          v-else
          v-model="state.values[field.key]"
          type="password"
          :placeholder="field.example"
          :data-testid="`csp-source-credential-${field.key}`"
        />
      </p-field-group>

      <template v-if="optionalFields.length">
        <p class="field-note" data-testid="csp-source-optional-note">
          Required to collect {{ optionalForText }} from {{ state.provider }}.
          {{ state.provider }} reads {{ optionalForText }} with these separate
          keys, so without them {{ optionalForText }} cannot be added to this
          source service; everything else is collected without them. Enter both
          keys or leave both empty.
        </p>
        <p-field-group
          v-for="field in optionalFields"
          :key="field.key"
          :label="field.key"
          :help-text="field.description"
        >
          <p-text-input
            v-model="state.values[field.key]"
            type="password"
            :placeholder="field.example"
            :invalid="optionalPartial && !filled(field.key)"
            data-optional="true"
            :data-testid="`csp-source-credential-${field.key}`"
          />
        </p-field-group>
        <p
          v-if="optionalPartial"
          class="field-note error"
          data-testid="csp-source-optional-error"
        >
          Enter both {{ optionalFields.map(f => f.key).join(' and ') }}, or
          leave both empty.
        </p>
      </template>

      <p-field-group label="Region" required>
        <div class="region-row">
          <region-select
            v-model="state.region"
            :provider="state.provider"
            :options="regionOptions"
            :loading="resRegions.isLoading.value"
            :error="state.regionError"
            :empty-text="
              requiredFilled
                ? 'Load the regions of this account first'
                : 'Enter the required keys first'
            "
            testid="csp-source-region"
            :invalid="!!state.provider && !state.region"
          />
          <p-button
            style-type="secondary"
            size="sm"
            :disabled="!requiredFilled || resRegions.isLoading.value"
            :loading="resRegions.isLoading.value"
            data-testid="csp-source-load-regions"
            @click="handleLoadRegions"
          >
            Load Regions
          </p-button>
        </div>
      </p-field-group>
    </p-pane-layout>
  </p-pane-layout>
</template>

<style scoped lang="postcss">
.csp-source-group-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: none;
}
.layout {
  padding: 1rem;
}
.field-note {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}
.region-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.region-row > :first-child {
  flex: 1;
}
.field-note.error {
  color: #dc2626;
}
</style>
