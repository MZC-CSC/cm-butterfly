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
  /**
   * The one VM the tests may register. It must be a throwaway VM created for testing — never
   * the first VM the account happens to list, which can be someone's working machine.
   */
  testVmId: string;
}

/**
 * The bucket the object storage tests collect from. Like the VM, it must be a throwaway
 * bucket created for testing — the tests read it and recommend from it.
 */
export function testBucket(): string {
  const bucket = process.env.TEST_CSP_BUCKET ?? '';
  if (!bucket) {
    throw new Error(
      'TEST_CSP_BUCKET 이 없다 — 시험용으로 만든 버킷 이름을 지정한다(남의 버킷을 쓰지 않는다)',
    );
  }
  return bucket;
}

export function cspAccess(): CspAccess {
  const access = {
    provider: process.env.TEST_CSP_PROVIDER ?? '',
    region: process.env.TEST_CSP_REGION ?? '',
    accessKey: process.env.TEST_CSP_ACCESS_KEY ?? '',
    secretKey: process.env.TEST_CSP_SECRET_KEY ?? '',
    testVmId: process.env.TEST_CSP_VM_ID ?? '',
  };
  const missing = Object.entries({
    TEST_CSP_PROVIDER: access.provider,
    TEST_CSP_REGION: access.region,
    TEST_CSP_ACCESS_KEY: access.accessKey,
    TEST_CSP_SECRET_KEY: access.secretKey,
    TEST_CSP_VM_ID: access.testVmId,
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
