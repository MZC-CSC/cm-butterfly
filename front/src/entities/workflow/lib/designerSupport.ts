import { ITaskGroupResponse } from '@/entities/workflow/model/types';
import { analyzeTopology } from '@/entities/workflow/lib/designerTopology';

/**
 * Decides, in one place, **whether this workflow may be opened in the workflow tool.**
 *
 * The tool draws by stacking boxes, so some execution graphs cannot be transferred as-is.
 * Force-opening something that can't be transferred makes the view diverge from the real
 * execution, and saving in that state silently changes the execution order. So anything that
 * can't be opened is **sent as JSON without being opened.**
 *
 * ★ This decision is needed in two places and the two must never diverge:
 *   ① when the workflow tool loads a workflow, and
 *   ② when Edit / Clone&Edit is clicked on the execution-status screen (open in the tool vs. as JSON).
 * That's why both call this single function.
 *
 * The decision is made by **round-trip comparison** — build the diagram from the edges, then extract
 * the edges back from that diagram; if even one differs from the original, it's treated as un-openable.
 * That way there's no need to maintain a list of "what is supported." As the tool learns to draw more
 * shapes, this decision widens automatically, and shapes it can't yet handle (e.g. a branch that drops
 * out mid-fork) are filtered out automatically.
 */
export interface IDesignerSupport {
  /** Whether it may be opened in the workflow tool */
  canEdit: boolean;
  /** Reason it can't be opened. A sentence safe to show to the user as-is */
  reasons: string[];
}

export function checkDesignerSupport(
  taskGroups: Array<ITaskGroupResponse> | undefined,
): IDesignerSupport {
  const analysis = analyzeTopology(taskGroups);
  return {
    canEdit: analysis.representable,
    reasons: analysis.warnings,
  };
}
