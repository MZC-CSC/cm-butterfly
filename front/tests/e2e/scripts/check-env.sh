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
#   scripts/check-env.sh               # e2e.config 의 값을 따른다
#   BASE_URL=http://other-host \
#   TEST_SOURCE_NANO_IP=172.31.7.0 TEST_SOURCE_MICRO_IP=172.31.10.55 \
#   scripts/check-env.sh
#
set -uo pipefail

# 개인 설정(e2e.config)을 읽는다. 이미 준 환경변수가 우선이다.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/load-config.sh"

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
#
# ★ 찾는 이름은 *접속한 호스트*가 아니라 **그 서버의 실제 도메인**이다.
#
#   촬영은 가짜 도메인(v0.6.2.cmig-mzc.com)으로 접속한다 - 영상에 내부 호스트가 남지 않게 하려는
#   것이라 hosts 에만 있고 EC2 태그에는 없다. 그대로 찾으면 "걸려 있지 않다"가 나와 촬영이
#   시작되지 못한다(2026-08-20). 가짜 이름이면 실제 도메인으로 바꿔 찾는다.
E2E_REAL_HOST="${E2E_REAL_HOST:-}"
if [ -z "$E2E_REAL_HOST" ]; then
  case "$HOST" in
    *cmig-mzc.com) E2E_REAL_HOST="cmig.dev.cscmzc.com" ;;
    *)             E2E_REAL_HOST="$HOST" ;;
  esac
fi

if command -v aws >/dev/null 2>&1; then
  hold="$(aws ec2 describe-instances --region ap-northeast-2 \
      --filters "Name=tag:Auto.Dns,Values=$E2E_REAL_HOST" \
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
      # ★ 소프트웨어 마이그레이션의 소스가 되는 쪽은 nginx 가 *떠 있어야* 한다.
      #   cm-grasshopper 는 소스의 실행 상태를 대상에서도 재현하려 하고, 대상은 설치 직후 자동
      #   기동되므로, 소스가 꺼져 있으면 "active state mismatch" 로 검증이 실패한다. 부하 테스트도
      #   대상의 nginx 가 떠 있어야 성립한다. (2026-08-14 구간8 실패)
      if [ "$label" = "nano" ]; then
        st="$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=8 \
               -i "${E2E_SOURCE_KEY:-$HOME/.ssh/e2e-source-key}" \
               "ubuntu@$ip" 'systemctl is-active nginx' 2>/dev/null || true)"
        if [ "$st" = "active" ]; then
          say "  nginx (소프트웨어 소스)" "실행 중"
        else
          say "  nginx (소프트웨어 소스)" "❌ $st — 꺼져 있으면 SW 마이그레이션이 상태 불일치로 실패한다"
          echo "     → ssh ubuntu@$ip 'sudo systemctl start nginx'"
          fail=1
        fi
      fi
    else
      say "소스 $label ($ip)" "❌ 호스트에서 22 안 열림 — 서버가 꺼졌거나 사설 IP 가 아니다"; fail=1
    fi
  fi
done

# 테스트가 요구하는 식별자가 *돌아가는 화면*에 있는지. 폴백을 두지 않기로 했으므로(08-주의사항
# C-1) 없는 식별자를 기다리면 그냥 타임아웃이 나고, 원인이 화면인지 스크립트인지 알 수 없다.
#
# ★ 로컬 소스를 보면 안 된다. 여기서 보던 것은 체크아웃한 소스였고, 서버가 돌리는 이미지와는
#   아무 관계가 없다. 그래서 develop 에만 있고 릴리스 이미지에는 없는 식별자를 "있다"고
#   통과시켰고, 촬영은 30분을 돌다가 구간3~6 이 통째로 죽었다 — 없는 속성을 60초씩 기다리다.
#   (2026-08-14. data-status 가 그랬다.)
#
# 그래서 콘솔이 실제로 내려주는 JS 번들을 받아 그 안에서 찾는다. 식별자는 번들에 문자열로 남는다.
SRC="$(cd "$(dirname "$0")/../../../src" && pwd)"
NEEDED="target-detail-custom-view source-detail-custom-view target-custom-save
        create-form-save help-title help-body help-toggle help-panel help-resizer
        help-detach help-close help-header source-import-filename source-import-input
        source-import-count migration-guide-page migration-guide-steps
        notification-badge notification-item notification-confirm mci-list-table
        source-group-status model-name-input model-description-input
        workflow-create workflow-description-input"

BUNDLE_DIR="$(mktemp -d)"
trap 'rm -rf "$BUNDLE_DIR"' EXIT

