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

# 배율 - 화면을 몇 배로 *그려* 내릴지.
#
# ★ 화면 크기만 키우면 화질은 그대로다. 글자가 작아지고 더 많이 담길 뿐이다. 선명해지려면
#   같은 배치를 두 배 촘촘히 그려야 하고, 그것이 --force-device-scale-factor 다.
#   SCALE=2 면 배치는 1920x1080 그대로인 채 실제 픽셀만 3840x2160 이 된다.
#
#   비용: 1080p 는 0.4Mbps 남짓이라 4K 로 올려도 전 구간 1GB 안쪽이다. 메모리는 2배로 그리는
#   만큼 더 쓴다.
SCALE="${SCALE:-1}"

# 잘라낸 *뒤* 남길 크기. 여기서 거꾸로 화면 크기를 정한다 - 그래야 결과가 정확히 1080p/4K 다.
#
# ★ 예전에는 1920x1080 을 찍어 껍데기를 잘라내 1910x990 이 나왔다. 풀 HD 가 아니다.
OUT_W="${OUT_W:-1920}"
OUT_H="${OUT_H:-1080}"
# 초당 프레임 수 - *부드러움*을 정한다.
#
# ★ 24 는 영화와 같은 값이다. 15 로 찍었더니 마우스가 움직일 때 계단처럼 보였다.
FPS="${FPS:-24}"

# 키프레임 간격(초) - *자를 수 있는 눈금*을 정한다. 부드러움과는 무관하다.
#
# ★ 1초로 두면 편집을 **재인코딩 없이** 잘라내기로 끝낼 수 있다. 화질 손실이 사라지고
#   편집도 빨라진다. 기본값(약 16초)으로는 초 단위로 자를 수가 없어 매번 다시 인코딩했다.
KEYINT_SEC="${KEYINT_SEC:-1}"
CRF="${CRF:-16}"           # 낮을수록 좋다. 18 이하면 눈으로는 원본과 구분되지 않는다
DISPLAY_NUM="${DISPLAY_NUM:-:98}"

# 화면 가장자리에서 잘라낼 만큼.
#
# * 위쪽 90px 은 브라우저 껍데기(탭 줄·주소창)다. 주소창에는 접속한 주소가 그대로 보이므로
#   기본으로 잘라낸다 - 영상은 제품 화면만 담는다. 남기려면 CHROME_TOP=0.
# * 왼쪽 10px 은 창이 가상 화면을 다 채우지 못해 생기는 검은 띠다. 실측값이고, 남기면
#   영상 왼쪽에 검은 선으로 남는다.
#
#   두 값 모두 1920x1080 가상 화면에서 실측했다(2026-08-19). 화면 크기를 바꾸면 다시 잰다.
CHROME_TOP="${CHROME_TOP:-90}"
CHROME_LEFT="${CHROME_LEFT:-10}"

# 실제 픽셀 단위로 환산한다 - 배율을 올리면 껍데기도 같이 커진다.
PAD_T=$((CHROME_TOP * SCALE))
PAD_L=$((CHROME_LEFT * SCALE))
W=$((OUT_W * SCALE + PAD_L))
H=$((OUT_H * SCALE + PAD_T))

KEEP_ROOT="${KEEP_ROOT:-/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과}"
KEEP_DIR="${KEEP_DIR:-$KEEP_ROOT/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"
mkdir -p "$KEEP_DIR/원본"
OUT="$KEEP_DIR/원본/${TAG}-x11-$(date +%Y%m%d-%H%M).mp4"
RAW="${OUT%.mp4}.raw.mp4"

command -v ffmpeg >/dev/null || { echo "ffmpeg 이 없다" >&2; exit 1; }
command -v Xvfb   >/dev/null || { echo "Xvfb 가 없다" >&2; exit 1; }

