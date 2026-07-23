export interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: Record<string, any>[];
}

export interface JsonToTableOptions {
  maxDepth?: number;
  showNestedObjects?: boolean;
  arrayItemLimit?: number;
}

export interface TreeNode {
  id: string;
  label: string;
  value?: any;
  type: 'object' | 'array' | 'primitive';
  children?: TreeNode[];
  expanded?: boolean;
  level: number;
  path: string;
}

export interface JsonToTreeOptions {
  maxDepth?: number;
  showArrayIndices?: boolean;
  showPrimitiveValues?: boolean;
  rootLabel?: string;
}

/**
 * Converts JSON data into table form
 * @param jsonData - the JSON data to convert
 * @param options - conversion options
 * @returns table data objects
 */
export function jsonToTable(
  jsonData: any,
  options: JsonToTableOptions = {}
): TableData[] {
  const {
    maxDepth = 3,
    showNestedObjects = true,
    arrayItemLimit = 10
  } = options;

  const tables: TableData[] = [];

  // Create a table for each root-level key
  Object.keys(jsonData).forEach(key => {
    const value = jsonData[key];
    
    if (Array.isArray(value)) {
      // Array case
      const table = createTableFromArray(key, value, maxDepth, arrayItemLimit);
      if (table) {
        tables.push(table);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Object case
      const table = createTableFromObject(key, value, maxDepth, showNestedObjects);
      if (table) {
        tables.push(table);
      }
    } else {
      // Primitive value case
      const table = createSimpleTable(key, value);
      tables.push(table);
    }
  });

  return tables;
}

/**
 * Create a table from array data
 */
function createTableFromArray(
  key: string,
  array: any[],
  maxDepth: number,
  arrayItemLimit: number
): TableData | null {
  if (array.length === 0) return null;

  const limitedArray = array.slice(0, arrayItemLimit);
  const firstItem = limitedArray[0];

  if (typeof firstItem === 'object' && firstItem !== null) {
    // Array-of-objects case
    const columns = extractColumnsFromObject(firstItem, maxDepth);
    const rows = limitedArray.map((item, index) => ({
      ...flattenObject(item, maxDepth),
      _index: index + 1
    }));

    return {
      columns: [
        { key: '_index', label: 'No.', width: '80px' },
        ...columns
      ],
      rows
    };
  } else {
    // Array-of-primitives case
    return {
      columns: [
        { key: 'index', label: 'No.', width: '80px' },
        { key: 'value', label: 'Value', width: '200px' }
      ],
      rows: limitedArray.map((item, index) => ({
        index: index + 1,
        value: String(item)
      }))
    };
  }
}

/**
 * Create a table from object data
 */
function createTableFromObject(
  key: string,
  obj: any,
  maxDepth: number,
  showNestedObjects: boolean
): TableData | null {
  const columns = extractColumnsFromObject(obj, maxDepth);
  
  if (columns.length === 0) return null;

  const rows = [flattenObject(obj, maxDepth)];

  return {
    columns,
    rows
  };
}

/**
 * Create a table from a simple key-value pair
 */
function createSimpleTable(key: string, value: any): TableData {
  return {
    columns: [
      { key: 'key', label: 'Key', width: '200px' },
      { key: 'value', label: 'Value', width: '300px' }
    ],
    rows: [{
      key,
      value: String(value)
    }]
  };
}

/**
 * Extract column info from an object
 */
function extractColumnsFromObject(obj: any, maxDepth: number): TableColumn[] {
  const columns: TableColumn[] = [];
  const processedKeys = new Set<string>();

  function extractKeys(currentObj: any, depth: number, prefix: string = '') {
    if (depth > maxDepth) return;

    Object.keys(currentObj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (processedKeys.has(fullKey)) return;
      processedKeys.add(fullKey);

      const value = currentObj[key];
      
      if (Array.isArray(value)) {
        columns.push({
          key: fullKey,
          label: key,
          width: '200px'
        });
      } else if (typeof value === 'object' && value !== null) {
        if (depth < maxDepth) {
          extractKeys(value, depth + 1, fullKey);
        } else {
          columns.push({
            key: fullKey,
            label: key,
            width: '200px'
          });
        }
      } else {
        columns.push({
          key: fullKey,
          label: key,
          width: '150px'
        });
      }
    });
  }

  extractKeys(obj, 0);
  return columns;
}

