<script setup lang="ts">
import {
  PButtonModal,
  PPaneLayout,
  PFieldGroup,
  PTextInput,
  PSelectDropdown,
  PTextarea,
} from '@cloudforet-test/mirinae';
import { i18n } from '@/app/i18n';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  useGetProviderList,
  useGetCredentialFieldSpec,
  useRegisterCredential,
} from '@/entities/credentials/api/index';
import {
  toErrorMessage,
  showErrorMessage,
  showSuccessMessage,
} from '@/shared/utils';

// The page toggles this to make the list reload after a registration; the modal
// only ever emits it back.
defineProps<{ trigger?: boolean }>();

const emit = defineEmits([
  'update:close-modal',
  'update:trigger',
  'update:isModalOpened',
]);

// A field whose name hints at a long, multi-line secret (a service account key,
// a PEM block) gets a textarea. Everything else is a single line.
const MULTILINE_HINTS = ['privatekey', 'private_key', 'json', 'certificate'];

// cb-tumblebug rejects a holder name outside this shape, and it does so with a
// 500 whose reason is buried in the body. Checking it here turns that into a
// message next to the field.
const HOLDER_NAME_PATTERN = /^[a-z0-9_]+$/;

const state = reactive({
  provider: '',
  credentialHolder: 'admin',
  // Field names come from the server, so values are keyed by name rather than
  // held in named properties.
  values: {} as Record<string, string>,
  fields: [] as string[],
  specError: '',
});

const providers = ref<string[]>([]);
const providerLoadError = ref('');

const resProviderList = useGetProviderList();
const resRegister = useRegisterCredential();
const isSpecLoading = ref(false);

const providerItems = computed(() =>
  providers.value.map(name => ({ name, label: name })),
);

// Registration is blocked unless the field list actually came from the server and
// every field it named has a value. Sending a blank field would register a
// credential that reports success and then quietly gets skipped.
const holderNameError = computed(() => {
  const holder = state.credentialHolder.trim();
  if (!holder) return '';
  return HOLDER_NAME_PATTERN.test(holder)
    ? ''
    : 'Use lowercase letters, digits and underscores only. Hyphens are reserved as connection name delimiters.';
});

const canSubmit = computed(() => {
  if (!state.provider || !state.credentialHolder.trim()) return false;
  if (holderNameError.value) return false;
  if (state.specError || state.fields.length === 0) return false;
  return state.fields.every(field => (state.values[field] ?? '').trim() !== '');
});

const isMultiline = (field: string) => {
  const lowered = field.toLowerCase();
  return MULTILINE_HINTS.some(hint => lowered.includes(hint));
};

const loadProviders = async () => {
  try {
    const { data } = await resProviderList.execute({});
    const output = data?.responseData?.output;
    if (!Array.isArray(output) || output.length === 0) {
      providerLoadError.value = 'No cloud provider was returned by the server.';
      return;
    }
    providers.value = [...output].sort();
    providerLoadError.value = '';
  } catch (error) {
    providerLoadError.value = toErrorMessage(
      error,
      'Failed to load the cloud provider list.',
    );
  }
};

// The field list is never guessed. If it cannot be loaded the form stays empty and
// says so - falling back to a built-in list is how a provider ends up registered
// with the wrong field names.
const loadFieldSpec = async (provider: string) => {
  state.fields = [];
  state.values = {};
  state.specError = '';
  if (!provider) return;

  isSpecLoading.value = true;
  try {
    const resSpec = useGetCredentialFieldSpec(provider);
    const { data } = await resSpec.execute({
      pathParams: { path: `cloudos/metainfo/${provider}` },
      request: {},
    });
    const fields = data?.responseData?.Credential;
    if (!Array.isArray(fields) || fields.length === 0) {
      state.specError = `The server did not report which credential fields ${provider} requires.`;
      return;
    }
    state.fields = fields;
    fields.forEach(field => {
      state.values[field] = '';
    });
  } catch (error) {
    state.specError = toErrorMessage(
      error,
      `Failed to load the credential fields for ${provider}.`,
    );
  } finally {
    isSpecLoading.value = false;
  }
};

const handleProviderChange = (selected: string) => {
  state.provider = selected;
  loadFieldSpec(selected);
};

const handleCancel = () => {
  emit('update:isModalOpened', false);
};

const handleConfirm = async () => {
  if (!canSubmit.value) return;

  try {
    const { data } = await resRegister.execute({
      request: {
        providerName: state.provider,
        credentialHolder: state.credentialHolder.trim(),
        credentialKeyValueList: state.fields.map(field => ({
          key: field,
          value: state.values[field],
        })),
      },
    });

    // A non-2xx answer that does not throw used to fall through here silently,
    // leaving the modal open with no message at all. The reason is in the body,
    // not in the status line - a rejected holder name comes back as a 500 whose
    // status text is only "Internal Server Error".
    const code = data?.status?.code;
    if (code !== undefined && (code < 200 || code >= 300)) {
      const reason =
        (data?.responseData as { message?: string } | undefined)?.message ||
        data?.status?.message;
      showErrorMessage('failed', reason || 'Credential registration failed');
      return;
    }

    const allConnections = data?.responseData?.allConnections;
    const connections =
      allConnections?.count ?? allConnections?.connectionconfig?.length;
    showSuccessMessage(
      'success',
      connections
        ? `Credential registered. ${connections} connection(s) created.`
        : 'Credential registered.',
    );

    emit('update:trigger');
    emit('update:isModalOpened', false);
  } catch (error) {
    showErrorMessage(
      'failed',
      toErrorMessage(error, 'Credential registration failed'),
    );
  }
};

onMounted(loadProviders);
</script>

<template>
  <div>
    <p-button-modal
      :visible="true"
      header-title="Add Credential"
      size="md"
      data-testid="credential-modal"
      :loading="resRegister.isLoading.value"
      :disabled="!canSubmit"
      @close="handleCancel"
      @cancel="handleCancel"
      @confirm="handleConfirm"
    >
      <template #body>
        <p-pane-layout class="source-service-button-modal">
          <p-pane-layout class="layout">
            <p-field-group label="Provider" required>
              <p-select-dropdown
                :menu="providerItems"
                :selected="state.provider"
                data-testid="credential-provider"
                @update:selected="handleProviderChange"
              />
            </p-field-group>
            <p class="field-note" data-testid="credential-provider-error">
              {{ providerLoadError }}
            </p>

            <p-field-group
              label="Credential Holder"
              required
              :invalid="!!holderNameError"
              :invalid-text="holderNameError"
            >
              <p-text-input
                v-model="state.credentialHolder"
                data-testid="credential-holder"
                :invalid="!!holderNameError"
              />
            </p-field-group>

            <p class="field-note" data-testid="credential-spec-status">
              <template v-if="isSpecLoading">
                Loading the credential fields for {{ state.provider }}...
              </template>
              <template v-else-if="state.specError">
                {{ state.specError }}
              </template>
              <template v-else-if="state.fields.length">
                {{ state.fields.length }} field(s) required by
                {{ state.provider }}.
              </template>
              <template v-else> Select a provider first. </template>
            </p>

            <p-field-group
              v-for="field in state.fields"
              :key="field"
              :label="field"
              required
            >
              <p-textarea
                v-if="isMultiline(field)"
                v-model="state.values[field]"
                :data-testid="`credential-field-${field}`"
              />
              <p-text-input
                v-else
                v-model="state.values[field]"
                :data-testid="`credential-field-${field}`"
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

<style scoped lang="postcss">
.field-note {
  @apply text-xs text-gray-500 mb-2;
  min-height: 1rem;
}
</style>
