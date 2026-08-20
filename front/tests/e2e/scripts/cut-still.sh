#!/usr/bin/env bash
#
# 멈춰 있는 구간을 잘라 낸다.
#
# 시나리오에는 사람이 하는 일이 아니라 *기다리는 일*이 섞인다. 워크플로우를 저장하고 나서 airflow 가
# 그것을 읽어 갈 때까지, 인프라가 다 만들어질 때까지 — 그동안 화면은 한 픽셀도 바뀌지 않는다.
# 실제로 한 구간에서 그 정지가 2분을 넘겼다. 보는 사람에게는 영상이 멈춘 것으로 읽힌다.
#
# 사람이 편집한다면 그 자리를 잘라 낸다. 여기서도 같은 일을 한다 — 통째로 버리지는 않고 앞머리를
# 조금 남겨, "여기서 기다렸다"는 것은 보이되 기다림 자체는 지나가게 한다.
#
# 짧은 멈춤은 손대지 않는다. 값을 강조하고 잠깐 두는 것, 화면을 읽으라고 두는 것은 내용이다.
#
# 사용법:
#   scripts/cut-still.sh <mp4>              # 제자리에서 바꾼다
#   MIN=6 KEEP=1.5 scripts/cut-still.sh a.mp4
set -uo pipefail

SRC="${1:?mp4 경로가 필요하다}"
MIN="${MIN:-6}"     # 이보다 긴 정지만 손댄다(초)
KEEP="${KEEP:-1.5}" # 그중 남길 앞머리(초)

[ -r "$SRC" ] || {
  echo "[cut-still] 읽을 수 없다: $SRC" >&2
  exit 1
}

TOTAL="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")"

# 계산은 파이썬에 맡기되 *파일*로 넘긴다.
#
# 프로그램과 자료를 둘 다 표준입력으로 주면 뒤엣것이 앞엣것을 덮어써, 자료가 프로그램 자리로 들어가
# 문법 오류가 난다. 그런데 이 스크립트는 그걸 "잘라 낼 정지 없음" 으로 읽고 조용히 끝냈다 —
# 아무것도 안 한 것이 정상처럼 보였다.
PYWORK="$(mktemp -d)"
trap 'rm -rf "$PYWORK"' EXIT

cat > "$PYWORK/spans.py" <<'PY'
import sys

total, min_len, keep = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])

# freezedetect 는 긴 정지를 한 덩어리로 주지 않고 창 길이마다 끊어 여러 번 알린다. 그대로 두면
# 5초짜리 여럿으로 보여 아무것도 잘라 내지 못한다 — 맞닿은 것들을 먼저 하나로 잇는다.
spans = []
for line in sys.stdin:
    parts = line.split()
    if len(parts) != 2:
        continue
    a = float(parts[0])
    b = total if parts[1] == 'END' else float(parts[1])
    if spans and a - spans[-1][1] < 0.5:
        spans[-1][1] = max(spans[-1][1], b)
    else:
        spans.append([a, b])

# 남길 앞머리를 뺀 나머지가 버릴 자리다.
for a, b in spans:
    if b - a > min_len:
        print(f'{a + keep:.2f} {b:.2f}')
PY

cat > "$PYWORK/detect.py" <<'PY'
import glob, os, sys
from PIL import Image

# 쪽지 봉투의 채움색(#f6c445) 언저리. 화면 어디에 있든 잡는다 - 가운데에서 배지로 날아간다.
frames = sorted(glob.glob(os.path.join(sys.argv[1], "*.png")))
for i, p in enumerate(frames):
    im = Image.open(p).convert("RGB")
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r > 225 and 175 < g < 215 and b < 105:
                n += 1
    # 480px 로 줄인 화면에서 봉투는 20~30 픽셀쯤 잡힌다. 워크로드 목록의 `aws` 배지도 비슷해
    # 수만으로는 갈리지 않으므로 지속 시간으로 가른다(runs.py) - 여기서는 후보만 넘긴다.
    if n > 18:
        print("%.2f %d" % (i / 4, n))
PY

cat > "$PYWORK/runs.py" <<'PY'
import sys

# (시각, 픽셀수) 를 연속 구간으로 묶고 *짧게 나타났다 사라지는* 것만 남긴다.
#
# 봉투와 워크로드 목록의 `aws` 배지는 색도 크기도 비슷해 픽셀 수만으로는 갈리지 않는다.
# 갈리는 것은 지속 시간이다 - 봉투는 1초 남짓이고 배지는 그 화면에 있는 내내 붙어 있다.
rows = []
for line in sys.stdin:
    parts = line.split()
    if len(parts) == 2:
        rows.append((float(parts[0]), float(parts[1])))

runs = []
for t, _ in rows:
    if runs and t - runs[-1][-1] <= 0.4:
        runs[-1].append(t)
    else:
        runs.append([t])

for r in runs:
    if r[-1] - r[0] <= 4.0:
        print("%.2f" % r[0])
PY

cat > "$PYWORK/blank.py" <<'PY'
import glob, os, sys
from PIL import Image

