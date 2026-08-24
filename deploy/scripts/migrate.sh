#!/usr/bin/env bash
# 执行数据库迁移 (失败即退出, 阻止发布)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ROOT/backend"
PYTHON_BIN=""
if [ -x "$BACKEND/.venv/Scripts/python" ]; then PYTHON_BIN="$BACKEND/.venv/Scripts/python"; else PYTHON_BIN="$BACKEND/.venv/bin/python"; fi

echo "==> alembic upgrade head"
(cd "$BACKEND" && "$PYTHON_BIN" -m alembic upgrade head)

echo "==> alembic check (模型与迁移一致性)"
(cd "$BACKEND" && "$PYTHON_BIN" -m alembic check)

echo "迁移完成 ✔"
