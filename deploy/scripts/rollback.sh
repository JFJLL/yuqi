#!/usr/bin/env bash
# deploy/scripts/rollback.sh — 回滚
#  1) 恢复上一版 dist (dist.prev)
#  2) 恢复最近的 pb_data 备份 (deploy/scripts/backup.sh 生成)
# 进程名与 ecosystem.config.cjs 完全一致。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

# 1. dist 回滚
if [ -d dist.prev ]; then
  rm -rf dist.rollback
  mv dist dist.rollback 2>/dev/null || true
  mv dist.prev dist
  echo "== dist 已回滚 (旧版保留在 dist.rollback) =="
else
  echo "!! 无 dist.prev, 跳过前端回滚" >&2
fi

# 2. pb_data 回滚 (取最新备份)
LATEST="$(ls -1d "${ROOT}/backups"/pb_data-* 2>/dev/null | sort | tail -n 1 || true)"
if [ -z "${LATEST}" ]; then
  echo "!! 无 pb_data 备份, 跳过数据回滚 (绝不删除现有数据)" >&2
  exit 1
fi

PB_DATA_DIRS=(
  "${ROOT}/pocketbase/pb_data"
  "${ROOT}/vibex-local/pb_data"
)
PB_DATA=""
for d in "${PB_DATA_DIRS[@]}"; do
  if [ -d "${d}" ]; then
    PB_DATA="${d}"
    break
  fi
done
[ -z "${PB_DATA}" ] && { echo "!! 未找到 pb_data 目录" >&2; exit 1; }

# 先停服务再替换数据 (避免写库中替换)
pm2 stop yuqi-pb
sleep 2
rm -rf "${PB_DATA}.old"
mv "${PB_DATA}" "${PB_DATA}.old"
cp -a "${LATEST}" "${PB_DATA}"
pm2 start yuqi-pb --update-env
sleep 3

# 3. 重启其余进程
pm2 reload ecosystem.config.cjs --update-env
pm2 save

echo "== 回滚完成 (数据来自 ${LATEST}) =="
echo "  旧数据保留在 ${PB_DATA}.old, 确认无误后可手动清理。"
