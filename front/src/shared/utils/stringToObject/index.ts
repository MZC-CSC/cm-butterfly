export function parseRequestBody(requestBodyString: string): object {
  try {
    // JSON.parse를 사용하여 문자열을 객체로 변환
    const parsedObject = JSON.parse(requestBodyString);
    return parsedObject;
  } catch (error) {
    return {};
  }
}

/**
 * request_body 문자열이 리터럴 body 값이 아니라 cm-cicada 런타임 참조인지 판별한다.
 *
 * cm-cicada v0.5.1 부터 템플릿 task 의 request_body 가 리터럴 JSON 대신
 * 앞선 task 의 출력을 주입하는 참조 문자열로 온다. 예:
 *   - 점 경로 참조: `infra_recommend_get.cloudInfraModel`
 *   - task 이름 참조: `infra_recommend_get`
 *   - 템플릿 참조: `${...}`
 * 이런 문자열은 JSON 이 아니므로 `parseRequestBody` 가 `{}` 로 떨어뜨린다.
 * 참조를 리터럴로 오인해 파싱하면 값이 통째로 사라지므로, 참조는 파싱 대상에서 제외하고
 * 컴포넌트 스켈레톤으로 폴백해야 한다.
 *
 * 판별 규칙: 비어있지 않은 문자열이면서 유효한 JSON 이 아니면 참조로 본다
 * (리터럴 body 는 항상 유효한 JSON — 객체/배열/문자열/숫자).
 */
export function isReferenceRequestBody(requestBodyString: unknown): boolean {
  if (typeof requestBodyString !== 'string') return false;
  const trimmed = requestBodyString.trim();
  if (trimmed === '') return false;
  try {
    JSON.parse(trimmed);
    return false; // 유효 JSON → 리터럴 body, 참조 아님
  } catch {
    return true; // 파싱 불가 → 런타임 참조로 간주
  }
}
