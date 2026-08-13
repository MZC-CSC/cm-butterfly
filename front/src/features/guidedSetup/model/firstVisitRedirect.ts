import type VueRouter from 'vue-router';
import type { Route } from 'vue-router';
import { MENU_ID } from '@/entities';
import { refreshProgress, currentStep, progressKnown } from './useMigrationProgress';
import { guidanceOff, welcomeSeen } from './guidedSetupPreferences';

/**
 * Send someone who has nothing here yet to the guide, once.
 *
 * Logging in lands on a list. For a first-time visitor that list is empty, and an empty
 * list explains nothing - it is exactly the moment the guide is for.
 *
 * ## Not going round in circles
 *
 * The guide's Start button leads back to the very list this sends people away from, so
 * a naive rule would bounce between the two forever. Two separate things stop it, either
 * of which is enough on its own:
 *
 *   1. **Once per load.** The check runs on the first navigation and never again, so
 *      even a rule that kept saying "yes" could only redirect one time.
 *   2. **Once ever.** Both buttons on the welcome mark it as seen, and a seen welcome is
 *      never offered again. So the next load does not redirect either - the visitor is
 *      taken to the list they asked for and left alone.
 *
 * The first is the belt; the second is the braces. Neither depends on getting the timing
 * right, which is what makes this safe.
 */

let checked = false;

/** Test/dev seam - a fresh page load starts over anyway, this is for unit runs. */
export function resetFirstVisitRedirect(): void {
  checked = false;
}

export function installFirstVisitRedirect(router: VueRouter): void {
  router.beforeEach(async (to: Route, _from: Route, next) => {
    if (checked) return next();

    // Only inside the console, and never at the guide itself - arriving there is the
    // destination, not a reason to redirect.
    if (!to.path.startsWith('/main') || to.name === MENU_ID.MIGRATION_GUIDE) {
      return next();
    }

    // Nothing to offer if the welcome is spent or the reader turned guidance off.
    if (welcomeSeen.value || guidanceOff.value) {
      checked = true;
      return next();
    }

    checked = true;

    try {
      if (!progressKnown.value) await refreshProgress();
    } catch {
      return next();
    }

    // Only for an installation with nothing in it. Anyone further along asked for the
    // screen they asked for.
    if (progressKnown.value && currentStep.value === 1) {
      return next({ name: MENU_ID.MIGRATION_GUIDE });
    }
    next();
  });
}
