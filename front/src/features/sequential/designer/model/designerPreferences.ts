// Personal preference settings for the workflow tool.
//
// These values belong to the *viewer*, not the workflow, so they're kept in the
// browser rather than saved with the workflow. The feature must keep working even
// if saving fails (private browsing mode, etc.), so we swallow failures.

const AUTO_OPEN_PROPERTIES = 'workflow-designer.auto-open-properties';

export function isAutoOpenPropertiesEnabled(): boolean {
  try {
    // Default is on — a task needs its values filled in after being dropped, so opening it right away is better.
    return window.localStorage.getItem(AUTO_OPEN_PROPERTIES) !== 'off';
  } catch {
    return true;
  }
}

export function setAutoOpenPropertiesEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUTO_OPEN_PROPERTIES, enabled ? 'on' : 'off');
  } catch {
    /* On browsers that can't persist, just run with the default for this session */
  }
}
