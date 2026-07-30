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
