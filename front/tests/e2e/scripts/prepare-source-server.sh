#!/usr/bin/env bash
#
# 소스 서버(온프렘 대체) 준비 — 마이그레이션할 소프트웨어를 올려 둔다.
#
# 소프트웨어 마이그레이션 시나리오는 "소스에서 돌던 소프트웨어가 타깃으로 옮겨졌는가"를 확인한다.
# 그러므로 소스에 옮길 소프트웨어가 *실제로 돌고 있어야* 한다. 아무것도 없는 소스로 돌리면
# 마이그레이션이 옮길 게 없고, 테스트는 아무것도 증명하지 못한 채 통과해 버린다.
#
# 여기서는 nginx를 올린다 — 부하테스트 대상이기도 해서 그대로 이어진다.
#
# 사용법:
#   TEST_SOURCE_IP=1.2.3.4 TEST_SOURCE_KEY=~/.ssh/e2e-source.pem ./prepare-source-server.sh
#
set -euo pipefail

IP="${TEST_SOURCE_IP:?TEST_SOURCE_IP 가 필요하다 (소스 서버 공인 IP)}"
KEY="${TEST_SOURCE_KEY:?TEST_SOURCE_KEY 가 필요하다 (소스 서버 SSH 개인키 경로)}"
USER="${TEST_SOURCE_SSH_USER:-ubuntu}"

echo "[prepare] ${USER}@${IP} 에 nginx 설치"

ssh -o StrictHostKeyChecking=no -i "${KEY}" "${USER}@${IP}" bash -s <<'REMOTE'
set -e
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
# 마이그레이션된 서버와 구분되도록 표식을 남긴다.
echo "<h1>cm-butterfly e2e source</h1><p>migrated-from-source</p>" | sudo tee /var/www/html/index.html >/dev/null
sudo systemctl enable --now nginx
echo "[prepare] nginx: $(systemctl is-active nginx)"
curl -sf -o /dev/null http://localhost/ && echo "[prepare] http 200 OK"
REMOTE

echo "[prepare] 완료 — cm-honeybee 소프트웨어 수집에 nginx 가 잡힌다(패키지 + 바이너리)."
