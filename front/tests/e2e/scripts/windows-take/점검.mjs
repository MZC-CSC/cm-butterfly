/*
  촬영 전에 기능이 실제로 도는지 먼저 확인한다. 카메라만 끈 예행연습이다.

  ★ 왜 따로 도나 — 촬영은 화면을 통째로 잡고, 그동안 사람은 손을 뗀 채 기다려야 한다. 등록이
    실패하는 것을 그 다음에 알면 그 시간과 화면을 통째로 버린다. 실제로 이름이 겹쳐 두 번 버렸다.

  ★ 왜 촬영과 같은 길로 도나 — 다른 길로 확인하면 그것은 확인이 아니다. 커서를 실제로 옮겨
    누르는 것도, 파일 창에서 파일을 눌러 고르는 것도 촬영과 똑같이 한다. 녹화만 하지 않는다.
    **그래서 이것도 도는 동안 화면을 쓴다 — 마우스·키보드를 건드리지 않는다.**

  확인이 끝나면 만들어 본 그룹을 지운다. 남겨 두면 다음에 같은 이름이 겹쳐 촬영이 실패한다.

  실행:
    node 점검.mjs                   확인하고 지운다
    node 점검.mjs --지울그룹 a,b     먼저 a,b 도 지운다 (묵은 것이 이름을 붙잡고 있을 때)
*/
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import {
  Mouse,
  wait,
  groupName,
  connectionNames,
  pickFileByMouse,
  openLoginScreen,
  login,
  createGroupFromFile,
  showConnections,
  deleteGroup,
} from './흐름.mjs';
import {
  IMPORT_DIR,
  IMPORT_FILE,
  IMPORT_PATH,
  DESCRIPTION,
  browserPrefs,
} from './설정.mjs';

const W = 1920;
const H = 1080;
const PROFILE = path.join(os.tmpdir(), 'cmig-check-profile');
const say = m => console.log(`\n  ${m}`);

const argAt = flag => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};
const TO_DELETE = (argAt('--지울그룹') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!existsSync(IMPORT_PATH)) {
  console.error(`\n  넣을 파일이 없다: ${IMPORT_PATH}\n`);
  process.exit(1);
}

const CONNS = connectionNames(IMPORT_PATH);
const GROUP = groupName();

// 촬영과 같은 프로필 설정 — 파일 창이 같은 폴더에서 열려야 예행연습이 된다.
rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(path.join(PROFILE, 'Default'), { recursive: true });
writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify(browserPrefs(IMPORT_DIR)),
);

console.log(
  `\n  확인할 것 — 그룹 ${GROUP}, 연결 ${CONNS.length} 건 (${CONNS.join(', ')})`,
);
console.log(`  넣을 파일 — ${IMPORT_PATH}`);
console.log('  도는 동안 마우스·키보드를 건드리지 않는다.\n');

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: null,
  args: [
    `--window-size=${W},${H}`,
    '--window-position=0,0',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-crash-restore-bubble',
    '--disable-save-password-bubble',
    '--password-store=basic',
    '--disable-features=Translate',
  ],
});
const page = browser.pages()[0] || (await browser.newPage());
const mouse = new Mouse(page);
let failure = null;

try {
  say('로그인 화면을 연다');
  await openLoginScreen(page);
  await page.bringToFront();
  await wait(800);
  await mouse.calibrate();

  say('로그인한다');
  await login(page, mouse);

  for (const old of TO_DELETE) {
    const gone = await deleteGroup(page, mouse, old);
    say(gone ? `묵은 그룹 ${old} 를 지웠다` : `묵은 그룹 ${old} 는 이미 없다`);
  }

  say('그룹을 만들고 파일에서 연결정보를 넣는다');
  await createGroupFromFile(page, mouse, {
    name: GROUP,
    description: DESCRIPTION,
    expectedCount: CONNS.length,
    answerDialog: () => pickFileByMouse(mouse, IMPORT_FILE),
  });
  say('등록됐다');

  say('Connections 탭에서 들어간 연결을 확인한다');
  await showConnections(page, mouse, GROUP, CONNS, 1_500);
  say(`${CONNS.length} 건이 다 보인다 — ${CONNS.join(', ')}`);
} catch (e) {
  failure = e;
} finally {
  /*
    ★ 확인하려고 만든 것은 확인이 끝나면 지운다.

      남겨 두면 그 연결 이름들을 계속 붙잡고 있어, 곧바로 이어지는 촬영이 이름 충돌로 실패한다.
      실패했을 때도 지운다 — 만들다 만 것이 남는 쪽이 더 나쁘다.
      **지우는 것은 이 실행이 방금 만든 그룹뿐이다.** (POLICY-TEST-RESOURCE-GUARD §1)
  */
  say('확인하려고 만든 그룹을 지운다');
  const gone = await deleteGroup(page, mouse, GROUP).catch(() => false);
  say(gone ? `${GROUP} 를 지웠다` : `${GROUP} 는 지울 것이 없었다`);

  mouse.close();
  await browser.close();
}

if (failure) {
  console.error(`\n  ✗ 확인 실패 — ${failure.message}\n`);
  process.exit(1);
}
console.log(`\n  ✓ 확인 완료 — 이대로 촬영해도 된다\n`);
