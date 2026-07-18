<script setup lang="ts">
import {
  PButtonModal,
  PButton,
  PFieldGroup,
  PRadio,
  PRadioGroup,
  PTextInput,
} from '@cloudforet-test/mirinae';
import { computed, reactive, ref, watch } from 'vue';
import { useDeleteMci } from '@/entities/mci/api';
import {
  putDeleteRecord,
  updateDeleteStatus,
  getDeleteRecord,
  isDeleteInProgress,
  type DeleteRecord,
} from '@/entities/mci/lib/deleteTracker';
import { extractErrorMessage } from '@/shared/libs';

interface IProps {
  visible: boolean;
  selectedMciList: any[];
  nsId: string;
}

interface IEmits {
  (e: 'update:visible', value: boolean): void;
  (e: 'deleted'): void;
}

const props = defineProps<IProps>();
const emit = defineEmits<IEmits>();

// 모달은 두 단계다.
//   confirm  — 삭제 방식(Normal/Force) 선택 + 이름 타이핑 확인
//   progress — "삭제 처리 중". 요청을 낸 뒤 완료까지 진행 상태를 보여준다.
// 기존과 달리 삭제는 *비동기*다: reqId 로 요청을 추적하므로(deleteTracker), 이 모달을 닫고
// 다른 화면에 갔다 돌아와도 목록의 `삭제 상태` 컬럼이 같은 상태를 이어 보여준다.
const state = reactive({
  deleteMethod: 'normal',
  confirmKeyword: '',
  // confirm  — 삭제 방식 선택 + 이름 타이핑
  // progress — 삭제 처리 중 (완료까지 표시)
  // error    — 기존 삭제가 실패한 상태에서 다시 열림 → 에러 + 강제 삭제/취소
  phase: 'confirm' as 'confirm' | 'progress' | 'error',
  alreadyInProgress: false,
});

const trackedIds = ref<string[]>([]);

const checkKeyword = computed(() => {
  return props.selectedMciList.length === 1
    ? props.selectedMciList[0].name
    : 'Delete All';
});

// confirm 단계에선 이름을 정확히 입력해야 활성. progress 단계에선 확인 버튼을 막는다(재요청 방지).
const isDeleteDisabled = computed(() => {
  if (state.phase === 'progress') return true;
  return state.confirmKeyword !== checkKeyword.value;
});

const deleteMethodOptions = [
  { label: 'Normal Delete', key: 'normal' },
  { label: 'Force Delete', key: 'force' },
];

// 이 모달이 추적하는 인프라들의 현재 삭제 기록.
const trackedRecords = computed<DeleteRecord[]>(() =>
  trackedIds.value
    .map(id => getDeleteRecord(id))
    .filter((r): r is DeleteRecord => !!r),
);

const anyHandling = computed(() =>
  trackedRecords.value.some(r => r.status === 'Handling'),
);
const anyError = computed(() =>
  trackedRecords.value.some(r => r.status === 'Error'),
);

// error 단계에서 보여줄 실패 기록(에러 사유 표시용).
const erroredRecords = computed<DeleteRecord[]>(() =>
  trackedRecords.value.filter(r => r.status === 'Error'),
);

function newReqId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 지정한 인프라들에 삭제 요청을 낸다(옵션: terminate|force). 진행 기록을 남기고 추적한다.
function fireDeletes(mciNames: string[], option: string): string[] {
  const ids: string[] = [];
  for (const infraId of mciNames) {
    // 이미 진행 중이면 새 요청을 내지 않고(중복 방어) 그 기록을 그대로 추적한다.
    if (isDeleteInProgress(infraId)) {
      ids.push(infraId);
      continue;
    }
    const reqId = newReqId();
    putDeleteRecord({
      infraId,
      nsId: props.nsId,
      reqId,
      option,
      requestedAt: Date.now(),
      status: 'Handling',
    });
    useDeleteMci({ nsId: props.nsId, infraId, option }, reqId)
      .execute()
      .then(() => updateDeleteStatus(infraId, 'Success'))
      .catch((error: any) =>
        updateDeleteStatus(
          infraId,
          'Error',
          extractErrorMessage(error) ?? undefined,
        ),
      );
    ids.push(infraId);
  }
  return ids;
}

