/*
  창에서 고를 파일을 만든다.

  ★ 파일을 저장소에 두지 않는다. 그 안에는 소스 서버 주소와 계정이 들어가는데 이 폴더는 공개
    저장소에 있고, 값은 환경마다 다르다. e2e.config 의 값으로 그때그때 만들면 저장소에 남지도
    않고 환경과 어긋나지도 않는다.

  ★ 만드는 코드는 테스트가 쓰는 것과 같은 것이다(support/xlsx.mjs). 두 벌로 두면 한쪽만 고쳐져
    "촬영에서만 되는" 차이가 생긴다.

  실행:  node 파일만들기.mjs
*/
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { IMPORT_DIR, IMPORT_PATH } from './설정.mjs';

import { buildXlsx } from '../../support/xlsx.mjs';

/*
  넣을 서버들. e2e 가 쓰는 것과 같은 값을 본다.

  ★ 인증 수단이 하나는 있어야 등록된다. 촬영은 등록까지만 보여주고 수집으로 가지 않으므로
    개인키 대신 자리를 채우는 비밀번호를 쓴다 — 키를 이 파일에 담아 두지 않기 위한 것이다.
*/
const rows = [
  [
    'name',
    'description',
    'ip_address',
    'ssh_port',
    'user',
    'password',
    'private_key',
  ],
  [
    'sshtest-nano',
    'nginx test server',
    process.env.TEST_SOURCE_NANO_IP ?? '',
    '22',
    process.env.TEST_SOURCE_SSH_USER ?? 'ubuntu',
    'e2e-dummy-pass',
    '',
  ],
  [
    'sshtest-micro',
    'nginx test server',
    process.env.TEST_SOURCE_MICRO_IP ?? '',
    '22',
    process.env.TEST_SOURCE_SSH_USER ?? 'ubuntu',
    'e2e-dummy-pass',
    '',
  ],
];

const missing = rows.slice(1).filter(r => !r[2]);
if (missing.length) {
  console.error(
    '\n  소스 서버 주소가 비어 있다 — e2e.config 의 TEST_SOURCE_NANO_IP·TEST_SOURCE_MICRO_IP 를 채운다.\n',
  );
  process.exit(1);
}

// 폴더에는 넣을 파일 하나만 둔다. 앞선 회차가 남긴 것이 함께 보이면 화면이 어수선해진다.
mkdirSync(IMPORT_DIR, { recursive: true });
if (existsSync(IMPORT_DIR)) {
  for (const entry of readdirSync(IMPORT_DIR)) {
    if (!entry.startsWith('.'))
      rmSync(path.join(IMPORT_DIR, entry), { force: true });
  }
}
writeFileSync(IMPORT_PATH, buildXlsx(rows));
console.log(`\n  만들었다: ${IMPORT_PATH}\n`);
