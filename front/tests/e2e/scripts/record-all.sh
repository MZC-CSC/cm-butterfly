#!/usr/bin/env bash
#
# 통합 시나리오를 구간 순서대로 찍는다.
#
# 구간마다 따로 돌리고, 끝나는 즉시 영상을 꺼내 둔다 — playwright 가 다음 실행에서 test-results 를
# 통째로 비우기 때문에 미루면 앞 구간이 사라진다.
#
# 한 구간이 실패해도 멈추지 않는다. 구간은 각자 하나의 테이크라, 실패한 것만 나중에 다시 찍어
# 이어 붙이면 된다. 대신 끝에 어떤 구간이 실패했는지 모아 보여 준다.
#
# 사용법:
#   scripts/record-all.sh                # 전 구간
#   scripts/record-all.sh 3 4 5          # 지정한 구간만 (다시 찍기)
set -uo pipefail

cd "$(dirname "$0")/.."

SEGMENTS=("$@")
if [ "${#SEGMENTS[@]}" -eq 0 ]; then
  # 구간11 은 기본 목록에 넣지 않는다 — *이미 실패한 실행*이 있어야 성립하므로 늘 찍을 수 있는
  # 것이 아니다. 필요할 때 이름을 지정해 따로 찍는다:
  #   TEST_FAILED_WORKFLOW=<실패한 워크플로우> scripts/record-all.sh 11
  SEGMENTS=(1 0 2a 2 3 4 5 6 6b 7 8 8b 9 10 13)
fi

: "${BASE_URL:?BASE_URL 이 필요하다}"
: "${TEST_SOURCE_PRIVATE_KEY:?TEST_SOURCE_PRIVATE_KEY 가 필요하다 (08-주의사항 C-11)}"

# ★ 촬영 중에는 다른 playwright 를 돌리지 않는다 — 자물쇠로 막는다.
#
#   playwright 는 실행을 시작할 때 test-results 를 통째로 비운다. 촬영이 도는 중에 다른 spec 을
#   하나 돌렸더니 그 폴더가 지워져, 그때 찍히던 구간의 영상이 통째로 날아갔다. 시나리오는 멀쩡히
#   끝났는데 남은 것이 없었다 — 그 구간이 모델을 만드는 자리라 같은 이름표로 다시 찍을 수도 없어
#   한 벌을 통째로 다시 찍어야 했다. (2026-08-01)
LOCK="${TMPDIR:-/tmp}/cmig-e2e-recording.lock"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "❌ 이미 촬영이 돌고 있다 (pid $(cat "$LOCK")). 끝난 뒤에 다시 실행한다." >&2
  echo "   촬영 중에 다른 playwright 를 돌리면 test-results 가 비워져 영상이 날아간다." >&2
  exit 1
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

export E2E_DEMO_PACE=1

# 촬영은 보여주는 것이 목적이므로 품질을 올린다.
#
# * 녹화기의 비트레이트는 우리가 정할 수 없고 1080p 에서 700kbps 남짓이다. 화면 녹화로는 얇아서
#   글자가 가장 먼저 뭉개지고, 크로미움이 글자 가장자리를 R·G·B 서브픽셀로 부드럽게 하는 탓에
#   H.264 의 색 서브샘플링(4:2:0)이 그 얇은 색 테두리를 번지게 한다 — 글자 주변 색이 이상해지는
#   것이 이것이다.
#
#   2배로 그려 1080p 로 내리면 기록되는 픽셀 하나가 넷의 평균이라 글자 가장자리가 깨끗해진다.
#   글자를 회색으로만 부드럽게 하는 설정은 playwright.config.ts 에서 항상 적용된다.
#
#   빠른 검증에는 켜지 않는다 — 메모리와 시간이 든다: REC_FAST=1 로 끈다.
# 품질 단계 — REC_QUALITY 로 고른다.
#
#   fast    Playwright 녹화 · 1배        검증 전용. 가장 빠르고 가볍다
#   normal  Playwright 녹화 · 2배 렌더   지금까지의 기본
#   fullhd  x11 녹화 · 1920x1080         보여줄 영상
#   4k      x11 녹화 · 2배 렌더 3840x2160  최고 품질. 메모리를 두 배로 쓴다
#
# ★ x11 쪽이 화질이 확연히 낫다. Playwright 녹화기는 비트레이트를 우리가 정할 수 없어
#   1080p 에서 700kbps 남짓으로 나오고, 그 얇은 대역에서 가장 먼저 무너지는 것이 글자다.
#   x11 은 코덱과 품질을 우리가 정하므로 같은 길이에 파일이 오히려 작으면서 더 선명하다.
#
# 옛 이름(REC_FAST·E2E_HQ)도 계속 받는다 — 기존 호출을 깨지 않는다.
REC_QUALITY="${REC_QUALITY:-}"
if [ -z "$REC_QUALITY" ]; then
  [ "${REC_FAST:-0}" = "1" ] && REC_QUALITY=fast || REC_QUALITY=normal
