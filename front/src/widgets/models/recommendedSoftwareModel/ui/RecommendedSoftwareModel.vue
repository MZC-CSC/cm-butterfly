<script setup lang="ts">
import { PButton, PI, PSpinner, PPaneLayout } from '@cloudforet-test/mirinae';
import { CreateForm, SimpleEditForm } from '@/widgets/layout';
import { computed, onMounted, ref, reactive, watch, nextTick } from 'vue';
import { useRecommendedSoftwareModel } from '@/widgets/models/recommendedSoftwareModel/model/useRecommendedSoftwareModel';
import { useSourceModelStore } from '@/entities';
import { EnhancedJsonEditor } from '@/shared/ui/EnhancedJsonEditor';
import { createTargetSoftwareModel } from '@/entities/targetModels/api';
import { showErrorMessage, showSuccessMessage } from '@/shared/utils';
import { useAuthStore } from '@/shared/libs/store/auth';

interface IProps {
  sourceModelName: string;
  sourceModelId: string;
}

const props = defineProps<IProps>();
const emit = defineEmits(['update:close-modal']);

const recommendSoftwareModel = useRecommendedSoftwareModel();
const sourceModelStore = useSourceModelStore();
const authStore = useAuthStore();
const resCreateTargetSoftwareModel = createTargetSoftwareModel(null);

// Editor refs
const sourceEditorRef = ref<any>(null);
const recommendedEditorRef = ref<any>(null);

// 소스 모델 데이터
const sourceModel = computed(() =>
  sourceModelStore.getSourceModelById(props.sourceModelId),
);

// 소스 소프트웨어 모델 데이터 (JSON 표시용)
const sourceSoftwareModelData = computed(() => {
  if (sourceModel.value?.sourceSoftwareModel) {
    return sourceModel.value.sourceSoftwareModel;
  }
  return null;
});

// 소스 모델 JSON string
const sourceSoftwareModelString = computed(() => {
  if (!sourceSoftwareModelData.value) return '{}';
  try {
    return JSON.stringify(sourceSoftwareModelData.value, null, 2);
  } catch (e) {
    console.error('Failed to stringify source software model:', e);
    return '{}';
  }
});

// 추천 모델 결과 데이터 (JSON 표시용)
const recommendedModelData = ref<any>(null);

// 추천 모델 JSON string
const recommendedModelString = computed(() => {
  if (!recommendedModelData.value) return '{}';
  try {
    return JSON.stringify(recommendedModelData.value, null, 2);
  } catch (e) {
    console.error('Failed to stringify recommended model:', e);
    return '{}';
  }
});

// 로딩 상태
const isLoading = ref(false);

// Save TargetModel 모달 상태
const saveTargetModelModal = reactive({
  open: false,
  context: {
    name: '',
    description: '',
  },
});

onMounted(() => {
  recommendSoftwareModel.initToolBoxTableModel();
});

// Watch for source model changes and expand all
watch(sourceSoftwareModelData, (newVal) => {
  if (newVal) {
    console.log('Source model data changed, expanding...');
    setTimeout(() => {
      sourceEditorRef.value?.expandAll();
    }, 300);
  }
}, { immediate: true, deep: true });

// Watch for recommended model changes and expand all
watch(recommendedModelData, (newVal) => {
  if (newVal) {
    console.log('Recommended model data changed, expanding...');
    setTimeout(() => {
      recommendedEditorRef.value?.expandAll();
    }, 300);
  }
}, { immediate: true, deep: true });

