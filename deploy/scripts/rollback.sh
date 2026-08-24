#!/usr/bin/env bash
# 回滚: 用上一发布版本重启 (发布流程应保留上一发布目录/镜像)
set -euo pipefail

ENV_NAME="${1:-production}"  # production / test

echo "==> 回滚 $ENV_NAME 到上一发布版本"
# 若使用 PM2 多实例部署, 上一版本通常保留在 releases/ 目录并软链到当前:
#   ln -sfn "$(cat releases/previous)" current && pm2 reload yuqi-api
if [ -f "releases/previous" ] && [ -d "releases/$(cat releases/previous)" ]; then
  ln -sfn "releases/$(cat releases/previous)" current
  pm2 reload "yuqi-api${ENV_NAME:+-$ENV_NAME}" --update-env
  pm2 reload "yuqi-worker${ENV_NAME:+-$ENV_NAME}" --update-env 2>/dev/null || true
  pm2 reload "yuqi-scheduler${ENV_NAME:+-$ENV_NAME}" --update-env 2>/dev/null || true
  echo "回滚完成 ✔"
else
  echo "未找到上一发布版本, 请手动回滚 (数据库迁移如需降级请人工评估)"
  exit 1
fi
