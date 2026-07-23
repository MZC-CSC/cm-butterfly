/**
 * Per-run unique names — avoid re-registration collisions for same-named resources
 * against the real backend (@seed/@unit/@scenario).
 *
 * honeybee (source group), cicada (workflow), etc. have a UNIQUE constraint on the
 * name, so re-registering with the same name is rejected and leaves an error modal
 * open, which obscures subsequent actions. We append a unique suffix per run so it's
 * always a new registration.
 *
 * ★ RUN_ID must be *the same across processes*.
 *   seed, functional, and scenario run in different worker processes. Using Date.now()
 *   at module load time would give a different value per project, so functional would
 *   look for the `e2e-nano-source-123456` that seed created under the name
 *   `e2e-nano-source-789012` and fail to find it.
 *   So globalSetup plants E2E_RUN_ID in the main process (inherited by workers), and we read that value here.
 */
const RUN_ID = process.env.E2E_RUN_ID || String(Date.now()).slice(-6);

export function uniqueName(base: string): string {
  return `${base}-${RUN_ID}`;
}

export { RUN_ID };
