/**
 * System reserved names that users cannot use
 *
 * - __main_workflow__: Main workflow TaskGroup (CM-Cicada Flat structure)
 *   a single flat TaskGroup that contains every task
 */

export const RESERVED_NAMES: string[] = [];

/**
 * Check if a name matches the reserved pattern
 *
 * @param name - Name to check
 * @returns true if matches reserved pattern
 */
export function isReservedRootTaskGroupPattern(name: string): boolean {
  return name.startsWith('__root_task_group_') && name.endsWith('__');
}

/**
 * Check if a name is reserved by the system
 *
 * @param name - Name to check
 * @returns true if reserved, false otherwise
 */
export function isReservedName(name: string): boolean {
  return RESERVED_NAMES.includes(name) || isReservedRootTaskGroupPattern(name);
}

/**
 * Get error message for reserved name
 *
 * @param name - Reserved name
 * @returns Error message
 */
export function getReservedNameError(name: string): string {
  if (isReservedRootTaskGroupPattern(name)) {
    return `"${name}" matches a reserved system pattern (__root_task_group_*__). Please use a different name.`;
  }
  return `"${name}" is reserved by the system. Please use a different name.`;
}


