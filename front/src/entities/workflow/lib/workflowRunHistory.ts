import { useGetWorkflowRuns } from '@/entities/workflow/api';

/**
 * Has this workflow ever run.
 *
 * **The engine does not record "which definition was used for a run".** So if you edit a
 * workflow that has run, opening a past run shows the values of the *current definition* as
 * if they were that run's values. Users have no way to tell them apart. That's why we allow
 * editing when there is no history, and block editing the original (edit a clone instead) when there is.
 *
 * **The workflow itself has no property holding run history.** It can only be known by
 * querying the run list and taking its length, and the run-status screen's button layout uses the same value.
 *
 * ★ **A failed query is treated as "never run".**
 * A freshly created workflow answers with a failure for a while because the engine can't find
 * the DAG in Airflow (`400` + `The Dag with ID ... not found`). That is not an error but means
 * *it has not run even once yet*, so treating it as run would **tell the user to clone-and-edit
 * and then lock that clone too.** The opposite risk (treating something that really ran as
 * editable) doesn't reach here, since the only entry path is the single run-status screen.
 *
 * Measured (2026-07-19, dev server): about **5 seconds** of `400 DAG not found` right after
 * cloning, then `200` (an empty list or `null` when there are no runs). Measured at 0.5s intervals.
 */
export async function hasWorkflowRunHistory(
  workflowId: string,
): Promise<boolean> {
  if (!workflowId) return false;
  try {
    const { data, execute } = useGetWorkflowRuns(workflowId);
    await execute();
    return (data.value?.responseData ?? []).length > 0;
  } catch {
    return false;
  }
}
