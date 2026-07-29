#!/usr/bin/env bash
#
# 찍은 테이크를 눈으로만 보지 않고 재 본다.
#
# 녹화가 잘못돼도 실행은 통과한다. 커서가 빠졌던 테이크도, 단계마다 흰 화면이 끼던 테이크도
# 전부 "passed" 였고, 사람이 열어 보고 나서야 다시 찍었다. 그래서 테이크마다 같은 것을 재서
# 수치로 남긴다.
#
# 보는 것:
#   빈 화면    — 아무것도 안 그려진 프레임. 앞뒤는 잘라 내므로 남아 있다면 중간에서 난 것이다.
#   긴 정지    — 화면이 2초 넘게 한 픽셀도 안 바뀐 구간. 기다리는 자리인지 판단해야 한다.
#   길이       — 사람이 같은 일을 했을 때와 견줄 기준.
#
# 사용법:
#   scripts/check-take.sh <영상파일>
#   scripts/check-take.sh                 # 결과 폴더의 mp4 전부
set -uo pipefail

KEEP_DIR="${KEEP_DIR:-/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과/통합시나리오-v060}"

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg 가 없다 — 설치하고 다시 실행한다"; exit 2
fi

check_one() {
  local video="$1" probe
  probe="$(mktemp -d)"
  ffmpeg -v error -i "$video" -vf "fps=5,scale=320:-1,format=gray" "$probe/%05d.png" 2>/dev/null
  python3 - "$probe" "$(basename "$video")" <<'PY'
import sys, glob
from PIL import Image, ImageChops

frames = sorted(glob.glob(sys.argv[1] + "/*.png"))
name = sys.argv[2]
if not frames:
    print(f"  {name}: 프레임을 못 읽었다"); raise SystemExit

blanks, stalls = [], []
prev = None
still = 0
for i, f in enumerate(frames):
    im = Image.open(f)
    px = list(im.getdata())
    mean = sum(px) / len(px)
    if mean > 250 or mean < 15:
        blanks.append(i / 5)
    if prev is not None:
        d = ImageChops.difference(im, prev)
        if sum(1 for p in d.getdata() if p > 12) < 10:
            still += 1
        else:
            if still >= 10:
                stalls.append((round((i - still) / 5, 1), round(still / 5, 1)))
            still = 0
    prev = im
if still >= 10:
    stalls.append((round((len(frames) - still) / 5, 1), round(still / 5, 1)))

print(f"  {name}")
print(f"    길이      {len(frames)/5:.1f}초")
print(f"    빈 화면    {len(blanks)}프레임" + (f"  {[round(b,1) for b in blanks[:6]]}초" if blanks else "  (없음)"))
if stalls:
    print(f"    2초+ 정지  {len(stalls)}곳  " + ", ".join(f"{s}초부터 {d}초" for s, d in stalls[:6]))
else:
    print("    2초+ 정지  (없음)")
PY
  rm -rf "$probe"
}

echo "===== 테이크 점검 ====="
if [ $# -gt 0 ]; then
  for v in "$@"; do check_one "$v"; done
else
  shopt -s nullglob
  files=("$KEEP_DIR"/*.mp4)
  if [ "${#files[@]}" -eq 0 ]; then echo "  영상이 없다: $KEEP_DIR"; exit 1; fi
  for v in "${files[@]}"; do check_one "$v"; done
fi