fi

USE_X11=0
case "$REC_QUALITY" in
  fast)
    echo "[품질] fast — Playwright 녹화, 2배 렌더링 없이. 검증용이다"
    ;;
  normal)
    export E2E_HQ=1
    echo "[품질] normal — Playwright 녹화, 2배로 그려 1080p 로 내린다"
    ;;
  fullhd)
    USE_X11=1; export REC_SCALE=1
    echo "[품질] fullhd — x11 녹화, 1920x1080"
    ;;
  4k)
    USE_X11=1; export REC_SCALE=2
    echo "[품질] 4k — x11 녹화, 2배로 그려 3840x2160. 메모리를 두 배로 쓴다"
    ;;
  *)
    echo "REC_QUALITY 는 fast·normal·fullhd·4k 중 하나다 (받은 값: $REC_QUALITY)" >&2
    exit 2
    ;;
esac

# 한 벌 전체가 같은 이름표를 쓰게 한다.
#
# 구간마다 따로 돌리므로 프로세스가 갈리고, RUN_ID 는 프로세스마다 새로 정해진다. 그런데 만들어지는
# 자원의 이름에도, 구간 사이 인계 파일(support/handoff.ts)의 이름에도 그 값이 들어간다 - 구간마다
# 값이 달라지면 앞 구간이 만든 것을 뒤 구간이 **찾지 못한다**. 실제로 그렇게 구간 3 부터 줄줄이
# 실패했다("onprem-web-433829 이 목록 어디에도 없다" - 그 이름을 만든 적이 없으니 당연하다).
#
# 여기서 한 번 정해 물려주면 아홉 구간이 한 벌로 묶인다. 특정 구간만 다시 찍을 때는 그 벌의 값을
# 그대로 넘긴다: E2E_RUN_ID=433829 scripts/record-all.sh 5 6
export E2E_RUN_ID="${E2E_RUN_ID:-$(date +%s | tail -c 7)}"
echo "이번 벌 RUN_ID=$E2E_RUN_ID  (다시 찍을 때 이 값을 그대로 넘긴다)"

# 찍기 전에 환경을 본다.
#
# 한 벌을 통째로 날린 적이 있다 — 새로 딴 워크트리에 node_modules 가 없어 전 구간이 몇 초 만에
# 죽었고, 그것도 구간마다 영상을 꺼내려다 "영상이 없다"가 아홉 번 찍히고서야 알았다.
# 여기서 한 번 보면 그 30분을 버리지 않는다.
# ★ 앞선 벌이 남긴 것을 먼저 비운다.
#
# 목록에 지난 실행분이 섞여 나오는 것도 문제지만, 더 큰 것은 **구간1 이 조용히 뜻을 잃는다**는
# 점이다. 처음 방문 안내는 *아직 아무것도 없는 사람*에게만 뜨므로, 소스 그룹이 하나라도 남아
# 있으면 안내창이 아예 나타나지 않는다. 그런데도 구간은 통과한다 — 확인한 것이 없는 채로.
# (2026-08-14. 첫 벌은 안내창이 클릭을 막아 실패했고, 둘째 벌은 안내창이 안 떠서 통과했다.)
#
# 지우지 않고 넘어가려면 REC_KEEP_DATA=1 을 준다(구간 하나만 다시 찍을 때).
if [ "${REC_KEEP_DATA:-0}" = "1" ]; then
  echo "[reset] 건너뜀 — REC_KEEP_DATA=1"
else
  scripts/reset-dev-data.sh || {
    echo
    echo "앞선 벌의 자료를 비우지 못해 촬영을 시작하지 않는다 — 구간1 의 처음 방문 안내가 뜨지 않는다."
    exit 1
  }
fi

# 시연용 샘플이 환경에 있어야 한다 - 없으면 심는다(있으면 아무것도 하지 않는다).
scripts/seed-samples.sh || {
  echo
  echo "샘플을 준비하지 못해 촬영을 시작하지 않는다."
  exit 1
}

