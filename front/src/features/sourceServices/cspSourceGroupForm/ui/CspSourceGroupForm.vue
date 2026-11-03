<script setup lang="ts">
import {
  PPaneLayout,
  PFieldGroup,
  PTextInput,
  PTextarea,
  PSelectDropdown,
} from '@cloudforet-test/mirinae';
import { computed, onMounted, reactive, watch } from 'vue';
import { useGetCspInfo, useGetCspList } from '@/entities/sourceService/api';
import {
  ICspCredentialField,
  ICspSourceGroupRequest,
  SourceGroupType,
} from '@/entities/sourceService/model/types';

/**
 * Registration form for a CSP-type source group: the customer's cloud account that
 * the migration reads from. The credential fields come from cm-honeybee
 * (GET /csp/{name}), so a CSP the console has never heard of still gets a form.
 */
const emit = defineEmits<{
  (e: 'update:value', value: ICspSourceGroupRequest | null): void;
}>();

const resCspList = useGetCspList();
const resCspInfo = useGetCspInfo(null);

const state = reactive({
  name: '',
  description: '',
  provider: '',
  region: '',
  fields: [] as ICspCredentialField[],
  values: {} as Record<string, string>,
  providerError: '',
  specError: '',
});

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
  try {
    const { data } = await resCspInfo.execute({
      pathParams: { name: provider },
    });
    const info = data.responseData;
    state.fields = info?.credentials ?? [];
    state.fields.forEach(field => {
      state.values[field.key] = '';
    });
    if (!state.region) state.region = info?.default_region ?? '';
  } catch (e) {
    state.specError =
      (e as any)?.errorMsg?.value ??
      `Could not load the credential fields for ${provider}.`;
  }
}

function isMultiline(key: string) {
  return key.toLowerCase().includes('private_key');
}

const request = computed<ICspSourceGroupRequest | null>(() => {
  if (!state.name.trim() || !state.provider || !state.region.trim()) return null;
  if (!state.fields.length) return null;
  if (state.fields.some(field => !state.values[field.key]?.trim())) return null;
  return {
    name: state.name.trim(),
    description: state.description,
    type: SourceGroupType.Csp,
    provider_name: state.provider,
    region_name: state.region.trim(),
    credential: state.fields.map(field => ({
      key: field.key,
      value: state.values[field.key],
    })),
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
        Enter the credential of the cloud account to migrate from. It is stored by
        the source collector (cm-honeybee) and is not shown again. The target cloud
        account is configured separately.
      </p>
      <p-field-group label="Provider" required>
        <!-- PSelectDropdown reports the choice through @select only. -->
        <p-select-dropdown
          :menu="providerItems"
          :selected.sync="state.provider"
          placeholder="Select a provider"
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
          {{ state.fields.length }} field(s) required by {{ state.provider }}.
        </template>
        <template v-else>Select a provider first.</template>
      </p>

      <p-field-group
        v-for="field in state.fields"
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

      <p-field-group label="Region" required>
        <p-text-input
          v-model="state.region"
          data-testid="csp-source-region"
          placeholder="e.g. ap-northeast-2"
          :invalid="!state.region"
        />
      </p-field-group>
    </p-pane-layout>
  </p-pane-layout>
</template>

<style scoped lang="postcss">
.csp-source-group-form {
  @apply flex flex-col gap-4 border-none;
  .layout {
    @apply p-4;
  }
  .field-note {
    @apply text-sm text-gray-500 mb-2;
  }
  .field-note.error {
    @apply text-red-500;
  }
}
</style>
