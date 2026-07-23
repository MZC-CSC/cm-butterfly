# Task Component Editor

A general-purpose Task Editor that lets you edit the parameters of various Task Components based on a JSON Schema.

## 🎯 Key features

### 1. **General-purpose Editor**
- Uses a single Editor for all Task Components
- Automatic form generation based on JSON Schema
- Supports Path Parameters, Query Parameters, and Body Parameters

### 2. **Recursive rendering**
- Automatically renders nested Object structures
- Dynamically adds/removes items for Array types
- Supports nested structures of unlimited depth

### 3. **Automatic data management**
- Saves changes automatically
- Separates the Schema from the actual data
- Real-time updates via Vue.js reactivity

## 🏗️ Structure

```
editor/
├── ui/
│   ├── TaskComponentEditor.vue          # Main general-purpose Editor
│   ├── RecursiveFormField.vue           # Recursive form field rendering
│   └── components/                      # UI components
│       ├── FormField.vue
│       ├── ArrayContentRenderer.vue
│       ├── DataStructureRenderer.vue
│       └── ...
├── model/
│   ├── editorProviders.ts               # Editor Provider (uses TaskComponentEditor for all tasks)
│   ├── commonTaskEditorModel.ts         # Shared Task Editor logic
│   └── ...
├── utils/
│   ├── schemaAnalyzer.ts                # Schema analysis utility
│   └── dataMapper.ts                    # Data mapping utility
├── composables/
│   └── useTaskSchemaLoader.ts           # Schema loading logic
├── store/
│   └── taskSchemaStore.ts               # Schema cache store
└── index.ts                             # Export file
```

## 🚀 Usage

### Basic usage

TaskComponentEditor is applied automatically to all tasks in `editorProviders.ts`:

```typescript
// editorProviders.ts
if (step.componentType === 'task') {
  const TaskEditorComponent: any = TaskComponentEditor;
  
  insertDynamicComponent(
    TaskEditorComponent,
    { step },
    {
      saveComponentName: e => {
        step.name = e;
        stepContext.notifyNameChanged();
      },
      saveContext: e => {
        step.properties.model = e;
        stepContext.notifyPropertiesChanged();
      },
      saveFixedModel: e => {
        step.properties.fixedModel = e;
        stepContext.notifyPropertiesChanged();
      },
    },
    editor,
  );
}
```

### Step structure

```typescript
interface Step {
  id: string;
  name: string;
  type: string;
  componentType: 'task' | 'container' | 'switch';
  properties: {
    fixedModel?: {
      task_component: string;  // Task Component ID
      path_params?: any;
      query_params?: any;
      body_params?: any;
    };
    model?: any;  // Edited data for the current session
    originalData?: {
      path_params?: any;
      query_params?: any;
      request_body?: any;  // body_params data at initial load
    };
  };
}
```

## 📊 Data flow

### 1. **Data loading priority**

```
Priority 1: step.properties.model
            ↓ (current session data - preserves changes when the Task Editor is closed and reopened)
Priority 2: originalData.request_body
            ↓ (fallback at initial load)
Priority 3: Empty Object {}
```

### 2. **Data save flow**

```
User Input
    ↓
RecursiveFormField.vue (emit 'update')
    ↓
TaskComponentEditor.vue (updateBodyParamField)
    ↓
Deep Clone (triggers Vue reactivity)
    ↓
watch(bodyParamsModel)
    ↓
saveContext callback
    ↓
step.properties.model updated
    ↓
stepContext.notifyPropertiesChanged()
```

## 🔧 Main components

### 1. TaskComponentEditor.vue

The main general-purpose Editor component:
- Loads the Task Component Schema
- Renders the Path/Query/Body Parameters sections
- Auto-save logic

### 2. RecursiveFormField.vue

The recursive form field renderer:
- Handles Object, Array, and Primitive types
- Recursively renders nested structures
- Emits data change events

### 3. editorProviders.ts

Editor Provider configuration:
- Uses TaskComponentEditor for all tasks
- Sets up the saveContext and saveFixedModel callbacks
- Updates step.properties

