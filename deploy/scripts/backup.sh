#!/usr/bin/env bash
# deploy/scripts/backup.sh — 备份 PocketBase 数据 (pb_data)
# 用法: deploy/scripts/backup.sh [保留份数, 默认 7]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KEEP="${1:-7}"
BACKUP_ROOT="${ROOT}/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/pb_data-${STAMP}"

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

if [ -z "${PB_DATA}" ]; then
  echo "!! 未找到 pb_data 目录 (检查 pocketbase/pb_data 或 vibex-local/pb_data)" >&2
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"
echo "== 备份 ${PB_DATA} -> ${DEST} =="
cp -a "${PB_DATA}" "${DEST}"

# 清理旧备份 (仅删备份目录, 绝不触碰 pb_data 本体)
ls -1d "${BACKUP_ROOT}"/pb_data-* 2>/dev/null | sort | head -n -"${KEEP}" | while read -r old; do
  echo "  清理旧备份: ${old}"
  rm -rf "${old}"
done

echo "== 备份完成: ${DEST} =="
