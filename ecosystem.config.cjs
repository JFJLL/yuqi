// PM2 ecosystem for yuqi (https://yuqi.red-magic.cn)
//
// 进程配置:
//   - yuqi-pb              : PocketBase 数据库与 API, 127.0.0.1:7040
//   - yuqi-asr-gateway     : ASR 上传转发与后台轮询, 127.0.0.1:18084
//   - yuqi-oss-scanner     : OSS 录音定时扫描与自动提交 ASR
//   - yuqi-business-worker : 一期后台任务 (RISK_ANALYSIS 等, 数据库任务表轮询)
//   (前端网页已改为 Nginx 直接托管 dist/ 静态目录)
//
// 用法:
//   pnpm install && pnpm build
//   把 PocketBase linux 二进制放到 vibex-local/bin/linux/pocketbase
//   pm2 start ecosystem.config.cjs && pm2 save
const path = require('path')

const ROOT = __dirname

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
    },
    {
      name: 'yuqi-asr-gateway',
      script: path.join(ROOT, 'server', 'asr-gateway.mjs'),
      interpreter: 'node',
      cwd: ROOT,
      max_memory_restart: '250M',
      autorestart: true,
      // 请在云服务器的 PM2 环境或 systemd EnvironmentFile 中设置，勿提交真实值：
      // ASR_BASE_URL=http://127.0.0.1:18082
      // ASR_SERVICE_TOKEN=<long-random-token>
      // POCKETBASE_URL=http://127.0.0.1:7040
      // YUQI_ASR_GATEWAY_PORT=18084
    },
    {
      name: 'yuqi-oss-scanner',
      script: path.join(ROOT, 'server', 'oss-scanner.mjs'),
      interpreter: 'node',
      cwd: ROOT,
      max_memory_restart: '200M',
      autorestart: true,
      // 与 yuqi-asr-gateway 共用同一份环境文件，另需 OSS_* 与 SCAN_INTERVAL_MS：
      // OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
      // OSS_BUCKET=redmagic
      // OSS_PREFIX=audio/
      // OSS_ACCESS_KEY_ID=<...>
      // OSS_ACCESS_KEY_SECRET=<...>
    },
    {
      name: 'yuqi-business-worker',
      script: path.join(ROOT, 'server', 'business-worker.mjs'),
      interpreter: 'node',
      cwd: ROOT,
      max_memory_restart: '250M',
      autorestart: true,
      // 依赖内部服务身份连接 PocketBase, 环境变量由服务器环境文件提供 (勿提交真实值):
      // YUQI_PB_URL=http://127.0.0.1:7040
      // YUQI_SERVICE_TOKEN=<与 PocketBase 环境一致的内部服务 Token>
      // YUQI_SERVICE_TENANT_CODE=demo
      // YUQI_POLL_INTERVAL_MS=3000
    },
  ],
}
