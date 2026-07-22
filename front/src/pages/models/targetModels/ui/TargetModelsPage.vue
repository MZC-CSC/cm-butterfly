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
 * A workflow created here is also **sent to the execution-state view** once saved.
 *
 * It should land in the same place as saving from the workflow view — what you
 * usually do after saving is *run* it, and whether to run or keep editing is
 * decided on the execution-state screen. Previously, saving here only closed the
 * editor and left you on the target-models screen, so **to get to the workflow
 * you just created you had to navigate to the workflow list and pick it again.**
 *
 * Since the screens differ (target models vs. workflow) this is routing, not a
 * tab switch, and which workflow is passed along as a query parameter.
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
    // Set migrationType based on modelType
    let migrationType = 'infra'; // default

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
      // targetmodellist update trigger goes here
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
