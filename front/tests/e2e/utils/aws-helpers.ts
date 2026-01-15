/**
 * AWS EC2 테스트 리소스 관리 헬퍼
 *
 * 테스트용 EC2 인스턴스를 자동으로 생성하고 삭제합니다.
 * 환경 변수로 기존 서버 정보가 제공되면 해당 서버를 사용합니다.
 */

import { execSync } from 'child_process';

interface EC2TestResource {
  instanceId: string;
  publicIp: string;
  privateIp: string;
  keyPairName: string;
  privateKey: string;
  sshUser: string;
  sshPort: string;
  isAutoCreated: boolean;
}

interface AWSConfig {
  region: string;
  amiId?: string;
  instanceType: string;
  securityGroupId?: string;
  subnetId?: string;
  vpcId?: string;
}

const DEFAULT_CONFIG: AWSConfig = {
  region: 'ap-northeast-2',
  instanceType: 't3.micro',
};

/**
 * AWS CLI 명령 실행
 */
function runAWSCommand(command: string, timeout = 60000): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error: any) {
    console.error(`AWS command failed: ${command}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * 최신 Amazon Linux 2023 AMI ID 조회
 */
function getLatestAMI(region: string): string {
  const command = `aws ec2 describe-images --region ${region} --owners amazon --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text`;
  return runAWSCommand(command);
}

/**
 * 기본 VPC ID 조회
 */
function getDefaultVPC(region: string): string {
  const command = `aws ec2 describe-vpcs --region ${region} --query 'Vpcs[?IsDefault==\`true\`].VpcId' --output text`;
  return runAWSCommand(command);
}

/**
 * 기본 서브넷 ID 조회
 */
function getDefaultSubnet(region: string, vpcId: string): string {
  const command = `aws ec2 describe-subnets --region ${region} --filters "Name=vpc-id,Values=${vpcId}" --query 'Subnets[0].SubnetId' --output text`;
  return runAWSCommand(command);
}

/**
 * 기본 보안 그룹 ID 조회
 */
function getDefaultSecurityGroup(region: string, vpcId: string): string {
  const command = `aws ec2 describe-security-groups --region ${region} --filters "Name=vpc-id,Values=${vpcId}" "Name=group-name,Values=default" --query 'SecurityGroups[0].GroupId' --output text`;
  return runAWSCommand(command);
}

/**
 * 보안 그룹에 SSH 규칙 추가 (없는 경우)
 */
function ensureSSHRule(region: string, securityGroupId: string): void {
  try {
    const checkCommand = `aws ec2 describe-security-groups --region ${region} --group-ids ${securityGroupId} --query 'SecurityGroups[0].IpPermissions[?FromPort==\`22\`]' --output text`;
    const hasRule = runAWSCommand(checkCommand);

    if (!hasRule) {
      const addCommand = `aws ec2 authorize-security-group-ingress --region ${region} --group-id ${securityGroupId} --protocol tcp --port 22 --cidr 0.0.0.0/0`;
      runAWSCommand(addCommand);
      console.log('SSH rule added to security group');
    }
  } catch (error) {
    // 이미 규칙이 있는 경우 에러 무시
    console.log('SSH rule already exists or failed to add');
  }
}

/**
 * 테스트용 키페어 생성
 */
function createKeyPair(region: string, keyName: string): string {
  const command = `aws ec2 create-key-pair --region ${region} --key-name ${keyName} --query 'KeyMaterial' --output text`;
  return runAWSCommand(command);
}

/**
 * 키페어 삭제
 */
function deleteKeyPair(region: string, keyName: string): void {
  try {
    const command = `aws ec2 delete-key-pair --region ${region} --key-name ${keyName}`;
    runAWSCommand(command);
    console.log(`KeyPair deleted: ${keyName}`);
  } catch (error) {
    console.error(`Failed to delete KeyPair: ${keyName}`);
  }
}

/**
 * EC2 인스턴스 생성
 */
function createInstance(
  region: string,
  amiId: string,
  instanceType: string,
  keyName: string,
  securityGroupId: string,
  subnetId: string,
  name: string
): { instanceId: string; privateIp: string } {
  const command = `aws ec2 run-instances --region ${region} --image-id ${amiId} --instance-type ${instanceType} --key-name ${keyName} --security-group-ids ${securityGroupId} --subnet-id ${subnetId} --associate-public-ip-address --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=${name}}]' --query 'Instances[0].[InstanceId,PrivateIpAddress]' --output text`;

  const result = runAWSCommand(command);
  const [instanceId, privateIp] = result.split('\t');
  return { instanceId, privateIp };
}

/**
 * EC2 인스턴스가 Running 상태가 될 때까지 대기
 */
function waitForInstance(region: string, instanceId: string): string {
  console.log(`Waiting for instance ${instanceId} to be running...`);

  // instance-running 상태 대기
  const waitCommand = `aws ec2 wait instance-running --region ${region} --instance-ids ${instanceId}`;
  runAWSCommand(waitCommand, 180000); // 3분 타임아웃

  // Public IP 조회
  const getIpCommand = `aws ec2 describe-instances --region ${region} --instance-ids ${instanceId} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text`;
  const publicIp = runAWSCommand(getIpCommand);

  console.log(`Instance ${instanceId} is running with IP: ${publicIp}`);
  return publicIp;
}

