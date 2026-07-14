/**
 * 태스크 로그를 화면에 뿌릴 수 있는 형태로 정리한다.
 *
 * 엔진이 돌려주는 로그는 평문이 아니다. 실행 엔진의 응답(호스트명, 로그 본문)
 * 튜플 리스트를 통째로 문자열화한 것이고, 줄바꿈도 실제 개행이 아니라 리터럴
 * 두 글자다. 그대로 뿌리면 로그 전체가 한 줄로 뭉개지고 앞뒤에 군더더기가 붙는다.
 *
 * ⚠️ 임시 조치다. 엔진이 평문을 돌려주게 되면(업스트림 요청) 이 유틸은 사라진다.
 *    형식이 예상과 다르면 원문을 그대로 돌려준다 — 파싱 실패를 감추지 않는다.
 */

/** `[('hostname', '...본문...')]` 껍데기를 벗기고 리터럴 개행을 실제 개행으로 */
export function normalizeTaskLog(raw: unknown): string {
  const text = toText(raw);
  if (!text) return '';

  const unwrapped = unwrapTupleList(text) ?? text;
  return unwrapped.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function toText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const content = (raw as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

function unwrapTupleList(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[(') || !trimmed.endsWith(')]')) return null;

  // ('hostname', '<본문>') 에서 본문만 꺼낸다. 본문은 마지막 따옴표 쌍 안에 있다.
  const match = trimmed.match(
    /^\[\(\s*['"][^'"]*['"]\s*,\s*(['"])([\s\S]*)\1\s*\)\]$/,
  );
  return match ? match[2] : null;
}

const FAILURE_MARKERS = [
  'AirflowException',
  'Traceback (most recent call last)',
  'non-zero exit code',
  'ERROR -',
  'Error:',
];

/**
 * 로그에서 실패 원인으로 보이는 구간을 발췌한다.
 *
 * 엔진은 실패 사유를 요약해 주지 않는다(응답에 그런 필드가 없다). 그래서 로그를
 * 뒤에서부터 훑어 원인 표지를 찾는다. 찾지 못하면 **추측하지 않고 빈 값을 돌려준다** —
 * 그때 화면은 "원인을 찾지 못했다"고 말하고 전체 로그를 보게 한다.
 */
export function extractFailureSummary(log: string, maxLines = 6): string {
  if (!log) return '';

  const lines = log.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (FAILURE_MARKERS.some(marker => lines[i].includes(marker))) {
      return lines
        .slice(i, i + maxLines)
        .join('\n')
        .trim();
    }
  }
  return '';
}
