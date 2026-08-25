#!/usr/bin/env bash
# deploy/scripts/health-check.sh — 健康检查 (真实端点)
# 检查: PocketBase /api/health, ASR Gateway /health (根据 ENV 校验), Worker 进程存活与状态
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_NAME="${ENV:-production}"
PB_URL="${PB_URL:-http://127.0.0.1:7040}"
ASR_URL="${ASR_URL:-http://127.0.0.1:18084}"
fail=0

say_ok()  { printf '  [ok] %s\n' "$1"; }
say_bad() { printf '  [!!] %s\n' "$1"; fail=1; }

echo "== 健康检查 (环境: ${ENV_NAME}) =="

# PocketBase
if curl -sf -m 5 "${PB_URL}/api/health" >/dev/null 2>&1; then
  say_ok "PocketBase ${PB_URL}/api/health"
else
  say_bad "PocketBase 不健康: ${PB_URL}/api/health"
fi

# ASR Gateway: 校验 JSON 内容，生产环境禁止 degraded/unconfigured/mock 假通过
asr_health_raw="$(curl -sf -m 5 "${ASR_URL}/health" 2>/dev/null || echo "")"
if [ -n "${asr_health_raw}" ]; then
  extra_args=()
  if [ "${REQUIRE_EMBEDDED_WORKER:-0}" = "1" ]; then
    extra_args+=(--require-embedded-worker)
  fi
  if node "${ROOT}/scripts/check-asr-health.mjs" --env "${ENV_NAME}" "${extra_args[@]}" --json "${asr_health_raw}" >/dev/null 2>&1; then
    say_ok "ASR Gateway ${ASR_URL}/health (${ENV_NAME} 模式校验通过)"
  else
    asr_reason="$(node "${ROOT}/scripts/check-asr-health.mjs" --env "${ENV_NAME}" "${extra_args[@]}" --json "${asr_health_raw}" 2>&1 || true)"
    say_bad "ASR Gateway 未达到 ${ENV_NAME} 健康要求: ${asr_reason}"
  fi
else
  say_bad "ASR Gateway 不可达: ${ASR_URL}/health"
fi

# PM2 进程状态检查 (必须处于 online 状态)
if command -v pm2 >/dev/null 2>&1; then
  for proc in yuqi-pb yuqi-asr-gateway yuqi-oss-scanner; do
    status="$(pm2 jlist 2>/dev/null | node -e "
      let d=''; process.stdin.on('data', c => d += c).on('end', () => {
        try {
          const list = JSON.parse(d || '[]')
          const p = list.find(x => x.name === '${proc}')
          if (!p) { console.log('missing'); return; }
          const st = p.pm2_env.status || 'unknown'
          const restarts = Number(p.pm2_env.restart_time || 0)
          console.log(st + ':' + restarts)
        } catch(_) { console.log('error'); }
      })
    " 2>/dev/null || echo missing)"
    if [ "${status}" = "missing" ] || [ "${status}" = "error" ]; then
      say_bad "PM2 进程缺失: ${proc}"
    else
      pm2_status="$(echo "${status}" | cut -d: -f1)"
      pm2_restarts="$(echo "${status}" | cut -d: -f2)"
      if [ "${pm2_status}" = "online" ]; then
        if [ "${pm2_restarts}" -gt 10 ]; then
          say_ok "PM2 ${proc}: online (警告: restarts=${pm2_restarts})"
        else
          say_ok "PM2 ${proc}: online (restarts=${pm2_restarts})"
        fi
      else
        say_bad "PM2 ${proc} 状态非 online: ${pm2_status} (restarts=${pm2_restarts})"
      fi
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
