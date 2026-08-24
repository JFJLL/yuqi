#!/usr/bin/env bash
# 导出 OpenAPI JSON (供 openapi-typescript 生成前端类型)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
"$ROOT/backend/.venv/Scripts/python.exe" "$ROOT/backend/scripts/export_openapi.py" "$ROOT/openapi.json"
