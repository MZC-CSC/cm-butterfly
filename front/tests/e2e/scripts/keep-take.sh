#!/usr/bin/env bash
#
# 방금 찍은 구간 영상을 결과 폴더로 옮겨 둔다.
#
# playwright 는 실행할 때마다 test-results 를 통째로 비운다. 구간을 하나씩 찍는 방식에서는
# 다음 구간을 찍는 순간 앞 구간의 영상이 사라진다 — 실제로 통과한 구간 1·2 의 첫 테이크가
# 그렇게 없어졌다. 그래서 한 구간이 끝나면 바로 꺼내 둔다.
#
# 사용법:
#   scripts/keep-take.sh seg3            # 구간3 영상을 결과 폴더에 seg3-<시각>.webm 으로 보관
#   KEEP_DIR=... scripts/keep-take.sh seg3
#
set -euo pipefail

# 구간 번호는 인자로 받는다. playwright 가 결과 폴더 이름을 잘라 버려서(제목 중간이 사라진다)
# 폴더에서 읽어 낼 수가 없다 — 그래서 한 번에 한 구간씩 찍고 그 번호를 넘긴다.
#
# 번호만으로는 무엇을 찍은 것인지 알 수 없다. 파일명에 내용을 붙여 두면 폴더만 봐도 읽힌다.
seg_label() {
  case "${1#seg}" in
    1) SEG="seg1-로그인-마이그레이션가이드-도움말" ;;
    2) SEG="seg2-소스서비스등록-개별" ;;
    2a) SEG="seg2a-소스서비스등록-파일임포트" ;;
    3) SEG="seg3-트랙A-타깃모델에5555-인프라생성" ;;
    4) SEG="seg4-트랙B-소스모델에5555-타깃모델확인-스펙상향" ;;
    5) SEG="seg5-트랙B-이름갈라-두번째인프라-알림확인" ;;
    6) SEG="seg6-워크로드-인프라2대확인" ;;
    7) SEG="seg7-소프트웨어수집-SW모델-마이그레이션" ;;
    8) SEG="seg8-nginx설치확인-부하테스트" ;;
    9) SEG="seg9-정리-인프라삭제" ;;
    *) SEG="seg$1" ;;
  esac
  printf '%s' "$SEG"
}
FRONT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC_DIR="$FRONT_DIR/test-results"
# 회차마다 폴더를 가른다. 한 폴더에 계속 쌓으면 다시 찍을 때 앞 회차를 지우게 되고, 그러면 견줄
# 대상이 없어진다 — 실제로 그렇게 한 벌을 잃었다.
KEEP_ROOT="/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과"
KEEP_DIR="${KEEP_DIR:-$KEEP_ROOT/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"

mkdir -p "$KEEP_DIR"

# 실패한 실행의 영상도 남긴다 — 어디서 어긋났는지는 그 영상에만 있다.
mapfile -t VIDEOS < <(find "$SRC_DIR" -name video.webm -not -path '*/.playwright-artifacts-*' | sort)
if [ "${#VIDEOS[@]}" -eq 0 ]; then
  echo "[keep] 영상이 없다: $SRC_DIR"
  exit 1
fi

# 테이크 앞머리의 빈 화면을 잘라 낸다.
#
# 브라우저가 뜨고 첫 화면이 그려질 때까지 2초 남짓 하얀 화면이 남는다. 구간마다 그게 붙으니 이어 붙이면
# 단계 사이마다 흰 화면이 끼는 것처럼 보인다. 내용이 시작되는 지점을 찾아 그 앞을 버린다.
#
# 찾는 일은 ffmpeg 에게 맡긴다. 프레임을 전부 png 로 뽑아 파이썬으로 비교하던 방식은 4분짜리 구간에서
# 수 분이 걸렸다 — 같은 판정을 필터 한 번으로 6초 만에 한다.
#
# 흰 화면을 찾는 필터가 따로 없으므로 화면을 뒤집어(negate) *검은* 구간을 찾는다.
first_content_second() {
  local video="$1"
  ffmpeg -v info -t 6 -i "$video" -vf "negate,blackdetect=d=0.1:pic_th=0.96" -f null - 2>&1 \
    | awk '
        match($0, /black_start:[0-9.]+/) {
          s = substr($0, RSTART+12, RLENGTH-12)
        }
        match($0, /black_end:[0-9.]+/) {
          e = substr($0, RSTART+10, RLENGTH-10)
          if (s+0 < 0.3 && !done) { printf "%.1f\n", (e-0.2 > 0 ? e-0.2 : 0); done=1 }
        }
        END { if (!done) print "0.0" }'
}

