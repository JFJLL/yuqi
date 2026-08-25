#!/usr/bin/env bash
# deploy/scripts/deploy-test.sh — 测试环境部署
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV=test bash "${ROOT}/deploy/scripts/deploy.sh" "$@"