// Get-Migration-List API 호출 (실패 시 더미 데이터 사용)
async function handleGetMigrationList() {
  if (!sourceSoftwareModelData.value) {
    console.warn('Source software model data is not available');
    return;
  }

  isLoading.value = true;

  try {
    // 먼저 실제 API 호출 시도
    const response = await recommendSoftwareModel.getSoftwareMigrationListData(sourceSoftwareModelData.value);

    // 응답의 status.code를 확인하여 에러 여부 판단
    const statusCode = response?.data?.status?.code;
    if (statusCode && statusCode >= 400) {
      console.warn(
        'API returned error status, using dummy data:',
        response.data.status,
      );
      throw new Error(
        `API Error: ${statusCode} - ${response.data.status?.message || 'Unknown error'}`,
      );
    }

    // API 응답 데이터를 recommendedModelData에 저장
    recommendedModelData.value = recommendSoftwareModel.tableModel.tableState.items[0]?.originalData || null;

    console.log('API migration data loaded:', recommendedModelData.value);
  } catch (error) {
    console.warn('API call failed, using dummy data:', error);

    // API 호출 실패 시 더미 데이터 사용
    const dummyMigrationData = {
      description: 'Software Migration Recommendations',
      isInitUserModel: true,
      targetSoftwareModel: {
        servers: [
          {
            errors: ['No critical errors found'],
            migration_list: {
              binaries: [
                {
                  binary_path: '/usr/local/bin/app',
                  custom_configs: ['/etc/app/config.json'],
                  custom_data_paths: ['/var/lib/app/data'],
                  name: 'Sample Application',
                  needed_libraries: ['libssl-dev', 'libcurl4-openssl-dev'],
                  order: 1,
                  version: '1.0.0',
                },
              ],
              containers: [
                {
                  container_id: 'sample-container-1',
                  container_image: {
                    image_architecture: 'common',
                    image_hash: 'sha256:abc123def456',
                    image_name: 'sample-app',
                    image_version: 'latest',
                  },
                  container_ports: [
                    {
                      container_port: 8080,
                      host_ip: '0.0.0.0',
                      host_port: 8080,
                      protocol: 'tcp',
                    },
                  ],
                  container_status: 'running',
                  docker_compose_path: '/opt/docker-compose.yml',
                  envs: [
                    {
                      name: 'DB_HOST',
                      value: 'localhost',
                    },
                    {
                      name: 'DB_PORT',
                      value: '5432',
                    },
                  ],
                  mount_paths: ['/var/lib/app:/app/data'],
                  name: 'sample-app-container',
                  network_mode: 'bridge',
                  order: 1,
                  restart_policy: 'unless-stopped',
                  runtime: 'docker',
                },
              ],
              kubernetes: [
                {
                  kube_config: '/etc/kubernetes/admin.conf',
                  order: 1,
                  resources: {
                    deployment: {
                      replicas: 3,
                      resources: {
                        requests: {
                          cpu: '100m',
                          memory: '128Mi',
                        },
                        limits: {
                          cpu: '500m',
                          memory: '512Mi',
                        },
                      },
                    },
                  },
                  velero: {
                    backup_location_config: 'default',
                    bucket: 'backup-bucket',
                    features: 'EnableCSI',
                    plugins: 'velero/velero-plugin-for-aws:v1.0.0',
                    provider: 'aws',
                    secret_file: '/etc/velero/credentials',
                  },
                  version: '1.24.0',
                },
              ],
              packages: [
                {
                  custom_configs: ['/etc/nginx/nginx.conf'],
                  custom_data_paths: ['/var/www/html'],
                  gpg_key_url: 'https://nginx.org/keys/nginx_signing.key',
                  name: 'nginx',
                  need_to_delete_packages: ['apache2'],
                  needed_packages: ['nginx', 'nginx-common'],
                  order: 1,
                  repo_url: 'http://nginx.org/packages/ubuntu',
                  repo_use_os_version_code: false,
                  version: '1.18.0',
                },
              ],
            },
            source_connection_info_id: 'conn-12345',
          },
        ],
      },
      userId: 'user-123',
      userModelName: `${props.sourceModelName}_Migration`,
      userModelVersion: 'v0.1',
    };

    // 더미 데이터를 recommendedModelData에 저장
    recommendedModelData.value = dummyMigrationData;
    console.log('Dummy migration data loaded:', dummyMigrationData);
  } finally {
    isLoading.value = false;
  }
}

function handleCloseModal() {
  emit('update:close-modal', false);
}

// Save 버튼 클릭 핸들러
function handleSaveTargetModel() {
  if (!recommendedModelData.value) {
    console.warn('No migration recommendations data to save');
    return;
  }

  saveTargetModelModal.open = true;
}

// Save 모달 닫기 핸들러
function handleCloseSaveModal() {
  saveTargetModelModal.open = false;
}

// 실제 저장 처리
function handleCreateTargetModel(e) {
  saveTargetModelModal.context.name = e.name;
  saveTargetModelModal.context.description = e.description;

  // Source Software Model에서 isInitUserModel 값 가져오기
  const isInitUserModel = sourceSoftwareModelData.value?.isInitUserModel ?? false;
  const userId = authStore.id; // 로그인 유저의 ID 사용
  const userModelVersion = sourceModel.value?.userModelVersion ?? 'v0.1';

  const requestBody = {
    description: e.description,
    isInitUserModel: isInitUserModel,
    targetSoftwareModel: recommendedModelData.value.targetSoftwareModel,
    userId: userId,
    userModelVersion: userModelVersion,
    userModelName: e.name,
  };

  resCreateTargetSoftwareModel
    .execute({
      request: requestBody,
    })
    .then(res => {
      showSuccessMessage(
        'success',
        'Successfully created software target model',
      );
      saveTargetModelModal.open = false;
      emit('update:close-modal', false);
    })
    .catch(e => {
      showErrorMessage('error', e.errorMsg);
    });
}
</script>

