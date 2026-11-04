/**
 * Name of a connection made from a cloud resource. Names stay ASCII-safe (the CSP's
 * display name goes in the description), and cm-honeybee requires a connection name to
 * be unique across every source group, so the group id keeps the same resource added to
 * two groups apart.
 */
export function cspConnectionName(
  resourceType: string,
  resourceId: string,
  sourceGroupId: string,
): string {
  const resource = `${resourceType}-${resourceId}`
    .replace(/[^A-Za-z0-9-]/g, '-')
    .slice(0, 50);
  return `${resource}-${sourceGroupId.slice(0, 8)}`;
}
