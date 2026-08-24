#!/usr/bin/env bash
# 首次安装: Python venv + 前端依赖 + 数据库建库
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ROOT/backend"

echo "==> 创建后端 venv 并安装依赖"
python -m venv "$BACKEND/.venv"
PYTHON_BIN="$BACKEND/.venv/Scripts/python"
[ -x "$PYTHON_BIN" ] || PYTHON_BIN="$BACKEND/.venv/bin/python"
(cd "$BACKEND" && "$PYTHON_BIN" -m pip install --upgrade pip >/dev/null && "$PYTHON_BIN" -m pip install -e ".[dev]" >/dev/null)

echo "==> 安装前端依赖"
(cd "$ROOT" && pnpm install)

echo "==> 数据库初始化"
if [ -n "${PG_DB:-}" ]; then
  createdb -h "${PG_HOST:-127.0.0.1}" -U "${PG_USER:-yuqi}" "${PG_DB}" 2>/dev/null || echo "(数据库已存在或需手动创建)"
fi
(cd "$BACKEND" && "$PYTHON_BIN" -m alembic upgrade head)

echo "安装完成 ✔ 请配置 backend/.env (密钥/DB/Redis/OSS) 后启动服务"
