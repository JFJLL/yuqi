#!/usr/bin/env bash
# deploy/scripts/health-check.sh — 健康检查 (真实端点)
# 检查: PocketBase /api/health, ASR Gateway /health, Worker 进程存活
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PB_URL="${PB_URL:-http://127.0.0.1:7040}"
ASR_URL="${ASR_URL:-http://127.0.0.1:18084}"
fail=0

say_ok()  { printf '  [ok] %s\n' "$1"; }
say_bad() { printf '  [!!] %s\n' "$1"; fail=1; }

echo "== 健康检查 =="

# PocketBase
if curl -sf -m 5 "${PB_URL}/api/health" >/dev/null 2>&1; then
  say_ok "PocketBase ${PB_URL}/api/health"
else
  say_bad "PocketBase 不健康: ${PB_URL}/api/health"
fi

# ASR Gateway
if curl -sf -m 5 "${ASR_URL}/health" >/dev/null 2>&1; then
  say_ok "ASR Gateway ${ASR_URL}/health"
else
  say_bad "ASR Gateway 不健康: ${ASR_URL}/health"
fi

# PM2 进程 (进程名与 ecosystem.config.cjs 一致)
if command -v pm2 >/dev/null 2>&1; then
  for proc in yuqi-pb yuqi-asr-gateway yuqi-oss-scanner yuqi-business-worker; do
    status="$(pm2 jlist 2>/dev/null | node -e "
      let d=''; process.stdin.on('data', c => d += c).on('end', () => {
        const list = JSON.parse(d || '[]')
        const p = list.find(x => x.name === '${proc}')
        console.log(p ? (p.pm2_env.status + ' (restarts=' + p.pm2_env.restart_time + ')') : 'missing')
      })
    " 2>/dev/null || echo missing)"
    if [ "${status}" = "missing" ]; then
      say_bad "PM2 进程缺失: ${proc}"
    else
      say_ok "PM2 ${proc}: ${status}"
    fi
  done
fi

echo
if [ "${fail}" -eq 0 ]; then
  echo "== 健康检查通过 =="
else
  echo "== 健康检查失败 ==" >&2
  exit 1
fi