// confirm 단계에서 삭제 실행 — 요청을 내고 progress 단계로 전환한다(즉시 닫지 않는다).
function handleConfirm() {
  if (state.phase !== 'confirm') return;
  const option = state.deleteMethod === 'force' ? 'force' : 'terminate';
  trackedIds.value = fireDeletes(
    props.selectedMciList.map(m => m.name as string),
    option,
  );
  state.phase = 'progress';
  emit('deleted'); // 목록이 즉시 `삭제 상태` 컬럼을 띄우도록 갱신
}

// error 단계에서 [강제 삭제] — 실패한 대상을 force 로 다시 삭제하고 progress 로 전환한다.
// force 는 CSP 자원을 남기고 텀블벅 내부 데이터만 지운다(배너로 이미 고지).
// 기록이 Error 상태(진행 중 아님)이므로 fireDeletes 가 새 reqId 로 다시 발행한다.
function handleForceDelete() {
  const names = erroredRecords.value.map(r => r.infraId);
  trackedIds.value = fireDeletes(names, 'force');
  state.phase = 'progress';
  emit('deleted');
}

// error 단계에서 [재시도] — 선택 화면(confirm)으로 돌아간다. 일반 삭제가 되는 경우도 있어
// (텀블벅이 일시적으로 막혔던 등) 다시 일반/강제를 골라 재시도한다. 강제 삭제는 CSP 자원을
// 남기므로, 먼저 일반 삭제로 되는지 확인하고 안 되면 강제로 가는 흐름을 사용자가 고른다.
function handleRetry() {
  state.deleteMethod = 'normal';
  state.confirmKeyword = '';
  state.phase = 'confirm';
}

// progress 단계에서 모두 삭제되면(진행 중·에러 없음) 모달을 닫는다. 에러가 있으면 열어 둔다.
watch([anyHandling, anyError], ([handling, error]) => {
  if (state.phase !== 'progress') return;
  if (!handling && !error) {
    emit('deleted');
    closeAndReset();
  }
});

function closeAndReset() {
  emit('update:visible', false);
  resetState();
}

function resetState() {
  state.deleteMethod = 'normal';
  state.confirmKeyword = '';
  state.phase = 'confirm';
  state.alreadyInProgress = false;
  trackedIds.value = [];
}

// 닫기 — 삭제는 계속되고 목록이 상태를 이어 보여준다("백그라운드로 보내기").
// 지금 목록 화면을 보고 있으므로, 닫으면서 목록을 새로고침해 `삭제 상태` 컬럼이 뜨게 한다.
function handleClose() {
  emit('deleted');
  closeAndReset();
}

// 모달이 열릴 때 대상의 현재 삭제 기록으로 단계를 정한다.
//   진행 중(Handling) → progress ("이미 처리 중" 안내 + 진행 상태)
//   실패(Error)       → error (기존 삭제 실패 + 에러 메시지 + 강제 삭제/취소)
//   없음              → confirm (삭제 방식 선택 + 타이핑)
watch(
  () => props.visible,
  visible => {
    if (!visible) {
      resetState();
      return;
    }
    const names = props.selectedMciList.map(m => m.name as string);
    const inProgress = names.filter(name => isDeleteInProgress(name));
    const errored = names.filter(
      name => getDeleteRecord(name)?.status === 'Error',
    );
    if (inProgress.length > 0) {
      trackedIds.value = inProgress;
      state.phase = 'progress';
      state.alreadyInProgress = true;
    } else if (errored.length > 0) {
      trackedIds.value = errored;
      state.phase = 'error';
    } else {
      state.phase = 'confirm';
      state.alreadyInProgress = false;
    }
  },
);
</script>

