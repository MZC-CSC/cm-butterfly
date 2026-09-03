#!/usr/bin/env bash
#
# 한 벌을 찍고 나서 그 폴더 안에 README 를 만든다.
#
# 영상만 놓아 두면 파일 이름으로 순서를 짐작해야 하고, 어느 구간이 무엇을 보이는 것인지는 결국
# 시나리오 파일을 열어야 안다. 받는 사람이 폴더 하나만 열면 되도록, 목록·길이·설명을 한자리에
# 적는다. 보고서와 캡처도 같은 폴더 안에 있으므로 함께 가리킨다.
#
# 사용법:
#   scripts/make-readme.sh <결과폴더>
set -uo pipefail

DIR="${1:?결과 폴더 경로가 필요하다}"
[ -d "$DIR" ] || { echo "폴더가 없다: $DIR" >&2; exit 1; }

# 구간 번호 → 무엇을 보이는가. 시나리오 제목과 같은 뜻으로 적되, 영상을 받는 사람이 읽을 말로 쓴다.
describe() {
  case "$1" in
    1)  echo "로그인하고 마이그레이션 가이드를 따라간다. 처음 방문 안내와 도움말 패널을 연다" ;;
    2a) echo "엑셀 파일 하나로 서버 여러 대를 한 번에 등록한다 (파일 선택 창까지 보이도록 크롬을 직접 띄워 찍었다)" ;;
    2)  echo "소스 서비스를 화면에서 직접 등록하고, 접속 정보를 넣어 수집한다" ;;
    3)  echo "트랙1 — 추천받은 그대로 인프라를 만든다. 아무것도 고치지 않는다" ;;
    4)  echo "트랙2 — 타겟 모델을 고쳐 만든다. 방화벽에 5555 를 더하고 스펙을 올린다" ;;
    5)  echo "트랙3 — 워크플로우만 고쳐 만든다. 규칙을 복제해 값을 바꾼다" ;;
    6)  echo "트랙4 — 소스 모델을 고쳐 만든다. 그 변경이 추천을 거쳐 따라오는지 본다" ;;
    6b) echo "네 갈래가 만든 인프라를 워크로드 화면에서 한자리에 놓고 본다" ;;
    7)  echo "소스의 소프트웨어를 수집해 트랙2 인프라로 옮긴다" ;;
    8)  echo "옮겨간 nginx 가 실제로 뜨는지 확인하고 부하 테스트를 돌린다" ;;
    8b) echo "실패한 작업에서 재실행 버튼이 무엇을 하는지 보여 준다" ;;
    9)  echo "만든 것을 지운다" ;;
    10) echo "쌓인 알림을 하나씩 확인하고 비운다" ;;
    11) echo "용량이 없어 실패한 인프라를, 로그에서 읽은 존으로 바꿔 다시 만든다" ;;
    13) echo "연계 서비스가 모두 응답하는지 서비스 상태 화면에서 본다 (정상)" ;;
    14) echo "서비스 하나를 실제로 내려 장애 알림이 뜨는 것을 보고, 되살려 복구까지 본다" ;;
    *)  echo "" ;;
  esac
}

secs() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | cut -d. -f1; }
mmss() { printf '%d:%02d' $(( ${1:-0} / 60 )) $(( ${1:-0} % 60 )); }

OUT="$DIR/README.md"
TITLE="$(basename "$DIR")"

{
  echo "# ${TITLE}"
  echo
  echo "cm-butterfly v0.6.0 라인업 통합 시나리오를 구간별로 찍은 한 벌이다."
  echo "구간마다 하나의 테이크라 필요한 것만 따로 받아 보면 된다. 기다리기만 하는 정지 구간은 잘라 냈다."
  echo
  echo "| 구간 | 길이 | 무엇을 보이는가 | 파일 |"
  echo "|---|---|---|---|"
} > "$OUT"

# 시나리오에 적힌 순서대로 세운다 — 파일 이름 순으로 두면 구간10 이 구간2 앞에 온다.
order() { case "$1" in 1) echo 110;; 2a) echo 120;; 2) echo 130;; 6b) echo 165;; 8b) echo 185;; *) echo "$(( $1 * 10 + 100 ))";; esac; }

for f in "$DIR"/seg*.mp4; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  seg="$(sed -E 's/^seg([0-9]+[a-z]?)-.*/\1/' <<<"$base")"
  printf '%s\t%s\n' "$(order "$seg")" "$base"
done | sort -n | cut -f2 | while read -r base; do
  f="$DIR/$base"
  seg="$(sed -E 's/^seg([0-9]+[a-z]?)-.*/\1/' <<<"$base")"
  echo "| 구간${seg} | $(mmss "$(secs "$f")") | $(describe "$seg") | [${base}](./${base}) |" >> "$OUT"
done

{
  echo
  TOTAL=0
  for f in "$DIR"/seg*.mp4; do [ -e "$f" ] && TOTAL=$(( TOTAL + $(secs "$f") )); done
  echo "전체 $(mmss "$TOTAL") · $(du -sh "$DIR" | cut -f1)"
  echo
  if [ -d "$DIR/보고서" ]; then
    echo "## 실행 보고서"
    echo
    echo "[보고서/index.html](./보고서/index.html) — 구간별 통과 여부와 각 단계의 실행 시각이 그대로 들어 있다. 브라우저로 열면 인쇄·PDF 로 남길 수 있다."
    echo
  fi
  if [ -d "$DIR/캡처" ]; then
    echo "## 화면 캡처"
    echo
    echo "시나리오가 결과를 확인하는 자리에서 남긴 것이다."
    echo
    for p in "$DIR"/캡처/*.png; do
      [ -e "$p" ] || continue
      n="$(basename "$p")"
      echo "- [${n}](./캡처/${n})"
    done
    echo
  fi
} >> "$OUT"

echo "[readme] $OUT"
