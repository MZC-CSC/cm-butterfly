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
 * Registration form for a file system, DBMS or MinIO source group. cm-honeybee 0.6.4 takes
 * the group with a provider (required for db and minio) and a region (required for minio on
 * the providers in MINIO_REGION_REQUIRED_PROVIDERS). Connections of these groups are added
 * later, once the console supports their forms.
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
const providerRequired = computed(
  () =>
    props.groupType === SourceGroupType.Db ||
    props.groupType === SourceGroupType.Minio,
);
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
    if (state.provider) request.provider_name = state.provider;
    if (state.region.trim()) request.region_name = state.region.trim();
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
      <p-field-group label="Provider" :required="providerRequired">
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
        label="Region"
        :required="regionRequired"
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
