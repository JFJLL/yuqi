#!/usr/bin/env bash
# deploy/scripts/check-env.sh — 环境预检 (Ubuntu)
# 检查 Node / pnpm / PocketBase 二进制 / PM2 / Nginx, 不检查 PostgreSQL/Redis。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_NAME="${ENV:-test}"
fail=0

say_ok()  { printf '  [ok] %s\n' "$1"; }
say_bad() { printf '  [!!] %s\n' "$1"; fail=1; }

echo "== 环境预检 ($(hostname), ENV=${ENV_NAME}) =="

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
  say_ok "nginx 未安装或不可用 (本地测试环境可跳过, 生产环境由系统提供)"
fi

# 部署脚本必需环境变量 (按 ENV 检查 .env.production 或 .env.test)
if [ "${ENV_NAME}" = "production" ]; then
  TARGET_ENV_FILE="${ROOT}/.env.production"
else
  TARGET_ENV_FILE="${ROOT}/.env.test"
fi

if [ -f "${TARGET_ENV_FILE}" ]; then
  say_ok "找到环境文件 ${TARGET_ENV_FILE}"
else
  say_bad "缺少环境文件 ${TARGET_ENV_FILE} (请按 deploy/asr-gateway.env.example 提供)"
fi

# 端口占用检查 (7040 PB / 18084 ASR Gateway, 首次部署未启动属正常, 不阻断部署)
for port in 7040 18084; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    say_ok "端口 ${port} 已被监听"
  else
    say_ok "端口 ${port} 未监听 (空闲, 首次部署正常)"
  fi
done

echo
if [ "${fail}" -eq 0 ]; then
  echo "== 预检通过 =="
else
  echo "== 预检存在缺失, 请先修复 ==" >&2
  exit 1
fi
