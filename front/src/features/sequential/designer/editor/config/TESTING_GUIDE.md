# Task Property Order Feature Testing Guide

## Completed implementation

### 1. Configuration file
- Created `taskPropertyOrderConfig.ts`
- Defined the ordering rules for `beetle_task_infra_migration` and `grasshopper_task_software_migration`

### 2. RecursiveFormField.vue
- Added the `taskName` and `currentPath` props
- Added the `sortedPropertyNames` and `sortedArrayItemPropertyNames` computed properties
- Applied sorting when rendering Object and Array item properties

### 3. TaskComponentEditor.vue
- Added the `getCurrentTaskComponentName()` method
- Passed taskName and currentPath to RecursiveFormField

## Test scenarios

### Test 1: beetle_task_infra_migration

**Goal**: Verify that the property order in Body Parameters displays as configured

**Steps**:
1. Open the Workflow Editor
2. Create a `beetle_task_infra_migration` task or open an existing one
3. When the Task Editor opens, check the Body Parameters section

**Expected result**:
The properties in Body Parameters should be displayed in this order:
1. `targetVmInfra` (first)
2. `targetSecurityGroupList`
3. `targetSshKey`
4. `targetVNet`
5. `targetVmOsImageList`
6. `targetVmSpecList`
7. (any properties not in the config are displayed last, in their original order)

**How to verify**:
- Open the browser developer tools (F12) and check the Console tab
- Check the logs output by RecursiveFormField
- Visually confirm the actual field order in the UI

### Test 2: grasshopper_task_software_migration

**Goal**: Verify that the property order inside each item of the servers array displays as configured

**Steps**:
1. Open the Workflow Editor
2. Create a `grasshopper_task_software_migration` task or open an existing one
3. When the Task Editor opens, check the Body Parameters section
4. If there is a `servers` array, expand it
5. Expand each item of the array and check its inner properties

**Expected result**:
Inside each item of the servers array, the properties should be displayed in this order:
1. `source_connection_info_id` (first)
2. `migration_list`
3. `errors`
4. (any properties not in the config are displayed last, in their original order)

**How to verify**:
- Check the field order when expanding an item of the servers array in the UI
- Check the sortedArrayItemPropertyNames result in the browser developer tools

### Test 3: Other tasks (no config)

**Goal**: Verify that tasks without a config keep their existing behavior

**Steps**:
1. Open the Workflow Editor
2. Open another task component (e.g., `tumblebug_mci_dynamic`)
3. Check the Body Parameters of the Task Editor

**Expected result**:
- The properties should be displayed in the same order as before
- There should be no change in order

## Debugging tips

### 1. Check the console logs

You can add the following logs in RecursiveFormField.vue to check:

```typescript
// add inside the sortedPropertyNames computed
console.log('🔍 Property Sorting:', {
  taskName: props.taskName,
  currentPath: props.currentPath,
  originalKeys: keys,
  order: order,
  sortedKeys: order ? sortPropertiesByOrder(keys, order) : keys
});
```

### 2. Check the path

Verify that the current field's path is correct:
- `body_params` - the top-level body params of beetle_task
- `body_params.servers[]` - inside a servers array item of grasshopper_task

### 3. Check the task name

Verify that getCurrentTaskComponentName() returns the correct value:

```typescript
// check in TaskComponentEditor.vue
console.log('Current Task Component:', getCurrentTaskComponentName());
```

## Adding more configuration

To add an ordering rule for a new task:

1. Open the `taskPropertyOrderConfig.ts` file
2. Add the new task configuration to `TASK_PROPERTY_ORDER_CONFIG`:

```typescript
export const TASK_PROPERTY_ORDER_CONFIG: Record<string, PropertyOrderRule[]> = {
  // ... existing config ...
  
  'new_task_name': [
    {
      path: 'body_params',  // or 'body_params.someArray[]', etc.
      order: [
        'property1',
        'property2',
        'property3'
      ]
    }
  ]
};
```

## Known limitations

1. **Nested paths**: currently only paths of the form `body_params` and `body_params.field[]` are supported
2. **Dynamic paths**: dynamic paths that include an array index are expressed with `[]`
3. **Order preservation**: properties not in the config keep their original order (not alphabetical)

## Success criteria

✅ targetVmInfra is displayed first in the Body Parameters of beetle_task_infra_migration
✅ source_connection_info_id is displayed first in the servers[] items of grasshopper_task_software_migration
✅ Other tasks without a config keep their existing order
✅ No linter errors
✅ No impact on existing features
