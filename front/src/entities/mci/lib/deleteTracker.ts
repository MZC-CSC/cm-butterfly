import { reactive } from 'vue';
import {
  useListDeleteRequests,
  useSaveDeleteRequest,
  useUpdateDeleteRequestStatus,
  useRemoveDeleteRequest,
  type DeleteRequestRecord,
  type DeleteRequestStatus,
} from '@/entities/mci/api/deleteRequest';
import { useGetBeetleRequest, useGetMciList } from '@/entities/mci/api';
import { notify } from '@/entities/notification/lib/notificationStore';
import { registerTracker } from '@/shared/libs/tracking/runner';

/**
 * 워크로드(인프라) 삭제 추적 (BAR-1444 → BAR-1531)
 *
 * 삭제는 수 분 걸리고 실패할 수 있어서, 요청을 내고 끝이 아니라 *결과를 끝까지 따라가야* 한다.
 * 이 모듈이 그 역할을 하며 두 가지가 핵심이다.
 *
 * **서버에 보관한다** — 요청 id 를 브라우저에만 두면 다른 PC 에서는 삭제가 실패한 사실도, 그 사유도
 * 알 수 없다. 서버에 두면 어느 자리에서 로그인하든 하던 처리를 이어받는다.
 *
 * **화면과 무관하게 돈다** — 폴링이 목록 화면 안에 있으면 다른 화면으로 가는 순간 추적이 멈추고,
 * 한참 뒤 목록에 돌아와서야 조회를 시작해 뒤늦게 반영된다. 그래서 컴포넌트가 아니라 이 모듈이
 * 폴링을 소유한다. 앱이 떠 있는 동안 계속 돈다.
 *
 * 키는 인프라 이름이 아니라 **uid** 다. cb-tumblebug 에서 인프라 id 는 곧 이름이라, 지우고 같은
 * 이름으로 다시 만들면 옛 기록이 새 인프라 것으로 보인다.
 */

export type DeleteStatus = DeleteRequestStatus;

export interface DeleteRecord {
  uid: string;
  nsId: string;
  infraId: string;
  reqId: string;
  option: string; // 'terminate' | 'force'
  status: DeleteStatus;
  errorReason?: string;
}

const state = reactive<{ records: Record<string, DeleteRecord> }>({
  records: {},
});

/** 서버 응답(snake_case)을 화면이 쓰는 형태로 옮긴다. */
function fromRecord(r: DeleteRequestRecord): DeleteRecord {
  return {
    uid: r.uid,
    nsId: r.ns_id,
    infraId: r.infra_id,
    reqId: r.req_id,
    option: r.option,
    status: r.status,
    errorReason: r.error_reason || undefined,
  };
}

/** 현재 추적 중인 기록 전체(목록 렌더용). */
export function allDeleteRecords(): DeleteRecord[] {
  return Object.values(state.records);
}

/** uid 로 기록 조회. */
export function getDeleteRecord(uid: string): DeleteRecord | undefined {
  return state.records[uid];
}

/** 진행 중인 삭제가 있으면 true — 중복 요청 방어에 쓴다. */
/**
 * 배경에서 아직 끝나지 않은 삭제가 있는가.
 *
 * 세션 유지 판단에 쓴다 — 삭제가 도는 중이라면 사용자가 화면을 만지지 않아도 세션을 이어 준다.
 * 결과를 보여 줄 상대가 사라지면 그 작업을 지켜본 의미가 없기 때문이다.
 */
export function hasPendingDeletes(): boolean {
  return allDeleteRecords().some(r => r.status === 'Handling');
}

export function isDeleteInProgress(uid: string): boolean {
  return state.records[uid]?.status === 'Handling';
}

/** 삭제 요청을 서버에 기록한다(같은 인프라의 이전 기록은 대체된다). */
export async function putDeleteRecord(rec: DeleteRecord): Promise<void> {
  state.records[rec.uid] = rec;
  try {
    await useSaveDeleteRequest({
      uid: rec.uid,
      ns_id: rec.nsId,
      infra_id: rec.infraId,
      req_id: rec.reqId,
      option: rec.option,
      status: rec.status,
      error_reason: rec.errorReason ?? '',
    }).execute();
  } catch (e) {
    // 서버 기록에 실패해도 이번 화면에서는 진행 상태를 보여준다. 다만 다른 자리에서는 보이지
    // 않게 되므로 조용히 넘기지 않고 남긴다.
    console.error('[deleteTracker] 삭제 요청 기록 실패', e);
  }
}

/** 기록을 지운다 — 삭제가 성공했거나, 인프라가 목록에서 사라진 경우. */
export async function clearDeleteRecord(uid: string): Promise<void> {
  delete state.records[uid];
  try {
    await useRemoveDeleteRequest(uid).execute();
  } catch (e) {
    console.error('[deleteTracker] 삭제 기록 제거 실패', e);
  }
}

/** 상태를 갱신한다. 성공은 여기로 오지 않는다 — 성공하면 기록 자체를 지운다. */
async function markStatus(
  uid: string,
  status: DeleteStatus,
  errorReason?: string,
): Promise<void> {
  const rec = state.records[uid];
  if (rec) {
    rec.status = status;
    if (errorReason !== undefined) rec.errorReason = errorReason;
  }
  try {
    await useUpdateDeleteRequestStatus(uid, status, errorReason).execute();
  } catch (e) {
    console.error('[deleteTracker] 삭제 상태 갱신 실패', e);
  }
}

