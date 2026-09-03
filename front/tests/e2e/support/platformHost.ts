import { execFileSync } from 'child_process';

/**
 * Run a command on the machine the lineup is running on.
 *
 * Used to make something fail on purpose. The health screen's whole point is that it says when a
 * service has stopped answering, and the only honest way to show that is to stop one - a mocked
 * response would demonstrate the mock.
 *
 * ★ Only the services this file names can be touched, and only stop/start. A free-form command
 *   channel into the platform host is not something a test suite should carry, and the failure it
 *   would cause on a wrong argument is the kind that takes an environment down rather than a test.
 */

const HOST = (() => {
  const base = process.env.BASE_URL ?? '';
  return base.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
})();

const KEY = process.env.E2E_SSH_KEY ?? '';

/**
 * The service to stop for the demonstration.
 *
 * cm-damselfly holds the models, and it is the one service nothing else in the lineup waits on to
 * start - stopping cb-tumblebug or cb-spider would cascade, and getting the lineup back would take
 * longer than the take. It is restored immediately either way.
 */
export const DEMO_SERVICE = 'cm-damselfly';

function ssh(command: string): string {
  if (!HOST) throw new Error('BASE_URL 이 없어 플랫폼 호스트를 알 수 없다');
  return execFileSync(
    'ssh',
    [
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'ConnectTimeout=15',
      '-i',
      KEY,
      `ubuntu@${HOST}`,
      command,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
}

/** Stop one service so the health screen has something real to report. */
export function stopService(name: string): void {
  if (name !== DEMO_SERVICE) {
    throw new Error(`시연용으로 내릴 수 있는 서비스는 ${DEMO_SERVICE} 뿐이다`);
  }
  ssh(`docker stop ${name}`);
}

/** Put it back. Called in a finally, so a failed assertion does not leave the lineup short. */
export function startService(name: string): void {
  if (name !== DEMO_SERVICE) {
    throw new Error(`시연용으로 올릴 수 있는 서비스는 ${DEMO_SERVICE} 뿐이다`);
  }
  ssh(`docker start ${name}`);
}

/** Whether it is running, for confirming the environment is back as it was. */
export function isRunning(name: string): boolean {
  const out = ssh(
    `docker inspect -f '{{.State.Running}}' ${name} 2>/dev/null || echo false`,
  );
  return out.trim() === 'true';
}
