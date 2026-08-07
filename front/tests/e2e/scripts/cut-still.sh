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
PY

RANGES="$(ffmpeg -v info -i "$SRC" -vf "freezedetect=n=-55dB:d=2" -f null - 2>&1 |
  awk '
      match($0, /freeze_start: [0-9.]+/) { s = substr($0, RSTART+14, RLENGTH-14); open=1 }
      match($0, /freeze_end: [0-9.]+/)   { e = substr($0, RSTART+12, RLENGTH-12); if (open) print s, e; open=0 }
      END { if (open) print s, "END" }
  ')"

CUTS="$(printf '%s\n' "$RANGES" | python3 "$PYWORK/spans.py" "$TOTAL" "$MIN" "$KEEP")"

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
ffmpeg -v error -y -i "$SRC" \
  -vf "select='${EXPR}',setpts=N/FRAME_RATE/TB" \
  -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$TMP" || {
  echo "[cut-still] 다시 인코딩하지 못했다 — 원본을 그대로 둔다" >&2
  rm -f "$TMP"
  exit 1
}

mv -f "$TMP" "$SRC"
printf '[cut-still] %s  %s초 → %s초\n' "$(basename "$SRC")" "$TOTAL" "$NEWLEN"
