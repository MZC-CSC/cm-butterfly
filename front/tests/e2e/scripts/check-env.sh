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

# 워크트리에 의존성과 생성된 spec 이 있는지.
#
# 새로 딴 워크트리에는 node_modules 가 없다. 그 상태로 돌리면 playwright.config.ts 가
# @playwright/test 를 못 찾아 **전 구간이 몇 초 만에 죽는다** — 실제로 한 벌을 통째로 그렇게 날렸다.
# spec 도 마찬가지다. bddgen 을 돌리지 않으면 "No tests found" 로 조용히 끝난다.
E2E_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONT="$(cd "$E2E_DIR/../.." && pwd)"

if [ -d "$FRONT/node_modules/@playwright/test" ]; then say "의존성" "설치됨"
else say "의존성" "❌ 없음 — cd $FRONT && npm ci"; fail=1; fi

if [ -n "$(find "$E2E_DIR/.features-gen" -name '*.spec.js' 2>/dev/null | head -1)" ]; then
  say "생성된 spec" "있음"
else
  say "생성된 spec" "❌ 없음 — cd $E2E_DIR && npx bddgen"; fail=1
fi


code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/" || echo 000)"
if [ "$code" = "200" ]; then say "콘솔 $HOST" "OK ($code)"
else say "콘솔 $HOST" "❌ 응답 $code — 서버가 꺼져 있을 수 있다"; fail=1; fi

# 촬영 중에 서버가 내려가지 않는지.
#
# `Auto.StopHold=keep` 은 자동 종료를 건너뛰게 하는 스위치인데 **매일 06:00 에 시스템이 off 로
# 되돌린다**(REMOTE-SERVER-LIFECYCLE §5.4). 어제 걸어 둔 것은 오늘 소용이 없다. 한 벌을 찍는 데
# 25분이 걸리므로 그 사이에 종료 시각이 걸리면 중간부터 통째로 날아간다 — 실제로 그렇게
# 구간 4~9 를 잃었다(2026-07-30, 도메인이 사라져 ERR_NAME_NOT_RESOLVED).
if command -v aws >/dev/null 2>&1; then
  hold="$(aws ec2 describe-instances --region ap-northeast-2 \
      --filters "Name=tag:Auto.Dns,Values=$HOST" \
      --query "Reservations[].Instances[].Tags[?Key=='Auto.StopHold']|[0][0].Value" \
      --output text 2>/dev/null)"
  case "$hold" in
    keep) say "자동 종료 보류" "keep — 촬영 중 내려가지 않는다" ;;
    "" | None)
      say "자동 종료 보류" "❌ 걸려 있지 않다 — 촬영 도중 서버가 내려갈 수 있다"
      echo "   aws ec2 create-tags --region ap-northeast-2 --resources <instance-id> --tags Key=Auto.StopHold,Value=keep"
      fail=1 ;;
    *) say "자동 종료 보류" "❌ '$hold' — keep 이어야 한다"; fail=1 ;;
  esac
fi

# 라인업이 성해 있는지. 하나라도 restarting 이면 그 뒤 단계가 엉뚱하게 실패한다.
#
# 보는 대상은 **cloud-migrator 프로젝트의 컨테이너**뿐이다. 같은 호스트에서 다른 세션이 자기
# 브랜치 컨테이너를 띄워 두기도 하는데, 그건 우리 것이 아니고 헬스체크가 없어 상태가 그냥
# "Up" 으로 나온다 — 전체를 훑으면 남의 것 때문에 우리 실행이 막힌다.
#
# 판정은 docker 의 health 필터로 한다. 상태 문자열을 직접 훑으면 "(healthy)" 의 괄호 하나에
# 걸려 멀쩡한 것을 전부 비정상으로 세게 된다(실제로 그랬다).
if [ "$code" = "200" ] && [ -r "$SSH_KEY" ]; then
  bad="$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$SSH_KEY" "ubuntu@$HOST" \
    'docker ps -q --filter label=com.docker.compose.project=cloud-migrator \
       --filter health=unhealthy --filter health=starting | wc -l' 2>/dev/null)"
  total="$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$SSH_KEY" "ubuntu@$HOST" \
    'docker ps -q --filter label=com.docker.compose.project=cloud-migrator | wc -l' 2>/dev/null)"
  if [ "${bad:-1}" = "0" ] && [ "${total:-0}" -gt 0 ]; then
    say "라인업 컨테이너" "$total 개 전부 정상"
  else
    say "라인업 컨테이너" "❌ ${total:-?} 개 중 ${bad:-?} 개가 준비되지 않음"; fail=1
  fi
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

# 화면 이동은 좌측 메뉴 클릭으로 한다. 메뉴 항목의 식별자는 라우트 이름으로 만들어지므로
# 위 목록처럼 문자열 하나로 찾을 수 없다 — 만들어 내는 자리를 본다.
if grep -rq 'data-testid="`menu-${n.id}`"\|`menu-\${n.id}`' "$SRC" --include=*.vue 2>/dev/null; then
  say "메뉴 식별자" "있음"
else
  say "메뉴 식별자" "❌ 없음 — 메뉴 클릭 이동이 통째로 막힌다"; fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "❌ 환경이 준비되지 않았다. 서버를 올리고(Auto.StopHold=keep 재설정) 다시 확인한다."
  exit 1
fi
echo "✅ 준비됨"
