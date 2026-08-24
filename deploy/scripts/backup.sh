#!/usr/bin/env bash
# 备份 PostgreSQL + 输出 OSS 对象清单 (不删除任何线上数据)
set -euo pipefail

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-./backups/$STAMP}"
mkdir -p "$BACKUP_DIR"

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-yuqi_prod}"
PG_USER="${PG_USER:-yuqi}"

echo "==> pg_dump -> $BACKUP_DIR/yuqi.sql.gz"
pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" | gzip > "$BACKUP_DIR/yuqi.sql.gz"

echo "==> OSS 对象清单 -> $BACKUP_DIR/oss-manifest.txt"
if command -v ossutil >/dev/null 2>&1 && [ -n "${OSS_BUCKET:-}" ]; then
  ossutil ls "oss://$OSS_BUCKET/recordings/" > "$BACKUP_DIR/oss-manifest.txt" 2>/dev/null || \
    echo "(ossutil 未配置, 跳过 OSS 清单)" > "$BACKUP_DIR/oss-manifest.txt"
else
  echo "(ossutil 未配置, 跳过 OSS 清单)" > "$BACKUP_DIR/oss-manifest.txt"
fi

echo "备份完成: $BACKUP_DIR"
