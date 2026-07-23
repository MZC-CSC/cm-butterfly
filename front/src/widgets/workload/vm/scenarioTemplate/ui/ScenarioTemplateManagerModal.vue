<script setup lang="ts">
import {
  PButtonModal,
  PFieldGroup,
  PTextInput,
  PButton,
} from '@cloudforet-test/mirinae';
import { ref, reactive, onMounted } from 'vue';
import { showSuccessMessage, showErrorMessage } from '@/shared/utils';
import {
  useGetAllLoadTestScenarioCatalogs,
  useCreateLoadTestScenarioCatalog,
  useUpdateLoadTestScenarioCatalog,
  useDeleteLoadTestScenarioCatalog,
  ILoadTestScenarioCatalog,
  ICreateLoadTestScenarioCatalogRequest,
  IUpdateLoadTestScenarioCatalogRequest,
} from '@/entities/vm';

interface IProps {
  isOpen: boolean;
  nsId: string;
  mciId: string;
  vmId: string;
  ip: string;
}

// The ScenarioTemplate interface is replaced by ILoadTestScenarioCatalog
// ILoadTestScenarioCatalog already includes all fields, so no separate extension is needed
type ScenarioTemplate = ILoadTestScenarioCatalog;

defineProps<IProps>();
const emit = defineEmits(['close']);

// Form data for saving a template
const templateForm = reactive({
  name: '',
  description: '',
  virtualUsers: '',
  duration: '',
  rampUpTime: '',
  rampUpSteps: '',
});

// API hooks
const { data: catalogsData, execute: fetchCatalogs } =
  useGetAllLoadTestScenarioCatalogs();

// List of saved templates
const savedTemplates = ref<ScenarioTemplate[]>([]);
const activeTab = ref<'save' | 'load'>('save');
const editingTemplate = ref<ScenarioTemplate | null>(null);
const loading = ref(false);

// Save the template
async function saveTemplate() {
  if (!templateForm.name.trim()) {
    showErrorMessage('failed', 'Please enter a template name.');
    return;
  }

  loading.value = true;

  try {
    if (editingTemplate.value) {
      // Edit mode
      const updateData: IUpdateLoadTestScenarioCatalogRequest = {
        name: templateForm.name,
        description: templateForm.description,
        virtualUsers: templateForm.virtualUsers,
        duration: templateForm.duration,
        rampUpTime: templateForm.rampUpTime,
        rampUpSteps: templateForm.rampUpSteps,
      };

      const { execute: updateCatalogExecute } =
        useUpdateLoadTestScenarioCatalog(editingTemplate.value.id, updateData);
      await updateCatalogExecute();
      showSuccessMessage('success', 'Template updated successfully.');
      editingTemplate.value = null;
    } else {
      // Create new
      const createData: ICreateLoadTestScenarioCatalogRequest = {
        name: templateForm.name,
        description: templateForm.description,
        virtualUsers: templateForm.virtualUsers,
        duration: templateForm.duration,
        rampUpTime: templateForm.rampUpTime,
        rampUpSteps: templateForm.rampUpSteps,
      };

      const { execute: createCatalogExecute } =
        useCreateLoadTestScenarioCatalog(createData);
      await createCatalogExecute();
      showSuccessMessage('success', 'Template saved successfully.');
    }

    // Refresh the list
    await loadTemplates();

    // Reset the form
    resetForm();
  } catch (error) {
    console.error('Failed to save template:', error);
    showErrorMessage('failed', 'Failed to save template. Please try again.');
  } finally {
    loading.value = false;
  }
}

// Edit the template
function editTemplate(template: ScenarioTemplate) {
  editingTemplate.value = template;
  templateForm.name = template.name;
  templateForm.description = template.description;
  templateForm.virtualUsers = template.virtualUsers;
  templateForm.duration = template.duration;
  templateForm.rampUpTime = template.rampUpTime;
  templateForm.rampUpSteps = template.rampUpSteps;
  activeTab.value = 'save'; // Switch to the save tab
}

