# TableLoadingSpinner Component

A shared spinner component shown while table data is loading.

## Usage

### Basic usage (with PToolboxTable)

```vue
<template>
  <p-horizontal-layout :height="adjustedDynamicHeight">
    <template #container="{ height }">
      <!-- Show the spinner while loading -->
      <table-loading-spinner 
        :loading="apiInstance.isLoading.value"
        :height="height"
        message="Loading data..."
      />
      
      <!-- Show the table once loading is done -->
      <p-toolbox-table
        v-if="!apiInstance.isLoading.value"
        :items="tableModel.tableState.displayItems"
        @refresh="fetchData"
      />
    </template>
  </p-horizontal-layout>
</template>

<script setup lang="ts">
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';

const apiInstance = useGetData();

function fetchData() {
  apiInstance.execute();
}
</script>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| loading | boolean | Yes | - | Loading state |
| message | string | No | 'Loading...' | Message to display |
| height | string \| number | No | - | Height of the spinner area (px) |

## Screens already applied (Phase 1 & 2)

- ✅ Credentials List (`front/src/widgets/credentials/credentialsList/ui/CredentialsList.vue`)
- ✅ MCI List (`front/src/widgets/workload/mci/mciList/ui/MciList.vue`)
- ✅ Server List (VM List) (`front/src/widgets/workload/vm/vmList/ui/VmList.vue`)
- ✅ Source Service List (`front/src/widgets/source/sourceServices/sourceServiceList/ui/SourceServiceList.vue`)
- ✅ Workflow List (`front/src/widgets/workflow/workflows/workflowList/ui/WorkflowList.vue`)
- ✅ User List (`front/src/widgets/user/userlist/ui/UserListTable.vue`)

## Target screens (Phase 3 - future rollout)

The same pattern can be applied to the following screens:

- [ ] Source Connection List (`front/src/widgets/source/sourceConnections/sourceConnectionList/ui/SourceConnectionList.vue`)
- [ ] Source Model List (`front/src/widgets/models/sourceModels/sourceModelList/ui/SourceModelList.vue`)
- [ ] Target Model List (`front/src/widgets/models/targetModels/targetModelList/ui/TargetModelList.vue`)
- [ ] Workflow Templates List (`front/src/widgets/workflow/workflowTemplates/workflowTemplatesList/ui/WorkflowTemplatesList.vue`)
- [ ] Task Components List (`front/src/widgets/workflow/taskComponents/taskComponentsList/ui/TaskComponentsList.vue`)

## Application pattern

### 1. Add the import

```typescript
import TableLoadingSpinner from '@/shared/ui/LoadingSpinner/TableLoadingSpinner.vue';
```

### 2. Remove the PSpinner import (if present)

```typescript
// remove
import { PSpinner } from '@cloudforet-test/mirinae';
```

### 3. Modify the template

**Before:**
```vue
<div v-if="loading" class="loading-section" :style="{ height: `${height}px` }">
  <p-spinner size="xl" />
  <p>Loading...</p>
</div>

<p-toolbox-table
  v-else
  ...
/>
```

**After:**
```vue
<table-loading-spinner
  :loading="loading"
  :height="height"
  message="Loading..."
/>

<p-toolbox-table
  v-if="!loading"
  ...
/>
```

### 4. Remove the styles

Remove the existing `.loading-section` styles.

## Key benefits

- **Consistent UX**: provides the same loading experience across all tables
- **Maintainability**: change the spinner style in just one place
- **No code duplication**: eliminates the same spinner code repeated on every screen
- **Extensibility**: easy to upgrade later to skeleton loading and the like

## Notes

- The component handles the `v-if="loading"` condition internally, so the parent needs no separate `v-if` condition.
- Add a `v-if="!loading"` condition to PToolboxTable so it stays hidden while loading.
- The height prop is optional; if not provided, the default `min-height: 300px` applies.