/** 삭제가 실패했음을 기록한다(사유 포함). 목록의 `삭제 상태` 가 이 값을 보여준다. */
export async function markDeleteFailed(
  uid: string,
  errorReason?: string,
): Promise<void> {
  await markStatus(uid, 'Error', errorReason);
}

/** 서버에 남아 있는 추적 기록을 받아 온다(앱 시작·로그인 시). */
export async function loadDeleteRecords(): Promise<void> {
  try {
    const res: any = await useListDeleteRequests().execute();
    const list: DeleteRequestRecord[] =
      res?.data?.responseData ?? res?.data?.data ?? res?.data ?? [];
    const next: Record<string, DeleteRecord> = {};
    for (const r of Array.isArray(list) ? list : []) {
      next[r.uid] = fromRecord(r);
    }
    state.records = next;
  } catch (e) {
    console.error('[deleteTracker] 추적 기록 조회 실패', e);
  }
}

// ── 러너 등록 ───────────────────────────────────────────────────────────────
//
// 주기·중첩 방지·로그인/로그아웃 생명주기는 러너가 맡는다([runner](@/shared/libs/tracking/runner)).
// 여기는 *무엇을 물어볼지* 만 안다 — 삭제는 cm-beetle 의 요청 조회로 끝을 판정하는데, 부하 테스트도
// 워크플로우도 각자 다른 것을 본다. 한곳에 모으면 공통이 아니라 종류별 분기 덩어리가 된다.

/** 해당 인프라가 아직 목록에 있는지 확인한다(판단 불가 상황을 가르는 기준). */
async function infraStillListed(rec: DeleteRecord): Promise<boolean> {
  try {
    const res: any = await useGetMciList(rec.nsId, '').execute();
    const data =
      res?.data?.responseData?.data ?? res?.data?.data ?? res?.data ?? {};
    const list = data?.infra ?? data?.mci ?? [];
    return (Array.isArray(list) ? list : []).some(
      (m: any) => m?.uid === rec.uid,
    );
  } catch {
    // 목록 조회 자체가 실패하면 판단하지 않는다(다음 주기에 다시 본다).
    return true;
  }
}

async function notifyDone(rec: DeleteRecord): Promise<void> {
  // 강제 삭제는 텀블벅 기록만 지우고 CSP 자원은 남긴다 — 성공이지만 손이 더 간다.
  const forced = rec.option === 'force';
  await notify({
    category: 'Workload',
    level: forced ? 'Error' : 'Info',
    message: forced
      ? `Infra "${rec.infraId}" was force-deleted. CSP resources may remain.`
      : `Infra "${rec.infraId}" has been deleted.`,
    detail: forced
      ? 'Force delete removes the record only. Any surviving CSP resources keep billing and must be removed by hand.'
      : '',
    dedupKey: `delete:${rec.reqId}:done`,
  });
}

async function notifyFailed(rec: DeleteRecord, reason?: string): Promise<void> {
  await notify({
    category: 'Workload',
    level: 'Error',
    message: `Failed to delete infra "${rec.infraId}".`,
    detail: reason ?? '',
    dedupKey: `delete:${rec.reqId}:error`,
  });
}

async function notifyUnknown(rec: DeleteRecord): Promise<void> {
  await notify({
    category: 'Workload',
    level: 'Error',
    message: `Could not confirm the deletion of infra "${rec.infraId}".`,
    detail:
      'The request record is gone but the infra is still listed, so the outcome is unknown. Check the workload list.',
    dedupKey: `delete:${rec.reqId}:unknown`,
  });
}

/** 진행 중인 삭제 하나의 결과를 확인한다. */
async function checkOne(rec: DeleteRecord): Promise<void> {
  try {
    const res: any = await useGetBeetleRequest(rec.reqId).execute();
    const details =
      res?.data?.responseData?.data ??
      res?.data?.data ??
      res?.data?.responseData ??
      res?.data ??
      res;
    const status = String(details?.status ?? '').toLowerCase();

    if (status === 'success') {
      await notifyDone(rec);
      // 성공은 남길 것이 없다 — 인프라가 목록에서 사라지므로 보여줄 대상도 없다.
      await clearDeleteRecord(rec.uid);
    } else if (status === 'error') {
      const reason = details?.errorResponse || undefined;
      await markStatus(rec.uid, 'Error', reason);
      await notifyFailed(rec, reason);
    }
    // Handling 이면 그대로 두고 다음 주기에 다시 본다.
  } catch {
    // 조회가 실패했다. cm-beetle 의 요청 기록은 재시작을 넘기지 못하므로, 정상적으로 처리된
    // 요청인데도 여기로 올 수 있다. 그래서 실패로 단정하지 않고 *인프라가 아직 있는지*로 가른다.
    const listed = await infraStillListed(rec);
    if (!listed) {
      // 인프라가 없다 = 어떤 경로로든 지워졌다. 남겨 둘 이유가 없다.
      await notifyDone(rec);
      await clearDeleteRecord(rec.uid);
    } else {
      // 인프라는 있는데 요청 기록이 없다 → 성공인지 실패인지 알 수 없다.
      await markStatus(rec.uid, 'Unknown');
      await notifyUnknown(rec);
    }
  }
}

registerTracker({
  id: 'mci-delete',
  check: async () => {
    const handling = allDeleteRecords().filter(r => r.status === 'Handling');
    for (const rec of handling) {
      await checkOne(rec);
    }
  },
  hasWork: hasPendingDeletes,
  resume: loadDeleteRecords,
  reset: () => {
    state.records = {};
  },
});
