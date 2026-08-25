#!/usr/bin/env node
// check-secrets.mjs — 提交前安全检查脚本
//
// 用法:
//   node scripts/check-secrets.mjs            # 检查工作区已跟踪文件的密钥泄漏
//   node scripts/check-secrets.mjs --all      # 含未跟踪/忽略文件(仅本地自查)
//   node scripts/check-secrets.mjs --tech     # 额外检查禁止引入的技术栈痕迹
//
// 该脚本是门禁的一部分: pnpm lint / CI 中应调用一次, 发现疑似密钥立即失败。

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

// 与 .gitignore 保持一致, 不扫描的目录
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'templates',
  'vibex-local',
  'pocketbase/pb_data',
  'pocketbase/logs',
  'coverage',
])

// 密钥模式 (正则)
const SECRET_PATTERNS = [
  { name: 'aliyun access key', re: /\bLTAI[0-9A-Za-z]{12,}\b/ },
  { name: 'aws access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'github token', re: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/ },
  { name: 'generic bearer token', re: /(?:Authorization|Bearer)\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i },
  { name: 'stripe live secret', re: /\bsk_live_[0-9A-Za-z]{20,}\b/ },
  // 只匹配字面量密钥值: 排除 process.env.<VAR> / $VAR / <占位> / 空值等读取与模板写法
  { name: 'oss secret value', re: /OSS_ACCESS_KEY_SECRET\s*=\s*["']?[A-Za-z0-9+/=]{20,}["']?/ },
  { name: 'service token value', re: /(?:YUQI_SERVICE_TOKEN|ASR_SERVICE_TOKEN|POCKETBASE_ADMIN_PASSWORD)\s*=\s*["']?[A-Za-z0-9_-]{20,}["']?/ },
  { name: 'npm token', re: /\b(?:npm_|\/\/registry\.npmjs\.org\/:_authToken=)[0-9A-Za-z-]{20,}/ },
  { name: 'jdbc url', re: /jdbc:(?:mysql|postgresql):\/\/[^\s"']*(?::[^\s"']+@)/ },
  { name: 'redis url', re: /redis:\/\/[^\s"']*:[^\s"']*@/ },
  { name: 'generic password assignment', re: /(?:password|passwd)\s*[:=]\s*["'][^"']{8,}["']/i },
]

// 禁止引入的技术栈痕迹 (仅 --tech)
const FORBIDDEN_TECH = [
  { name: 'python backend', re: /\bfrom\s+fastapi\b|\bimport\s+fastapi\b|\buvicorn\b/ },
  { name: 'sqlalchemy', re: /\bsqlalchemy\b/ },
  { name: 'alembic', re: /\balembic\b/ },
  { name: 'celery/arq', re: /\bfrom\s+celery\b|\bimport\s+celery\b|\barq\b/ },
  { name: 'redis client', re: /\bimport\s+redis\b|\bfrom\s+redis\b/ },
  { name: 'postgres dsn', re: /postgres(?::\/\/|ql\+psycopg)/ },
  { name: 'django/flask app', re: /\bfrom\s+(?:django|flask)\b/ },
]

function trackedFiles() {
  return execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

function allFiles() {
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue
      if (IGNORE_DIRS.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) files.push(path.relative(ROOT, full))
    }
  }
  walk(ROOT)
  return files
}

function main() {
  const args = process.argv.slice(2)
  const includeAll = args.includes('--all')
  const checkTech = args.includes('--tech')
  const files = includeAll ? allFiles() : trackedFiles()

  let failed = false
  const binary = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.lock', '.map'])

  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase()
    if (binary.has(ext)) continue
    let content
    try {
      content = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    } catch {
      continue
    }
    for (const { name, re } of SECRET_PATTERNS) {
      const match = content.match(re)
      if (match) {
        failed = true
        console.error(`[SECRET] ${rel}: 疑似 ${name} 泄漏`)
      }
    }
    if (checkTech) {
      for (const { name, re } of FORBIDDEN_TECH) {
        if (re.test(content)) {
          failed = true
          console.error(`[TECH] ${rel}: 发现禁止技术栈痕迹: ${name}`)
        }
      }
    }
  }

  if (failed) {
    console.error('\n检查未通过: 请清除上述内容后再提交。')
    process.exit(1)
  }
  console.log('check-secrets: 未发现疑似密钥泄漏' + (checkTech ? ' 与禁止技术栈痕迹' : '') + ' ✓')
}

main()
