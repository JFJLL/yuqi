// PM2 ecosystem for yuqi (https://yuqi.red-magic.cn)
//
// 进程配置 (Phase 1.0.1 默认精简为 3 个进程):
//   - yuqi-pb          : PocketBase 数据库与 API, 127.0.0.1:7040
//   - yuqi-asr-gateway : ASR HTTP 上传/转写网关 + ASR Poller + 内嵌 Business Worker 循环, 127.0.0.1:18084
//   - yuqi-oss-scanner : OSS 录音定时扫描与自动提交 ASR
//   (注: processing_jobs 业务消费循环默认内嵌于 yuqi-asr-gateway 运行; 如需单独扩容可另行运行 pnpm worker)
//
// 用法:
//   pnpm install && pnpm build
//   把 PocketBase linux 二进制放到 vibex-local/bin/linux/pocketbase
//   pm2 start ecosystem.config.cjs && pm2 save
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const envFile = process.env.ENV === 'production' || process.env.NODE_ENV === 'production'
  ? path.join(ROOT, '.env.production')
  : (fs.existsSync(path.join(ROOT, '.env.production')) ? path.join(ROOT, '.env.production') : path.join(ROOT, '.env.test'))

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[key] = val
    }
  }
  return env
}

const loadedEnv = parseEnv(envFile)

module.exports = {
 apps: [
    {
      name: 'yuqi-pb',
      script: path.join(ROOT, 'vibex-local', 'bin', 'linux', 'pocketbase'),
      interpreter: 'none',
      cwd: path.join(ROOT, 'pocketbase'),
      // PocketBase resolves these directories relative to the executable by
      // default. Keep the project-owned hooks and migrations explicit so the
      // runtime path does not depend on where the binary is stored.
      args: [
        'serve',
        '--http=127.0.0.1:7040',
        `--hooksDir=${path.join(ROOT, 'pocketbase', 'pb_hooks')}`,
        `--migrationsDir=${path.join(ROOT, 'pocketbase', 'pb_migrations')}`,
      ].join(' '),
      max_memory_restart: '300M',
      autorestart: true,
      env: loadedEnv,
    },
    {
      name: 'yuqi-asr-gateway',
      script: path.join(ROOT, 'server', 'asr-gateway.mjs'),
      interpreter: 'node',
      cwd: ROOT,
      max_memory_restart: '250M',
      autorestart: true,
      env: loadedEnv,
    },
    {
      name: 'yuqi-oss-scanner',
      script: path.join(ROOT, 'server', 'oss-scanner.mjs'),
      interpreter: 'node',
      cwd: ROOT,
      max_memory_restart: '200M',
      autorestart: true,
      env: loadedEnv,
    },
  ],
}
