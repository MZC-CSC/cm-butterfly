/**
 * Decide the RUN_ID once at the start of the run.
 *
 * The seed, functional, and scenario projects run in different worker processes. If the resource
 * name suffix (RUN_ID) is generated separately per process, functional looks for the data seed
 * created under a different name and can't find it.
 *
 * globalSetup runs in the main process *before* workers are forked, so the environment variable
 * planted here is inherited as-is by every worker. support/naming.ts reads and uses this value.
 */
export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_ID ||= String(Date.now()).slice(-6);
  console.log(
    `[e2e] RUN_ID=${process.env.E2E_RUN_ID} (created-resource name suffix)`,
  );
}
