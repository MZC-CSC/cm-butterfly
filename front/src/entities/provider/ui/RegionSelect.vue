<script setup lang="ts">
import { PSelectDropdown } from '@cloudforet-test/mirinae';
import { computed, reactive, ref, watch } from 'vue';
import { useGetRegionList } from '@/entities/provider/api';

/**
 * Region picker backed by cb-tumblebug's region list (GetRegions), the same list the
 * infra recommendation offers. Typing narrows the list; it does not enter a value, so a
 * region the list does not have cannot be chosen. A mistyped region (ap-northeast2) used
 * to reach cm-beetle and fail only at migration time, when no connection matched it.
 */
interface IProps {
  provider?: string;
  value?: string;
  testid?: string;
  invalid?: boolean;
}
const props = withDefaults(defineProps<IProps>(), {
  provider: '',
  value: '',
  testid: undefined,
  invalid: false,
});
const emit = defineEmits<{ (e: 'input', value: string): void }>();

const resRegions = useGetRegionList(null);
const state = reactive({
  loading: false,
  error: '',
  searchText: '',
  items: [] as { name: string; label: string }[],
});

watch(
  () => props.provider,
  async provider => {
    state.items = [];
    state.error = '';
    if (!provider) return;
    state.loading = true;
    try {
      const { data } = await resRegions.execute({
        pathParams: { providerName: provider },
      });
      if (provider !== props.provider) return;
      state.items = (data.responseData?.regions ?? [])
        .map(r => ({
          name: r.regionId,
          label: r.location?.display
            ? `${r.regionId} (${r.location.display})`
            : r.regionId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!state.items.length)
        state.error = `No region list is available for ${provider}.`;
    } catch (e) {
      state.error =
        (e as any)?.errorMsg?.value ??
        `Could not load the regions of ${provider}.`;
    } finally {
      state.loading = false;
    }
  },
  { immediate: true },
);

// A value that is not in the list (a default carried over from another provider) is
// dropped rather than sent.
watch(
  () => [state.items, props.value, state.loading] as const,
  ([items, value, loading]) => {
    if (!value || loading || !props.provider) return;
    if (!items.some(i => i.name === value)) emit('input', '');
  },
);

// mirinae puts the search box inside the opened menu but focuses the menu itself, so
// typing right after opening goes nowhere. Focus the search box once the menu is open.
const rootRef = ref<HTMLElement | null>(null);
function focusSearch() {
  setTimeout(() => {
    // preventScroll: scrolling the modal body moves the button, which closes the menu.
    rootRef.value
      ?.querySelector<HTMLInputElement>('.p-search input')
      ?.focus({ preventScroll: true });
  }, 50);
}

// With use-fixed-menu-style, mirinae closes the menu whenever the button moves on screen
// (hooks/context-menu-fixed-style, throttled 300 ms) - it assumes the page scrolled. Near
// the bottom of a scrolling modal, opening the menu shifts the modal body, so the first
// click opens the menu and it closes again with no selection; the user has to click
// twice. A close that soon after opening is not a user's doing, so the button is clicked
// once more through mirinae's own path (its open state cannot be forced from outside).
let openedAt = 0;
let retried = false;
let selected = false;
function handleVisibleMenu(open: boolean) {
  if (open) {
    openedAt = Date.now();
    selected = false;
    focusSearch();
    return;
  }
  if (retried || Date.now() - openedAt >= 400) {
    retried = false;
    return;
  }
  // mirinae closes the menu before it emits select, so wait a tick to tell a pick apart.
  setTimeout(() => {
    if (selected) return;
    retried = true;
    rootRef.value?.querySelector<HTMLElement>('.dropdown-button')?.click();
  }, 0);
}

function handleSelect(v: string) {
  selected = true;
  emit('input', v);
}

const placeholder = computed(() => {
  if (!props.provider) return 'Select a provider first';
  if (state.loading) return 'Loading regions...';
  return 'Type to filter, then select';
});
</script>

<template>
  <div
    ref="rootRef"
    class="region-select"
    :data-testid="testid"
    :data-value="value"
  >
    <p-select-dropdown
      :menu="state.items"
      :selected="value"
      :search-text.sync="state.searchText"
      :placeholder="placeholder"
      :disabled="!provider || state.loading"
      :invalid="invalid"
      is-filterable
      use-fixed-menu-style
      is-fixed-width
      @select="handleSelect"
      @update:visible-menu="handleVisibleMenu"
    />
    <p
      v-if="state.error"
      class="region-error"
      :data-testid="testid ? `${testid}-error` : undefined"
    >
      {{ state.error }}
    </p>
  </div>
</template>

<style scoped lang="postcss">
.region-select {
  width: 100%;
}
.region-error {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #dc2626;
}
</style>
