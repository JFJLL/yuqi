#!/usr/bin/env bash
# 健康检查: API / 数据库 / 关键端点; 失败返回非零 (供部署流程触发回滚)
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:9000}"
MAX_RETRY="${MAX_RETRY:-5}"
SLEEP="${SLEEP:-3}"

for i in $(seq 1 "$MAX_RETRY"); do
  if curl -fsS "$API_URL/healthz" >/dev/null 2>&1; then
    echo "健康检查通过 ✔ ($API_URL)"
    exit 0
  fi
  echo "等待服务就绪 ($i/$MAX_RETRY)..."
  sleep "$SLEEP"
done

echo "健康检查失败 ✘ ($API_URL)"
exit 1
