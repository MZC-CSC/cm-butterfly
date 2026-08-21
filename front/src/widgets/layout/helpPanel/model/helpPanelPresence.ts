import { ref, readonly } from 'vue';

/**
 * A way for a screen to open the help panel.
 *
 * The panel already holds an explanation of every screen, written out in full. What it
 * did not have was anyone to open it: the reader had to know the icon in the corner was
 * there and think to press it, which is exactly what someone new does not know.
 *
 * A counter rather than a flag - two requests in a row have to be two events, and a flag
 * that is already true says nothing the second time.
 */
const requests = ref(0);

export const helpPanelOpenRequests = readonly(requests);

export function requestHelpPanel(): void {
  requests.value += 1;
}