/**
 * EC2 인스턴스 종료
 */
function terminateInstance(region: string, instanceId: string): void {
  try {
    const command = `aws ec2 terminate-instances --region ${region} --instance-ids ${instanceId}`;
    runAWSCommand(command);
    console.log(`Instance terminated: ${instanceId}`);

    // 종료 완료 대기
    const waitCommand = `aws ec2 wait instance-terminated --region ${region} --instance-ids ${instanceId}`;
    runAWSCommand(waitCommand, 180000);
    console.log(`Instance termination completed: ${instanceId}`);
  } catch (error) {
    console.error(`Failed to terminate instance: ${instanceId}`);
  }
}

/**
 * 테스트용 EC2 리소스 생성 또는 기존 리소스 사용
 *
 * 환경 변수:
 * - TEST_EC2_IP: 기존 EC2 Public IP (설정 시 기존 서버 사용)
 * - TEST_EC2_USER: SSH 사용자 (기본값: ec2-user)
 * - TEST_EC2_PORT: SSH 포트 (기본값: 22)
 * - TEST_EC2_SSH_KEY: SSH Private Key (기존 서버 사용 시 필수)
 */
export async function getOrCreateEC2Resource(): Promise<EC2TestResource> {
  // 환경 변수로 기존 서버 정보가 제공된 경우
  const existingIp = process.env.TEST_EC2_IP;
  const existingKey = process.env.TEST_EC2_SSH_KEY;

  if (existingIp && existingKey) {
    console.log(`Using existing EC2 instance: ${existingIp}`);
    return {
      instanceId: '',
      publicIp: existingIp,
      privateIp: '',
      keyPairName: '',
      privateKey: existingKey,
      sshUser: process.env.TEST_EC2_USER || 'ec2-user',
      sshPort: process.env.TEST_EC2_PORT || '22',
      isAutoCreated: false,
    };
  }

  // 새로운 EC2 인스턴스 자동 생성
  console.log('Creating new EC2 instance for testing...');

  const region = DEFAULT_CONFIG.region;
  const timestamp = Date.now();
  const keyPairName = `e2e-test-keypair-${timestamp}`;
  const instanceName = `e2e-test-instance-${timestamp}`;

  try {
    // 1. AMI ID 조회
    const amiId = getLatestAMI(region);
    console.log(`Using AMI: ${amiId}`);

    // 2. VPC, 서브넷, 보안 그룹 조회
    const vpcId = getDefaultVPC(region);
    const subnetId = getDefaultSubnet(region, vpcId);
    const securityGroupId = getDefaultSecurityGroup(region, vpcId);

    // 3. SSH 규칙 확인
    ensureSSHRule(region, securityGroupId);

    // 4. 키페어 생성
    console.log(`Creating KeyPair: ${keyPairName}`);
    const privateKey = createKeyPair(region, keyPairName);

    // 5. EC2 인스턴스 생성
    console.log(`Creating EC2 instance: ${instanceName}`);
    const { instanceId, privateIp } = createInstance(
      region,
      amiId,
      DEFAULT_CONFIG.instanceType,
      keyPairName,
      securityGroupId,
      subnetId,
      instanceName
    );

    // 6. Running 상태 대기 및 Public IP 조회
    const publicIp = waitForInstance(region, instanceId);

    // 7. SSH 접속 가능할 때까지 추가 대기 (30초)
    console.log('Waiting for SSH to be available...');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    return {
      instanceId,
      publicIp,
      privateIp,
      keyPairName,
      privateKey,
      sshUser: 'ec2-user',
      sshPort: '22',
      isAutoCreated: true,
    };
  } catch (error) {
    console.error('Failed to create EC2 resources:', error);
    throw error;
  }
}

/**
 * 테스트용 EC2 리소스 정리
 */
export async function cleanupEC2Resource(resource: EC2TestResource): Promise<void> {
  if (!resource.isAutoCreated) {
    console.log('Skipping cleanup for existing EC2 instance');
    return;
  }

  const region = DEFAULT_CONFIG.region;

  console.log('Cleaning up EC2 test resources...');

  // 1. EC2 인스턴스 종료
  if (resource.instanceId) {
    terminateInstance(region, resource.instanceId);
  }

  // 2. 키페어 삭제
  if (resource.keyPairName) {
    deleteKeyPair(region, resource.keyPairName);
  }

  console.log('EC2 test resources cleanup completed');
}

/**
 * 전역 테스트 리소스 저장소
 */
let globalEC2Resource: EC2TestResource | null = null;

export function getGlobalEC2Resource(): EC2TestResource | null {
  return globalEC2Resource;
}

export function setGlobalEC2Resource(resource: EC2TestResource): void {
  globalEC2Resource = resource;
}

export function clearGlobalEC2Resource(): void {
  globalEC2Resource = null;
}
