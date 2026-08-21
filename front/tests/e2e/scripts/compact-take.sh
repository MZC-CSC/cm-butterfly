#!/usr/bin/env bash
#
# 편집이 끝난 한 벌을 **배포용으로 한 번 줄인다.**
#
# ★ 왜 필요한가 — 촬영은 키프레임을 1초마다 넣는다. 그래야 편집을 재인코딩 없이(=손실 없이)
#   구간 단위로 오려 붙일 수 있다. 그런데 키프레임은 화질을 올리지 않는다. *편집 눈금*을
#   만들 뿐이고 용량만 는다 — 실측 2.5배다(2.1MB → 5.2MB).
#
#   그래서 편집이 확정된 뒤 **딱 한 번** 보통 간격으로 다시 인코딩해 용량을 되돌린다.
#   편집 중에는 하지 않는다. 그때마다 하면 세대가 쌓여 화질이 깎인다.
#
# 사용법:
#   scripts/compact-take.sh <폴더>
#   CRF=18 scripts/compact-take.sh <폴더>     # 더 줄이고 싶을 때
#
# 원본(원본/)은 건드리지 않는다 — 편집이 잘못됐을 때 되돌아갈 자리다.
set -uo pipefail

DIR="${1:?영상 폴더가 필요하다}"
CRF="${CRF:-16}"
[ -d "$DIR" ] || { echo "폴더가 없다: $DIR" >&2; exit 1; }

command -v ffmpeg >/dev/null || { echo "ffmpeg 이 없다" >&2; exit 1; }

before=0 after=0 n=0
for f in "$DIR"/*.mp4; do
  [ -e "$f" ] || continue
  b=$(stat -c%s "$f")
  tmp="${f%.mp4}.compact.mp4"
  if ffmpeg -v error -y -i "$f" \
       -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p \
       -movflags +faststart "$tmp"; then
    a=$(stat -c%s "$tmp")
    mv -f "$tmp" "$f"
    n=$((n + 1)); before=$((before + b)); after=$((after + a))
    printf "  %-52s %5sKB → %5sKB\n" "$(basename "$f")" "$((b / 1024))" "$((a / 1024))"
  else
    rm -f "$tmp"
    echo "  ⚠ $(basename "$f") — 줄이지 못했다. 그대로 둔다" >&2
  fi
done

[ "$n" -gt 0 ] || { echo "줄일 영상이 없다"; exit 0; }
echo
echo "[compact] ${n}편 · $((before / 1024 / 1024))MB → $((after / 1024 / 1024))MB"
echo "[compact] 원본(원본/)은 그대로 뒀다"
