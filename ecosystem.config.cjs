// PM2 ecosystem for yuqi (https://yuqi.red-magic.cn)
//
// 两个进程:
//   - yuqi-pb   : PocketBase, 127.0.0.1:7040, cwd=pocketbase/ 让它按 cwd 解析
//                 pb_data / pb_migrations / pb_hooks
//   - yuqi-web  : vite preview 托管 dist/, 127.0.0.1:8040 (需先 pnpm build)
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
    {
      name: 'yuqi-web',
      script: path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
      cwd: ROOT,
      args: 'preview --host 127.0.0.1 --port 8040 --strictPort',
      max_memory_restart: '300M',
      autorestart: true,
    },
  ],
}
