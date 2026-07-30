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
  SEGMENTS=(1 2a 2 3 4 5 6 7 8 9)
fi

: "${BASE_URL:?BASE_URL 이 필요하다}"
: "${TEST_SOURCE_PRIVATE_KEY:?TEST_SOURCE_PRIVATE_KEY 가 필요하다 (08-주의사항 C-11)}"

export E2E_DEMO_PACE=1

# 찍기 전에 환경을 본다.
#
# 한 벌을 통째로 날린 적이 있다 — 새로 딴 워크트리에 node_modules 가 없어 전 구간이 몇 초 만에
# 죽었고, 그것도 구간마다 영상을 꺼내려다 "영상이 없다"가 아홉 번 찍히고서야 알았다.
# 여기서 한 번 보면 그 30분을 버리지 않는다.
scripts/check-env.sh || {
  echo
  echo "환경이 준비되지 않아 촬영을 시작하지 않는다. 위 항목을 해소하고 다시 실행한다."
  exit 1
}

failed=()
for seg in "${SEGMENTS[@]}"; do
  echo
  echo "════════ 구간 $seg ════════"
  if npx playwright test --project=integration --grep "@seg${seg}\b"; then
    echo "구간 $seg 통과"
  else
    echo "구간 $seg 실패 — 영상은 남긴다(어디서 어긋났는지는 거기에만 있다)"
    failed+=("$seg")
  fi
  scripts/keep-take.sh "$seg" || true
done

echo
if [ "${#failed[@]}" -eq 0 ]; then
  echo "✅ 전 구간 통과"
else
  echo "❌ 다시 찍을 구간: ${failed[*]}"
  echo "   scripts/record-all.sh ${failed[*]}"
  exit 1
fi
