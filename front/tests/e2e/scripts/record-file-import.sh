#!/usr/bin/env bash
#
# 파일 선택 창까지 담아 찍는다.
#
# ★ playwright 의 녹화로는 이 장면을 만들 수 없다. 파일 고르는 창은 운영체제가 그리는 것이라
#   브라우저 화면 밖에 있고, 녹화에는 아무것도 남지 않는다 — 그래서 지금까지 그 구간은 "파일명이
#   갑자기 나타나는" 모습이었다.
#
#   여기서는 가상 디스플레이를 하나 띄우고 그 **화면 전체**를 ffmpeg 으로 찍는다. 창이 뜨고,
#   경로를 넣고, 열고, 목록에 반영되는 것까지 한 흐름으로 남는다.
#
# 조작은 playwright 가 하되 파일 선택만 사람처럼 창을 거쳐 간다. 나머지 구간과 달리 이 한 구간만
# 이렇게 찍는 이유는 그것뿐이다.
#
# 사용법:
#   BASE_URL=http://localhost scripts/record-file-import.sh
set -uo pipefail

# 개인 설정(e2e.config)을 읽는다. 이미 준 환경변수가 우선이다.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/load-config.sh"

cd "$(dirname "$0")/.."

: "${BASE_URL:?BASE_URL 이 필요하다}"

KEEP_ROOT="/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과"
DEST="${KEEP_DIR:-$KEEP_ROOT/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"
mkdir -p "$DEST"

STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEST/seg2a-파일임포트-창까지-$STAMP.mp4"

DISPLAY_NUM="${DISPLAY_NUM:-:97}"
W=1600
H=1000

command -v ffmpeg  >/dev/null || { echo "ffmpeg 이 없다" >&2; exit 1; }
command -v Xvfb    >/dev/null || { echo "Xvfb 가 없다" >&2; exit 1; }

echo "[import] 가상 화면 $DISPLAY_NUM (${W}x${H}) 을 띄운다"
Xvfb "$DISPLAY_NUM" -screen 0 "${W}x${H}x24" -nolisten tcp &
XVFB_PID=$!
sleep 2

cleanup() {
  [ -n "${FFMPEG_PID:-}" ] && kill "$FFMPEG_PID" 2>/dev/null
  wait "${FFMPEG_PID:-}" 2>/dev/null
  kill "$XVFB_PID" 2>/dev/null
}
trap cleanup EXIT

echo "[import] 녹화를 시작한다 → $OUT"
ffmpeg -nostdin -loglevel error -y \
  -f x11grab -framerate 15 -video_size "${W}x${H}" -i "$DISPLAY_NUM" \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p "$OUT" &
FFMPEG_PID=$!
sleep 1

DISPLAY="$DISPLAY_NUM" node scripts/file-import-take.mjs
CODE=$?

sleep 1
cleanup
trap - EXIT

if [ "$CODE" -eq 0 ]; then
  echo "[import] 완료 — $OUT"
else
  echo "[import] 실패($CODE) — 영상은 남긴다: $OUT" >&2
fi
exit "$CODE"