// Delete the template
async function deleteTemplate(templateId: number) {
  loading.value = true;

  try {
    const { execute: deleteCatalogExecute } =
      useDeleteLoadTestScenarioCatalog(templateId);
    await deleteCatalogExecute();
    showSuccessMessage('success', 'Template deleted successfully.');
    // Refresh the list
    await loadTemplates();
  } catch (error) {
    console.error('Failed to delete template:', error);
    showErrorMessage('failed', 'Failed to delete template. Please try again.');
  } finally {
    loading.value = false;
  }
}

function cancelEdit() {
  editingTemplate.value = null;
  resetForm();
}

function handleClose() {
  editingTemplate.value = null;
  resetForm();
  // Reset the tab
  activeTab.value = 'save';
  emit('close');
}

// Form reset helper
function resetForm() {
  templateForm.name = '';
  templateForm.description = '';
  templateForm.virtualUsers = '';
  templateForm.duration = '';
  templateForm.rampUpTime = '';
  templateForm.rampUpSteps = '';
}

// Load templates from the API
async function loadTemplates() {
  loading.value = true;

  try {
    await fetchCatalogs();

    if (catalogsData.value?.responseData?.result?.loadTestScenarioCatalogs) {
      savedTemplates.value =
        catalogsData.value.responseData.result.loadTestScenarioCatalogs;
    } else {
      savedTemplates.value = [];
    }
  } catch (error) {
    showErrorMessage('failed', 'Failed to load templates. Please try again.');
  } finally {
    loading.value = false;
  }
}

