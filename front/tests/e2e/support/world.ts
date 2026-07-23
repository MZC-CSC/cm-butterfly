/**
 * Scenario-wide state shared across steps (identifying created infra/nodes, recommendation
 * results, etc.). A migration scenario spans several screens and stages, so the identifiers
 * of created resources are collected here for later stages (nginx install, load test,
 * cleanup) to reference.
 */
export const scenarioState: {
  /** Name of the source group currently in play (recorded by the register step → referenced by the collect/save steps) */
  sourceGroupName?: string;
  /** Name of the source model currently in play (recorded by the source-model/custom-model save steps → referenced by the recommend step).
   *  Kept here rather than as a module-local variable because different step files need to see the same value. */
  sourceModelName?: string;
  /** Name of the created target infra (MCI) */
  infraName?: string;
  /** ID of the created infra (within nsId) */
  infraId?: string;
  /** ID of the node targeted for load/commands */
  nodeId?: string;
  /** Node's public IP (host for external nginx access / load target) */
  nodePublicIp?: string;
  /** Node's SSH account — nodes created by tumblebug use cb-user (different from the source server's ubuntu) */
  nodeUserName?: string;
  /** List of the node's security group ids — the targets to open port 80 on */
  securityGroupIds?: string[];
  /** Last recommended spec (for verification) */
  lastRecommendedSpec?: string;
  /** Name of the software source model (SW collect → referenced by the SW recommend step) */
  softwareSourceModelName?: string;
  /** Name of the software migration workflow (run → referenced by the status-check step) */
  softwareWorkflowName?: string;
  /**
   * The *time the software migration workflow was run*.
   *
   * This is the only key for singling out grasshopper runs as ours. Neither the infra name
   * (`infra101`) nor the node id distinguishes it from records left by a prior run, because
   * cb-tumblebug reuses the same values.
   */
  swRunStartedAt?: number;
  /** cm-grasshopper execution ids (only those started by this run) */
  swExecutionIds?: string[];
  /** Per-software results reported by the API — compared against the results screen */
  swMigrationRows?: any[];
  /** Whether the nginx targeted by the load test came up *via software migration* */
  nginxFromMigration?: boolean;
} = {};

export function resetScenarioState(): void {
  for (const k of Object.keys(scenarioState)) {
    delete (scenarioState as Record<string, unknown>)[k];
  }
}
