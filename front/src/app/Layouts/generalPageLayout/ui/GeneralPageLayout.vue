<script setup lang="ts">
interface Props {
  isCentered?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isCentered: false,
});
</script>

<template>
  <div class="general-page-layout" :class="{ 'is-centered': props.isCentered }">
    <div class="header">
      <slot name="handbook" />
    </div>
    <div class="page-contents">
      <slot />
    </div>
    <!-- TODO: fnb -->
  </div>
</template>

<style scoped lang="postcss">
.general-page-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: stretch;
  overflow: auto;

  .header {
    @apply flex;
    padding: 1.5rem 1.5rem 0.25rem 1.5rem;
    &.without-breadcrumbs {
      padding: 0;
    }
  }
  .page-contents {
    width: 100%;
    flex-grow: 1;
    padding: 0 1.5rem 2rem 1.5rem;
    max-width: 1920px;

    &.without-breadcrumbs {
      padding: 1.5rem 1.5rem 2rem 1.5rem;
    }
  }
  .fnb {
    width: 100%;
  }

  &.is-centered {
    .page-contents {
      margin-right: auto;
      margin-left: auto;
    }
  }
}
</style>
