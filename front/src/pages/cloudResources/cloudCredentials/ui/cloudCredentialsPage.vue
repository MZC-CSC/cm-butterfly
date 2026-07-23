<!-- src/pages/cloudResources/cloudCredentials/ui/CredentialPage.vue -->
<script setup lang="ts">
import { ref, reactive } from 'vue';
import { PButton, PTab } from '@cloudforet-test/mirinae';
import CustomViewCredential from '@/widgets/credentials/customViewCredential/ui/CustomViewCredential.vue';
import CredentialsList from '@/widgets/credentials/credentialsList/ui/CredentialsList.vue';
import CredentialsDetail from '@/widgets/credentials/credentialsDetail/ui/CredentialsDetail.vue';
import { showSuccessMessage } from '@/shared/utils';

const selectedCredentialName = ref<{ id: string } | null>(null);
const pageName = 'Cloud Credentials';

// Main tab state
const mainTabState = ref({
  activeTab: 'details',
  tabs: [
    { name: 'details', label: 'Details' },
    { name: 'usage', label: 'Usage' },
  ],
});

// Credential Detail tab state (if needed)
const credentialDetailTabState = ref({
  activeTab: 'information',
  tabs: [
    { name: 'information', label: 'Information' },
    { name: 'usageCollect', label: 'Usage Collect' },
  ],
});

// Modal state
const modalStates = reactive({
  addCredentialGroup: {
    open: false,
    category: 'add',
    confirm() {
      modalStates.addCredentialGroup.open = false;
    },
    trigger: false,
    updateTrigger() {
      modalStates.addCredentialGroup.trigger = false;
    },
  },
});

// Modal handlers
function handleCredentialEdit() {
  showSuccessMessage('Info', 'Edit functionality is currently disabled.');
}
// Add Credential handler
function handleAddCredential() {
  modalStates.addCredentialGroup.open = true;
  getCredentialList();
  // modalStates.addServiceGroup.open = !value;
  // modalStates.addSourceConnection.open = value;
  // isCollapsed.value = value;
  // isGnbToolboxShown.value = !value;
}

// // Edit Credential handler
// function handleCredentialEdit() {
//   if (selectedCredentialName.value) {
//     modalStates.editCredentialGroup.open = true;
//   } else {
//     showErrorMessage('Error', 'Please select a Credential to edit.');
//   }
// }

// let data = computed(() => selectedCredentialName.value?.id);
// Credential selection handler
// function handleClickCredentialName(credential: { id: string }) {
//   selectedCredentialName.value = credential;
//   data = selectedCredentialName.value?.id;
//   console.log('extracted id value:', data);
//   console.log('extracted id value:', typeof data);
//   console.log('selected Credential Name:', credential);
//   console.log('selectedCredentialName:', selectedCredentialName.value);

//   // use data wherever it's needed
// }

// function handleClickCredentialName(credential: { id: string }) {
//   selectedCredentialName.value = credential;
//   console.log('selected Credential Name:', credential.id);
// }
function handleClickCredentialName(credential: { id: string }) {
  selectedCredentialName.value = credential;
}

// Modal-related handlers (implement as needed)
// Handle events triggered from the modal
function handleAddCredentialTrigger() {
  showSuccessMessage('Success', 'Credential added successfully.');
  modalStates.addCredentialGroup.trigger = true;
}
</script>

<template>
  <div :class="`${pageName}-page page`">
    <header>
      <p>{{ pageName }}</p>
    </header>
    <section :class="`${pageName}-page-body`">
      <CredentialsList
        :add-modal-state="modalStates.addCredentialGroup.open"
        :trigger="modalStates.addCredentialGroup.trigger"
        @select-row="handleClickCredentialName"
        @update:addModalState="e => (modalStates.addCredentialGroup.open = e)"
        @update:trigger="modalStates.addCredentialGroup.trigger = false"
        @update:title="e => (modalStates.addCredentialGroup.category = e)"
      />
      <p v-if="!selectedCredentialName" class="no-selection-message">
        Select an item for more details.
      </p>
      <div v-if="selectedCredentialName">
        <p-tab v-model="mainTabState.activeTab" :tabs="mainTabState.tabs">
          <template #details>
            <div class="tab-section-header">
              <p>Credential Details</p>
              <p-button
                style-type="tertiary"
                icon-left="ic_edit"
                @click="handleCredentialEdit"
              >
                Edit
              </p-button>
            </div>
            <CredentialsDetail
              :selectedCredentialName="selectedCredentialName?.id"
            />
          </template>
          <template #usage>
            <div class="tab-section-header">
              <p>Credential Usage</p>
            </div>
          </template>
        </p-tab>
      </div>
    </section>
    <div class="relative z-70">
      <custom-view-credential
        v-if="modalStates.addCredentialGroup.open"
        @update:isModalOpened="
          () => (modalStates.addCredentialGroup.open = false)
        "
        @update:is-connection-modal-opened="handleAddCredential"
        @update:trigger="modalStates.addCredentialGroup.trigger = true"
      />
    </div>
  </div>
</template>

<style scoped>
.credential-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* Additional styles */
}

.no-selection-message {
  text-align: center;
  color: gray;
  font-size: 14px;
}

.modal-container {
  position: relative;
  z-index: 60;
}
</style>
