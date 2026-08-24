#!/usr/bin/env bash
# 部署前环境检查: 依赖 / 数据库可达 / 迁移可执行
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ROOT/backend"

echo "[1/4] 检查运行时依赖..."
command -v python >/dev/null 2>&1 || { echo "缺少 python"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "缺少 node"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "缺少 pnpm"; exit 1; }
"$BACKEND/.venv/Scripts/python" --version >/dev/null 2>&1 || "$BACKEND/.venv/bin/python" --version >/dev/null 2>&1 \
  || { echo "后端 venv 不存在, 请先执行 install.sh"; exit 1; }

echo "[2/4] 检查数据库连接..."
PYTHON_BIN=""
if [ -x "$BACKEND/.venv/Scripts/python" ]; then PYTHON_BIN="$BACKEND/.venv/Scripts/python"; else PYTHON_BIN="$BACKEND/.venv/bin/python"; fi
(cd "$BACKEND" && "$PYTHON_BIN" -c "from app.core.config import get_settings; get_settings().database_url" >/dev/null 2>&1) \
  || { echo "配置加载失败 (检查 .env / 环境变量)"; exit 1; }

echo "[3/4] 检查迁移链..."
(cd "$BACKEND" && "$PYTHON_BIN" -m alembic heads >/dev/null 2>&1) || { echo "Alembic 不可用"; exit 1; }

echo "[4/4] 检查前端依赖..."
[ -d "$ROOT/node_modules" ] || { echo "node_modules 缺失, 请先 pnpm install"; exit 1; }

echo "环境检查通过 ✔"
