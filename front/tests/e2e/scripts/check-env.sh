#!/usr/bin/env bash
#
# 돌리기 전에 환경이 살아 있는지 본다.
#
# 서버가 꺼져 있으면 시나리오는 스크립트 문제처럼 보이는 실패를 낸다 — 구간을 하나만 돌리면
# 타임아웃까지 기다리고 나서야 알게 된다. 실제로 개발 서버와 소스 서버가 전날 19시 자동 종료로
# 내려간 상태에서 전체 실행을 걸었고, 전 구간이 2초 만에 죽었다.
#
# 자동 종료 보류(Auto.StopHold=keep)는 매일 06:00 에 풀린다. 하루짜리이므로 그날 다시 건다.
#
# 사용법:
#   BASE_URL=http://cmig.dev.cscmzc.com \
#   TEST_SOURCE_NANO_IP=172.31.7.0 TEST_SOURCE_MICRO_IP=172.31.10.55 \
#   scripts/check-env.sh
#
set -uo pipefail

BASE="${BASE_URL:?BASE_URL 이 필요하다}"
HOST="${BASE#*://}"; HOST="${HOST%%/*}"; HOST="${HOST%%:*}"
SSH_KEY="${E2E_SSH_KEY:-$HOME/.ssh/cb-webtool.pem}"
fail=0

say() { printf '  %-28s %s\n' "$1" "$2"; }

echo "===== 실행 전 환경 확인 ====="

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/" || echo 000)"
if [ "$code" = "200" ]; then say "콘솔 $HOST" "OK ($code)"
else say "콘솔 $HOST" "❌ 응답 $code — 서버가 꺼져 있을 수 있다"; fail=1; fi

# 컨테이너가 다 떠 있는지. 하나라도 restarting 이면 그 뒤 단계가 엉뚱하게 실패한다.
# 상태 문자열은 "(healthy)" 로 괄호까지 붙는다 — 괄호 없이 찾으면 한 줄도 매칭되지 않아
# 멀쩡한 것을 전부 비정상으로 센다.
if [ "$code" = "200" ] && [ -r "$SSH_KEY" ]; then
  # grep 은 하나도 못 찾으면 1 로 끝난다 — 여기서는 그것이 정상(전부 healthy)이므로 실패로 보지 않는다.
  bad="$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$SSH_KEY" "ubuntu@$HOST" \
    'docker ps --format "{{.Names}} {{.Status}}" | grep -cv "(healthy)" || true' 2>/dev/null)"
  if [ "$bad" = "0" ]; then say "컨테이너" "전부 healthy"
  else say "컨테이너" "❌ healthy 아님 $bad 개"; fail=1; fi
fi

# 소스 서버는 *플랫폼 호스트에서* 닿아야 한다 — 여기서 닿는 것과 다르다(08-주의사항 C-7).
for pair in "nano ${TEST_SOURCE_NANO_IP:-}" "micro ${TEST_SOURCE_MICRO_IP:-}"; do
  set -- $pair; label="$1"; ip="${2:-}"
  [ -n "$ip" ] || { say "소스 $label" "❌ IP 미지정"; fail=1; continue; }
  if [ "$code" = "200" ] && [ -r "$SSH_KEY" ]; then
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$SSH_KEY" "ubuntu@$HOST" \
        "timeout 5 bash -c '</dev/tcp/$ip/22'" 2>/dev/null; then
      say "소스 $label ($ip)" "호스트에서 SSH 도달"
    else
      say "소스 $label ($ip)" "❌ 호스트에서 22 안 열림 — 서버가 꺼졌거나 사설 IP 가 아니다"; fail=1
    fi
  fi
done

# 테스트가 요구하는 식별자가 화면 소스에 있는지. 폴백을 두지 않기로 했으므로(08-주의사항 C-1)
# 없는 식별자를 기다리면 그냥 타임아웃이 나고, 원인이 화면인지 스크립트인지 알 수 없다.
#
# 실제로 `target-detail-custom-view` 를 있다고 가정하고 폴백만 걷어낸 적이 있다 — 소스 모델
# 상세에는 있고 타깃 모델 상세에는 없던 식별자였다. 심기 전에 폴백부터 지운 순서가 틀렸다.
SRC="$(cd "$(dirname "$0")/../../../src" && pwd)"
missing=""
for t in target-detail-custom-view source-detail-custom-view target-custom-save \
         create-form-save help-title help-body help-toggle help-panel help-resizer \
         help-detach help-close help-header source-import-filename source-import-input \
         source-import-count migration-guide-page migration-guide-steps \
         notification-badge notification-item notification-confirm mci-list-table; do
  grep -rq "\"$t\"" "$SRC" --include=*.vue 2>/dev/null || missing="$missing $t"
done
if [ -z "$missing" ]; then say "화면 식별자" "필요한 것 모두 있음"
else say "화면 식별자" "❌ 없음:$missing"; fail=1; fi

echo
if [ "$fail" -ne 0 ]; then
  echo "❌ 환경이 준비되지 않았다. 서버를 올리고(Auto.StopHold=keep 재설정) 다시 확인한다."
  exit 1
fi
echo "✅ 준비됨"
