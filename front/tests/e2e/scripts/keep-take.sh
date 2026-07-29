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
    2) SEG="seg2-소스서비스등록" ;;
    3) SEG="seg3-소스모델-AWS타깃모델-5555추가-워크플로우" ;;
    4) SEG="seg4-커스텀소스모델-GCP타깃모델-스펙상향" ;;
    5) SEG="seg5-워크플로우-nameSeed-알림확인" ;;
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
KEEP_DIR="${KEEP_DIR:-/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과/통합시나리오-v060}"

mkdir -p "$KEEP_DIR"

# 실패한 실행의 영상도 남긴다 — 어디서 어긋났는지는 그 영상에만 있다.
mapfile -t VIDEOS < <(find "$SRC_DIR" -name video.webm -not -path '*/.playwright-artifacts-*' | sort)
if [ "${#VIDEOS[@]}" -eq 0 ]; then
  echo "[keep] 영상이 없다: $SRC_DIR"
  exit 1
fi

SEG_ARG="${1:?구간 번호가 필요하다 (예: seg3)}"
STAMP="$(date +%Y%m%d-%H%M)"
i=0
for v in "${VIDEOS[@]}"; do
  num="${SEG_ARG#seg}"
  name="$(seg_label "$num")-$STAMP"
  [ "${#VIDEOS[@]}" -gt 1 ] && name="$name-$((++i))"
  cp "$v" "$KEEP_DIR/$name.webm"
  echo "[keep] $name.webm  ($(du -h "$v" | cut -f1))"
done
