<script setup lang="ts">
import { PTab, PButton } from '@cloudforet-test/mirinae';
import { ref, reactive } from 'vue';
import {
  WorkflowList,
  WorkflowDetail,
  WorkflowJsonViewer,
  WorkflowHistory,
  WorkflowRunViewer,
} from '@/widgets/workflow';
import { SimpleEditForm } from '@/widgets/layout';
import {
  useGetWorkflow,
  useUpdateWorkflow,
  useWorkflowStore,
} from '@/entities';
import {
  showErrorMessage,
  showSuccessMessage,
  toErrorMessage,
} from '@/shared/utils';
import WorkflowEditor from '@/features/workflow/workflowEditor/ui/WorkflowEditor.vue';

const getWorkflow = useGetWorkflow(null);
const updateWorkflow = useUpdateWorkflow(null, null);
const workflowStore = useWorkflowStore();

const pageName = 'Workflows';

/**
 * 실행 뷰어에서 복제해 편집하기.
 *
 * 값을 바꿔 다시 돌리고 싶을 때 *원본을 고치지 않는다* — 엔진은 "그 실행에 쓰인 정의"를
 * 돌려주지 않으므로, 원본을 고치면 그 워크플로우의 과거 실행이 화면에서 엉뚱한 값으로
 * 보이게 된다. 복제본을 선택 상태로 바꾸고 그것을 에디터로 연다.
 */
function handleEditClone(clonedWorkflowId: string) {
  // 복제본은 뷰어가 이미 스토어에 넣었다. 목록도 편집기도 스토어를 보고 그리므로
  // 여기서 목록을 다시 받아올 필요가 없다 — 목록을 다시 받으면 표가 다시 그려지며
  // 방금 연 편집기가 닫힌다.
  selectedWorkflowId.value = clonedWorkflowId;
  modalState.workflowToolModal.open = true;
}

/**
 * 미실행 원본을 그래픽 에디터로 (복제 없이). 실행 이력이 없어 원본을 직접 고쳐도 된다.
 */
function handleEditOriginal(workflowId: string) {
  selectedWorkflowId.value = workflowId;
  modalState.workflowToolModal.open = true;
}

/**
 * 병렬이라 그래픽 에디터가 못 다루는 워크플로우를 JSON 에디터로 연다.
 * 원본(미실행 Edit) 또는 복제본(실행됨 Clone&Edit) — 어느 쪽이든 id로 스토어에서
 * 정의를 꺼내 JSON 에디터에 넘긴다. (복제본은 뷰어가 이미 스토어에 넣었다.)
 */
/** 워크플로우 툴이 그대로 옮길 수 없는 그래프는 JSON 에디터로 연다 */
function handleEditJson(workflowId: string) {
  selectedWorkflowId.value = workflowId;
  const wf = workflowStore.getWorkflowById(workflowId);
  workflowName.value = wf?.name ?? '';
  workflowJson.value = wf?.data ?? {};
  modalState.workflowJsonModal.open = true;
}

const selectedWorkflowId = ref<string>('');
const workflowName = ref<string>('');
const workflowJson = ref<object>({});
const wfIdData = ref<object>({});

const modalState = reactive({
  addWorkflow: {
    open: false,
    trigger: false,
    updateTrigger() {
      this.trigger = false;
    },
  },

  editModal: { open: false },
  workflowToolModal: { open: false },
  workflowJsonModal: { open: false },
});

const mainTabState = reactive({
  activeTab: 'details',
  tabs: [
    {
      name: 'details',
      label: 'Details',
    },
    {
      name: 'history',
      label: 'History',
    },
    {
      name: 'runViewer',
      label: 'Run Status',
    },
  ],
});

const schema = {
  json: true,
  properties: {
    description: {
      type: 'string',
      title: 'Description',
    },
    task_groups: {
      type: 'array',
      title: 'Task Groups',
    },
  },
};

function handleClickWorkflowId(id: string) {
  selectedWorkflowId.value = id;
}

async function getWorkflowById() {
  try {
    const { data } = await getWorkflow.execute({
      pathParams: {
        wfId: selectedWorkflowId.value,
      },
    });

    if (
      data.responseData?.data &&
      Object.values(data.responseData.data).length > 0
    ) {
      wfIdData.value = data.responseData?.data;
    }
  } catch (error) {
    showErrorMessage('error', 'Failed to get the workflow.');
  }
}

// watch(selectedWorkflowId, () => {
//   getWorkflowById();
// });

