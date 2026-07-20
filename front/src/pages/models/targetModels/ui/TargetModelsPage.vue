<script setup lang="ts">
import { PTab, PButton } from '@cloudforet-test/mirinae';
import { TargetModelList } from '@/widgets/models/targetModels';
import { TargetModelDetail } from '@/widgets/models/targetModels';
import { SimpleEditForm } from '@/widgets/layout';
import { CustomViewTargetModel } from '@/widgets/models/targetModels';
import { reactive, ref, computed } from 'vue';
import WorkflowEditor from '@/features/workflow/workflowEditor/ui/WorkflowEditor.vue';
import { useTargetModelStore, useUpdateTargetModel } from '@/entities';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useRouter } from 'vue-router/composables';
import { WORKFLOW_MANAGEMENT_ROUTE } from '@/app/providers/router/routes/constants';

const router = useRouter();

/**
 * 여기서 만든 워크플로우도 저장하면 **실행 상태로 보낸다.**
 *
 * 워크플로우 화면에서 저장했을 때와 같은 자리에 도착해야 한다 — 저장 다음에 하는 일은
 * 대개 *실행*이고, 실행할지 더 고칠지는 실행 상태 화면에서 갈린다. 예전엔 여기서
 * 저장하면 편집기만 닫히고 목표 모델 화면에 그대로 남아, **방금 만든 워크플로우를
 * 찾아가려면 사용자가 직접 워크플로우 목록으로 이동해 다시 골라야 했다.**
 *
 * 화면이 다르므로(목표 모델 ↔ 워크플로우) 탭 전환이 아니라 라우팅이고, 어느
 * 워크플로우인지는 쿼리로 넘긴다.
 */
function handleSavedWorkflow(workflowId: string) {
  modalStates.workflowEditorModal.open = false;
  router.push({
    name: WORKFLOW_MANAGEMENT_ROUTE.WORKFLOWS._NAME,
    query: workflowId ? { wfId: workflowId } : {},
  });
}

const pageName = 'Target Models';

const selectedTargetModelId = ref<string>('');
const selectedTargetModelName = ref<string>('');
const targetModelName = ref<string>('');
const targetModelDescription = ref<string>('');
const resUpdateTargetModel = useUpdateTargetModel(null, null);
const targetModelStore = useTargetModelStore();

// Add computed property for targetModel
const targetModelForWorkflow = computed(() => {
  const model = targetModelStore.getTargetModelById(
    selectedTargetModelId.value,
  );
  if (model) {
    // modelType을 기반으로 migrationType 설정
    let migrationType = 'infra'; // 기본값

    if (model.modelType === 'SoftwareModel') {
      migrationType = 'software';
    } else if (
      model.modelType === 'CloudModel' ||
      model.modelType === 'OnPremiseModel'
    ) {
      migrationType = 'infra';
    }

    const modelWithMigrationType = {
      ...model,
      migrationType: migrationType,
    };

    console.log('Passing targetModel to WorkflowEditor:', {
      selectedTargetModelId: selectedTargetModelId.value,
      model: modelWithMigrationType,
      modelType: model?.modelType,
      migrationType: migrationType,
      hasCloudInfraModel: !!model?.cloudInfraModel,
      isCloudModel: model?.isCloudModel,
    });

    return modelWithMigrationType;
  }
  return model;
});

const migrationTypeForWorkflow = computed(() => {
  const model = targetModelForWorkflow.value;
  if (model?.modelType) {
    return model.modelType === 'SoftwareModel' ? 'software' : 'infra';
  }
  return 'infra'; // default
});

const mainTabState = reactive({
  activeTab: 'details',
  tabs: [
    {
      name: 'details',
      label: 'Details',
    },
  ],
});

const modalStates = reactive({
  editModelModal: {
    open: false,
    context: {
      name: '',
      description: '',
    },
    trigger: false,
    updateTrigger() {
      modalStates.editModelModal.trigger = false;
    },
  },
  customViewJsonModal: {
    open: false,
  },
  workflowEditorModal: {
    open: false,
  },
});

