/**
 * The cloud account the CSP tests read from.
 *
 * These are function tests against a real server (08-주의사항 §A): when the values are
 * missing the run stops here instead of carrying on with placeholders, so nobody mistakes a
 * run without a real account for a pass.
 */
export interface CspAccess {
  provider: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export function cspAccess(): CspAccess {
  const access = {
    provider: process.env.TEST_CSP_PROVIDER ?? '',
    region: process.env.TEST_CSP_REGION ?? '',
    accessKey: process.env.TEST_CSP_ACCESS_KEY ?? '',
    secretKey: process.env.TEST_CSP_SECRET_KEY ?? '',
  };
  const missing = Object.entries({
    TEST_CSP_PROVIDER: access.provider,
    TEST_CSP_REGION: access.region,
    TEST_CSP_ACCESS_KEY: access.accessKey,
    TEST_CSP_SECRET_KEY: access.secretKey,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `CSP 계정 값이 없다: ${missing.join(', ')} — 실제 계정 없이 돌리지 않는다`,
    );
  }
  return access;
}
