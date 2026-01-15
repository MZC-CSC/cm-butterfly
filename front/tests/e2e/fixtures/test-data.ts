/**
 * E2E 테스트용 데이터
 */

/**
 * 테스트 사용자 정보
 */
export const testUser = {
  username: process.env.TEST_USERNAME || 'cmiguser',
  password: process.env.TEST_PASSWORD || 'cmiguserPassword!',
};

/**
 * 관리자 사용자 정보
 */
export const adminUser = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'adminPassword!',
};

/**
 * 테스트 워크플로우 데이터
 */
export const testWorkflow = {
  name: 'E2E Test Workflow',
  description: 'Workflow created by E2E test automation',
};

/**
 * 테스트 네임스페이스
 */
export const testNamespace = {
  id: 'ns01',
  name: 'Test Namespace',
};

/**
 * 테스트용 EC2 인스턴스 정보
 */
export const testEC2 = {
  instanceId: 'i-06f39c591889058a0',
  publicIp: '43.201.31.247',
  privateIp: '172.31.2.118',
  sshPort: '22',
  sshUser: 'ec2-user',
  keyPairName: 'jsyoo-only-seoul',
  region: 'ap-northeast-2',
};

/**
 * 페이지 URL 경로
 */
export const pageUrls = {
  login: '/auth/login',
  main: '/main',
  sourceServices: '/main/source-computing/source-services',
  workflows: '/main/workflow-management/workflows',
  workflowTemplates: '/main/workflow-management/workflow-templates',
  taskComponents: '/main/workflow-management/task-components',
  workloads: '/main/workload-operations/workloads',
  sourceModels: '/main/models/source-models',
  targetModels: '/main/models/target-models',
  cloudCredentials: '/main/cloud-resources/cloud-credentials',
  apis: '/main/cloud-resources/apis',
};

/**
 * 대기 시간 (밀리초)
 */
export const timeouts = {
  short: 1000,
  medium: 3000,
  long: 5000,
  apiResponse: 10000,
  pageLoad: 15000,
};

/**
 * 테스트 셀렉터
 */
export const selectors = {
  // 로그인 페이지
  login: {
    userIdInput: 'input[placeholder="id"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '.error-msg',
    loginForm: '.login-form-wrapper',
  },

  // 공통 레이아웃
  layout: {
    sidebar: '.gnb-navigation-rail, [class*="sidebar"]',
    topbar: '.topbar, [class*="topbar"]',
    mainContent: '.main-content, [class*="main"]',
    logo: '.logo-name',
  },

  // 네비게이션
  navigation: {
    menuItem: '.menu-item, [class*="menu-item"]',
    activeMenu: '.active, [class*="active"]',
  },

  // 테이블
  table: {
    container: '.p-data-table, table',
    row: 'tr',
    cell: 'td',
    header: 'th',
  },

  // 버튼
  buttons: {
    create: 'button:has-text("Create"), button:has-text("생성")',
    save: 'button:has-text("Save"), button:has-text("저장")',
    delete: 'button:has-text("Delete"), button:has-text("삭제")',
    cancel: 'button:has-text("Cancel"), button:has-text("취소")',
    confirm: 'button:has-text("Confirm"), button:has-text("확인")',
  },

  // 모달
  modal: {
    container: '.modal, [role="dialog"]',
    closeButton: '[aria-label="Close"], .close-button',
    title: '.modal-title, [class*="modal-header"]',
  },
};