/**
 * Flatten an object into table row data
 */
function flattenObject(obj: any, maxDepth: number, currentDepth: number = 0): Record<string, any> {
  const flattened: Record<string, any> = {};

  if (currentDepth >= maxDepth) {
    return { value: JSON.stringify(obj) };
  }

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (Array.isArray(value)) {
      flattened[key] = `[${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      if (currentDepth < maxDepth - 1) {
        const nested = flattenObject(value, maxDepth, currentDepth + 1);
        Object.keys(nested).forEach(nestedKey => {
          flattened[`${key}.${nestedKey}`] = nested[nestedKey];
        });
      } else {
        flattened[key] = JSON.stringify(value);
      }
    } else {
      flattened[key] = value;
    }
  });

  return flattened;
}

/**
 * Table-building function optimized for a specific JSON structure
 * Builds tables to match the given example data structure
 */
export function createMigrationDataTables(jsonData: any): TableData[] {
  const tables: TableData[] = [];

  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (data.targetSoftwareModel?.servers) {
      const servers = data.targetSoftwareModel.servers;
      
      servers.forEach((server: any, serverIndex: number) => {
        // Server basic info table
        tables.push({
          columns: [
            { key: 'field', label: 'Field', width: '200px' },
            { key: 'value', label: 'Value', width: '300px' }
          ],
          rows: [
            { field: 'Server Index', value: serverIndex + 1 },
            { field: 'Error', value: server.errors?.join(', ') || 'None' },
            { field: 'Source Connection ID', value: data.source_connection_info_id || 'N/A' }
          ]
        });

        // Binaries table
        if (server.migration_list?.binaries?.length > 0) {
          tables.push({
            columns: [
              { key: 'name', label: 'Name', width: '200px' },
              { key: 'version', label: 'Version', width: '100px' },
              { key: 'binary_path', label: 'Binary Path', width: '250px' },
              { key: 'needed_libraries', label: 'Required Libraries', width: '200px' },
              { key: 'custom_configs', label: 'Custom Configs', width: '200px' },
              { key: 'custom_data_paths', label: 'Custom Data Paths', width: '200px' },
              { key: 'order', label: 'Order', width: '80px' }
            ],
            rows: server.migration_list.binaries.map((binary: any) => ({
              name: binary.name || 'N/A',
              version: binary.version || 'N/A',
              binary_path: binary.binary_path || 'N/A',
              needed_libraries: Array.isArray(binary.needed_libraries) ? binary.needed_libraries.join(', ') : 'N/A',
              custom_configs: Array.isArray(binary.custom_configs) ? binary.custom_configs.join(', ') : 'N/A',
              custom_data_paths: Array.isArray(binary.custom_data_paths) ? binary.custom_data_paths.join(', ') : 'N/A',
              order: binary.order || 'N/A'
            }))
          });
        }

        // Containers table
        if (server.migration_list?.containers?.length > 0) {
          tables.push({
            columns: [
              { key: 'name', label: 'Container Name', width: '200px' },
              { key: 'container_id', label: 'Container ID', width: '150px' },
              { key: 'image_name', label: 'Image Name', width: '150px' },
              { key: 'image_version', label: 'Image Version', width: '100px' },
              { key: 'container_status', label: 'Status', width: '100px' },
              { key: 'runtime', label: 'Runtime', width: '100px' },
              { key: 'network_mode', label: 'Network Mode', width: '120px' },
              { key: 'restart_policy', label: 'Restart Policy', width: '120px' },
              { key: 'order', label: 'Order', width: '80px' }
            ],
            rows: server.migration_list.containers.map((container: any) => ({
              name: container.name || 'N/A',
              container_id: container.container_id || 'N/A',
              image_name: container.container_image?.image_name || 'N/A',
              image_version: container.container_image?.image_version || 'N/A',
              container_status: container.container_status || 'N/A',
              runtime: container.runtime || 'N/A',
              network_mode: container.network_mode || 'N/A',
              restart_policy: container.restart_policy || 'N/A',
              order: container.order || 'N/A'
            }))
          });
        }

        // Kubernetes table
        if (server.migration_list?.kubernetes?.length > 0) {
          tables.push({
            columns: [
              { key: 'version', label: 'K8s Version', width: '100px' },
              { key: 'kube_config', label: 'Kube Config', width: '200px' },
              { key: 'replicas', label: 'Replicas', width: '100px' },
              { key: 'cpu_limit', label: 'CPU Limit', width: '100px' },
              { key: 'memory_limit', label: 'Memory Limit', width: '100px' },
              { key: 'cpu_request', label: 'CPU Request', width: '100px' },
              { key: 'memory_request', label: 'Memory Request', width: '100px' },
              { key: 'order', label: 'Order', width: '80px' }
            ],
            rows: server.migration_list.kubernetes.map((k8s: any) => ({
              version: k8s.version || 'N/A',
              kube_config: k8s.kube_config || 'N/A',
              replicas: k8s.resources?.deployment?.replicas || 'N/A',
              cpu_limit: k8s.resources?.deployment?.resources?.limits?.cpu || 'N/A',
              memory_limit: k8s.resources?.deployment?.resources?.limits?.memory || 'N/A',
              cpu_request: k8s.resources?.deployment?.resources?.requests?.cpu || 'N/A',
              memory_request: k8s.resources?.deployment?.resources?.requests?.memory || 'N/A',
              order: k8s.order || 'N/A'
            }))
          });
        }

        // Packages table
        if (server.migration_list?.packages?.length > 0) {
          tables.push({
            columns: [
              { key: 'name', label: 'Package Name', width: '150px' },
              { key: 'version', label: 'Version', width: '100px' },
              { key: 'needed_packages', label: 'Required Packages', width: '200px' },
              { key: 'need_to_delete_packages', label: 'Packages to Remove', width: '200px' },
              { key: 'repo_url', label: 'Repository URL', width: '200px' },
              { key: 'gpg_key_url', label: 'GPG Key URL', width: '200px' },
              { key: 'custom_configs', label: 'Custom Configs', width: '200px' },
              { key: 'custom_data_paths', label: 'Custom Data Paths', width: '200px' },
              { key: 'order', label: 'Order', width: '80px' }
            ],
            rows: server.migration_list.packages.map((pkg: any) => ({
              name: pkg.name || 'N/A',
              version: pkg.version || 'N/A',
              needed_packages: Array.isArray(pkg.needed_packages) ? pkg.needed_packages.join(', ') : 'N/A',
              need_to_delete_packages: Array.isArray(pkg.need_to_delete_packages) ? pkg.need_to_delete_packages.join(', ') : 'N/A',
              repo_url: pkg.repo_url || 'N/A',
              gpg_key_url: pkg.gpg_key_url || 'N/A',
              custom_configs: Array.isArray(pkg.custom_configs) ? pkg.custom_configs.join(', ') : 'N/A',
              custom_data_paths: Array.isArray(pkg.custom_data_paths) ? pkg.custom_data_paths.join(', ') : 'N/A',
              order: pkg.order || 'N/A'
            }))
          });
        }
      });
    }

    // Software Model info table
    if (data.softwareModel) {
      tables.push({
        columns: [
          { key: 'field', label: 'Field', width: '200px' },
          { key: 'value', label: 'Value', width: '300px' }
        ],
        rows: [
          { field: 'ID', value: data.softwareModel.id || 'N/A' },
          { field: 'Name', value: data.softwareModel.name || 'N/A' },
          { field: 'Description', value: data.softwareModel.description || 'N/A' }
        ]
      });
    }

  } catch (error) {
    console.error('JSON parsing error:', error);
    tables.push({
      columns: [
        { key: 'error', label: 'Error', width: '500px' }
      ],
      rows: [
        { error: 'Cannot parse JSON data.' }
      ]
    });
  }

  return tables;
}

/**
 * Converts JSON data into a tree structure
 * @param jsonData - the JSON data to convert
 * @param options - conversion options
 * @returns array of tree nodes
 */
export function jsonToTree(
  jsonData: any,
  options: JsonToTreeOptions = {}
): TreeNode[] {
  const {
    maxDepth = 10,
    showArrayIndices = true,
    showPrimitiveValues = true,
    rootLabel = 'Root'
  } = options;

  let nodeId = 0;
  const visitedObjects = new WeakSet();
  
  function generateId(): string {
    return `node-${++nodeId}`;
  }

  function createTreeNode(
    data: any,
    label: string,
    level: number,
    path: string,
    parentPath: string = ''
  ): TreeNode {
    const fullPath = parentPath ? `${parentPath}.${path}` : path;
    const currentNodeId = generateId();

    if (data === null || data === undefined) {
      return {
        id: currentNodeId,
        label: `${label}: ${data}`,
        value: data,
        type: 'primitive',
        level,
        path: fullPath,
        expanded: false
      };
    }

    if (Array.isArray(data)) {
      const children: TreeNode[] = [];
      
      if (level < maxDepth) {
        data.forEach((item, index) => {
          const itemLabel = showArrayIndices ? `[${index}]` : `Item ${index + 1}`;
          children.push(createTreeNode(item, itemLabel, level + 1, `[${index}]`, fullPath));
        });
      }

      return {
        id: currentNodeId,
        label: `${label} (${data.length} items)`,
        value: data,
        type: 'array',
        children,
        level,
        path: fullPath,
        expanded: level < 2 // The first 2 levels are expanded by default
      };
    }

    if (typeof data === 'object') {
      // Guard against circular references
      if (visitedObjects.has(data)) {
        return {
          id: currentNodeId,
          label: `${label} (circular reference)`,
          value: '[Circular Reference]',
          type: 'primitive',
          level,
          path: fullPath,
          expanded: false
        };
      }
      
      visitedObjects.add(data);
      const children: TreeNode[] = [];
      
      if (level < maxDepth) {
        Object.keys(data).forEach(key => {
          children.push(createTreeNode(data[key], key, level + 1, key, fullPath));
        });
      }

      return {
        id: currentNodeId,
        label: `${label} (${Object.keys(data).length} properties)`,
        value: data,
        type: 'object',
        children,
        level,
        path: fullPath,
        expanded: level < 2 // The first 2 levels are expanded by default
      };
    }

    // Primitive type
    const displayValue = showPrimitiveValues ? `: ${data}` : '';
    return {
      id: currentNodeId,
      label: `${label}${displayValue}`,
      value: data,
      type: 'primitive',
      level,
      path: fullPath,
      expanded: false
    };
  }

  return [createTreeNode(jsonData, rootLabel, 0, 'root')];
}

/**
 * Flattens tree nodes into an array
 * @param treeNodes - array of tree nodes
 * @returns flattened array of nodes
 */
export function flattenTreeNodes(treeNodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  
  function traverse(nodes: TreeNode[]) {
    nodes.forEach(node => {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    });
  }
  
  traverse(treeNodes);
  return result;
}

/**
 * Finds the node at a specific path within the tree nodes
 * @param treeNodes - array of tree nodes
 * @param path - the path to find
 * @returns the found node, or null
 */
export function findTreeNodeByPath(treeNodes: TreeNode[], path: string): TreeNode | null {
  const flattened = flattenTreeNodes(treeNodes);
  return flattened.find(node => node.path === path) || null;
}

/**
 * Toggles the expanded state of a tree node
 * @param treeNodes - array of tree nodes
 * @param nodeId - ID of the node to toggle
 * @returns the updated array of tree nodes
 */
export function toggleTreeNode(treeNodes: TreeNode[], nodeId: string): TreeNode[] {
  function toggleNode(nodes: TreeNode[]): TreeNode[] {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, expanded: !node.expanded };
      }
      if (node.children) {
        return { ...node, children: toggleNode(node.children) };
      }
      return node;
    });
  }
  
  return toggleNode(treeNodes);
}

/**
 * Filters tree nodes
 * @param treeNodes - array of tree nodes
 * @param searchTerm - the search term
 * @returns the filtered array of tree nodes
 */
export function filterTreeNodes(treeNodes: TreeNode[], searchTerm: string): TreeNode[] {
  if (!searchTerm.trim()) return treeNodes;
  
  const term = searchTerm.toLowerCase();
  
  function filterNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.reduce((acc: TreeNode[], node) => {
      const matches = node.label.toLowerCase().includes(term) || 
                     (node.value && String(node.value).toLowerCase().includes(term));
      
      if (matches) {
        acc.push(node);
      } else if (node.children) {
        const filteredChildren = filterNodes(node.children);
        if (filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren,
            expanded: true // Show filtered nodes in the expanded state
          });
        }
      }
      
      return acc;
    }, []);
  }
  
  return filterNodes(treeNodes);
}
