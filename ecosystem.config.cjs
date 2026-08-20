// PM2 ecosystem for yuqi (https://yuqi.red-magic.cn)
//
// 进程配置:
//   - yuqi-pb          : PocketBase 数据库与 API, 127.0.0.1:7040
//   - yuqi-asr-gateway : ASR 上传转发与后台轮询, 127.0.0.1:18084
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
      args: 'serve --http=127.0.0.1:7040',
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
      // ASR_BASE_URL=http://127.0.0.1:<frp-visitor-port>
      // ASR_SERVICE_TOKEN=<long-random-token>
      // POCKETBASE_URL=http://127.0.0.1:7040
      // YUQI_ASR_GATEWAY_PORT=18084
    },
  ],
}