# 보여줄 것이 없는 화면 = *고른* 화면.
#
# ★ 어둡기로 재지 않는다. 흰 바탕의 콘솔 화면은 320px 로 줄이면 글자가 옅은 회색이 되어
#   "어두운 픽셀"이 거의 없다. 주소창을 잘라내 어두운 껍데기까지 사라지면 멀쩡한 화면이
#   빈 화면으로 잡힌다(2026-08-19 실제로 그렇게 잘려 나갔다).
#   빈 화면은 흰색이든 검은색이든 고르고, 내용이 있으면 고르지 않다.
frames = sorted(glob.glob(os.path.join(sys.argv[1], "*.png")))
for i, p in enumerate(frames):
    im = Image.open(p).convert("L")
    px = im.load()
    w, h = im.size
    vals = [px[x, y] for y in range(0, h, 2) for x in range(0, w, 2)]
    mean = sum(vals) / len(vals)
    sd = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
    if sd < 4:
        print("%.2f" % (i / 4))
PY

cat > "$PYWORK/protect.py" <<'PY'
import sys

pad = float(sys.argv[1])
keeps = [(float(t) - pad, float(t) + pad) for t in sys.argv[2].split()]
for line in sys.stdin:
    if not line.strip():
        continue
    a, b = map(float, line.split())
    spans = [(a, b)]
    for ka, kb in keeps:
        nxt = []
        for sa, sb in spans:
            if kb <= sa or ka >= sb:
                nxt.append((sa, sb))
                continue
            if ka > sa:
                nxt.append((sa, ka))
            if kb < sb:
                nxt.append((kb, sb))
        spans = nxt
    for sa, sb in spans:
        if sb - sa > 0.3:
            print("%.2f %.2f" % (sa, sb))
PY

cat > "$PYWORK/keeps.py" <<'PY'
import sys

total = float(sys.argv[1])
cuts = [tuple(map(float, l.split())) for l in sys.stdin if l.strip()]
t, out = 0.0, []
for a, b in cuts:
    if a - t > 0.05:
        out.append((t, a))
    t = b
if total - t > 0.05:
    out.append((t, total))
