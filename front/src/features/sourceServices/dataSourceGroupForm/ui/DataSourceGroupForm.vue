<script setup lang="ts">
import {
  PPaneLayout,
  PFieldGroup,
  PTextInput,
  PTextarea,
  PSelectDropdown,
} from '@cloudforet-test/mirinae';
import { computed, reactive, watch } from 'vue';
import {
  DATA_SOURCE_PROVIDERS,
  MINIO_REGION_REQUIRED_PROVIDERS,
  SOURCE_GROUP_TYPE_LABEL,
  SourceGroupType,
} from '@/entities/sourceService/model/types';

/**
 * Registration form for a file system, DBMS or MinIO source group. cm-honeybee takes a
 * provider only for db and minio (required for both) and a region only for minio, where it
 * derives the S3 endpoint from it on the providers in MINIO_REGION_REQUIRED_PROVIDERS and
 * requires it there; it drops them otherwise. So the form asks only for what is used:
 * nothing for a file system, the provider for a DBMS, and for MinIO the provider plus the
 * region when that provider needs one. Connections of these groups are added later, once the
 * console supports their forms.
 */
interface IProps {
  groupType: 'fs' | 'db' | 'minio';
}
const props = defineProps<IProps>();
const emit = defineEmits<{
  (e: 'update:value', value: Record<string, any> | null): void;
}>();

const state = reactive({
  name: '',
  description: '',
  provider: '',
  region: '',
});

const providerItems = DATA_SOURCE_PROVIDERS.map(p => ({ name: p, label: p }));
// Both are required where they are taken, so one flag serves for showing and requiring.
const providerRequired = computed(
  () =>
    props.groupType === SourceGroupType.Db ||
    props.groupType === SourceGroupType.Minio,
);
// Shown only where it is used, and required wherever it is shown.
const regionRequired = computed(
  () =>
    props.groupType === SourceGroupType.Minio &&
    MINIO_REGION_REQUIRED_PROVIDERS.includes(state.provider),
);

watch(
  [() => ({ ...state }), () => props.groupType],
  () => {
    const valid =
      !!state.name.trim() &&
      (!providerRequired.value || !!state.provider) &&
      (!regionRequired.value || !!state.region.trim());
    if (!valid) {
      emit('update:value', null);
      return;
    }
    const request: Record<string, any> = {
      name: state.name.trim(),
      description: state.description,
      type: props.groupType,
    };
    // A value typed in before switching to a type that does not take it is not sent.
    if (providerRequired.value && state.provider)
      request.provider_name = state.provider;
    if (regionRequired.value && state.region.trim())
      request.region_name = state.region.trim();
    emit('update:value', request);
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <div data-testid="data-source-group-form">
    <p-pane-layout class="layout">
      <p-field-group label="Source Service Name" required>
        <p-text-input
          v-model="state.name"
          data-testid="data-source-service-name"
          placeholder="Source Service Name"
          :invalid="!state.name"
        />
      </p-field-group>
      <p-field-group label="Description">
        <p-textarea
          v-model="state.description"
          data-testid="data-source-service-description"
        />
      </p-field-group>
      <p-field-group v-if="providerRequired" label="Provider" required>
        <p-select-dropdown
          :menu="providerItems"
          :selected="state.provider"
          placeholder="Select a provider"
          use-fixed-menu-style
          data-testid="data-source-provider"
          :data-value="state.provider"
          @select="v => (state.provider = v)"
        />
      </p-field-group>
      <p-field-group
        v-if="regionRequired"
        label="Region"
        required
        help-text="The provider's region code, e.g. ap-northeast-2."
      >
        <p-text-input
          v-model="state.region"
          data-testid="data-source-region"
          placeholder="Region"
          :invalid="regionRequired && !state.region"
        />
      </p-field-group>
      <p class="note" data-testid="data-source-note">
        {{ SOURCE_GROUP_TYPE_LABEL[groupType] }} connections are added after the
        console supports their forms.
      </p>
    </p-pane-layout>
  </div>
</template>

<style scoped lang="postcss">
.layout {
  padding: 1rem;
  margin: 1rem;
}
.note {
  font-size: 0.75rem;
  color: theme('colors.gray.500');
}
</style>
