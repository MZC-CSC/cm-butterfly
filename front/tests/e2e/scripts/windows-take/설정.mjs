/*
  촬영과 점검이 함께 보는 값들.

  ★ 여기에 주소나 경로를 적어 두지 않는다. 이 폴더는 공개 저장소에 있고, 값은 환경마다 다르다.
    전부 `tests/e2e/e2e.config` 에서 읽는다 — 나머지 e2e 가 읽는 그 파일이다(docs/03-환경설정).
    그 파일은 추적되지 않으므로 자기 값이 저장소에 올라가지 않는다.
*/
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const E2E_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/*
  e2e.config 를 읽는다.

  ★ support/loadConfig.ts 와 같은 일을 한다. 그쪽은 테스트 러너가 읽는 타입스크립트라 여기서
    그대로 부를 수 없어(이 스크립트들은 윈도우즈에서 node 로 곧장 돈다) 같은 규칙을 짧게 다시
    적었다. 형식이 KEY=VALUE 한 줄씩이라 옮겨 적을 것이 많지 않다.
*/
function fromConfig() {
  const file = path.join(E2E_DIR, 'e2e.config');
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value))
      value = value.slice(1, -1);
    if (value.startsWith('~/')) value = path.join(os.homedir(), value.slice(2));
    out[key] = value;
  }
  return out;
}

const cfg = fromConfig();
const value = (name, fallback) => process.env[name] ?? cfg[name] ?? fallback;

const need = name => {
  const v = value(name);
  if (!v) {
    throw new Error(
      `${name} 이 없다 — tests/e2e/e2e.config 에 넣는다 (e2e.config.example 참고).`,
    );
  }
  return v;
};

/**
 * 화면에 나갈 주소.
 *
 * ★ 영상에 나가는 주소는 개발 장비 이름이 아니라 배포본 이름이어야 한다. 붙는 곳은 같은 서버이고
 *   (hosts 에 이 이름을 그 서버 주소로 적어 둔다), 이름만 바꿔 부르는 것이다.
 */
export const PUBLIC_HOST = need('E2E_PUBLIC_HOST');
export const BASE_URL = value('BASE_URL') || `http://${PUBLIC_HOST}`;

/** 실제로 붙는 곳. 이 이름이 늘 현재 공인 IP 를 가리키므로 hosts 에 적을 값은 여기서 나온다. */
export const REAL_HOST = need('E2E_REAL_HOST');

/** 파일 창이 열릴 폴더. 넣을 파일 하나만 두어야 화면에 그것만 보인다. */
export const IMPORT_DIR = need('E2E_IMPORT_DIR');
export const IMPORT_FILE = value('E2E_IMPORT_FILE', '연결정보.xlsx');
export const IMPORT_PATH = path.join(IMPORT_DIR, IMPORT_FILE);

/** 소스 서비스 이름 밑 설명칸에 적을 말. */
export const DESCRIPTION = '엑셀 파일을 이용한 다중 커넥션 등록';

/**
 * 촬영용 브라우저 프로필 설정.
 *
 * ★ `selectfile.last_directory` 가 이 촬영의 핵심이다. 파일 창이 여는 폴더는 프로필에 남은
 *   "마지막에 쓴 폴더"인데, 그냥 두면 계정 홈이 열려 개발 폴더 목록이 화면에 그대로 남는다.
 *   매번 새 프로필에 이 폴더를 미리 적어 둔다 — 프로필은 브라우저가 뜨기 *전에* 있어야 하므로
 *   `launchPersistentContext` 로 띄운다. 러너가 만들어 버리는 임시 프로필에 나중에 써 넣으면
 *   늦어서 무시된다.
 *
 * ★ `credentials_enable_service` 는 로그인 직후의 "비밀번호를 저장하시겠습니까?" 를 끈다.
 *   브라우저가 그린 것이라 페이지 쪽에서는 닫을 수 없고, 그냥 두면 계정 이름을 단 채
 *   끝까지 화면에 남는다.
 */
export function browserPrefs(dir) {
  return {
    selectfile: { last_directory: dir },
    savefile: { default_directory: dir },
    download: { default_directory: dir, prompt_for_download: false },
    credentials_enable_service: false,
    credentials_enable_autosignin: false,
    autofill: { credit_card_enabled: false, profile_enabled: false },
    translate: { enabled: false },
    profile: {
      exit_type: 'Normal',
      exited_cleanly: true,
      password_manager_enabled: false,
    },
  };
}