# 끝에 남는 정지 화면도 잘라 낸다.
#
# 마지막 동작이 끝난 뒤에도 녹화는 계속 돌아간다 — 단언을 확인하고 화면을 캡처하고 브라우저를 닫는
# 동안이다. 그 시간이 그대로 꼬리로 붙어, 한 테이크가 7초 넘게 멈춘 화면으로 끝나기도 했다.
#
# 여기서도 ffmpeg 이 판정한다(freezedetect). 중간의 멈춤은 기다리는 자리라 그대로 두고, *끝까지
# 이어지는* 멈춤 — 시작만 있고 끝이 없는 것 — 만 잘라 낸다.
last_change_second() {
  local video="$1" total
  total="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")"
  ffmpeg -v info -i "$video" -vf "freezedetect=n=-55dB:d=2" -f null - 2>&1 \
    | awk -v total="$total" '
        match($0, /freeze_start: [0-9.]+/) { s = substr($0, RSTART+14, RLENGTH-14); open=1 }
        match($0, /freeze_end: [0-9.]+/)   { open=0 }
        END {
          if (!open) { printf "%.1f\n", total; exit }
          t = s + 0.8
          if (t > total) t = total
          # 절반 넘게 잘라 내야 한다면 판정을 믿지 않는다. 꼬리를 다듬으려다 내용을 버리는 쪽이
          # 훨씬 나쁘다 — 남는 정지 몇 초는 편집에서 잘라도 되지만 없어진 장면은 다시 찍어야 한다.
          if (t < total * 0.5) { printf "%.1f\n", total; exit }
          printf "%.1f\n", t
        }'
}

# 콘솔이 뜨는 지점(초) — 로그인 화면이 끝나는 곳.
#
# 로그인 화면과 콘솔은 **왼쪽 기둥**이 다르다. 콘솔에는 메뉴 글자가 세로로 서 있고 로그인 화면의
# 같은 자리는 매끈한 배경이다. 글자가 있으면 밝기가 들쭉날쭉해지므로, 그 편차가 처음으로 커지는
# 지점이 콘솔이 그려진 때다. 글자를 읽지 않으므로 문구가 바뀌어도 흔들리지 않는다.
console_open_second() {
  local video="$1" probe t
  probe="$(mktemp -d)"
  ffmpeg -v error -y -i "$video" -t 30 \
    -vf "fps=5,crop=iw*0.12:ih*0.55:0:ih*0.12,scale=90:-1,format=gray" \
    "$probe/%04d.png" 2>/dev/null || true
  t="$(python3 -c "
import sys, glob
from PIL import Image, ImageStat
frames = sorted(glob.glob(sys.argv[1] + '/*.png'))
for i, f in enumerate(frames):
    if ImageStat.Stat(Image.open(f).convert('L')).stddev[0] > 18:
        # 여유를 두지 않는다 — 한 프레임만 앞서도 로그인 화면이 남고,
        # 이어 붙였을 때 그 깜빡임이 그대로 보인다.
        print(f'{i / 5:.1f}'); break
else:
    print('0.0')
" "$probe" 2>/dev/null)"
  rm -rf "$probe"
  echo "${t:-0.0}"
}

SEG_ARG="${1:?구간 번호가 필요하다 (예: seg3)}"
STAMP="$(date +%Y%m%d-%H%M)"
i=0
for v in "${VIDEOS[@]}"; do
  num="${SEG_ARG#seg}"
  name="$(seg_label "$num")-$STAMP"
  [ "${#VIDEOS[@]}" -gt 1 ] && name="$name-$((++i))"

  start="$(first_content_second "$v")"
  stop="$(last_change_second "$v")"

  # 로그인 장면은 첫 편에만 둔다.
  #
  # 녹화는 브라우저가 열릴 때 함께 시작되므로 중간부터 켤 수 없고, 매 구간이 로그인부터 찍힌다.
  # 아홉 편을 이어 붙이면 로그인 화면이 아홉 번 나온다 — 하나로 합칠 수가 없다. 그래서 첫 편을
  # 뺀 나머지는 콘솔이 뜨는 지점부터 남긴다.
  if [ "$num" != "1" ]; then
    login_end="$(console_open_second "$v")"
    if awk -v a="$login_end" -v b="$start" 'BEGIN{exit !(a>b)}'; then
      start="$login_end"
    fi
  fi

  # 다시 인코딩해서 자른다. 스트림 복사(-c copy)는 키프레임 경계로만 자를 수 있는데 playwright 가
  # 내보내는 webm 은 앞쪽에 키프레임이 하나뿐이라, 복사로는 아무것도 잘리지 않는다(실제로 그랬다).
  # 나가는 형식은 mp4(h264) — 편집기에서 바로 붙일 수 있고 용량도 webm 보다 작다.
  # 화질 — 원본(playwright 의 VP8, 1080p 에 700kbps 남짓)이 이미 얇다. 여기서 다시 세게 압축하면
  # 손실이 한 겹 더 얹혀 글자가 뭉갠다. 화면 녹화는 글자가 생명이라 crf 를 낮추고 preset 을
  # 늦춰 *원본이 가진 만큼은* 그대로 남긴다. 늘어나는 용량은 한 편에 수 MB 수준이다.
  ffmpeg -v error -y -ss "$start" -to "$stop" -i "$v" \
    -c:v libx264 -preset slow -crf 16 -tune stillimage -pix_fmt yuv420p -an \
    -movflags +faststart \
    "$KEEP_DIR/$name.mp4"
  echo "[keep] $name.mp4  (${start}~${stop}초 구간, $(du -h "$KEEP_DIR/$name.mp4" | cut -f1))"
done
