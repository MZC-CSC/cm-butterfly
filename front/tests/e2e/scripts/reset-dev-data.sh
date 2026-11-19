#!/usr/bin/env bash
#
# 촬영 전에 개발 환경에 남은 것을 비운다.
#
# 앞선 실행이 남긴 소스그룹·모델·워크플로우가 목록에 그대로 쌓이면, 찍은 화면에 이번 시나리오와
# 무관한 항목이 잔뜩 섞여 나온다. 실제로 타깃 모델 목록에 지난 실행분 12건이 남은 채로 한 벌을
# 찍었고, 그래서 다시 찍어야 했다.
#
# ★ 모델은 종류별로 지운다. 목록은 통합 API `GET /model` 하나로 모든 단계·종류가 나오지만,
#   삭제는 종류마다 경로가 다르다 — 인프라 `/infra-model/{id}`, 소프트웨어·오브젝트 스토리지·RDBMS 는
#   `/{종류}-model/{id}?modelStage=…` (단계 필수). 목록에서 온 id 를 다른 종류의 경로에 넣으면 지워지지
#   않는다 — 지웠다고 믿은 채로 촬영에 들어가게 된다.
#   하위 모델이 있으면 409 로 거부되므로 목표 → 계획 → 소스 순서로 지운다. (2026-11-19 legacy API 에서 전환)
#
# 인프라(워크로드)는 여기서 건드리지 않는다. CSP 자원이 걸려 있어 제품의 삭제 기능으로 지워야 한다.
#
# 사용법:
#   HOST=cmig.dev.cscmzc.com scripts/reset-dev-data.sh
set -uo pipefail

HOST="${HOST:-cmig.dev.cscmzc.com}"
SSH_KEY="${E2E_SSH_KEY:-$HOME/.ssh/cb-webtool.pem}"
AUTH="${DEV_BASIC_AUTH:-default:default}"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "ubuntu@$HOST" AUTH="$AUTH" 'bash -s' <<'REMOTE'
set -uo pipefail
HB=http://localhost:8081/honeybee
DF=http://localhost:8088/damselfly
CC=http://localhost:8083/cicada
TB=http://localhost:1323/tumblebug

n=0
for id in $(curl -s -u "$AUTH" "$HB/source_group" | python3 -c "
import sys,json
for g in json.load(sys.stdin).get('source_group') or []: print(g['id'])"); do
  curl -s -o /dev/null -X DELETE -u "$AUTH" "$HB/source_group/$id" && n=$((n+1))
done
echo "  소스그룹      $n 건 삭제"

# 종류마다 경로가 다르므로 목록에서 종류·단계를 함께 읽어 짝을 맞춘다. 하위 모델부터 지운다.
m=0
for pair in $(curl -s -u "$AUTH" "$DF/model" | python3 -c "
import sys,json
order = {'target': 0, 'planning': 1, 'source': 2}
rows = []
for x in json.load(sys.stdin) or []:
    kind, stage = x.get('modelType'), x.get('modelStage')
    if stage not in order: continue
    if kind in ('CloudModel', 'OnPremiseModel'): path = 'infra-model/' + x['id']
    elif kind == 'SoftwareModel':                path = 'software-model/' + x['id'] + '?modelStage=' + stage
    elif kind == 'objectStorageModel':           path = 'object-storage-model/' + x['id'] + '?modelStage=' + stage
    elif kind == 'RDBMSModel':                   path = 'rdbms-model/' + x['id'] + '?modelStage=' + stage
    else:                                        continue
    rows.append((order[stage], path))
for _, path in sorted(rows): print(path)
"); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -u "$AUTH" "$DF/$pair")
  [ "$code" = "200" ] && m=$((m+1)) || echo "    실패($code) $pair"
done
echo "  모델          $m 건 삭제"

w=0
for id in $(curl -s "$CC/workflow" | python3 -c "
import sys,json
d=json.load(sys.stdin); ws=d if isinstance(d,list) else (d.get('workflows') or [])
# 'sample-' 로 시작하는 것은 남긴다 — 우리가 미리 심어 둔 시연용이고, 지우면 그 구간이 통째로 못 돈다.
for x in ws or []:
    if not (x.get('name') or '').startswith('sample-'): print(x['id'])" 2>/dev/null); do
  curl -s -o /dev/null -X DELETE "$CC/workflow/$id" && w=$((w+1))
done
echo "  워크플로우    $w 건 삭제"

# 알림도 비운다.
#
# 알림 목록은 지난 실행의 기록을 그대로 들고 있다. 지금은 자원 이름을 업무형으로 바꿨지만
# 그 전에 만든 알림에는 `e2e-wf-…` 가 그대로 적혀 있고, 촬영 중 알림 창을 열면 **화면에 나온다** —
# 이름을 바꾼 이유가 통째로 무너진다.
#
# 화면의 "Mark all read" 가 실제로 하는 일도 삭제다(handler 의 ReadAllNotifications →
# repository 의 DeleteAllByUser). 여기서는 사람이 눌러 줄 사람이 없으니 저장소에서 직접 비운다.
n=$(docker exec cm-butterfly-db psql -U butterflyadmin -d butterfly-db -tAc \
      "DELETE FROM notifications RETURNING 1" 2>/dev/null | wc -l)
echo "  알림          $n 건 삭제"

echo "  남은 인프라   $(curl -s -u "$AUTH" "$TB/ns/mig01/infra?option=id")"
REMOTE