print('+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in out))
print(f'{sum(b - a for a, b in out):.1f}')
# 남길 구간을 그대로도 내보낸다 - 재인코딩 없이 잘라 붙일 때 쓴다.
#
# ★ 자를 자리를 *키프레임 눈금*(1초)에 맞춘다. 시작은 내림, 끝은 올림이라 조금 넉넉히 남는다 -
#   보여줄 것을 잘라 먹는 쪽보다 정지가 반 초 더 남는 쪽이 낫다.
import math
for a, b in out:
    print(f'RANGE {math.floor(a)} {math.ceil(b)}')
PY


# -- 잘라내면 안 되는 순간을 먼저 찾는다 --------------------------------------
#
# * 화면이 멈춘 것처럼 보여도 *보여줘야 하는 것*이 그 안에 있을 수 있다.
#
#   알림 도착 신호(가운데에 떴다 배지로 날아가는 노란 쪽지)가 그렇다. 1700px 화면에서 64px 이라
#   freezedetect 의 잡음 한계를 넘지 못해 그 구간이 통째로 정지로 잡히고 그대로 잘려 나갔다 -
#   애니메이션은 제대로 떴는데 최종 영상에는 없었다(2026-08-19). 화면에 억지로 움직임을 만드는
#   대신 그 순간을 찾아 앞뒤를 보호한다.
#
#   PROTECT_PAD 로 앞뒤 여유를 준다. 검출은 색으로 하므로 놓치면 보호가 없을 뿐 잘못 자르지는 않는다.
PROTECT_PAD="${PROTECT_PAD:-2.0}"

find_protected() {
  command -v python3 >/dev/null 2>&1 || return 0
  python3 -c 'import PIL' 2>/dev/null || return 0
  local dir="$PYWORK/scan"
  mkdir -p "$dir"
  ffmpeg -v error -i "$SRC" -vf "fps=4,scale=480:-1" "$dir/%05d.png" 2>/dev/null || return 0
  python3 "$PYWORK/detect.py" "$dir"
}

find_blank() {
  command -v python3 >/dev/null 2>&1 || return 0
  python3 -c 'import PIL' 2>/dev/null || return 0
  [ -d "$PYWORK/scan" ] || return 0
  python3 "$PYWORK/blank.py" "$PYWORK/scan"
}

PROTECT="$(find_protected | python3 "$PYWORK/runs.py")"

# -- 내용이 없는 화면은 잘라낸다 -----------------------------------------------
#
# * 화면이 갈아엎히는 사이에 백지가 1초쯤 지나간다. 정지 제거로는 안 잡힌다 - 백지도 "정지"지만
#   6초를 넘겨야 자르는데 이건 1초 남짓이라 그대로 남는다. 보는 쪽에는 화면이 깜빡한 것으로만
#   보이고 아무 내용이 없다(2026-08-19 사용자 지적).
#
#   글자가 사실상 없는 프레임을 찾아 그 구간을 잘라낸다. 짧아도 자른다 - 보여줄 것이 없는 자리다.
BLANK="$(find_blank)"
if [ -n "$BLANK" ]; then
  echo "[cut-still] 내용 없는 화면 $(printf '%s\n' "$BLANK" | wc -l) 프레임 - 그 구간을 잘라낸다"
fi
if [ -n "$PROTECT" ]; then
  echo "[cut-still] 보호할 순간 $(printf '%s\n' "$PROTECT" | wc -l) 곳 - 앞뒤 ${PROTECT_PAD}초를 남긴다"
fi

RANGES="$(ffmpeg -v info -i "$SRC" -vf "freezedetect=n=${FREEZE_N:--70dB}:d=2" -f null - 2>&1 |
  awk '
      match($0, /freeze_start: [0-9.]+/) { s = substr($0, RSTART+14, RLENGTH-14); open=1 }
      match($0, /freeze_end: [0-9.]+/)   { e = substr($0, RSTART+12, RLENGTH-12); if (open) print s, e; open=0 }
      END { if (open) print s, "END" }
  ')"

CUTS="$(printf '%s\n' "$RANGES" | python3 "$PYWORK/spans.py" "$TOTAL" "$MIN" "$KEEP")"

# 내용 없는 화면을 잘라낼 목록에 더한다. 프레임 간격(0.25초)만큼 앞뒤로 붙여 한 덩어리로 만든다.
if [ -n "$BLANK" ]; then
  CUTS="$(printf '%s\n%s\n' "$CUTS" "$(printf '%s\n' "$BLANK" | python3 -c '
import sys
ts = [float(l) for l in sys.stdin if l.strip()]
spans = []
for t in ts:
    a, b = t - 0.13, t + 0.38
    if spans and a - spans[-1][1] < 0.4:
        spans[-1][1] = max(spans[-1][1], b)
    else:
        spans.append([a, b])
for a, b in spans:
    print("%.2f %.2f" % (max(a, 0), b))
')" | grep -v '^$' | sort -n)"
fi

# 보호할 순간이 걸린 구간은 그만큼 잘라내기에서 뺀다.
if [ -n "$PROTECT" ]; then
  CUTS="$(printf '%s\n' "$CUTS" | python3 "$PYWORK/protect.py" "$PROTECT_PAD" "$(printf '%s ' $PROTECT)")"
fi

if [ -z "$CUTS" ]; then
  echo "[cut-still] 잘라 낼 정지 없음 — 그대로 둔다"
  exit 0
fi

KEEPS="$(printf '%s\n' "$CUTS" | python3 "$PYWORK/keeps.py" "$TOTAL")"
EXPR="$(printf '%s\n' "$KEEPS" | head -1)"
NEWLEN="$(printf '%s\n' "$KEEPS" | tail -1)"

# 대부분이 기다림인 구간은 실제로 있다 — 한 구간은 257초 중 196초가 정지였다(워크플로우가 읽히기를
# 기다린 시간). 그래서 "많이 잘린다"는 것 자체는 이상 신호가 아니다. 다만 판정이 통째로 어긋났을
# 때를 대비해 바닥은 둔다. 정지 판정은 한 픽셀이라도 바뀌면 깨지므로 잘라 낸 자리는 정말로
# 멈춰 있던 자리다.
if python3 -c "import sys; sys.exit(0 if float('$NEWLEN') < float('$TOTAL') * 0.12 else 1)"; then
  echo "[cut-still] 너무 많이 잘린다(${TOTAL}초 → ${NEWLEN}초) — 그대로 둔다"
  exit 0
fi

TMP="${SRC%.mp4}.cut.mp4"

# 재인코딩하지 않고 잘라 붙인다.
#
# ★ 예전에는 프레임을 골라 내느라 통째로 다시 인코딩했고, 그것도 crf 20 이라 **촬영본(crf 16)보다
#   화질을 깎고** 있었다. 세대가 하나 쌓이면 압축 자국이 '무늬'로 남아 용량까지 오히려 는다.
#   촬영을 키프레임 1초로 찍으므로 이제 구간 단위로 그냥 오려 붙이면 된다 - 손실이 없다.
PARTS="$(mktemp -d)"
LIST="$PARTS/list.txt"
: > "$LIST"
n=0
printf '%s\n' "$KEEPS" | grep '^RANGE ' | while read -r _ a b; do
  n=$((n + 1))
  part="$PARTS/$(printf '%03d' "$n").mp4"
  ffmpeg -v error -y -ss "$a" -to "$b" -i "$SRC" -c copy "$part" 2>/dev/null || continue
  printf "file '%s'\n" "$part" >> "$LIST"
done

if [ ! -s "$LIST" ] || ! ffmpeg -v error -y -f concat -safe 0 -i "$LIST" \
     -c copy -movflags +faststart "$TMP" 2>/dev/null; then
  echo "[cut-still] 잘라 붙이지 못했다 — 원본을 그대로 둔다" >&2
  rm -rf "$PARTS"; rm -f "$TMP"
  exit 1
fi
rm -rf "$PARTS"

mv -f "$TMP" "$SRC"
printf '[cut-still] %s  %s초 → %s초\n' "$(basename "$SRC")" "$TOTAL" "$NEWLEN"
