import { reactive } from 'vue';

// 워크로드(인프라) 삭제 요청 추적 (BAR-1444)
//
// 삭제는 오래 걸리고(하류 수 분~수십 분) 비동기다. 사용자가 기다리다 다른 화면으로 가거나
// 새로고침해도 "무엇이 삭제 중인지"를 알 수 있어야 하고, 같은 대상에 삭제 명령이 두 번 나가면
// 안 된다. 그래서 삭제 요청을 infraId 별로 브라우저(localStorage)에 보관하고, 목록·상세가
// 같은 기록을 본다. cm-beetle 의 요청 추적(reqId)과 짝을 이룬다.

export type DeleteStatus = 'Handling' | 'Success' | 'Error';

export interface DeleteRecord {
  infraId: string;
  nsId: string;
  reqId: string;
  option: string; // 'terminate' | 'force'
  requestedAt: number;
  status: DeleteStatus;
  errorReason?: string; // beetle/tumblebug 이 준 실패 사유 (있을 때만)
  // 진행 단계(예: "deleting SG"). 현재 cb-tumblebug·cm-beetle 은 *삭제* 경로에서
  // 단계별 진행을 내보내지 않으므로(생성 경로에만 있음) 채워지지 않는다. 업스트림이
  // 삭제에도 progress 를 넣으면 그때 활용할 예약 필드다.
  stage?: string;
}

const STORAGE_KEY = 'cmig.mci.deleteRequests';

function readStorage(): Record<string, DeleteRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DeleteRecord>) : {};
  } catch {
    return {};
  }
}

// 모든 컴포넌트가 공유하는 반응형 상태. 최초 1회 localStorage 에서 채운다.
const state = reactive<{ records: Record<string, DeleteRecord> }>({
  records: readStorage(),
});

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  } catch {
    /* 용량 초과 등은 무시 — 메모리 상태로는 계속 동작 */
  }
}

/** 삭제 요청 기록을 저장(또는 갱신)한다. */
export function putDeleteRecord(rec: DeleteRecord): void {
  state.records[rec.infraId] = rec;
  persist();
}

/** 해당 인프라의 삭제 기록을 반환(없으면 undefined). */
export function getDeleteRecord(infraId: string): DeleteRecord | undefined {
  return state.records[infraId];
}

/** 진행 중(Handling)인 삭제가 있으면 true — 중복 삭제 방어에 쓴다. */
export function isDeleteInProgress(infraId: string): boolean {
  return state.records[infraId]?.status === 'Handling';
}

/** 상태만 갱신한다(사유 포함). 기록이 없으면 무시. */
export function updateDeleteStatus(
  infraId: string,
  status: DeleteStatus,
  errorReason?: string,
): void {
  const rec = state.records[infraId];
  if (!rec) return;
  rec.status = status;
  if (errorReason !== undefined) rec.errorReason = errorReason;
  persist();
}

/** 기록을 지운다(삭제 완료로 목록에서 사라졌거나, 정리 시). */
export function clearDeleteRecord(infraId: string): void {
  if (state.records[infraId]) {
    delete state.records[infraId];
    persist();
  }
}

/** 현재 보관된 삭제 기록 전체(목록 렌더링·폴링 대상 판단용). */
export function allDeleteRecords(): DeleteRecord[] {
  return Object.values(state.records);
}
