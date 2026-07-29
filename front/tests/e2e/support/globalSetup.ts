/**
 * Decide the RUN_ID once at the start of the run.
 *
 * The seed, functional, and scenario projects run in different worker processes. If the resource
 * name suffix (RUN_ID) is generated separately per process, functional looks for the data seed
 * created under a different name and can't find it.
 *
 * globalSetup runs in the main process *before* workers are forked, so the environment variable
 * planted here is inherited as-is by every worker. support/naming.ts reads and uses this value.
 */
export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_ID ||= String(Date.now()).slice(-6);
  console.log(
    `[e2e] RUN_ID=${process.env.E2E_RUN_ID} (created-resource name suffix)`,
  );
  requireRealSourceCredentials();
}

/**
 * Refuse to start a scenario run that has no real source server to work with.
 *
 * Without the address and key, fixtures/test-data.ts falls back to an empty IP and the placeholder
 * password `e2e-dummy-pass`. Registration still succeeds - the product has no way to know the
 * credential is fictional - and the run only comes apart later at collection, as an SSH failure
 * that reads like a product fault. Hours have gone into chasing that twice now: once in July, and
 * again while checking the file import, where two working paths were both called broken.
 *
 * 08-주의사항 §A said to fail loudly here rather than run on dummies. It was written down and never
 * put into code, so nothing stopped it happening again. This is that rule, enforced.
 *
 * Only the runs that talk to a real server are covered. @unit and @dummy are meant to use
 * placeholders, and the projects that carry them set E2E_ALLOW_DUMMY_SOURCE.
 */
function requireRealSourceCredentials(): void {
  if (process.env.E2E_ALLOW_DUMMY_SOURCE === '1') return;

  const args = process.argv.join(' ');
  const scenarioRun = /--project[= ](integration|scenario|live)/.test(args);
  if (!scenarioRun) return;

  const missing = [
    ['TEST_SOURCE_NANO_IP', process.env.TEST_SOURCE_NANO_IP],
    ['TEST_SOURCE_MICRO_IP', process.env.TEST_SOURCE_MICRO_IP],
    [
      'TEST_SOURCE_PRIVATE_KEY',
      process.env.TEST_SOURCE_PRIVATE_KEY ||
        process.env.TEST_SOURCE_NANO_PRIVATE_KEY,
    ],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length === 0) return;

  throw new Error(
    [
      `실서버로 도는 실행인데 필수값이 비어 있다: ${missing.join(', ')}`,
      '',
      '이대로 두면 더미 자격증명으로 등록까지 성공한 뒤 수집에서 SSH 인증 실패로 무너진다 —',
      '제품 결함처럼 보이지만 원인은 여기다(08-주의사항 §A).',
      '',
      '  export TEST_SOURCE_PRIVATE_KEY="$(cat <개인키 파일>)"',
      '  export TEST_SOURCE_NANO_IP=... TEST_SOURCE_MICRO_IP=...   # 사설 IP (§C-7)',
      '',
      '더미로 도는 것이 맞는 실행이면 E2E_ALLOW_DUMMY_SOURCE=1 을 준다.',
    ].join('\n'),
  );
}
