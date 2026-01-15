/**
 * Playwright 전역 설정 - 테스트 시작 전 EC2 리소스 준비
 *
 * Playwright의 globalSetup은 별도 프로세스에서 실행되므로
 * process.env로는 테스트 프로세스에 환경 변수를 전달할 수 없습니다.
 * 대신 파일을 통해 리소스 정보를 전달합니다.
 */

import { getOrCreateEC2Resource } from './utils/aws-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EC2_RESOURCE_FILE = path.join(__dirname, '.ec2-resource.json');

async function globalSetup() {
  console.log('\n========================================');
  console.log('Global Setup: Preparing EC2 resources...');
  console.log('========================================\n');

  try {
    const resource = await getOrCreateEC2Resource();

    // 리소스 정보를 파일에 저장 (테스트 및 teardown에서 사용)
    fs.writeFileSync(EC2_RESOURCE_FILE, JSON.stringify(resource, null, 2));

    console.log('\n========================================');
    console.log('EC2 Resource Ready:');
    console.log(`  Instance ID: ${resource.instanceId || '(existing)'}`);
    console.log(`  Public IP: ${resource.publicIp}`);
    console.log(`  SSH User: ${resource.sshUser}`);
    console.log(`  Auto Created: ${resource.isAutoCreated}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Failed to setup EC2 resources:', error);
    // EC2 생성 실패해도 다른 테스트는 진행 가능하도록
    console.warn('Continuing without EC2 resources...');

    // 빈 리소스 파일 생성 (테스트에서 기본값 사용)
    fs.writeFileSync(EC2_RESOURCE_FILE, JSON.stringify({
      instanceId: '',
      publicIp: '',
      privateIp: '',
      keyPairName: '',
      privateKey: '',
      sshUser: 'ec2-user',
      sshPort: '22',
      isAutoCreated: false,
    }, null, 2));
  }
}

export default globalSetup;
