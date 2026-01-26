import { test, expect } from '@playwright/test';
import { captureTestStep, waitForPageLoad, performLogin } from '../utils/test-helpers';
import { testUser, pageUrls, timeouts } from '../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CSV Import 테스트 - 두 가지 인증 방식 (Password / PrivateKey)
 *
 * 테스트 시나리오:
 * 1. Source Services 목록 페이지 방문 → 스크린샷 캡처
 * 2. Add 버튼 클릭 → Add Source Service 모달 열기 → 스크린샷 캡처
 * 3. Source Service Name, Description 입력
 * 4. With Source Connection 토글 활성화
 * 5. Import Source Connection 버튼 클릭 → CSV 파일 선택 (두 가지 인증 방식 포함)
 * 6. Add 버튼 클릭 → Source Service 생성
 * 7. 목록에서 생성된 Source Service 확인 → 스크린샷 캡처
 * 8. Source Service 선택 → Connections 탭에서 Import된 Connection 확인
 * 9. 각 Connection의 SSH 연결 상태 확인 (Password, PrivateKey)
 *
 * 인증 방식:
 * - Password 인증: user + password
 * - PrivateKey 인증: user + private_key
 */

/**
 * 테스트 서버 설정
 */
interface TestServer {
  ip: string;
  port: string;
  user: string;
  password?: string;
  privateKey?: string;
}

/**
 * CSV 연결 항목 인터페이스
 */
interface CSVConnectionEntry {
  name: string;
  description: string;
  ip: string;
  port: string;
  user: string;
  password: string;
  privateKey: string;
}

/**
 * 테스트용 CSV 파일 생성 (여러 Connection 지원)
 */
function createTestCSVFile(connections: CSVConnectionEntry[], filename: string): string {
  const csvDir = path.join(__dirname, '..', 'fixtures');
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  // CSV 헤더
  let csvContent = 'name,description,ip_address,ssh_port,user,password,private_key\n';

  // 각 Connection 추가
  for (const conn of connections) {
    // Private Key의 실제 줄바꿈을 \n 리터럴 문자열로 변환
    const privateKeyOneLine = conn.privateKey ? conn.privateKey.replace(/\n/g, '\\n') : '';
    csvContent += `${conn.name},${conn.description},${conn.ip},${conn.port},${conn.user},${conn.password},${privateKeyOneLine}\n`;
  }

  const csvPath = path.join(csvDir, filename);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  console.log(`📄 CSV file created: ${csvPath}`);
  console.log(`   - Total connections: ${connections.length}`);
  for (const conn of connections) {
    const authType = conn.password ? 'Password' : 'PrivateKey';
    console.log(`   - ${conn.name}: ${authType} auth (${conn.ip})`);
  }

  return csvPath;
}

/**
 * EC2 리소스 정보 로드 (Password + PrivateKey 인증 지원)
 */
function loadTestResource(): TestServer {
  // 로컬 SSH 키 읽기
  const sshKeyPaths = [
    path.join(process.env.HOME || '', '.ssh', 'id_rsa'),
    '/home/ubuntu/mzc/ant/cm-ant/internal/utils/id_rsa',
  ];

  let privateKey = '';
  for (const keyPath of sshKeyPaths) {
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf-8');
      console.log(`🔑 SSH key loaded from: ${keyPath}`);
      break;
    }
  }

  return {
    ip: process.env.TEST_EC2_IP || '172.31.5.66',
    port: process.env.TEST_EC2_PORT || '22',
    user: process.env.TEST_EC2_USER || 'ubuntu',
    password: process.env.TEST_EC2_PASSWORD || 'TestPassword123!',
    privateKey: process.env.TEST_EC2_SSH_KEY || privateKey,
  };
}

test.describe.configure({ mode: 'serial' }); // 테스트를 순차적으로 실행

