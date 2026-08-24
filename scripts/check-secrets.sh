#!/usr/bin/env bash
# 禁止提交生产密钥检查: 在暂存/已跟踪文本中扫描常见密钥形态。
# 用法: bash scripts/check-secrets.sh [--staged|--all]
# 仓库内真实密钥应通过环境变量 + .env.example 模板管理, 不允许出现在源码里。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---all}"

if [ "$MODE" = "--staged" ]; then
  FILES=$(git -C "$ROOT" diff --cached --name-only --diff-filter=ACM)
else
  FILES=$(git -C "$ROOT" ls-files)
fi

# 常见密钥形态 (组合单次 grep)
PATTERN='AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-[0-9A-Za-z]{20,}|ASR_SERVICE_TOKEN=[^<[:space:]]{16,}|OSS_ACCESS_KEY_SECRET=[^<[:space:]]{16,}|POCKETBASE_SUPERUSER_PASS=[^<[:space:]]{8,}'

fail=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  full="$ROOT/$file"
  [ -f "$full" ] || continue
  case "$file" in
    *.lock|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.mp3|*.wav|*.m4a|*.pdf) continue ;;
  esac
  # 命中后再过滤允许行 (示例/占位符)
  hits=$(grep -nE "$PATTERN" "$full" 2>/dev/null | grep -viE 'example|(<[^>]*>)|changeme|your-|xxx|placeholder' || true)
  if [ -n "$hits" ]; then
    while IFS= read -r line; do
      echo "SECRET-LIKE: $file:$line"
    done <<< "$hits"
    fail=1
  fi
done <<< "$FILES"

if [ "$fail" = "1" ]; then
  echo "✖ 检测到疑似密钥, 已阻止提交。请改用环境变量 + .env.example 模板。"
  exit 1
fi
echo "✔ 未检测到疑似密钥。"
