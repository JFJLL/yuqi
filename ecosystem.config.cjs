// PM2 ecosystem for yuqi (https://yuqi.red-magic.cn)
//
// 进程配置:
//   - yuqi-pb : PocketBase 数据库与 API, 127.0.0.1:7040
//   (前端网页已改为 Nginx 直接托管 dist/ 静态目录，无需再启动 Node 进程)
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
      // AI 功能需要时取消注释, 填入你自己的 key (来自 .env.local)
      // env: {
      //   RH_API_KEY: '',
      // },
    },
  ],
}
