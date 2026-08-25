#!/usr/bin/env bash
# deploy/scripts/deploy-production.sh — 生产环境部署 (需显式确认)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "${ENV:-}" = "production" ]; then
  # 已在 deploy.sh 中由 ENV=production 触发, 不再二次确认 (非交互脚本)
  exec bash "${ROOT}/deploy/scripts/deploy.sh" "$@"
fi

echo "即将在生产环境执行部署。请确认:"
echo "  1) 已通过备份与灰度验证"
echo "  2) .env.production 环境变量就绪"
read -r -p "输入 yes 继续: " answer
if [ "${answer}" != "yes" ]; then
  echo "已取消。"
  exit 1
fi
ENV=production bash "${ROOT}/deploy/scripts/deploy.sh" "$@"