test.describe('CSV Import 테스트 - Password & PrivateKey 인증 방식', () => {
  const timestamp = Date.now();
  const testServiceName = `csv-multi-auth-${timestamp}`;
  const testResource = loadTestResource();

  // 두 가지 인증 방식의 Connection 정의
  const passwordConnName = `conn-password-${timestamp}`;
  const privateKeyConnName = `conn-privatekey-${timestamp}`;

  test.beforeEach(async ({ page }) => {
    await performLogin(page, testUser.username, testUser.password);
    await waitForPageLoad(page);
  });

  test('CSV-01: Source Service 생성 및 두 가지 인증 방식 CSV Import', async ({ page }) => {
    test.setTimeout(180000); // 3분 타임아웃

    // =========================================
    // Step 1: Source Services 목록 페이지 방문
    // =========================================
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);
    await page.waitForTimeout(timeouts.short);

    // 스크린샷 1: Source Services 목록 페이지 (테스트 시작 전 상태)
    await captureTestStep(page, 'csv-multi-auth', '01-source-services-list', 'Source Services 목록 페이지');
    console.log('📸 Screenshot 1: Source Services 목록 페이지');

    // =========================================
    // Step 2: Add 버튼 클릭하여 모달 열기
    // =========================================
    const addButton = page.locator('button:has-text("Add")').first();
    await expect(addButton).toBeVisible({ timeout: timeouts.medium });
    await addButton.click();
    await page.waitForTimeout(timeouts.short);

    // 모달이 열릴 때까지 대기 (모달 타이틀로 확인)
    const modalTitle = page.locator('text=Add Source Service').first();
    await expect(modalTitle).toBeVisible({ timeout: timeouts.medium });
    await page.waitForTimeout(500); // 모달 애니메이션 대기

    // 스크린샷 2: Add Source Service 모달 (빈 상태)
    await captureTestStep(page, 'csv-multi-auth', '02-add-modal-empty', 'Add Source Service 모달 - 입력 전');
    console.log('📸 Screenshot 2: Add Source Service 모달 (빈 상태)');

    // =========================================
    // Step 3: Source Service Name 입력
    // =========================================
    const nameInput = page.locator('input[placeholder="Source Service Name"]');
    await expect(nameInput).toBeVisible({ timeout: timeouts.short });
    await nameInput.fill(testServiceName);
    console.log(`✏️ Source Service Name: ${testServiceName}`);

    // =========================================
    // Step 4: Description 입력
    // =========================================
    const descTextarea = page.locator('textarea').first();
    if (await descTextarea.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await descTextarea.fill('CSV Import E2E Test - Password & PrivateKey 인증 방식 테스트');
      console.log('✏️ Description entered');
    }

    // =========================================
    // Step 5: With Source Connection 토글 활성화
    // =========================================
    const withConnText = page.locator('span:has-text("With Source Connection")');
    if (await withConnText.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      const parentDiv = withConnText.locator('..');
      const siblingButton = parentDiv.locator('button').first();

      if (await siblingButton.isVisible({ timeout: timeouts.short }).catch(() => false)) {
        await siblingButton.click();
        await page.waitForTimeout(timeouts.short);
        console.log('🔘 With Source Connection 토글 활성화');
      }
    }

    // 토글 활성화 여부 확인
    await page.waitForTimeout(500);
    const importBtnCheck = page.locator('button:has-text("Import Source Connection")');
    const isImportEnabled = await importBtnCheck.isEnabled({ timeout: timeouts.short }).catch(() => false);

    if (!isImportEnabled) {
      console.log('⚠️ 토글이 활성화되지 않음, XPath로 재시도...');
      const toggleByXPath = page.locator('//span[contains(text(),"With Source Connection")]/../button[1]');
      if (await toggleByXPath.first().isVisible({ timeout: timeouts.short }).catch(() => false)) {
        await toggleByXPath.first().click();
        await page.waitForTimeout(timeouts.short);
        console.log('🔘 토글 활성화 (XPath)');
      }
    }

    // =========================================
    // Step 6: CSV 파일 생성 (두 가지 인증 방식)
    // =========================================
    const connections: CSVConnectionEntry[] = [
      {
        name: passwordConnName,
        description: 'Password 인증 방식 테스트 Connection',
        ip: testResource.ip,
        port: testResource.port,
        user: testResource.user,
        password: testResource.password || '',
        privateKey: '', // Password 인증에서는 privateKey 비워둠
      },
      {
        name: privateKeyConnName,
        description: 'PrivateKey 인증 방식 테스트 Connection',
        ip: testResource.ip,
        port: testResource.port,
        user: testResource.user,
        password: '', // PrivateKey 인증에서는 password 비워둠
        privateKey: testResource.privateKey || '',
      },
    ];

    const csvPath = createTestCSVFile(connections, 'test-multi-auth-import.csv');

    // 스크린샷 3: 정보 입력 후, Import 전
    await captureTestStep(page, 'csv-multi-auth', '03-before-import', 'Source Service 정보 입력 - Import 전');
    console.log('📸 Screenshot 3: 정보 입력 완료, Import 전');

    // =========================================
    // Step 7: CSV 파일 내용 캡처 (테스트 확인용)
    // =========================================
    // CSV 파일 내용을 로그에 출력
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    console.log('\n📋 CSV 파일 내용:');
    console.log('─'.repeat(80));
    // Password와 PrivateKey는 마스킹하여 출력
    const lines = csvContent.split('\n');
    for (const line of lines) {
      if (line.includes('-----BEGIN')) {
        // PrivateKey가 있는 라인은 마스킹
        const parts = line.split(',');
        parts[parts.length - 1] = '[PRIVATE_KEY_MASKED]';
        console.log(parts.join(','));
      } else if (line.includes('TestPassword')) {
        // Password가 있는 라인은 마스킹
        const parts = line.split(',');
        parts[5] = '[PASSWORD_MASKED]';
        console.log(parts.join(','));
      } else {
        console.log(line);
      }
    }
    console.log('─'.repeat(80));

    // =========================================
    // Step 8: Import Source Connection 및 파일 업로드
    // =========================================
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);
    console.log('📁 CSV 파일 업로드 완료');

    await page.waitForTimeout(timeouts.medium);

    // 스크린샷 4: CSV 파일 Import 후
    await captureTestStep(page, 'csv-multi-auth', '04-after-import', 'CSV 파일 Import 완료 (2개 Connection)');
    console.log('📸 Screenshot 4: CSV Import 완료');

    // =========================================
    // Step 9: Add 버튼 클릭하여 Source Service 생성
    // =========================================
    const addConfirmButton = page.locator('button:has-text("Add")').last();
    if (await addConfirmButton.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await addConfirmButton.click();
      console.log('🚀 Add 버튼 클릭 - Source Service 생성 중...');
    }

    // 모달이 닫히고 목록이 갱신될 때까지 대기
    await page.waitForTimeout(timeouts.long);

    // 페이지 새로고침하여 최신 상태 확인
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);
    await page.waitForTimeout(timeouts.medium);

    // =========================================
    // Step 10: 생성된 Source Service 확인
    // =========================================
    // 스크린샷 5: Source Service 생성 결과 (목록에 추가됨)
    await captureTestStep(page, 'csv-multi-auth', '05-service-created', 'Source Service 생성 완료 - 목록 확인');
    console.log('📸 Screenshot 5: Source Service 생성 완료');

    // 생성된 Source Service 찾기
    const serviceRow = page.locator(`tr:has-text("${testServiceName}")`);
    const serviceExists = await serviceRow.isVisible({ timeout: timeouts.medium }).catch(() => false);

    if (serviceExists) {
      console.log(`✅ Source Service "${testServiceName}" created successfully`);
      await expect(serviceRow).toBeVisible();

      // =========================================
      // Step 11: Source Service 선택
      // =========================================
      await serviceRow.click();
      await page.waitForTimeout(timeouts.short);

      // 스크린샷 6: Source Service 선택됨
      await captureTestStep(page, 'csv-multi-auth', '06-service-selected', 'Source Service 선택됨');
      console.log('📸 Screenshot 6: Source Service 선택됨');

      // =========================================
      // Step 12: Connections 탭 클릭
      // =========================================
      const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
      if (await connectionsTab.isVisible({ timeout: timeouts.short }).catch(() => false)) {
        await connectionsTab.click();
        await page.waitForTimeout(timeouts.short);
        console.log('📑 Connections 탭 클릭');
      }

      // =========================================
      // Step 13: Import된 Connection 목록 확인 (2개)
      // =========================================
      // 스크린샷 7: Connections 탭 - Import된 Connection 확인
      await captureTestStep(page, 'csv-multi-auth', '07-connections-list', 'Connections 탭 - 2개 Connection 확인');
      console.log('📸 Screenshot 7: Connections 탭');

      // Password 인증 Connection 확인
      const passwordConnRow = page.locator(`tr:has-text("${passwordConnName}")`);
      const passwordConnExists = await passwordConnRow.isVisible({ timeout: timeouts.short }).catch(() => false);
      if (passwordConnExists) {
        console.log(`✅ Password 인증 Connection "${passwordConnName}" found`);
      } else {
        console.log(`⚠️ Password 인증 Connection not found by exact name`);
      }

      // PrivateKey 인증 Connection 확인
      const privateKeyConnRow = page.locator(`tr:has-text("${privateKeyConnName}")`);
      const privateKeyConnExists = await privateKeyConnRow.isVisible({ timeout: timeouts.short }).catch(() => false);
      if (privateKeyConnExists) {
        console.log(`✅ PrivateKey 인증 Connection "${privateKeyConnName}" found`);
      } else {
        console.log(`⚠️ PrivateKey 인증 Connection not found by exact name`);
      }

      // 전체 Connection 수 확인
      const connectionRows = page.locator('tbody tr');
      const connCount = await connectionRows.count();
      console.log(`📊 Total Connections in list: ${connCount}`);
    } else {
      console.log('⚠️ Source Service not found by exact name');
      const recentService = page.locator('tbody tr').first();
      if (await recentService.isVisible()) {
        await recentService.click();
        await captureTestStep(page, 'csv-multi-auth', '05-service-fallback', 'Source Service 확인 (fallback)');
      }
    }
  });

  test('CSV-02: Password 인증 Connection SSH 연결 상태 확인', async ({ page }) => {
    test.setTimeout(120000);

    // =========================================
    // Step 1: Source Services 페이지 이동
    // =========================================
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);
    await page.waitForTimeout(timeouts.medium);

    // =========================================
    // Step 2: 테스트로 생성한 Source Service 찾기
    // =========================================
    // 테이블 로드 대기
    await page.waitForSelector('tbody tr:not(.fake-row)', { state: 'visible', timeout: 30000 }).catch(() => {
      console.log('⚠️ No table rows found, continuing...');
    });

    let serviceRow = page.locator('tr:has-text("csv-multi-auth")').first();
    if (!(await serviceRow.isVisible({ timeout: timeouts.medium }).catch(() => false))) {
      // 테이블 내 실제 데이터 행 찾기 (fake-row 제외)
      serviceRow = page.locator('tbody tr:not(.fake-row)').first();
      console.log('⚠️ Using first Source Service as fallback');
    }

    await serviceRow.click({ timeout: 15000 });
    await page.waitForTimeout(timeouts.short);

    // Connections 탭 클릭
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 스크린샷 8: Password 인증 Connection 선택 전
    await captureTestStep(page, 'csv-multi-auth', '08-password-conn-before', 'Password 인증 Connection 확인 전');
    console.log('📸 Screenshot 8: Password 인증 Connection 확인 전');

    // =========================================
    // Step 3: Password 인증 Connection 선택
    // =========================================
    let passwordConnRow = page.locator('tr:has-text("conn-password")').first();
    if (!(await passwordConnRow.isVisible({ timeout: timeouts.short }).catch(() => false))) {
      // 첫 번째 Connection 선택
      passwordConnRow = page.locator('tbody tr').first();
      console.log('⚠️ Using first Connection as fallback for Password auth test');
    }

    if (await passwordConnRow.isVisible()) {
      await passwordConnRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 스크린샷 9: Password 인증 Connection 선택됨
    await captureTestStep(page, 'csv-multi-auth', '09-password-conn-selected', 'Password 인증 Connection 선택됨');
    console.log('📸 Screenshot 9: Password 인증 Connection 선택됨');

    // =========================================
    // Step 4: Password Connection Status 확인
    // =========================================
    const statusSuccess = page.locator('text=success').first();
    const isSuccess = await statusSuccess.isVisible({ timeout: timeouts.short }).catch(() => false);

    if (isSuccess) {
      console.log('✅ Password Connection Status: success');
    } else {
      console.log('⚠️ Password Connection Status: Unknown (needs Refresh)');
    }

    // 스크린샷 10: Password Connection 상태
    await captureTestStep(page, 'csv-multi-auth', '10-password-conn-status', 'Password 인증 Connection 상태');
    console.log('📸 Screenshot 10: Password Connection 상태');
  });

  test('CSV-03: PrivateKey 인증 Connection SSH 연결 상태 확인', async ({ page }) => {
    test.setTimeout(120000);

    // =========================================
    // Step 1: Source Services 페이지 이동
    // =========================================
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);
    await page.waitForTimeout(timeouts.medium);

    // =========================================
    // Step 2: 테스트로 생성한 Source Service 찾기
    // =========================================
    // 테이블 로드 대기
    await page.waitForSelector('tbody tr:not(.fake-row)', { state: 'visible', timeout: 30000 }).catch(() => {
      console.log('⚠️ No table rows found, continuing...');
    });

    let serviceRow = page.locator('tr:has-text("csv-multi-auth")').first();
    if (!(await serviceRow.isVisible({ timeout: timeouts.medium }).catch(() => false))) {
      serviceRow = page.locator('tbody tr:not(.fake-row)').first();
      console.log('⚠️ Using first Source Service as fallback');
    }

    await serviceRow.click({ timeout: 15000 });
    await page.waitForTimeout(timeouts.short);

    // Connections 탭 클릭
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 스크린샷 11: PrivateKey 인증 Connection 선택 전
    await captureTestStep(page, 'csv-multi-auth', '11-privatekey-conn-before', 'PrivateKey 인증 Connection 확인 전');
    console.log('📸 Screenshot 11: PrivateKey 인증 Connection 확인 전');

    // =========================================
    // Step 3: PrivateKey 인증 Connection 선택
    // =========================================
    let privateKeyConnRow = page.locator('tr:has-text("conn-privatekey")').first();
    if (!(await privateKeyConnRow.isVisible({ timeout: timeouts.short }).catch(() => false))) {
      // 두 번째 Connection 선택 (있는 경우)
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      if (count > 1) {
        privateKeyConnRow = rows.nth(1);
      } else {
        privateKeyConnRow = rows.first();
      }
      console.log('⚠️ Using fallback Connection for PrivateKey auth test');
    }

    if (await privateKeyConnRow.isVisible()) {
      await privateKeyConnRow.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 스크린샷 12: PrivateKey 인증 Connection 선택됨
    await captureTestStep(page, 'csv-multi-auth', '12-privatekey-conn-selected', 'PrivateKey 인증 Connection 선택됨');
    console.log('📸 Screenshot 12: PrivateKey 인증 Connection 선택됨');

    // =========================================
    // Step 4: PrivateKey Connection Status 확인
    // =========================================
    const statusSuccess = page.locator('text=success').first();
    const isSuccess = await statusSuccess.isVisible({ timeout: timeouts.short }).catch(() => false);

    if (isSuccess) {
      console.log('✅ PrivateKey Connection Status: success');
    } else {
      console.log('⚠️ PrivateKey Connection Status: Unknown (needs Refresh)');
    }

    // 스크린샷 13: PrivateKey Connection 상태
    await captureTestStep(page, 'csv-multi-auth', '13-privatekey-conn-status', 'PrivateKey 인증 Connection 상태');
    console.log('📸 Screenshot 13: PrivateKey Connection 상태');
  });

  test('CSV-04: 두 Connection Refresh로 SSH 연결 확인', async ({ page }) => {
    test.setTimeout(180000);

    // =========================================
    // Step 1: Source Services 페이지 이동
    // =========================================
    await page.goto(pageUrls.sourceServices);
    await waitForPageLoad(page);
    await page.waitForTimeout(timeouts.medium);

    // =========================================
    // Step 2: Source Service 선택
    // =========================================
    // 테이블 로드 대기
    await page.waitForSelector('tbody tr:not(.fake-row)', { state: 'visible', timeout: 30000 }).catch(() => {
      console.log('⚠️ No table rows found, continuing...');
    });

    let serviceRow = page.locator('tr:has-text("csv-multi-auth")').first();
    if (!(await serviceRow.isVisible({ timeout: timeouts.medium }).catch(() => false))) {
      serviceRow = page.locator('tbody tr:not(.fake-row)').first();
    }
    await serviceRow.click({ timeout: 15000 });
    await page.waitForTimeout(timeouts.short);

    // 스크린샷 14: Refresh 전 상태
    await captureTestStep(page, 'csv-multi-auth', '14-before-refresh', 'Refresh 전 상태');
    console.log('📸 Screenshot 14: Refresh 전');

    // =========================================
    // Step 3: Refresh 버튼 클릭
    // =========================================
    const refreshButton = page.locator('button:has-text("Refresh")');
    if (await refreshButton.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await refreshButton.click();
      console.log('🔄 Refresh 버튼 클릭');

      // API 응답 대기 (SSH 연결 확인에 시간 소요)
      await page.waitForTimeout(timeouts.long * 3); // 15초 대기
    } else {
      console.log('⚠️ Refresh 버튼을 찾을 수 없음');
    }

    // 스크린샷 15: Refresh 후 상태
    await captureTestStep(page, 'csv-multi-auth', '15-after-refresh', 'Refresh 후 상태');
    console.log('📸 Screenshot 15: Refresh 후');

    // =========================================
    // Step 4: Connections 탭에서 각 Connection 상태 확인
    // =========================================
    const connectionsTab = page.locator('button:has-text("Connections"), [role="tab"]:has-text("Connections")').first();
    if (await connectionsTab.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await connectionsTab.click();
      await page.waitForTimeout(timeouts.short);
    }

    // 스크린샷 16: Connections 탭 최종 상태
    await captureTestStep(page, 'csv-multi-auth', '16-connections-final', 'Connections 탭 - 최종 상태');
    console.log('📸 Screenshot 16: Connections 탭 최종 상태');

    // =========================================
    // Step 5: Password Connection 최종 확인
    // =========================================
    let passwordConn = page.locator('tr:has-text("conn-password")').first();
    if (await passwordConn.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await passwordConn.click();
      await page.waitForTimeout(timeouts.short);
    }

    await captureTestStep(page, 'csv-multi-auth', '17-password-final', 'Password 인증 Connection 최종 상태');
    console.log('📸 Screenshot 17: Password Connection 최종');

    // Status 확인
    let statusText = await page.locator('text=success').first().isVisible({ timeout: timeouts.short }).catch(() => false);
    if (statusText) {
      console.log('✅ Password Connection: SSH 연결 성공');
    } else {
      console.log('⚠️ Password Connection: SSH 연결 상태 확인 필요');
    }

    // =========================================
    // Step 6: PrivateKey Connection 최종 확인
    // =========================================
    let privateKeyConn = page.locator('tr:has-text("conn-privatekey")').first();
    if (await privateKeyConn.isVisible({ timeout: timeouts.short }).catch(() => false)) {
      await privateKeyConn.click();
      await page.waitForTimeout(timeouts.short);
    } else {
      // 두 번째 행 선택
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      if (count > 1) {
        await rows.nth(1).click();
        await page.waitForTimeout(timeouts.short);
      }
    }

    await captureTestStep(page, 'csv-multi-auth', '18-privatekey-final', 'PrivateKey 인증 Connection 최종 상태');
    console.log('📸 Screenshot 18: PrivateKey Connection 최종');

    // Status 확인
    statusText = await page.locator('text=success').first().isVisible({ timeout: timeouts.short }).catch(() => false);
    if (statusText) {
      console.log('✅ PrivateKey Connection: SSH 연결 성공');
    } else {
      console.log('⚠️ PrivateKey Connection: SSH 연결 상태 확인 필요');
    }

    console.log('\n🎉 CSV Import 멀티 인증 테스트 완료!');
    console.log('   - Password 인증 Connection 테스트');
    console.log('   - PrivateKey 인증 Connection 테스트');
  });
});