function handleClickTargetModel(data: { id: string; name: string }) {
  selectedTargetModelId.value = data.id;
  selectedTargetModelName.value = data.name;
}

function handleUpdateTargetModel(e) {
  const targetModel = targetModelStore.getTargetModelById(
    selectedTargetModelId.value,
  );

  modalStates.editModelModal.open = false;
  modalStates.editModelModal.context.name = e.name;
  modalStates.editModelModal.context.description = e.description;

  const requestBody = Object.assign({}, targetModel, {
    userModelName: e.name,
    description: e.description,
  });

  resUpdateTargetModel
    .execute({
      pathParams: { id: selectedTargetModelId.value },
      request: requestBody,
    })
    .then(res => {
      showSuccessMessage('success', 'Successfully updated target model');
      modalStates.editModelModal.trigger = true;
      // 여기에 targetmodellist update trigger
    })
    .catch(e => {
      showErrorMessage('error', e.errorMsg);
    });
}
</script>

<template>
  <div :class="`${pageName}-page page`">
    <header>
      <p>{{ pageName }}</p>
    </header>
    <section :class="`${pageName}-page-body`">
      <target-model-list
        :trigger="modalStates.editModelModal.trigger"
        @select-row="handleClickTargetModel"
        @update:trigger="modalStates.editModelModal.updateTrigger"
      />
      <div v-if="selectedTargetModelId">
        <p-tab v-model="mainTabState.activeTab" :tabs="mainTabState.tabs">
          <template #details>
            <div class="tab-section-header">
              <p>Target Model Information</p>
              <p-button
                style-type="tertiary"
                icon-left="ic_edit"
                @click="modalStates.editModelModal.open = true"
              >
                Edit
              </p-button>
            </div>
            <target-model-detail
              :selected-target-model-id="selectedTargetModelId"
              @update:custom-view-json-modal="
                modalStates.customViewJsonModal.open = true
              "
              @update:target-model-name="e => (targetModelName = e)"
              @update:target-model-description="
                e => (targetModelDescription = e)
              "
              @update:workflow-edit-modal="
                e => (modalStates.workflowEditorModal.open = e)
              "
            />
          </template>
        </p-tab>
      </div>
      <p v-else class="flex justify-center text-gray-300 text-sm font-normal">
        Select an item for more details.
      </p>
    </section>
    <div class="relative z-60">
      <simple-edit-form
        v-if="modalStates.editModelModal.open"
        header-title="Edit Model"
        :name="targetModelName"
        :description="targetModelDescription"
        name-label="Model Name"
        name-placeholder="Model Name"
        @update:save-modal="handleUpdateTargetModel"
        @update:close-modal="modalStates.editModelModal.open = false"
        @update:trigger="modalStates.editModelModal.trigger = true"
      />
    </div>
    <div class="relative z-70">
      <custom-view-target-model
        v-if="modalStates.customViewJsonModal.open"
        :selected-target-id="selectedTargetModelId"
        :selected-target-name="selectedTargetModelName"
        @update:close-modal="modalStates.customViewJsonModal.open = false"
        @update:trigger="modalStates.editModelModal.trigger = true"
        @update:close-target-model-detail="
          selectedTargetModelId = '';
          selectedTargetModelName = '';
        "
      />
    </div>
    <div class="relative z-70">
      <workflow-editor
        v-if="modalStates.workflowEditorModal.open"
        :target-model-name="targetModelName"
        tool-type="add"
        wft-id=""
        :target-model="targetModelForWorkflow"
        :migration-type="migrationTypeForWorkflow"
        :recommended-model="targetModelForWorkflow"
        @update:close-modal="modalStates.workflowEditorModal.open = false"
        @update:saved="handleSavedWorkflow"
      />
    </div>
  </div>
</template>