fetch_js() {  # 인자로 받은 경로들을 받아 stdout 으로 흘린다
  while read -r u; do
    [ -n "$u" ] || continue
    case "$u" in
      http*) URL="$u" ;;
      /*)    URL="${BASE_URL}${u}" ;;
      *)     URL="${BASE_URL}/${u}" ;;
    esac
    curl -fsS --max-time 60 "$URL" 2>/dev/null
  done
}

if curl -fsS --max-time 20 "$BASE_URL/" -o "$BUNDLE_DIR/index.html" 2>/dev/null; then
  # 1) index.html 이 직접 부르는 것
  grep -oE '(src|href)="[^"]+\.js"' "$BUNDLE_DIR/index.html" \
    | sed -E 's/^(src|href)="//; s/"$//' | sort -u > "$BUNDLE_DIR/entry.txt"
  fetch_js < "$BUNDLE_DIR/entry.txt" > "$BUNDLE_DIR/entry.js"

  # 2) ★ 지연 로딩 청크까지 따라간다. 화면 대부분은 라우트 단위로 쪼개져 있어 index.html 에
  #    이름이 없다 — 여기를 빠뜨리면 멀쩡히 있는 식별자를 "없다"고 말한다(migration-guide-*).
  #    청크 파일명은 진입 번들 안에 문자열로 들어 있다. Vite 는 `"./Foo-hash.js"` 처럼 적고
  #    실제 경로는 assets/ 아래다. webpack 은 `js/...` 로 적는다 — 둘 다 받는다.
  grep -oE '"\./[A-Za-z0-9_.-]+\.js"|"assets/[A-Za-z0-9_.-]+\.js"|"[^"]*js/[A-Za-z0-9_.-]+\.js"' \
       "$BUNDLE_DIR/entry.js" 2>/dev/null \
    | tr -d '"' | sed 's#^\./#assets/#' | sort -u | head -400 > "$BUNDLE_DIR/chunks.txt"
  fetch_js < "$BUNDLE_DIR/chunks.txt" > "$BUNDLE_DIR/chunks.js"

  cat "$BUNDLE_DIR/entry.js" "$BUNDLE_DIR/chunks.js" > "$BUNDLE_DIR/all.js"
fi

missing=""
if [ -s "$BUNDLE_DIR/all.js" ]; then
  for t in $NEEDED; do
    grep -qF "$t" "$BUNDLE_DIR/all.js" || missing="$missing $t"
  done
  WHERE="돌아가는 화면"
else
  # 번들을 받지 못하면 소스로 물러선다. 그것은 확인이 아니라 추정이므로 그렇게 말한다.
  for t in $NEEDED; do
    grep -rq "\"$t\"" "$SRC" --include=*.vue 2>/dev/null || missing="$missing $t"
  done
  WHERE="⚠ 번들을 받지 못해 로컬 소스로 추정"
fi

if [ -z "$missing" ]; then say "화면 식별자" "$WHERE — 필요한 것 모두 있음"
else
  say "화면 식별자" "❌ $WHERE 에 없음:$missing"
  echo "     → 돌아가는 이미지가 테스트보다 오래됐다. 그 식별자가 든 이미지로 올린 뒤 다시 확인한다."
  fail=1
fi

# 값을 실어 나르는 속성은 위 목록으로 잡히지 않는다 — `data-testid="..."` 처럼 리터럴이 아니라
# `:data-status="data.status"` 로 바인딩돼 번들에서는 다른 모양이 되기 때문이다. 그런데 구간3~6
# 이 이것 하나로 통째로 죽으므로(2026-08-14) 따로 본다.
#
# ★ 번들 전체에서 `data-status` 를 찾으면 안 된다 — 라이프사이클 모달과 Service Status 화면도
#   같은 속성을 쓰므로 소스 그룹 쪽이 없어도 "있다"가 나온다. 파일 단위로 좁혀도 소용없다
#   (다 한 덩어리에 들어 있다). 그 요소가 컴파일된 *그 자리*를 본다 — 속성들은 한 객체로
#   묶여 나오므로 `data-testid":"source-group-status` 앞뒤 200자 안에 함께 있어야 한다.
if [ -s "$BUNDLE_DIR/all.js" ]; then
#   그리고 이름만 같은 것에 속지 않는다 — 이 표는 열 슬롯 이름도 `"data-status"` 라서
#   그냥 찾으면 늘 "있다"가 나온다. 속성 객체 안의 모양(`"data-status":`)으로만 본다.
  around="$(grep -oE '.{240}"data-testid":"source-group-status".{240}' "$BUNDLE_DIR/all.js" 2>/dev/null | head -1)"
  if [ -z "$around" ]; then
    say "상태 속성" "건너뜀 — source-group-status 를 번들에서 못 찾았다"
  elif printf '%s' "$around" | grep -qE '"data-status":'; then
    say "상태 속성" "돌아가는 화면 — 소스 그룹에 data-status 있음"
  else
    say "상태 속성" "❌ 소스 그룹에 data-status 없음 — 수집 전 상태 대기가 전부 타임아웃 난다"
    fail=1
  fi
fi

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