async function handleUpdateWorkflowEdit() {
  try {
    if (selectedWorkflowId.value.length > 0) {
      await getWorkflowById();

      if (Object.values(wfIdData.value).length > 0) {
        const { data } = await updateWorkflow.execute({
          pathParams: {
            wfId: selectedWorkflowId.value,
          },
          request: {
            data: wfIdData.value,
            name: workflowName.value,
          },
        });

        if (data.responseData?.data !== null) {
          showSuccessMessage('success', 'Workflow data updated successfully.');
          modalState.addWorkflow.trigger = true;
        }
      }
    }
  } catch (error) {
    showErrorMessage('error', 'Failed to update the workflow.');
  }
}

async function handleUpdateWorkflow(updatedData: object) {
  try {
    const { data } = await updateWorkflow.execute({
      pathParams: {
        wfId: selectedWorkflowId.value,
      },
      request: {
        data: updatedData,
      },
    });

    // The response may arrive without the data wrapper, so read all the way down optionally.
    // This used to throw and fall into the catch, which then showed a hardcoded, unrelated message.
    if (data.responseData?.data?.task_groups != null) {
      modalState.addWorkflow.trigger = true;
      showSuccessMessage('Success', 'Workflow data updated successfully.');
    } else {
      modalState.addWorkflow.trigger = true;
      showErrorMessage('Error', 'Workflow data cannot be null.');
    }
  } catch (error) {
    showErrorMessage(
      'Error',
      toErrorMessage(error, 'Failed to update the workflow.'),
    );
  }
}
</script>

<template>
  <div :class="`${pageName}-page page`">
    <header>
      <p data-testid="workflow-page-header">{{ pageName }}</p>
    </header>
    <section :class="`${pageName}-page-body`">
      <workflow-list
        :trigger="modalState.addWorkflow.trigger"
        :selected-wf-id="selectedWorkflowId"
        @select-row="handleClickWorkflowId"
        @update:trigger="modalState.addWorkflow.updateTrigger()"
      />
      <p v-if="!selectedWorkflowId" class="more-details">
        Select an item for more details.
      </p>
      <div v-if="selectedWorkflowId">
        <p-tab v-model="mainTabState.activeTab" :tabs="mainTabState.tabs">
          <template #details>
            <div class="tab-section-header">
              <p>Workflow Information</p>
              <p-button
                style-type="tertiary"
                icon-left="ic_edit"
                @click="
                  () => {
                    modalState.editModal.open = true;
                  }
                "
              >
                Edit
              </p-button>
            </div>
            <workflow-detail
              :selected-workflow-id="selectedWorkflowId"
              @update:workflow-json-modal="
                modalState.workflowJsonModal.open = true
              "
              @update:workflow-tool-modal="
                e => (modalState.workflowToolModal.open = e)
              "
              @update:workflow-name="e => (workflowName = e)"
              @update:workflow-json="e => (workflowJson = e)"
            />
          </template>
          <template #history>
            <div class="tab-section-header">
              <p>Workflow History</p>
            </div>
            <workflow-history :selected-workflow-id="selectedWorkflowId" />
          </template>
          <template #runViewer>
            <div class="tab-section-header">
              <p>Workflow Run Status</p>
            </div>
            <workflow-run-viewer
              :workflow-id="selectedWorkflowId"
              @edit-json="handleEditJson"
              @edit-clone="handleEditClone"
              @edit-original="handleEditOriginal"
            />
          </template>
        </p-tab>
      </div>
    </section>
    <div class="relative z-60">
      <simple-edit-form
        v-if="modalState.editModal.open"
        :name="workflowName"
        header-title="Edit Workflow"
        name-label="Workflow Name"
        name-placeholder="Workflow Name"
        @update:save-modal="
          () => {
            modalState.editModal.open = false;
            handleUpdateWorkflowEdit();
          }
        "
        @update:close-modal="modalState.editModal.open = false"
        @update:name-value="e => (workflowName = e)"
        @update:trigger="modalState.addWorkflow.trigger = true"
      />
    </div>
    <div class="relative z-70">
      <workflow-json-viewer
        v-if="modalState.workflowJsonModal.open"
        :name="workflowName"
        title="Custom & View Workflow"
        :json="workflowJson"
        :schema="schema"
        :read-only="false"
        @update:close-modal="e => (modalState.workflowJsonModal.open = e)"
        @update:api="handleUpdateWorkflow"
      />
      <WorkflowEditor
        v-if="modalState.workflowToolModal.open"
        :tool-type="'edit'"
        :wft-id="selectedWorkflowId"
        @update:close-modal="e => (modalState.workflowToolModal.open = e)"
        @update:trigger="modalState.addWorkflow.trigger = true"
      />
    </div>
  </div>
</template>

<style scoped lang="postcss"></style>
