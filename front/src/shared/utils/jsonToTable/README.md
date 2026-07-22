# JSON Data Utilities

Utility functions and Vue components for converting JSON data into tables and trees.

## Key features

- Convert JSON data into clean tables
- Convert JSON data into tree structures
- Generate tables optimized for the migration data structure
- Unified viewer (table + tree + JSON)
- Easy to use as Vue components
- TypeScript support

## Usage

### 1. Basic usage

```typescript
import { 
  jsonToTable, 
  createMigrationDataTables,
  jsonToTree,
  filterTreeNodes,
  toggleTreeNode
} from '@/shared/utils/jsonToTable';

// Convert plain JSON data into tables
const tables = jsonToTable(jsonData);

// Convert migration data into tables
const migrationTables = createMigrationDataTables(migrationData);

// Convert JSON data into a tree
const treeNodes = jsonToTree(jsonData);

// Filter tree nodes
const filteredNodes = filterTreeNodes(treeNodes, 'search term');

// Toggle a tree node
const toggledNodes = toggleTreeNode(treeNodes, 'node-id');
```

### 2. Using the Vue components

#### Table component
```vue
<template>
  <JsonDataTable 
    :json-data="jsonData" 
    :use-migration-format="true"
    :table-titles="['Server Info', 'Binaries', 'Containers']"
  />
</template>

<script>
import JsonDataTable from '@/shared/ui/Table/JsonDataTable.vue';

export default {
  components: {
    JsonDataTable
  },
  data() {
    return {
      jsonData: { /* JSON data */ }
    };
  }
};
</script>
```

#### Tree component
```vue
<template>
  <JsonDataTree
    :json-data="jsonData"
    :show-search="true"
    :show-values="true"
    :max-depth="5"
    @node-click="handleNodeClick"
  />
</template>

<script>
import JsonDataTree from '@/shared/ui/Tree/JsonDataTree.vue';

export default {
  components: {
    JsonDataTree
  },
  methods: {
    handleNodeClick(node) {
      console.log('Clicked node:', node);
    }
  }
};
</script>
```

#### Unified viewer component
```vue
<template>
  <JsonDataViewer
    :json-data="jsonData"
    :use-migration-format="true"
    :available-views="['table', 'tree', 'raw']"
    :table-titles="['Server Info', 'Binaries', 'Containers']"
  />
</template>

<script>
import JsonDataViewer from '@/shared/ui/JsonDataViewer/JsonDataViewer.vue';

export default {
  components: {
    JsonDataViewer
  }
};
</script>
```

## API

### Table-related functions

#### `jsonToTable(jsonData, options?)`
Converts plain JSON data into tables.

**Parameters:**
- `jsonData`: the JSON data to convert
- `options`: conversion options
  - `maxDepth`: maximum depth (default: 3)
  - `showNestedObjects`: whether to show nested objects (default: true)
  - `arrayItemLimit`: array item limit (default: 10)

#### `createMigrationDataTables(jsonData)`
Generates tables optimized for the migration data structure.

**Parameters:**
- `jsonData`: the migration JSON data (string or object)

### Tree-related functions

#### `jsonToTree(jsonData, options?)`
Converts JSON data into a tree structure.

**Parameters:**
- `jsonData`: the JSON data to convert
- `options`: conversion options
  - `maxDepth`: maximum depth (default: 10)
  - `showArrayIndices`: whether to show array indices (default: true)
  - `showPrimitiveValues`: whether to show primitive values (default: true)
  - `rootLabel`: root label (default: 'Root')

#### `flattenTreeNodes(treeNodes)`
Flattens tree nodes into an array.

**Parameters:**
- `treeNodes`: the array of tree nodes

#### `findTreeNodeByPath(treeNodes, path)`
Finds the node at a specific path.

**Parameters:**
- `treeNodes`: the array of tree nodes
- `path`: the path to find

#### `toggleTreeNode(treeNodes, nodeId)`
Toggles the expanded state of a tree node.

**Parameters:**
- `treeNodes`: the array of tree nodes
- `nodeId`: the ID of the node to toggle

#### `filterTreeNodes(treeNodes, searchTerm)`
Filters tree nodes.

**Parameters:**
- `treeNodes`: the array of tree nodes
- `searchTerm`: the search term

## Component Props

### `JsonDataTable`
- `jsonData` (required): the JSON data to display
- `useMigrationFormat` (optional): whether to use the migration format (default: false)
- `tableTitles` (optional): array of table titles

### `JsonDataTree`
- `jsonData` (required): the JSON data or TreeNode array to display
- `showSearch` (optional): whether to show the search feature (default: true)
- `showValues` (optional): whether to show values (default: true)
- `maxDepth` (optional): maximum depth (default: 10)
- `currentDepth` (optional): current depth (default: 0)
- `searchTerm` (optional): the search term

### `JsonDataViewer`
- `jsonData` (required): the JSON data to display
- `useMigrationFormat` (optional): whether to use the migration format (default: false)
- `tableTitles` (optional): array of table titles
- `maxDepth` (optional): maximum depth (default: 10)
- `availableViews` (optional): array of available views (default: ['table', 'tree', 'raw'])

## Example data structure

### Migration data
```json
{
  "targetSoftwareModel": {
    "servers": [
      {
        "errors": ["No critical errors found"],
        "migration_list": {
          "binaries": [...],
          "containers": [...],
          "kubernetes": [...],
          "packages": [...]
        }
      }
    ]
  },
  "softwareModel": {
    "id": "7b_COtxNSSeJgu8",
    "name": "nfs-web-sw1-tg01",
    "description": ""
  }
}
```

## Styling

The components are styled using Tailwind CSS. You can change the styling by modifying the CSS classes as needed.

## Type definitions

```typescript
interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

interface TableData {
  columns: TableColumn[];
  rows: Record<string, any>[];
}

interface JsonToTableOptions {
  maxDepth?: number;
  showNestedObjects?: boolean;
  arrayItemLimit?: number;
}

interface TreeNode {
  id: string;
  label: string;
  value?: any;
  type: 'object' | 'array' | 'primitive';
  children?: TreeNode[];
  expanded?: boolean;
  level: number;
  path: string;
}

interface JsonToTreeOptions {
  maxDepth?: number;
  showArrayIndices?: boolean;
  showPrimitiveValues?: boolean;
  rootLabel?: string;
}
```
