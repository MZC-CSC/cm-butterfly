#!/usr/bin/env bash
#
# 시연용 샘플을 환경에 심는다 (없을 때만).
#
# 왜 필요한가 — 재실행 버튼이 무엇을 하는지 보여주려면 *실패한 워크플로우*가 있어야 하는데,
# 실제 마이그레이션을 실패시키려면 자원을 만들다 말아야 하고 그건 비용과 뒷정리를 남긴다.
# 그래서 bash 만 쓰는 샘플을 따로 둔다 — 두 갈래가 나란히 돌고 한쪽만 실패한다.
#
# 콘솔에는 워크플로우를 파일로 들여오는 기능이 없으므로 cm-cicada API 로 직접 심는다.
# 이미 있으면 아무것도 하지 않으므로 몇 번을 돌려도 안전하다.
#
# 사용법:
#   HOST=cmig.dev.cscmzc.com scripts/seed-samples.sh
set -uo pipefail

HOST="${HOST:-${BASE_URL#*://}}"
HOST="${HOST%%/*}"
# 포트를 뗀다 - BASE_URL 이 front-dev(:5174) 를 가리킬 때가 있고, 그대로 두면 ssh 가 그것을
# 호스트 이름의 일부로 읽어 "No such file or directory" 로 죽는다(2026-08-19).
HOST="${HOST%%:*}"
SSH_KEY="${E2E_SSH_KEY:-$HOME/.ssh/cb-webtool.pem}"
HERE="$(cd "$(dirname "$0")" && pwd)"

scp -q -o StrictHostKeyChecking=no -i "$SSH_KEY" \
  "$HERE/../fixtures/sample-parallel-failure-workflow.json" \
  "ubuntu@$HOST:/tmp/e2e-sample-wf.json" || {
  echo "  샘플 파일을 서버로 옮기지 못했다" >&2
  exit 1
}

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "ubuntu@$HOST" 'bash -s' <<'REMOTE'
set -uo pipefail
CC=http://localhost:8083/cicada

# ① 언제나 실패하는 bash 작업 — 실패를 만들어 내는 유일한 부품이다
if curl -s "$CC/task_component" | grep -q '"_v2_bash_fail"'; then
  echo "  작업 컴포넌트  이미 있음 (_v2_bash_fail)"
else
  curl -s -o /dev/null -X POST "$CC/task_component" -H 'Content-Type: application/json' -d '{
    "name": "_v2_bash_fail",
    "description": "[V2 Sample] Always fails - for demonstrating re-run (BashOperator, exit 1)",
    "type": "bash",
    "spec": { "bash_command": "echo \"verifying...\"; echo \"verification failed\" >&2; exit 1" }
  }' && echo "  작업 컴포넌트  생성 (_v2_bash_fail)"
fi

# ② 병렬 샘플 워크플로우
if curl -s "$CC/workflow" | grep -q '"sample-parallel-partial-failure"'; then
  echo "  샘플 워크플로우 이미 있음"
else
  curl -s -o /dev/null -X POST "$CC/workflow" -H 'Content-Type: application/json' \
    --data-binary @/tmp/e2e-sample-wf.json && echo "  샘플 워크플로우 생성"
fi

# DAG 가 잡혀야 실행할 수 있다 — 잡힐 때까지 기다린다(최대 3분).
# 방금 만든 것은 곧바로 조회되지 않을 때가 있다 - 몇 번 더 물어본다.
wfid=""
for _ in $(seq 1 12); do
  wfid="$(curl -s "$CC/workflow/name/sample-parallel-partial-failure" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)"
  [ -n "$wfid" ] && break
  sleep 3
done

if [ -n "$wfid" ]; then
  for _ in $(seq 1 36); do
    if curl -s -o /dev/null -w '%{http_code}' "$CC/workflow/$wfid/runs" | grep -q 200; then
      echo "  샘플 DAG        등록 확인"
      exit 0
    fi
    sleep 5
  done
  echo "  샘플 DAG        3분 안에 등록되지 않았다" >&2
  exit 1
else
  echo "  샘플 워크플로우 id 를 찾지 못했다" >&2
  exit 1
fi
REMOTE