## 💾 Data persistence

### Problem: Preserving Body Parameters changes

**Issue**: Changes disappear when the Task Editor is closed and reopened

**Root Cause**:
1. Vue.js does not detect changes to deeply nested objects
2. `step.properties.model` gets overwritten by the schema
3. Data loading priority issue

**Solution**:
1. **Deep Cloning**: deep-clone the entire object in `updateBodyParamField`
2. **Data Loading Priority**: load `step.properties.model` first
3. **Distinguish Schema vs Data**: check whether it's a schema or actual data

```typescript
// ✅ Deep Clone to trigger Vue reactivity
const updateBodyParamField = (fieldName: string, value: any) => {
  const newModel = JSON.parse(JSON.stringify({
    ...bodyParamsModel.value,
    [fieldName]: value
  }));
  
  bodyParamsModel.value = newModel;  // new object reference → Vue detects it
};
```

## 🐛 Major bug fixes

### Bug #1: Body Parameters changes lost
**Cause**: Vue.js reactivity limitation (deeply nested objects)
**Fix**: change the object reference via deep cloning

### Bug #2: Reverts to initial values when the Task Editor is reopened
**Cause**: incorrect data loading priority
**Fix**: load `step.properties.model` first

### Bug #3: Schema saved as actual data
**Cause**: failure to distinguish Schema from Data
**Fix**: added logic to check whether something is a schema

```typescript
// Check whether it's a schema
const isSchema = (obj: any) => {
  return obj && 
         obj.type === 'object' && 
         obj.properties && 
         typeof obj.properties === 'object';
};
```

## 🎨 UI structure

### Path Parameters
- Input for fixed path variables
- Example: `/api/{version}/users/{userId}`

### Query Parameters
- URL query string parameters
- Example: `?page=1&limit=10`

### Body Parameters
- POST/PUT request body
- Recursive Object/Array rendering
- Dynamic field add/remove

## 🔄 Migration guide

### Before (using CompositeTaskEditor, CommonTaskEditor)

```typescript
// editorProviders.ts
if (step.type === 'beetle_task_infra_migration') {
  const TaskEditorComponent = BeetleTaskEditor;
} else if (step.type === 'grasshopper_task_software_migration') {
  const TaskEditorComponent = GrasshopperTaskEditor;
}
```

### Now (using TaskComponentEditor)

```typescript
// editorProviders.ts
if (step.componentType === 'task') {
  const TaskEditorComponent = TaskComponentEditor;  // unified for all tasks
}
```

**Changes**:
- ✅ Uses a single Editor for all tasks
- ✅ No need for a separate Editor per Task Component
- ✅ Improved maintainability
- ✅ Improved extensibility

## 📝 Supported Task Components

- `beetle_task_infra_migration`: Infrastructure migration
- `grasshopper_task_software_migration`: Software migration
- All other Task Components (supported automatically)

**TaskComponentEditor supports every Task as long as a JSON Schema is available!**

## 🧪 Testing

### E2E tests

```bash
cd front
npm test
```

Test scenario:
1. Create and run an Infrastructure Workflow
2. Create a Software Workflow
3. Modify Query Parameters in the Task Editor
4. Save and run the Workflow
5. Verify the infrastructure in Workloads

Detailed docs: `/front/tests/README.md`

## 🚀 Future plans

1. **Optimize schema caching**: minimize API calls
2. **Strengthen validation**: real-time validation
3. **Extend editing features**: Drag & Drop, Copy & Paste
4. **Theme support**: Dark/Light mode
5. **Accessibility improvements**: keyboard navigation

## 📚 Related docs

- [E2E Testing Guide](../../../../tests/README.md)
- [Quick Start Guide](../../../../tests/QUICKSTART.md)
- [Playwright test script](../../../../tests/e2e-workflow-complete.spec.ts)

## 🔗 References

- Vue 2.7 Composition API
- JSON Schema Specification
- Sequential Workflow Designer
- Pinia State Management
