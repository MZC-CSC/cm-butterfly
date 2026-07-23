/**
 * Task Property Order Configuration
 * Controls the display order of properties in the Task Editor's body params area.
 */

export interface PropertyOrderRule {
  path: string;  // path to apply to (e.g. 'body_params', 'body_params.servers[]')
  order: string[];  // property names listed in the order to show them
}

/**
 * Per-task property order settings
 * - Keyed by step.type (task component type) to define each task's ordering rule
 * - Uses step.type, not step.name (step.name is user-editable)
 * - Controls the property order of a specific path, based on the path
 * - Tasks without a setting keep the default order
 */
export const TASK_PROPERTY_ORDER_CONFIG: Record<string, PropertyOrderRule[]> = {
  // Beetle Infra Migration Task
  'beetle_task_infra_migration': [
    {
      path: 'body_params',
      order: [  
        'description',
        'targetCloud',
        'targetInfra',
        'targetSpecList',
        'targetOsImageList',
        'targetVNet',
        'targetSecurityGroupList',
        'targetSshKey',
        'status'
      ]
    },
    {
      path: 'body_params.targetInfra',
      order: [
        'name',
        'description',        
        'nodeGroups',
        'installMonAgent',  
        'label',
        'systemLabel',
        'postCommand'
      ]
    }
  ],
  
  // Grasshopper Software Migration Task
  'grasshopper_task_software_migration': [
    {
      path: 'body_params.targetSoftwareModel.servers[]',
      order: [
        'source_connection_info_id',
        'migration_list',
        'errors'
      ]
    },
    {
        path: 'body_params.targetSoftwareModel.servers[].migration_list.packages[]',
        order: [
          'name',
          'version',
          'order',
          'repo_use_os_version_code',          
          'repo_url',
          'gpg_key_url',
          'custom_configs'
        ]
      }
  ]
};

/**
 * Find the ordering rule for the current path.
 *
 * @param taskName - Task component type (step.type, not step.name)
 * @param currentPath - path of the current field (e.g. 'body_params.servers[]')
 * @returns the order array, or null if there's no setting
 */
export function getPropertyOrder(
  taskName: string,
  currentPath: string
): string[] | null {
  const rules = TASK_PROPERTY_ORDER_CONFIG[taskName];
  if (!rules) return null;

  const matchedRule = rules.find(rule => rule.path === currentPath);
  return matchedRule ? matchedRule.order : null;
}

/**
 * Sort a property key array according to a given order.
 * - Properties listed in `order` come first, in that order
 * - The rest follow in their original order
 *
 * @param properties - property key array to sort
 * @param order - preferred order array
 * @returns the sorted property key array
 */
export function sortPropertiesByOrder(
  properties: string[],
  order: string[]
): string[] {
  // Place first only those in `order` that actually exist
  const ordered = order.filter(key => properties.includes(key));

  // The remaining properties not in `order` (keep original order)
  const remaining = properties.filter(key => !order.includes(key));
  
  return [...ordered, ...remaining];
}

