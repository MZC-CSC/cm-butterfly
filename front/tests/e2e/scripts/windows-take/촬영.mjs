/*
  윈도우즈에서 구간2a 를 처음부터 끝까지 스스로 찍는다.

  ★ 왜 윈도우즈에서만 따로 찍나 — 파일 고르는 창은 운영체제가 그린다. 리눅스에서 찍으면 GTK 창이
    나오고, 그 창이 여는 폴더는 그 장비의 홈이라 개발 폴더가 그대로 화면에 남는다. 폴더를 바꾸는
    방법을 세 가지 시도했으나 전부 막혔다(브라우저에 다른 HOME 을 줘도 GTK 는 계정 정보를 본다).

  하는 일: 브라우저 띄우기 → 로그인 화면이 뜨면 녹화 시작 → 로그인 → 그룹 생성(이름·설명) →
           파일 창에서 **파일을 눌러 고르기** → 등록 → **Connections 탭에서 들어간 연결 보여주기**
           → 녹화 정지 → 앞부분 다듬기.

  누르는 것은 전부 윈도우즈 커서를 실제로 옮겨 누른다(조작.mjs). 사람이 직접 시험하는 장면을
  담는 것이므로 무엇이 누르는지 보여야 한다.

  화면에서 하는 일 자체는 흐름.mjs 에 있고, 점검.mjs 가 같은 것을 녹화 없이 먼저 돌려 본다.
  **촬영 전에 반드시 `node 점검.mjs` 를 통과시킨다.**

  실행:  node 촬영.mjs
*/
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, '결과');
const RAW = path.join(OUT_DIR, '원본.mp4');
const FINAL = path.join(OUT_DIR, '02-엑셀 파일로 소스 서비스 등록.mp4');
const PROFILE = path.join(os.tmpdir(), 'cmig-take-profile');

const W = 1920;
const H = 1080;
const say = m => console.log(`\n  ${m}`);

mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(IMPORT_PATH)) {
  console.error(`\n  넣을 파일이 없다: ${IMPORT_PATH}\n`);
  process.exit(1);
}

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(path.join(PROFILE, 'Default'), { recursive: true });
writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify(browserPrefs(IMPORT_DIR)),
);

const CONNS = connectionNames(IMPORT_PATH);
const GROUP = groupName();

console.log(
  `\n  찍을 것 — 그룹 ${GROUP}, 연결 ${CONNS.length} 건 (${CONNS.join(', ')})`,
);

say('브라우저를 띄운다 — 아직 녹화하지 않는다');
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

let rec = null;
try {
  /*
    ★ 로그인 화면이 다 뜬 뒤에 녹화를 시작한다.

    녹화부터 걸고 브라우저를 띄우면 창이 올라올 때까지의 바탕화면 — 곧 열려 있는 편집기와
    개발 폴더 — 이 앞머리에 그대로 담긴다. 서버가 느린 날은 그게 십수 초가 된다.
    앞을 몇 초 자를지 미리 정해 두는 방식으로는 못 막으므로, 담길 것이 갖춰진 뒤에 건다.
  */
  await openLoginScreen(page);
  await page.bringToFront();
  await wait(800);
  await mouse.calibrate();
  await wait(600);

  say('화면 녹화를 시작한다');
  rec = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'gdigrab',
      '-framerate',
      '24',
      '-offset_x',
      '0',
      '-offset_y',
      '0',
      '-video_size',
      `${W}x${H}`,
      // ★ 커서를 함께 담는다. 사람이 직접 시험하는 장면이므로 무엇이 누르는지 보여야 한다.
      '-draw_mouse',
      '1',
      '-i',
      'desktop',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '16',
      '-pix_fmt',
      'yuv420p',
      // 1초 키프레임 — 나중에 앞을 자를 때 다시 인코딩하지 않아도 된다.
      '-g',
      '24',
      '-keyint_min',
      '24',
      '-sc_threshold',
      '0',
      '-movflags',
      '+faststart',
      RAW,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  await wait(2_000);

  say('로그인한다');
  await login(page, mouse);

  say(`그룹 ${GROUP} 을 만들고 파일에서 연결정보를 넣는다`);
  await createGroupFromFile(page, mouse, {
    name: GROUP,
    description: DESCRIPTION,
    expectedCount: CONNS.length,
    answerDialog: () => pickFileByMouse(mouse, IMPORT_FILE),
  });

  say('Connections 탭에서 무엇이 들어갔는지 보여준다');
  await showConnections(page, mouse, GROUP, CONNS, 6_000);
  say(`${CONNS.join(', ')} — 다 보인다`);
} finally {
  /*
    ★ 브라우저보다 녹화를 먼저 멈춘다. 순서를 바꾸면 창이 사라진 뒤의 바탕화면이 꼬리에 남는다.
  */
  if (rec) {
    say('녹화를 멈춘다');
    rec.stdin.write('q');
    await new Promise(r => rec.on('close', r));
  }

  /*
    ★ 치우는 것은 녹화를 멈춘 *뒤에* 한다.

      영상은 "파일 한 장으로 여러 대가 등록됐다" 로 끝나야 한다. 지우는 장면이 뒤에 붙으면
      방금 보여준 것을 되무르는 것으로 읽힌다. 그렇다고 남겨 둘 수도 없다 — 연결 이름은
      서버에서 겹칠 수 없어, 남겨 두면 다음 점검과 촬영이 그 이름에 걸려 실패한다.
      그래서 카메라를 끄고 나서 지운다. **지우는 것은 이 실행이 방금 만든 그룹뿐이다.**
      (POLICY-TEST-RESOURCE-GUARD §1)
  */
  say('찍은 그룹을 지운다 — 녹화가 끝난 뒤이므로 영상에는 없다');
  const gone = await deleteGroup(page, mouse, GROUP).catch(() => false);
  say(gone ? `${GROUP} 를 지웠다` : `${GROUP} 는 지울 것이 없었다`);

  mouse.close();
  await browser.close();
}

/*
  앞을 다듬는다.

  녹화를 걸고 실제로 프레임이 잡히기까지의 짧은 틈만 잘라 낸다. 다시 인코딩하지 않고
  잘라내므로 화질은 그대로다 — 1초 키프레임으로 찍었기 때문에 가능하다.
*/
say('앞을 다듬는다');
execFileSync('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-ss',
  '1',
  '-i',
  RAW,
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  FINAL,
]);

console.log(`\n  완료\n    편집본  ${FINAL}\n    원본    ${RAW}\n`);
