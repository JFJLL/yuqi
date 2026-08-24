#!/usr/bin/env bash
# deploy/scripts/deploy.sh — 部署 (测试/生产通用)
# 用法:
#   ENV=test       deploy/scripts/deploy.sh   # 测试环境
#   ENV=production deploy/scripts/deploy.sh   # 生产环境
#
# 流程: 环境预检 -> 备份 pb_data -> 构建 -> PM2 重载 -> Nginx 校验/重载 -> 健康检查
set -euo pipefail

ENV_NAME="${ENV:-test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

if [ "${ENV_NAME}" = "production" ]; then
  ENV_FILE="${ROOT}/.env.production"
else
  ENV_FILE="${ROOT}/.env.test"
fi

echo "== 部署环境: ${ENV_NAME} (env file: ${ENV_FILE}) =="

# 0. 预检
bash "${ROOT}/deploy/scripts/check-env.sh"

# 1. 备份 pb_data (部署失败可回滚; 不自动删除数据)
bash "${ROOT}/deploy/scripts/backup.sh"

# 2. 构建
bash "${ROOT}/deploy/scripts/build.sh"

# 3. PM2 重载 (环境变量来自环境文件, --update-env 同步)
if [ -f "${ENV_FILE}" ]; then
  set -a; source "${ENV_FILE}"; set +a
fi
pm2 reload ecosystem.config.cjs --update-env
pm2 save

# 4. Nginx 校验 + 重载
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  nginx -s reload
fi

# 5. 健康检查 (真实端点)
sleep 3
bash "${ROOT}/deploy/scripts/health-check.sh"

echo "== 部署完成 (${ENV_NAME}) =="