// Load templates when the component mounts
onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <p-button-modal
    data-testid="scenario-template-modal"
    :visible="isOpen"
    :v-model="isOpen"
    :loading="loading"
    header-title="Scenario Template Management"
    hide-footer
    @close="handleClose"
    @cancel="handleClose"
  >
    <template #body>
      <div class="template-manager">
        <!-- Tab header -->
        <div class="tab-header">
          <button
            :class="['tab-button', { active: activeTab === 'save' }]"
            @click="activeTab = 'save'"
          >
            Save Template
          </button>
          <button
            :class="['tab-button', { active: activeTab === 'load' }]"
            @click="activeTab = 'load'"
          >
            Manage Templates
          </button>
        </div>

        <!-- Save template tab -->
        <div v-if="activeTab === 'save'" class="tab-content">
          <div class="save-section">
            <h3>
              {{ editingTemplate ? 'Edit Template' : 'Save New Template' }}
            </h3>
            <p class="description">
              Save current load configuration as a template for future reuse.
            </p>

            <div class="template-form">
              <p-field-group label="Template Name" required>
                <template #default="{ invalid }">
                  <p-text-input
                    v-model="templateForm.name"
                    data-testid="scenario-template-name"
                    :invalid="invalid"
                    placeholder="Enter template name"
                    block
                  />
                </template>
              </p-field-group>

              <p-field-group label="Description">
                <template #default="{ invalid }">
                  <p-text-input
                    v-model="templateForm.description"
                    :invalid="invalid"
                    placeholder="Enter template description"
                    block
                  />
                </template>
              </p-field-group>

              <section class="section">
                <p-field-group label="Virtual Users" required>
                  <template #default="{ invalid }">
                    <p-text-input
                      v-model="templateForm.virtualUsers"
                      :invalid="invalid"
                      type="number"
                      placeholder="Number of virtual users"
                      block
                    />
                  </template>
                </p-field-group>
                <p-field-group label="Test Duration" required>
                  <template #default="{ invalid }">
                    <p-text-input
                      v-model="templateForm.duration"
                      :invalid="invalid"
                      type="number"
                      placeholder="Test Run Time"
                      block
                    >
                      <template #input-right>sec</template>
                    </p-text-input>
                  </template>
                </p-field-group>
                <div class="flex gap-1">
                  <p-field-group
                    class="flex-1 !m-0"
                    label="RampUp Time"
                    required
                  >
                    <template #default="{ invalid }">
                      <p-text-input
                        v-model="templateForm.rampUpTime"
                        :invalid="invalid"
                        placeholder="Time"
                        type="number"
                        block
                      />
                    </template>
                  </p-field-group>
                  <p-field-group
                    class="flex-1 !m-0"
                    label="RampUp Steps"
                    required
                  >
                    <template #default="{ invalid }">
                      <p-text-input
                        v-model="templateForm.rampUpSteps"
                        :invalid="invalid"
                        placeholder="Number of steps"
                        type="number"
                        block
                      />
                    </template>
                  </p-field-group>
                </div>
              </section>

              <div class="save-actions">
                <p-button
                  data-testid="scenario-template-save"
                  style-type="primary"
                  :loading="loading"
                  @click="saveTemplate"
                >
                  {{ editingTemplate ? 'Update Template' : 'Save Template' }}
                </p-button>
                <p-button
                  v-if="editingTemplate"
                  style-type="secondary"
                  @click="cancelEdit"
                >
                  Cancel
                </p-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Load template tab -->
        <div v-if="activeTab === 'load'" class="tab-content">
          <div class="load-section">
            <h3>Saved Templates</h3>

            <div class="templates-table">
              <div v-if="loading" class="loading-state">
                <p>Loading templates...</p>
              </div>
              <div v-else-if="savedTemplates.length === 0" class="empty-state">
                <p>No templates saved yet.</p>
              </div>
              <div v-else class="template-list">
                <div
                  v-for="template in savedTemplates"
                  :key="template.id"
                  class="template-item"
                >
                  <div class="template-info">
                    <div class="template-name">
                      <strong>{{ template.name }}</strong>
                      <p class="template-description">
                        {{ template.description }}
                      </p>
                    </div>
                    <div class="template-date">
                      {{ template.createdAt }}
                    </div>
                  </div>
                  <div class="template-actions" @click.stop>
                    <p-button
                      style-type="tertiary"
                      size="sm"
                      @click="editTemplate(template)"
                    >
                      Edit
                    </p-button>
                    <p-button
                      style-type="secondary"
                      size="sm"
                      :loading="loading"
                      @click="deleteTemplate(template.id)"
                    >
                      Delete
                    </p-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="modal-footer">
        <p-button style-type="secondary" @click="handleClose"> Close </p-button>
      </div>
    </template>
  </p-button-modal>
</template>

<style scoped lang="postcss">
.template-manager {
  @apply bg-gray-100;
  padding: 16px;

  .tab-header {
    @apply flex border-b border-gray-300 mb-4;

    .tab-button {
      @apply px-4 py-2 text-sm font-medium border-b-2 border-transparent;
      @apply hover:text-blue-600 hover:border-blue-300;

      &.active {
        @apply text-blue-600 border-blue-600;
      }
    }
  }

  .tab-content {
    .save-section,
    .load-section {
      h3 {
        @apply text-lg font-semibold mb-2;
      }

      .description {
        @apply text-sm text-gray-600 mb-4;
      }
    }

    .template-form {
      .section {
        background: white;
        margin: 8px 0;
        padding: 12px;
        border-radius: 6px;
      }

      .save-actions {
        @apply flex justify-end mt-4 gap-2;
      }
    }

    .templates-table {
      .loading-state,
      .empty-state {
        @apply text-center py-8 text-gray-500;
      }

      .template-list {
        @apply space-y-2;
      }

      .template-item {
        @apply flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all;

        .template-info {
          @apply flex-1;

          .template-name {
            strong {
              @apply block text-sm font-medium text-gray-900;
            }

            .template-description {
              @apply text-xs text-gray-500 mt-1;
            }
          }

          .template-date {
            @apply text-xs text-gray-400 mt-1;
          }
        }

        .template-actions {
          @apply flex gap-1 ml-4;
        }
      }
    }
  }
}

.modal-footer {
  @apply flex justify-end gap-2;
}
</style>
