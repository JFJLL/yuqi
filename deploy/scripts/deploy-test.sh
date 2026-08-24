#!/usr/bin/env bash
# 测试环境部署: 构建 -> 迁移 -> 重启 -> 健康检查
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

bash deploy/scripts/check-env.sh
bash deploy/scripts/build.sh
bash deploy/scripts/migrate.sh

echo "==> 重启测试环境进程 (PM2)"
pm2 reload yuqi-api-test --update-env 2>/dev/null || pm2 start deploy/pm2/ecosystem.test.config.cjs --only yuqi-api-test
pm2 reload yuqi-worker-test --update-env 2>/dev/null || true
pm2 reload yuqi-scheduler-test --update-env 2>/dev/null || true
pm2 save >/dev/null 2>&1 || true

API_URL="${API_URL:-http://127.0.0.1:9100}" bash deploy/scripts/health-check.sh
echo "测试环境部署完成 ✔"
