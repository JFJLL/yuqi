#!/usr/bin/env bash
# deploy/scripts/deploy.sh — 部署 (测试/生产通用)
# 用法:
#   ENV=test       deploy/scripts/deploy.sh   # 测试环境
#   ENV=production deploy/scripts/deploy.sh   # 生产环境
#
# 流程: 环境预检 -> 备份 pb_data -> 构建 -> PM2 启动/重载 -> Nginx 校验/重载 -> 健康检查
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

# 0. 预检 (传入 ENV)
ENV="${ENV_NAME}" bash "${ROOT}/deploy/scripts/check-env.sh"

# 1. 备份 pb_data (部署失败可回滚; 不自动删除数据)
bash "${ROOT}/deploy/scripts/backup.sh"

# 2. 构建
bash "${ROOT}/deploy/scripts/build.sh"

# 3. PM2 启动/重载 (首次部署使用 start, 已存在使用 reload)
if [ -f "${ENV_FILE}" ]; then
  set -a; source "${ENV_FILE}"; set +a
fi

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yuqi-pb >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs --update-env
  fi

  # 清理旧版遗留的独立 yuqi-business-worker (Phase 1.0.1 已合并入 yuqi-asr-gateway 进程)
  if pm2 describe yuqi-business-worker >/dev/null 2>&1; then
    echo "  [info] 发现遗留的独立 yuqi-business-worker 进程, 正在清理..."
    pm2 stop yuqi-business-worker >/dev/null 2>&1 || true
    pm2 delete yuqi-business-worker >/dev/null 2>&1 || true
  fi

  pm2 save
fi

# 4. Nginx 校验 + 重载 (仅在安装了 nginx 时执行)
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  nginx -s reload
else
  echo "  [info] nginx 未找到, 跳过 nginx 校验与重载"
fi

# 5. 健康检查 (真实端点, 传递当前环境)
sleep 3
ENV="${ENV_NAME}" bash "${ROOT}/deploy/scripts/health-check.sh"

echo "== 部署完成 (${ENV_NAME}) =="
