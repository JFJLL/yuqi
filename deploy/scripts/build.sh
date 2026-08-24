#!/usr/bin/env bash
# 构建前端静态产物
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> pnpm install (冻结 lockfile)"
pnpm install --frozen-lockfile

echo "==> pnpm build -> dist/ (管理端)"
pnpm build

echo "==> pnpm build:employee-h5 -> apps/employee-h5/dist (员工 H5)"
pnpm build:employee-h5

echo "前端构建完成 ✔"
