import { ref } from 'vue';

/**
 * The two choices a person can make about the guidance, and the only two things
 * about it worth keeping.
 *
 * Whether the migration has been finished is *not* here. That is answered by the
 * data - a workflow that has been run is a workflow that has been run, on any
 * browser - so storing it would only add a second answer that can disagree with
 * the first. See `useMigrationProgress`.
 *
 * What is left is what the data cannot say: whether the welcome has already been
 * shown once, and whether the reader has asked for the guidance to stop. Both live
 * in localStorage, as every other preference in this console does.
 *
 * Move to another browser and these reset. The only person that affects is one who
 * has not finished yet - and showing them the guidance again is the better mistake.
 */

const WELCOME_KEY = 'cmig.guidedSetup.welcomeSeen';
const OFF_KEY = 'cmig.guidedSetup.off';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    // Private browsing can refuse storage. Behave as if nothing was ever chosen.
    return false;
  }
}

function write(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Nothing to do: the guidance will simply appear again next time.
  }
}

export const guidanceOff = ref<boolean>(read(OFF_KEY));

export function setGuidanceOff(off: boolean): void {
  guidanceOff.value = off;
  write(OFF_KEY, off);
}

export const welcomeSeen = ref<boolean>(read(WELCOME_KEY));

export function markWelcomeSeen(): void {
  welcomeSeen.value = true;
  write(WELCOME_KEY, true);
}