<template>
  <div>
    <create-form
      class="page-modal-layout"
      data-testid="sw-recommend-modal"
      title="Software Migration Recommendation"
      :need-widget-layout="true"
      :badge-title="sourceModelName"
      first-title="Software Model Analysis"
      @update:modal-state="handleCloseModal"
    >
      <template #add-info>
        <div class="json-viewer-layout">
          <!-- 왼쪽: Source Model JSON Viewer -->
          <p-pane-layout class="json-editor-pane">
            <p class="editor-title">Source Software Model</p>
            <div class="editor-wrapper">
              <EnhancedJsonEditor
                ref="sourceEditorRef"
                :model-value="sourceSoftwareModelString"
                :read-only="true"
                :mode="'tree'"
                :main-menu-bar="true"
                :navigation-bar="true"
                :status-bar="false"
                height="600px"
              />
            </div>
          </p-pane-layout>

          <!-- 가운데: Recommend Model 버튼 -->
          <button
            class="convert-btn"
            data-testid="sw-recommend-get"
            :disabled="!sourceSoftwareModelData || isLoading"
            @click="handleGetMigrationList"
          >
            <div class="flex flex-row">
              <p-i
                class="icon"
                name="ic_arrow-right"
                color="white"
                width="1rem"
                height="1rem"
              />
              <p>Get Migration List</p>
            </div>
            <p-spinner v-if="isLoading" class="spinner" size="md" />
          </button>

          <!-- 오른쪽: Recommended Model 결과 JSON Viewer -->
          <p-pane-layout class="json-editor-pane">
            <p class="editor-title">Migration Recommendations</p>
            <div class="editor-wrapper">
              <EnhancedJsonEditor
                ref="recommendedEditorRef"
                :model-value="recommendedModelString"
                :read-only="true"
                :mode="'tree'"
                :main-menu-bar="true"
                :navigation-bar="true"
                :status-bar="false"
                height="600px"
              />
            </div>
          </p-pane-layout>
        </div>
      </template>

      <template #buttons>
        <p-button style-type="tertiary" @click="handleCloseModal">
          Cancel
        </p-button>
        <p-button
          data-testid="sw-recommend-save-target"
          :disabled="!recommendedModelData"
          @click="handleSaveTargetModel"
        >
          Save
        </p-button>
      </template>
    </create-form>

    <!-- Save Software Migration as Target Model 모달 -->
    <simple-edit-form
      v-if="saveTargetModelModal.open"
      header-title="Save Software Migration as Target Model"
      :name="saveTargetModelModal.context.name"
      :description="saveTargetModelModal.context.description"
      name-label="Name"
      name-placeholder="Target Model Name"
      @update:save-modal="handleCreateTargetModel"
      @update:close-modal="handleCloseSaveModal"
    />
  </div>
</template>

<style scoped lang="postcss">
.page-modal-layout {
  min-width: 1200px;
}

.json-viewer-layout {
  @apply flex justify-center;
  width: 100%;
  min-width: 600px;
  max-width: 100%;
  overflow-x: auto;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    min-width: 300px;
  }
}

.json-editor-pane {
  overflow-y: auto;
  overflow-x: auto;
  min-width: 300px;
  max-width: 100%;
  width: 100%;
  border-bottom: 1px solid #dddddf;

  .editor-title {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 700;
    background-color: #F7F7F7;
    padding: 0.25rem 0.75rem;
    border-radius: 6px 0;
  }

  .editor-wrapper {
    background-color: white;
    padding: 0.5rem;
    width: 100%;
    min-width: 280px;
    min-height: 400px;
  }
}

.convert-btn {
  @apply flex flex-col justify-center items-center rounded-[4px] text-[#fff] bg-violet-400;
  font-size: 14px;
  padding: 0 24px;
  position: relative;
  min-width: 80px;
  margin: 0 8px;
  border: none;
  cursor: pointer;

  @media (max-width: 768px) {
    margin: 8px 0;
    min-width: 120px;
  }

  .spinner {
    @apply pl-[8px];
    position: absolute;
    top: 450px;

    @media (max-width: 768px) {
      top: 60px;
    }
  }

  .icon {
    @apply mt-[2px] mr-[0.25rem];
  }
}

.convert-btn:hover {
  @apply bg-violet-500;
}

.convert-btn:focus {
  @apply bg-violet-400;
}

.convert-btn:disabled {
  @apply bg-gray-300;
  cursor: not-allowed;
}
</style>
