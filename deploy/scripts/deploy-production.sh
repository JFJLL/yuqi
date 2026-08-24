#!/usr/bin/env bash
# 生产环境部署: 备份 -> 构建 -> 迁移 -> 重启 -> 健康检查 (失败自动回滚提示)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

[ "${ALLOW_PRODUCTION_DEPLOY:-}" = "true" ] || { echo "请显式设置 ALLOW_PRODUCTION_DEPLOY=true"; exit 1; }

bash deploy/scripts/check-env.sh
bash deploy/scripts/backup.sh
bash deploy/scripts/build.sh
bash deploy/scripts/migrate.sh

echo "==> 重启生产进程 (PM2)"
pm2 reload yuqi-api --update-env
pm2 reload yuqi-worker --update-env 2>/dev/null || true
pm2 reload yuqi-scheduler --update-env 2>/dev/null || true
pm2 save >/dev/null 2>&1 || true

if ! API_URL="${API_URL:-http://127.0.0.1:9000}" bash deploy/scripts/health-check.sh; then
  echo "健康检查失败, 请执行 deploy/scripts/rollback.sh 回滚"
  exit 1
fi
echo "生产部署完成 ✔"
