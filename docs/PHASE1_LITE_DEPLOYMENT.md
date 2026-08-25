# 一期轻量闭环 · 部署 (DEPLOYMENT)

## 目标进程 (Phase 1.0.1 默认仅以下 3 个)

| PM2 进程名 | 脚本 | 端口 |
|---|---|---|
| yuqi-pb | vibex-local/bin/linux/pocketbase serve | 127.0.0.1:7040 |
| yuqi-asr-gateway | server/asr-gateway.mjs (内嵌 Business Worker 循环) | 127.0.0.1:18084 |
| yuqi-oss-scanner | server/oss-scanner.mjs | - (定时) |

> **Phase 1.0.1 运维简化**：`processing_jobs` 业务任务消费循环（`RISK_ANALYSIS`、`SLA_SCAN`）默认内嵌于 `yuqi-asr-gateway` 进程中运行，默认生产拓扑精简为 3 个 PM2 进程。同时完整保留 `server/business-worker.mjs` 独立启动能力（可通过 `YUQI_EMBEDDED_WORKER=0` 及 `pnpm worker` 启动独立 Worker 扩容）。

不新增 Python 进程。环境变量只来自服务器环境文件 (.env.production 等, 不入 Git)。

## 环境变量 (服务器)

```
YUQI_ENV=production
YUQI_SERVICE_TOKEN=<random>          # PB hooks 与各进程共用
YUQI_SERVICE_TENANT_CODE=<tenant>    # 内部服务固定租户
POCKETBASE_URL=http://127.0.0.1:7040
ASR_BASE_URL=http://127.0.0.1:18082
ASR_SERVICE_TOKEN=<同 ASR 服务>
OSS_* (阿里云 OSS 只读凭证)
YUQI_ALLOW_DEMO_SEED=                # 生产必须为空
YUQI_DEV_FIXED_CODE=                 # 生产必须为空
```

## Nginx

- `/` → dist 静态 SPA (try_files → /index.html)
- `/employee/*` → 同样回退 index.html (SPA)
- `/__pb/` → 127.0.0.1:7040 (PocketBase; 管理控制台 /_/ 建议限制 IP 或不经公网)
- `/__asr/` → 127.0.0.1:18084 (ASR Gateway)
- 不暴露内部 worker、ASR 远端回环端口 18082、Service Token
- index.html 禁止长期缓存; 静态资源长期缓存; HTTPS; 安全响应头; client_max_body_size 200M

## 脚本

deploy/scripts/check-env.sh, build.sh, deploy-test.sh, deploy-production.sh, backup.sh, rollback.sh, health-check.sh
- Ubuntu 适配, 无 .venv/python 检查, 无 PostgreSQL/Redis 检查; 检查 Node/pnpm/PocketBase/PM2/Nginx。
- 部署前备份 pb_data; 保留上一版 dist; 回滚进程名与 ecosystem 一致; 失败即停; 不自动删 PocketBase 数据。

## 状态

生产服务器未实际部署(无服务器权限): 脚本已完成并通过本地语法验证, 部署步骤标记"生产未执行"。