<template>
  <p-button-modal
    data-testid="mci-delete-modal"
    :visible="visible"
    header-title="Delete Workloads"
    size="sm"
    hide-footer
    @close="handleClose"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #body>
      <!-- error 단계 — 기존 삭제가 실패한 상태에서 다시 열림. 에러 메시지(길면 스크롤) + 강제 삭제/취소. -->
      <div
        v-if="state.phase === 'error'"
        class="delete-modal-content"
        data-testid="mci-delete-error"
      >
        <div class="force-warning-banner">
          기존 삭제 요청이 처리 중에 실패했습니다.
        </div>
        <p class="description">실패한 워크로드</p>
        <div class="error-reason-box" data-testid="wl-delete-error-dialog">
          <div
            v-for="rec in erroredRecords"
            :key="rec.infraId"
            class="error-reason-item"
          >
            <span class="progress-name">{{ rec.infraId }}</span>
            <span v-if="rec.errorReason" class="error-reason-text">{{
              rec.errorReason
            }}</span>
          </div>
        </div>
        <p class="hint">
          강제 삭제는 CSP 리소스는 남기고 텀블벅 내부 데이터만 지웁니다. 남은
          CSP 리소스는 직접 삭제하셔야 합니다.
        </p>
      </div>

      <!-- progress 단계 — 삭제 처리 중 (완료까지 계속 표시). 닫아도 목록이 상태를 이어 보여준다. -->
      <div
        v-else-if="state.phase === 'progress'"
        class="delete-modal-content"
        data-testid="mci-delete-progress"
      >
        <div v-if="state.alreadyInProgress" class="warning-banner">
          이미 처리 중인 삭제가 있습니다. 새로 시작하지 않고 현재 진행 상태를
          보여줍니다.
        </div>
        <p class="description">삭제 처리 중</p>
        <div class="mci-list">
          <div
            v-for="rec in trackedRecords"
            :key="rec.infraId"
            class="progress-item"
          >
            <span class="progress-name">{{ rec.infraId }}</span>
            <span
              v-if="rec.status === 'Handling'"
              class="progress-status handling"
            >
              <span class="spinner" />
              {{ rec.stage ? `삭제 중 · ${rec.stage}` : '삭제 처리 중' }}
            </span>
            <span
              v-else-if="rec.status === 'Error'"
              class="progress-status error"
              data-testid="mci-delete-progress-error"
            >
              에러<template v-if="rec.errorReason"
                >: {{ rec.errorReason }}</template
              >
            </span>
            <span v-else class="progress-status done">삭제 완료</span>
          </div>
        </div>
        <p v-if="anyHandling" class="hint">
          이 창을 닫아도 삭제는 계속되고, 목록의 <b>삭제 상태</b> 컬럼에서 진행
          상황을 볼 수 있습니다.
        </p>
      </div>

      <!-- confirm 단계 — 삭제 방식 선택 + 이름 타이핑 확인 -->
      <div v-else class="delete-modal-content">
        <div class="warning-banner">
          ⚠️ Deleting workloads will also delete
          <span class="keyword-highlight"
            >all resources included in the workloads</span
          >
          which may take
          <span class="keyword-highlight"
            >from a few minutes to several hours</span
          >
        </div>
        <p class="description">The following workloads will be deleted</p>
        <div class="mci-list">
          <div v-for="mci in selectedMciList" :key="mci.name" class="mci-item">
            {{ mci.name }}
          </div>
        </div>

        <p-field-group label="Delete Method" required class="mt-8">
          <div
            v-if="state.deleteMethod === 'force'"
            class="force-warning-banner"
          >
            🚨 Force delete removes only Tumblebug's internal records and
            <span class="keyword-highlight"
              >leaves the CSP resources running</span
            >. You must delete the remaining CSP resources yourself.
          </div>
          <p-radio-group>
            <p-radio
              v-for="option in deleteMethodOptions"
              :key="option.key"
              v-model="state.deleteMethod"
              :value="option.key"
              :data-testid="
                option.key === 'force' ? 'mci-delete-method-force' : undefined
              "
            >
              <span>{{ option.label }}</span>
            </p-radio>
          </p-radio-group>
        </p-field-group>

        <p-field-group required class="mt-8">
          <template #label>
            <span
              >To continue, please enter
              <span class="keyword-highlight">{{ checkKeyword }}</span></span
            >
            <p-text-input
              v-model="state.confirmKeyword"
              data-testid="mci-delete-confirm-keyword"
              :placeholder="checkKeyword"
            />
          </template>
        </p-field-group>
      </div>

      <!--
        단계별 버튼.

        ★ PButtonModal 에는 `footer` 슬롯이 없다 — 푸터는 `v-if="!hideFooter"` 로 감싼 고정 영역이고,
          바꿀 수 있는 건 그 안의 `close-button`/`confirm-button` 슬롯뿐이다. 그래서 `hide-footer` 로
          기본 푸터를 끈 뒤 `#footer` 슬롯에 버튼을 넣으면 *아무것도 렌더되지 않는다*(실제로 그랬다).
          에러 단계는 버튼이 셋(재시도·강제 삭제·닫기)이라 기본 두 슬롯으로는 부족하므로,
          기본 푸터는 끈 채 버튼 줄을 body 끝에 직접 그린다.
      -->
      <div class="modal-footer">
        <!-- error: 재시도(선택 화면으로) / 강제 삭제 / 닫기 -->
        <template v-if="state.phase === 'error'">
          <p-button
            style-type="transparent"
            data-testid="wl-delete-close"
            @click="handleClose"
          >
            닫기
          </p-button>
          <p-button
            style-type="secondary"
            data-testid="wl-delete-retry"
            @click="handleRetry"
          >
            재시도
          </p-button>
          <p-button
            style-type="negative-primary"
            data-testid="wl-delete-force-enter"
            @click="handleForceDelete"
          >
            강제 삭제
          </p-button>
        </template>
        <!-- progress: 닫기만 (삭제는 계속되고 목록이 이어 보여줌) -->
        <template v-else-if="state.phase === 'progress'">
          <p-button
            style-type="transparent"
            data-testid="wl-delete-close"
            @click="handleClose"
          >
            닫기
          </p-button>
        </template>
        <!-- confirm: 취소 / 삭제(이름 타이핑 시 활성) -->
        <template v-else>
          <p-button
            style-type="transparent"
            data-testid="wl-delete-cancel"
            @click="handleClose"
          >
            Cancel
          </p-button>
          <p-button
            style-type="negative-primary"
            data-testid="wl-delete-confirm"
            :disabled="isDeleteDisabled"
            @click="handleConfirm"
          >
            Delete
          </p-button>
        </template>
      </div>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.delete-modal-content {
  .warning-banner {
    padding: 12px;
    margin-bottom: 16px;
    background-color: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    color: #856404;
    font-size: 14px;
    line-height: 1.5;
  }

  .description {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .mci-list {
    padding: 12px;
    background-color: #f7f7f7;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;

    .mci-item {
      padding: 4px 0;
      font-size: 14px;
      font-family: monospace;
    }

    .progress-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      font-size: 14px;
    }
    .progress-name {
      font-family: monospace;
    }
    .progress-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
    }
    .progress-status.handling {
      color: #6b7280;
    }
    .progress-status.error {
      color: #dc2626;
      font-weight: 600;
    }
    .progress-status.done {
      color: #2a9d8f;
    }
    .progress-status .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid #d1d5db;
      border-top-color: #6b7280;
      border-radius: 50%;
      animation: wl-modal-spin 0.8s linear infinite;
    }
  }

  .hint {
    margin-top: 10px;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
  }

  /* 에러 사유가 길어도 강제 삭제 버튼이 밀려나지 않도록 스크롤 영역에 담는다. */
  .error-reason-box {
    max-height: 180px;
    overflow-y: auto;
    padding: 12px;
    background-color: #fff5f5;
    border: 1px solid #feb2b2;
    border-radius: 4px;
  }
  .error-reason-item {
    padding: 6px 0;
    font-size: 13px;
  }
  .error-reason-item + .error-reason-item {
    border-top: 1px solid #fed7d7;
  }
  .error-reason-item .progress-name {
    display: block;
    font-family: monospace;
    font-weight: 600;
    color: #c53030;
  }
  .error-reason-text {
    display: block;
    margin-top: 2px;
    color: #742a2a;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  /* 기본 푸터를 끄고 body 안에 그리므로(위 템플릿 주석 참고), 구분선과 여백으로 푸터처럼 보이게 한다. */
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;

  .force-warning-banner {
    padding: 12px;
    margin-bottom: 8px;
    background-color: #fee;
    border: 1px solid #e53e3e;
    border-radius: 4px;
    color: #c53030;
    font-size: 14px;
    line-height: 1.5;
  }

  .keyword-highlight {
    color: #e53e3e;
    font-weight: bold;
  }
}
@keyframes wl-modal-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
