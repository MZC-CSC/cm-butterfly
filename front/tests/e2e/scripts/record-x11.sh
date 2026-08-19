#!/usr/bin/env bash
#
# 구간 하나를 **가상 화면 통째로** 찍는다.
#
# ★ Playwright 의 녹화기는 비트레이트를 우리가 정할 수 없다. 1080p 에서 700kbps 남짓이라
#   화면 녹화로는 얇고, 가장 먼저 무너지는 것이 글자다 — 단계 표시의 작은 글씨, 표의 가는
#   테두리, 도움말 패널의 옅은 배경이 뭉개진다. 2배로 그려 내려도 그 한계는 남는다.
#
#   여기서는 가상 화면을 띄우고 그 화면 전체를 ffmpeg 으로 찍으므로 코덱·품질을 우리가 정한다.
#   파일 선택 창 때문에 만든 record-file-import.sh 와 같은 방식이고, 그쪽에서 이미 검증됐다.
#
# 사용법:
#   BASE_URL=... scripts/record-x11.sh seg1
#   CRF=16 FPS=20 scripts/record-x11.sh seg4
set -uo pipefail
cd "$(dirname "$0")/.."

TAG="${1:?구간 태그가 필요하다 (예: seg1)}"
W="${REC_W:-1920}"
H="${REC_H:-1080}"
FPS="${FPS:-15}"
CRF="${CRF:-16}"           # 낮을수록 좋다. 18 이하면 눈으로는 원본과 구분되지 않는다
DISPLAY_NUM="${DISPLAY_NUM:-:98}"

# 브라우저 껍데기(탭 줄·주소창)를 잘라낼 높이. 0 이면 그대로 둔다.
#
# * 주소창에는 접속한 주소가 그대로 보인다. 공개해도 되는 주소면 그대로 두는 편이 낫다 -
#   어디에 접속해 무엇을 했는지가 영상에 남는다. 가려야 할 때만 값을 준다: CHROME_TOP=95
#   (실측으로 탭 줄과 주소창이 위쪽 95px 이다.)
CHROME_TOP="${CHROME_TOP:-0}"

KEEP_ROOT="${KEEP_ROOT:-/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과}"
KEEP_DIR="${KEEP_DIR:-$KEEP_ROOT/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"
mkdir -p "$KEEP_DIR/원본"
OUT="$KEEP_DIR/원본/${TAG}-x11-$(date +%Y%m%d-%H%M).mp4"
RAW="${OUT%.mp4}.raw.mp4"

command -v ffmpeg >/dev/null || { echo "ffmpeg 이 없다" >&2; exit 1; }
command -v Xvfb   >/dev/null || { echo "Xvfb 가 없다" >&2; exit 1; }

CROP_ARG=""
if [ "$CHROME_TOP" -gt 0 ]; then
  CROP_ARG="-vf crop=${W}:$((H - CHROME_TOP)):0:${CHROME_TOP}"
  echo "[x11] 상단 ${CHROME_TOP}px(탭 줄·주소창)을 잘라낸다"
fi
echo "[x11] 가상 화면 $DISPLAY_NUM (${W}x${H}) · ${FPS}fps · crf ${CRF}"
Xvfb "$DISPLAY_NUM" -screen 0 "${W}x${H}x24" -nolisten tcp &
XVFB_PID=$!
sleep 2

cleanup() {
  # * ffmpeg 은 정상 종료 신호를 받아야 파일을 마무리한다.
  #
  #   `+faststart` 는 끝에 색인을 파일 앞으로 옮기는 쓰기를 한 번 더 한다. 그 전에 끊으면 색인이
  #   없는 파일이 남아 재생기가 열지 못한다("moov atom not found"). 실제로 그렇게 한 벌을
  #   날렸다(2026-08-19). SIGINT 를 주고 끝날 때까지 기다린다.
  if [ -n "${FFMPEG_PID:-}" ]; then
    kill -INT "$FFMPEG_PID" 2>/dev/null
    for _ in $(seq 1 30); do
      kill -0 "$FFMPEG_PID" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$FFMPEG_PID" 2>/dev/null
    wait "$FFMPEG_PID" 2>/dev/null
  fi
  kill "$XVFB_PID" 2>/dev/null
}
trap cleanup EXIT

ffmpeg -nostdin -loglevel error -y \
  -f x11grab -framerate "$FPS" -video_size "${W}x${H}" -i "$DISPLAY_NUM" \
  ${CROP_ARG} \
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart "$RAW" &
FFMPEG_PID=$!
sleep 1

# 창을 실제로 띄워야 화면에 그려진다. Playwright 자체 녹화는 끈다 — 여기서는 화면을 찍는다.
E2E_VIDEO=off E2E_DEMO_PACE=1 DISPLAY="$DISPLAY_NUM" \
  npx playwright test --grep "@${TAG} " --workers=1 --headed
CODE=$?

sleep 1
cleanup
trap - EXIT

# 앞뒤의 빈 화면을 잘라낸다.
#
# * 녹화는 브라우저가 뜨기 전에 시작하고 닫힌 뒤에 끝난다. 그래서 앞에는 빈 가상 화면(검은 바탕에
#   X 커서)이, 뒤에는 창이 사라진 검은 화면이 남는다. 실제로 앞 6초·뒤 3초가 그랬다.
#   내용이 있는 첫 프레임과 마지막 프레임을 찾아 그 사이만 남긴다.
echo "[x11] 앞뒤 빈 화면을 다듬는다"
BOUNDS="$(python3 - "$RAW" <<'PY'
import subprocess, sys, tempfile, os, glob
src = sys.argv[1]
d = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", "fps=2,scale=320:-1",
                os.path.join(d, "%05d.png")], check=False)
try:
    from PIL import Image
except Exception:
    print("0 0"); raise SystemExit
frames = sorted(glob.glob(os.path.join(d, "*.png")))
good = []
for i, p in enumerate(frames):
    im = Image.open(p).convert("L")
    px = im.load()
    w, h = im.size
    light = ink = tot = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            tot += 1
            v = px[x, y]
            if v > 120:
                light += 1
            elif v < 110:
                ink += 1
    # 밝기만 보면 부족하다 - 창은 떴는데 페이지가 아직 비어 있는 about:blank 도 밝다.
    # 글자가 어느 정도 있어야 *보여줄 것이 있는* 화면이다.
    if tot and light * 100 // tot > 50 and ink * 1000 // tot >= 3:
        good.append(i / 2)
print("%.2f %.2f" % (good[0], good[-1]) if good else "0 0")
PY
)"
START="$(echo "$BOUNDS" | cut -d' ' -f1)"
STOP="$(echo "$BOUNDS" | cut -d' ' -f2)"
if [ "$STOP" != "0" ]; then
  echo "[x11] 내용 구간 ${START}~${STOP}초"
  ffmpeg -v error -y -ss "$START" -to "$STOP" -i "$RAW" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart "$OUT"
  rm -f "$RAW"
else
  mv "$RAW" "$OUT"
fi

echo "[x11] $( [ "$CODE" -eq 0 ] && echo 완료 || echo "실패($CODE) — 영상은 남긴다") → $OUT"
exit "$CODE"
