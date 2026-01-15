/**
 * Playwright 전역 정리 - 테스트 종료 후 EC2 리소스 정리
 */

import { cleanupEC2Resource } from './utils/aws-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EC2_RESOURCE_FILE = path.join(__dirname, '.ec2-resource.json');

async function globalTeardown() {
  console.log('\n========================================');
  console.log('Global Teardown: Cleaning up resources...');
  console.log('========================================\n');

  try {
    // 리소스 정보 파일 읽기
    if (fs.existsSync(EC2_RESOURCE_FILE)) {
      const resourceJson = fs.readFileSync(EC2_RESOURCE_FILE, 'utf-8');
      const resource = JSON.parse(resourceJson);

      await cleanupEC2Resource(resource);

      // 리소스 파일 삭제
      fs.unlinkSync(EC2_RESOURCE_FILE);
    } else {
      console.log('No EC2 resource file found, skipping cleanup');
    }

    console.log('\n========================================');
    console.log('Global Teardown: Completed');
    console.log('========================================\n');
  } catch (error) {
    console.error('Failed to cleanup EC2 resources:', error);
    // 정리 실패해도 테스트 결과에 영향 없도록
  }
}

export default globalTeardown;