# 폭·높이는 짝수여야 한다 - 4:2:0 색 표본이 2픽셀 단위라 홀수면 인코딩이 거부된다.
CW=$(( OUT_W * SCALE / 2 * 2 ))
CH=$(( OUT_H * SCALE / 2 * 2 ))
CROP_ARG="-vf crop=${CW}:${CH}:${PAD_L}:${PAD_T}"
echo "[x11] 가상 화면 ${W}x${H} 에서 위 ${PAD_T}·왼쪽 ${PAD_L} 을 잘라 ${CW}x${CH} 로 남긴다"
[ "$SCALE" -gt 1 ] && echo "[x11] ${SCALE}배로 그린다 - 배치는 ${OUT_W}x${OUT_H} 그대로, 픽셀만 촘촘해진다"
echo "[x11] 가상 화면 $DISPLAY_NUM (${W}x${H}) · ${FPS}fps · crf ${CRF} · 키프레임 ${KEYINT_SEC}초"
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
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p \
  -g "$((FPS * KEYINT_SEC))" -keyint_min "$((FPS * KEYINT_SEC))" -sc_threshold 0 \
  -movflags +faststart "$RAW" &
FFMPEG_PID=$!
sleep 1

# 창을 실제로 띄워야 화면에 그려진다. Playwright 자체 녹화는 끈다 — 여기서는 화면을 찍는다.
E2E_VIDEO=off E2E_DEMO_PACE=1 DISPLAY="$DISPLAY_NUM" \
  E2E_X11_SCALE="$SCALE" E2E_X11_W="$OUT_W" E2E_X11_H="$OUT_H" \
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
    vals = [px[x, y] for y in range(0, h, 3) for x in range(0, w, 3)]

    # *변화량*으로 본다 - 어둡기로 보면 안 된다.
    #
    # ★ 예전에는 "어두운 픽셀이 얼마나 있나"로 글자 유무를 재고 있었다. 그때는 화면에 브라우저
    #   껍데기(어두운 탭 줄)가 함께 담겨 있어 그 값이 저절로 채워졌다. **주소창을 잘라내기
    #   시작하면서 그 공급원이 사라졌고**, 흰 바탕의 콘솔 화면이 통째로 "빈 화면"으로 판정돼
    #   234초짜리가 69초로, 40초짜리가 3초로 잘려 나갔다(2026-08-19).
    #
    #   진짜 빈 화면은 흰색이든 검은색이든 *고르다*. 내용이 있으면 고르지 않다. 그것만 보면 된다.
    mean = sum(vals) / len(vals)
    sd = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
    if sd >= 4:
        good.append(i / 2)
print("%.2f %.2f" % (good[0], good[-1]) if good else "0 0")
PY
)"
START="$(echo "$BOUNDS" | cut -d' ' -f1)"
STOP="$(echo "$BOUNDS" | cut -d' ' -f2)"
# 원본은 *손대지 않은 것*이어야 한다.
#
# ★ 예전에는 앞뒤를 다듬은 결과를 원본/ 에 넣고 찍은 그대로는 지웠다. 그런데 그 다듬기가 바로
#   내용을 잘라먹은 장본인이었고, 지워 버린 탓에 되돌릴 수도 없었다(2026-08-19). 다듬기도
#   편집이다 - 편집한 것을 원본이라 부르지 않는다.
mv "$RAW" "$OUT"

EDITED="$KEEP_DIR/$(basename "$OUT")"
if [ "$STOP" != "0" ]; then
  echo "[x11] 내용 구간 ${START}~${STOP}초"
  # 재인코딩하지 않는다 - 키프레임이 1초 간격이라 그대로 잘라내도 눈금이 충분하다.
  # 다시 인코딩하면 세대가 하나 더 쌓여 화질이 깎이고 용량이 오히려 는다.
  ffmpeg -v error -y -ss "$START" -to "$STOP" -i "$OUT" \
    -c copy -movflags +faststart "$EDITED"
else
  echo "[x11] 내용 구간을 찾지 못했다 - 다듬지 않고 그대로 둔다"
  cp "$OUT" "$EDITED"
fi
if [ "${E2E_KEEP_STILL:-}" = "1" ]; then
  echo "[x11] 정지 구간을 그대로 둔다 (E2E_KEEP_STILL=1)"
else
  "$(dirname "$0")/cut-still.sh" "$EDITED" || true
fi

echo "[x11] $( [ "$CODE" -eq 0 ] && echo 완료 || echo "실패($CODE) — 영상은 남긴다")"
echo "[x11]   편집본 $EDITED"
echo "[x11]   원본   $OUT"
exit "$CODE"
