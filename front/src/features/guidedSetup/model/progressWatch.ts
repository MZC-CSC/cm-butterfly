import { axiosInstance } from '@/shared/libs/api/instance';
import { refreshProgress } from './useMigrationProgress';

/**
 * Notice when the work moves, without every screen having to remember to say so.
 *
 * ## The problem this solves
 *
 * The step is worked out from the data, so it changes the moment the data does - register
 * a source service and step 1 is finished. But the reading was only taken when a screen
 * opened, and registering happens *while* the screen is already open. So the list filled
 * up in front of the reader and the guidance kept saying nothing was registered, until
 * the page was reloaded by hand and the answer jumped two steps at once.
 *
 * ## Why here and not in each screen
 *
 * Calling a refresh from every place that registers, collects, saves or runs something
 * means finding all of them, and finding them again each time one is added. The one thing
 * they have in common is that they all go out through this client, and the operation is
 * in the URL. So the trigger is read from the traffic: any call whose operation *acts*
 * rather than reads is taken as a change worth re-reading after.
 *
 * Reads are left alone by name - `list-…`, `get-…`, `GetModels` do not start with an
 * acting verb, so a screen full of lists causes no extra work.
 */
const ACTING_VERB =
  /^(register|create|add|update|edit|delete|remove|import|collect|save|run|start|stop|refresh|convert|generate|migrate|execute)/i;

/** One reading, however many requests arrive together - a bulk import is dozens at once. */
const SETTLE_MS = 800;

let installed = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function operationOf(url: string | undefined): string {
  if (!url) return '';
  const path = url.split('?')[0];
  const last = path.split('/').filter(Boolean).pop();
  return last ?? '';
}

function actsOnData(url: string | undefined): boolean {
  return ACTING_VERB.test(operationOf(url));
}

function scheduleRefresh(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void refreshProgress().catch(() => undefined);
  }, SETTLE_MS);
}

/**
 * Idempotent: whoever gets here first installs it, and the rest are no-ops. Called from
 * app start-up, so a reader who never opens the guide pays for nothing but the check.
 */
export function installProgressWatch(): void {
  if (installed) return;
  installed = true;

  axiosInstance.interceptors.response.use(
    response => {
      // A refusal changed nothing, so only a reply that succeeded counts.
      if (actsOnData(response?.config?.url)) scheduleRefresh();
      return response;
    },
    error => Promise.reject(error),
  );
}
