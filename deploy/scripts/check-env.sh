#!/usr/bin/env bash
# deploy/scripts/check-env.sh — 环境预检 (Ubuntu)
# 检查 Node / pnpm / PocketBase 二进制 / PM2 / Nginx, 不检查 PostgreSQL/Redis。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fail=0

say_ok()  { printf '  [ok] %s\n' "$1"; }
say_bad() { printf '  [!!] %s\n' "$1"; fail=1; }

echo "== 环境预检 ($(hostname)) =="

# Node
if command -v node >/dev/null 2>&1; then
  say_ok "node $(node -v)"
else
  say_bad "未找到 node, 请先安装 Node 20+ (https://nodejs.org)"
fi

# pnpm
if command -v pnpm >/dev/null 2>&1; then
  say_ok "pnpm $(pnpm -v)"
else
  say_bad "未找到 pnpm (corepack enable 或 npm i -g pnpm)"
fi

# PocketBase 二进制 (部署目录)
PB_BIN="${ROOT}/vibex-local/bin/linux/pocketbase"
if [ -x "${PB_BIN}" ]; then
  PB_VERSION="$("${PB_BIN}" --version 2>/dev/null || echo unknown)"
  say_ok "pocketbase ${PB_VERSION} (${PB_BIN})"
else
  say_bad "缺少 PocketBase Linux 二进制: ${PB_BIN} (请放置后 chmod +x)"
fi

# PM2
if command -v pm2 >/dev/null 2>&1; then
  say_ok "pm2 $(pm2 -v 2>/dev/null || echo present)"
else
  say_bad "未找到 pm2 (npm i -g pm2)"
fi

# Nginx
if command -v nginx >/dev/null 2>&1; then
  say_ok "nginx $(nginx -v 2>&1 | sed 's/.*nginx\///')"
else
  say_bad "未找到 nginx"
fi

# 部署脚本必需环境变量
if [ -f "${ROOT}/.env.production" ]; then
  say_ok "找到 .env.production"
else
  say_bad "缺少 ${ROOT}/.env.production (请按 deploy/asr-gateway.env.example 提供真实环境变量)"
fi

# 端口占用 (7040 PB / 18084 ASR Gateway)
for port in 7040 18084; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    say_ok "端口 ${port} 已被监听 (预期)"
  else
    say_bad "端口 ${port} 未被监听 (部署前进程未运行属正常, 部署脚本会拉起)"
  fi
done

echo
if [ "${fail}" -eq 0 ]; then
  echo "== 预检通过 =="
else
  echo "== 预检存在缺失, 请先修复 ==" >&2
  exit 1
fi
