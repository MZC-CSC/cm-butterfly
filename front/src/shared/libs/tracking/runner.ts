/**
 * 장시간 작업 추적 러너
 *
 * 오래 걸리는 작업은 사용자가 그 화면을 떠난 뒤에 끝난다. 결과를 잡으려면 화면과 무관하게 도는
 * 무언가가 필요한데, 그 "무언가" 를 작업마다 따로 만들면 주기·중첩 방지·로그인 시 시작 같은 코드가
 * 그만큼 복제된다.
 *
 * 그래서 **"언제 돌릴지" 만 공통으로 묶는다.** 무엇을 물어볼지는 작업마다 다르므로 체커가 각자 안다.
 *
 * ```
 * [러너]  주기 · 중첩 방지 · 로그인/로그아웃 생명주기
 *   ├─ 삭제 체커       check()
 *   ├─ 부하 체커       check()
 *   └─ 워크플로우 체커  check()
 * ```
 *
 * 완료 판정을 러너에 몰지 않은 이유 — 삭제는 cm-beetle 요청 조회로, 부하는 실행 상태로, 워크플로우는
 * 실행 목록으로 각각 다르게 끝을 판정한다. 한곳에 모으면 공통이 아니라 **작업 종류별 분기 덩어리**가
 * 되고, 작업이 늘 때마다 그 안이 자란다.
 *
 * 체커가 할 일은 두 가지다. *끝났는지 보고*, 끝났으면 *알릴지 정해서* `notify()` 를 부른다.
 * 알릴지 판단이 체커에 있는 이유는 그쪽이 맥락을 알기 때문이다 — 사용자가 지금 그 화면에서 결과를
 * 보고 있다면 굳이 배지를 올릴 필요가 없고, 그 판단은 알림 모듈이 할 수 없다.
 *
 * ★ **체커는 시작 시점에 이름·동작을 함께 남겨야 한다.** 끝난 뒤에는 id 밖에 없어서
 * "무엇이 끝났는지" 를 문장으로 만들 수 없다. "'주문서비스' 워크플로우 **재실행**이 끝났습니다" 처럼
 * 쓰려면 재실행이라는 동작과 이름을 시작할 때 기억해 둬야 한다.
 */

export interface Tracker {
  /** 로그·디버깅용 식별자. */
  id: string;

  /**
   * 한 주기 분의 확인. 진행 중인 것이 없으면 아무것도 하지 않고 끝나야 한다.
   *
   * 던지면 러너가 삼킨다 — 체커 하나가 실패해도 나머지는 계속 돌아야 한다.
   */
  check: () => Promise<void>;

  /**
   * 아직 끝나지 않은 작업이 있는가.
   *
   * 세션 유지 판단에 쓴다. 배경에서 도는 작업이 있는 동안에는 손을 떼고 있어도 세션을 이어 준다 —
   * 결과를 보여 줄 상대가 사라지면 지켜본 의미가 없기 때문이다.
   */
  hasWork: () => boolean;

  /** 로그인 시 서버에 남아 있던 것을 이어받는다(선택). */
  resume?: () => Promise<void>;

  /** 로그아웃 시 정리(선택). */
  reset?: () => void;
}

const POLL_INTERVAL_MS = 10_000;

const trackers: Tracker[] = [];
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * 체커를 등록한다. 모듈 로드 시점에 부르면 된다.
 *
 * 같은 id 를 두 번 등록하면 나중 것을 무시한다 — 모듈이 두 번 평가돼도 중복해서 돌지 않게.
 */
export function registerTracker(tracker: Tracker): void {
  if (trackers.some(t => t.id === tracker.id)) return;
  trackers.push(tracker);
}

/** 아직 끝나지 않은 작업이 하나라도 있는가(세션 유지 판단용). */
export function hasBackgroundWork(): boolean {
  return trackers.some(t => {
    try {
      return t.hasWork();
    } catch {
      return false;
    }
  });
}

async function runOnce(): Promise<void> {
  for (const tracker of trackers) {
    try {
      await tracker.check();
    } catch (e) {
      // 하나가 실패해도 나머지는 돈다. 다음 주기에 다시 시도한다.
      console.warn(`tracker "${tracker.id}" check failed`, e);
    }
  }
}

function scheduleNext(): void {
  if (!running) return;
  // 응답이 온 뒤에 다음 회차를 잡는다. setInterval 이면 조회가 주기보다 길어질 때 겹친다.
  pollTimer = setTimeout(async () => {
    await runOnce();
    scheduleNext();
  }, POLL_INTERVAL_MS);
}

/**
 * 추적을 시작한다 — 로그인 시점이 트리거다.
 *
 * 어느 브라우저로 접속하든 서버에 남아 있던 것을 이어받아, 해당 화면에 들어가기 *전에* 정리한다.
 */
export async function startTracking(): Promise<void> {
  if (running) return;
  running = true;

  for (const tracker of trackers) {
    try {
      await tracker.resume?.();
    } catch (e) {
      console.warn(`tracker "${tracker.id}" resume failed`, e);
    }
  }

  // 주기만 걸면 그 시간만큼 낡은 상태를 보여준다.
  await runOnce();
  scheduleNext();
}

/** 로그아웃 시 정지. */
export function stopTracking(): void {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  trackers.forEach(t => {
    try {
      t.reset?.();
    } catch {
      /* 정리 실패가 로그아웃을 막을 이유는 없다 */
    }
  });
}
