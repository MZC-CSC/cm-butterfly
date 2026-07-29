#!/usr/bin/env bash
#
# 촬영 전에 개발 환경에 남은 것을 비운다.
#
# 앞선 실행이 남긴 소스그룹·모델·워크플로우가 목록에 그대로 쌓이면, 찍은 화면에 이번 시나리오와
# 무관한 항목이 잔뜩 섞여 나온다. 실제로 타깃 모델 목록에 지난 실행분 12건이 남은 채로 한 벌을
# 찍었고, 그래서 다시 찍어야 했다.
#
# ★ 모델은 종류별로 지운다. `/model/{id}` 같은 경로는 없다 — 목록은 `/model/{isTargetModel}` 로
#   한꺼번에 나오지만 삭제는 `/cloudmodel/{id}`·`/onpremmodel/{id}`·`/softwaremodel/{source|target}/{id}`
#   로 갈린다. 목록에서 온 id 를 그대로 `/model/{id}` 에 넣으면 **아무 일도 일어나지 않고 성공처럼
#   끝난다** — 지웠다고 믿은 채로 촬영에 들어가게 된다.
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

# 종류마다 경로가 다르므로 목록에서 종류를 함께 읽어 짝을 맞춘다.
m=0
for pair in $(for t in true false; do
    curl -s -u "$AUTH" "$DF/model/$t" | python3 -c "
import sys,json
target = '$t' == 'true'
for x in json.load(sys.stdin) or []:
    kind = x.get('modelType')
    if kind == 'CloudModel':        path = 'cloudmodel'
    elif kind == 'OnPremiseModel':  path = 'onpremmodel'
    elif kind == 'SoftwareModel':   path = 'softwaremodel/' + ('target' if target else 'source')
    else:                           continue
    print(path + '|' + x['id'])
"
  done); do
  path="${pair%%|*}"; id="${pair##*|}"
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -u "$AUTH" "$DF/$path/$id")
  [ "$code" = "200" ] && m=$((m+1)) || echo "    실패($code) $path/$id"
done
echo "  모델          $m 건 삭제"

w=0
for id in $(curl -s "$CC/workflow" | python3 -c "
import sys,json
d=json.load(sys.stdin); ws=d if isinstance(d,list) else (d.get('workflows') or [])
for x in ws or []: print(x['id'])" 2>/dev/null); do
  curl -s -o /dev/null -X DELETE "$CC/workflow/$id" && w=$((w+1))
done
echo "  워크플로우    $w 건 삭제"

echo "  남은 인프라   $(curl -s -u "$AUTH" "$TB/ns/mig01/infra?option=id")"
REMOTE
