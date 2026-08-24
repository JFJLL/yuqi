#!/usr/bin/env bash
# 构建前端静态产物
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> pnpm install (冻结 lockfile)"
pnpm install --frozen-lockfile

echo "==> pnpm build -> dist/"
pnpm build

echo "前端构建完成 ✔"
