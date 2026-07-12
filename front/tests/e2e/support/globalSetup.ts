/**
 * 실행 시작 시 RUN_ID를 한 번 정한다.
 *
 * seed·functional·scenario 프로젝트는 서로 다른 worker 프로세스에서 돈다. 리소스 이름의 접미사(RUN_ID)를
 * 프로세스마다 따로 만들면 seed가 만든 데이터를 functional이 다른 이름으로 찾다가 못 찾는다.
 *
 * globalSetup은 worker가 fork되기 *전에* 메인 프로세스에서 돌기 때문에, 여기서 심은 환경변수는
 * 모든 worker가 그대로 물려받는다. support/naming.ts가 이 값을 읽어 쓴다.
 */
export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_ID ||= String(Date.now()).slice(-6);
  console.log(`[e2e] RUN_ID=${process.env.E2E_RUN_ID} (생성 리소스 이름 접미사)`);
}