scripts/check-env.sh || {
  echo
  echo "환경이 준비되지 않아 촬영을 시작하지 않는다. 위 항목을 해소하고 다시 실행한다."
  exit 1
}

# 편집 경로가 실제 화면에서 도는지 먼저 본다 (2분).
#
# ★ 한 벌은 45분이다. 규칙을 찾고 복제하고 값을 바꾸는 자리가 어긋나 있으면 그 45분을 다 쓰고
#   나서야 알게 되고, 고쳐서 다시 걸면 또 45분이다 — 하루에 네 번 그렇게 했다. 여기서 걸리는
#   것은 촬영에서도 반드시 걸리므로, 2분을 먼저 쓴다.
#
#   건너뛰려면 REC_SKIP_SMOKE=1.
if [ "${REC_SKIP_SMOKE:-0}" = "1" ]; then
  echo "[smoke] 건너뜀 — REC_SKIP_SMOKE=1"
else
  echo
  echo "════════ 편집 경로 점검 ════════"
  node scripts/smoke-edits.mjs || {
    echo
    echo "편집 경로가 화면에서 동작하지 않는다 — 이대로 찍으면 그 구간에서 45분을 버린다."
    exit 1
  }
fi

# 촬영 전에 치워 둘 것 — 알림함 비우기. 녹화하지 않는다.
#
# 지난 작업의 알림이 남아 있으면 첫 화면부터 그것이 뜨는데, 지우는 장면 자체는 보여줄 내용이
# 아니다. 그래서 구간이 아니라 준비 단계에 둔다.
echo
echo "════════ 사전 작업 ════════"
E2E_VIDEO=off npx playwright test --project=integration --grep "@prep" || {
  echo "사전 작업이 실패했지만 촬영은 계속한다 — 알림이 남아 있을 수 있다" >&2
}

failed=()
for seg in "${SEGMENTS[@]}"; do
  echo
  echo "════════ 구간 $seg ════════"
  if [ "$USE_X11" = 1 ]; then
    # x11 은 스스로 찍고·다듬고·보관한다. keep-take 를 다시 부르지 않는다.
    if SCALE="$REC_SCALE" scripts/record-x11.sh "seg${seg}"; then
      echo "구간 $seg 통과"
    else
      echo "구간 $seg 실패 — 영상은 남긴다(어디서 어긋났는지는 거기에만 있다)"
      failed+=("$seg")
    fi
    # 구간0 은 뒤 구간이 쓸 것을 만들어 두는 자리일 뿐이라 영상으로 남기지 않는다.
    if [ "$seg" = "0" ]; then
      d="${KEEP_DIR:-/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"
      rm -f "$d"/seg0-*.mp4 "$d"/원본/seg0-*.mp4 2>/dev/null
    fi
  else
    if npx playwright test --project=integration --grep "@seg${seg}\b"; then
      echo "구간 $seg 통과"
    else
      echo "구간 $seg 실패 — 영상은 남긴다(어디서 어긋났는지는 거기에만 있다)"
      failed+=("$seg")
    fi
    scripts/keep-take.sh "$seg" || true
  fi
done

# 보고서와 구간별 캡처를 영상 옆에 둔다.
#
# 흩어져 있으면 영상만 넘겨받은 사람이 "이 구간이 무엇을 확인한 것인지" 를 알 수 없다. 결과는
# 한 폴더에서 끝나야 한다 — 영상·보고서·캡처.
KEEP_ROOT="/home/ubuntu/mzc/ant/workflow/cmig-workflow/conf/private/E2E결과"
DEST="${KEEP_DIR:-$KEEP_ROOT/통합시나리오-v060-${E2E_TAKE_DIR:-$(date +%Y%m%d)}}"
mkdir -p "$DEST"

if [ -f e2e-report/index.html ]; then
  cp -r e2e-report "$DEST/보고서" 2>/dev/null || true
  echo "[결과] 보고서 → $DEST/보고서/index.html"
fi
if [ -d test-results/screens ]; then
  rm -rf "$DEST/캡처"
  cp -r test-results/screens "$DEST/캡처" 2>/dev/null || true
  echo "[결과] 캡처 → $DEST/캡처/"
fi

echo
if [ "${#failed[@]}" -eq 0 ]; then
  echo "✅ 전 구간 통과"
else
  echo "❌ 다시 찍을 구간: ${failed[*]}"
  echo "   scripts/record-all.sh ${failed[*]}"
  exit 1
fi
