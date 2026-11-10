/** Bucket size for display. An unknown size stays unknown ('-'), it is not shown as 0. */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return i === 0 ? `${value} ${units[i]}` : `${value.toFixed(1)} ${units[i]}`;
}
