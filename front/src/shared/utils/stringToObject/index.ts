export function parseRequestBody(requestBodyString: string): object {
  try {
    // Use JSON.parse to convert the string into an object
    const parsedObject = JSON.parse(requestBodyString);
    return parsedObject;
  } catch (error) {
    return {};
  }
}

/**
 * Determines whether a request_body string is a cm-cicada runtime reference rather than a literal body value.
 *
 * From cm-cicada v0.5.1 onward, a template task's request_body arrives as a reference string that
 * injects a previous task's output instead of literal JSON. Examples:
 *   - dot-path reference: `infra_recommend_get.cloudInfraModel`
 *   - task-name reference: `infra_recommend_get`
 *   - template reference: `${...}`
 * These strings are not JSON, so `parseRequestBody` drops them to `{}`.
 * Parsing a reference as if it were a literal loses the value entirely, so references must be
 * excluded from parsing and fall back to a component skeleton.
 *
 * Rule: a non-empty string that is not valid JSON is treated as a reference
 * (a literal body is always valid JSON — object/array/string/number).
 */
export function isReferenceRequestBody(requestBodyString: unknown): boolean {
  if (typeof requestBodyString !== 'string') return false;
  const trimmed = requestBodyString.trim();
  if (trimmed === '') return false;
  try {
    JSON.parse(trimmed);
    return false; // valid JSON → literal body, not a reference
  } catch {
    return true; // cannot parse → treated as a runtime reference
  }
}
