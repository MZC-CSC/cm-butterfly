#!/usr/bin/env bash
#
# e2e.config 를 읽어 환경변수로 올린다. 각 스크립트 맨 앞에서 source 한다.
#
#   . "$(dirname "$0")/load-config.sh"
#
# ★ 이미 값이 있는 변수는 건드리지 않는다. 명령줄에서 준 값이 설정 파일보다 우선이다 —
#   평소엔 설정 파일대로 돌리고 한 번만 다른 환경을 겨눌 때 앞에 붙여 쓰는 방식이 된다.
#
# 파일이 없어도 조용히 넘어간다. 필요한 값이 비어 있는지는 각 스크립트가 판단한다.

__e2e_cfg="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/e2e.config"

if [ -f "$__e2e_cfg" ]; then
  while IFS= read -r __line || [ -n "$__line" ]; do
    case "$__line" in ''|\#*) continue ;; esac
    __key="${__line%%=*}"
    __val="${__line#*=}"
    case "$__key" in *[!A-Za-z0-9_]*|'') continue ;; esac

    # 감싼 따옴표를 벗긴다.
    case "$__val" in
      \"*\") __val="${__val#\"}"; __val="${__val%\"}" ;;
      \'*\') __val="${__val#\'}"; __val="${__val%\'}" ;;
    esac

    # 홈 경로 축약을 풀어 준다 — 설정 파일에 ~ 를 쓸 수 있게.
    case "$__val" in "~/"*) __val="$HOME/${__val#\~/}" ;; esac

    # 이미 설정된 것은 그대로 둔다.
    if [ -z "${!__key:-}" ]; then export "$__key=$__val"; fi
  done < "$__e2e_cfg"
fi

unset __e2e_cfg __line __key __val
