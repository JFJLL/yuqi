#!/usr/bin/env bash
# deploy/scripts/deploy.sh — 部署 (测试/生产通用)
# 用法:
#   ENV=test       deploy/scripts/deploy.sh   # 测试环境
#   ENV=production deploy/scripts/deploy.sh   # 生产环境
#
# 流程: 环境预检 -> 备份 pb_data -> 构建 -> PM2 启动/重载 -> Pre-cutover 健康检查 -> 清理遗留 Worker -> PM2 save -> Nginx 校验/重载 -> Final 健康检查
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

# 0.1 生产环境防护: 默认三进程架构必须保证 YUQI_EMBEDDED_WORKER 不为 0
if [ -f "${ENV_FILE}" ]; then
  set -a; source "${ENV_FILE}"; set +a
fi

if [ "${ENV_NAME}" = "production" ] && [ "${YUQI_EMBEDDED_WORKER:-1}" = "0" ]; then
  echo "  [!!] 错误: 生产环境默认三进程部署严禁设置 YUQI_EMBEDDED_WORKER=0 (将导致 processing_jobs 无人消费)" >&2
  exit 1
fi

# 1. 备份 pb_data (部署失败可回滚; 不自动删除数据)
bash "${ROOT}/deploy/scripts/backup.sh"

# 2. 构建
bash "${ROOT}/deploy/scripts/build.sh"

# 3. PM2 启动/重载 (首次部署使用 start, 已存在使用 reload)
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yuqi-pb >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs --update-env
  fi
fi

# 4. Pre-cutover 健康检查: 确保新版 Gateway 与内嵌 Worker 就绪后才允许切量
echo "== Pre-cutover health check =="
sleep 3
if [ "${ENV_NAME}" = "production" ]; then
  ENV="${ENV_NAME}" REQUIRE_EMBEDDED_WORKER=1 bash "${ROOT}/deploy/scripts/health-check.sh"
else
  ENV="${ENV_NAME}" bash "${ROOT}/deploy/scripts/health-check.sh"
fi

# 5. 安全清理旧版遗留的独立 yuqi-business-worker (仅在 Pre-cutover 成功后执行)
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yuqi-business-worker >/dev/null 2>&1; then
    echo "  [deploy] 内嵌 Worker 运行正常; 正在安全移除旧版独立 yuqi-business-worker..."
    pm2 stop yuqi-business-worker || {
      echo "  [warn] 停止遗留 yuqi-business-worker 警告"
    }
    pm2 delete yuqi-business-worker || {
      echo "  [error] 删除遗留 yuqi-business-worker 失败" >&2
      exit 1
    }
    echo "  [ok] 已安全清理遗留的 yuqi-business-worker"
  else
    echo "  [info] 未发现遗留的独立 yuqi-business-worker 进程"
  fi

  # 6. 保存 PM2 进程拓扑 (确保重启后为新 3 进程配置)
  pm2 save
fi

# 7. Nginx 校验 + 重载 (仅在安装了 nginx 时执行)
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  nginx -s reload
else
  echo "  [info] nginx 未找到, 跳过 nginx 校验与重载"
fi

# 8. Final 最终端到端健康检查
echo "== Final health check =="
if [ "${ENV_NAME}" = "production" ]; then
  ENV="${ENV_NAME}" REQUIRE_EMBEDDED_WORKER=1 bash "${ROOT}/deploy/scripts/health-check.sh"
else
  ENV="${ENV_NAME}" bash "${ROOT}/deploy/scripts/health-check.sh"
fi

echo "== 部署完成 (${ENV_NAME}) =="
