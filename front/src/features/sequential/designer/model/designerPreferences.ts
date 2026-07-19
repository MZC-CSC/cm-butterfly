// 워크플로우 툴의 개인 취향 설정.
//
// 워크플로우가 아니라 *보는 사람*에 딸린 값이므로 워크플로우와 함께 저장하지
// 않고 브라우저에 남긴다. 저장에 실패해도(사생활 보호 모드 등) 기능은 그대로
// 동작해야 하므로 실패는 삼킨다.

const AUTO_OPEN_PROPERTIES = 'workflow-designer.auto-open-properties';

export function isAutoOpenPropertiesEnabled(): boolean {
  try {
    // 기본값은 켜짐 — 태스크는 놓은 뒤 값을 채워야 하므로 바로 열리는 편이 낫다.
    return window.localStorage.getItem(AUTO_OPEN_PROPERTIES) !== 'off';
  } catch {
    return true;
  }
}

export function setAutoOpenPropertiesEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUTO_OPEN_PROPERTIES, enabled ? 'on' : 'off');
  } catch {
    /* 저장할 수 없는 브라우저에서는 이번 세션 동안만 기본값으로 동작한다 */
  }
}
