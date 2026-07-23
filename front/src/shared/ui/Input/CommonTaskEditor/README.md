# CommonTaskEditor usage

## Overview
CommonTaskEditor is a general-purpose task editor component built to render any object you pass in. It uses RecursiveFieldRenderer to render fields of every type recursively, handling the input, array, nestedObject, and entity types.

## Structure
- **CommonTaskEditor**: the main component, which handles componentName, pathParams, queryParams, and formData
- **RecursiveFieldRenderer**: the core component that renders fields recursively
- **FieldGroup**: the component responsible for the basic field input pattern

## Props

### formData (required)
- **Type**: `Field[]`
- **Description**: the array of form data to render
- **Structure**:
```typescript
interface Field {
  type: 'input' | 'array' | 'nestedObject' | 'entity';
  context: {
    title?: string;
    subject?: string;
    model?: {
      value: string;
      isValid?: boolean;
      onBlur?: () => void;
    };
    values?: Field[];
  };
}
```

### componentName (optional)
- **Type**: `{ title: string; modelValue: string; readonly?: boolean; }`
- **Description**: configuration for the component name field

### pathParams (optional)
- **Type**: `{ subject: string; values: Field[]; }`
- **Description**: path parameter configuration

### queryParams (optional)
- **Type**: `{ subject: string; values: Field[]; }`
- **Description**: query parameter configuration

## Usage examples

### Basic usage
```vue
<template>
  <CommonTaskEditor
    :form-data="formContext"
    :component-name="componentNameData"
    :path-params="pathParamsData"
    :query-params="queryParamsData"
  />
</template>

<script setup lang="ts">
import { CommonTaskEditor } from '@/shared/ui/Input';

const formContext = ref([
  {
    type: 'entity',
    context: {
      subject: 'Server Configuration',
      values: [
        {
          type: 'input',
          context: {
            title: 'Server Name',
            model: {
              value: 'my-server',
              isValid: true
            }
          }
        }
      ]
    }
  }
]);

const componentNameData = {
  title: 'Component Name',
  modelValue: 'MyComponent',
  readonly: true
};
</script>
```

### How to use it in GrasshopperTaskEditor
```vue
<template>
  <CommonTaskEditor
    :form-data="taskEditorModel.formContext.value"
    :component-name="{
      title: taskEditorModel.componentNameModel.value.context.title,
      modelValue: taskEditorModel.componentNameModel.value.context.model.value,
      readonly: true
    }"
    :path-params="taskEditorModel.paramsContext.value?.path_params"
    :query-params="taskEditorModel.paramsContext.value?.query_params"
  />
</template>

<script setup lang="ts">
import { CommonTaskEditor } from '@/shared/ui/Input';
// ... existing code
</script>
```

## Features

1. **Fully recursive rendering**: handles nested structures of infinite depth via RecursiveFieldRenderer
2. **Type safety**: types guaranteed through TypeScript interfaces
3. **Reusability**: usable with any task type
4. **Style consistency**: keeps the same styles as the existing GrasshopperTaskEditor
5. **Special handling**: migration_list is rendered with special styling
6. **Performance optimization**: improved rendering performance through component separation

## Supported nested structure

```
migration_list: {
  containers: [
    {
      envs: [
        { name: string, value: string }
      ],
      custom_configs: [
        { key: string, value: string }
      ]
    }
  ],
  binaries: [
    {
      custom_data_paths: [
        { path: string }
      ]
    }
  ]
}
```

Even complex nested structures like this are handled automatically.

## Exclusions
- migration_list-related logic (GrasshopperTaskEditor only)
- binaries, containers, kubernetes-specific logic
- per-task special business logic
