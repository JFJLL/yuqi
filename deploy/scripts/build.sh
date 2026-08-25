#!/usr/bin/env bash
# deploy/scripts/build.sh — 安装依赖并构建前端, 构建前保留上一版 dist
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== 安装依赖 =="
pnpm install --frozen-lockfile

echo "== lint / typecheck =="
pnpm lint
pnpm typecheck

echo "== 构建 =="
if [ -d dist ]; then
  rm -rf dist.prev
  mv dist dist.prev
  echo "  上一版 dist 已保留为 dist.prev"
fi
pnpm build
echo "== 构建完成: $(ls -1 dist | wc -l) 个条目 =="
