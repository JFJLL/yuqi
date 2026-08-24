# 部署说明 (DEPLOYMENT)

## 拓扑

```
Nginx (443)
 ├── /          → 管理端静态 (dist/)
 ├── /employee/ → 员工 H5 静态 (apps/employee-h5/dist)
 ├── /api/      → FastAPI (:9000, 测试 :9100)
 └── (切换完成后移除 /__pb/)
PM2:
  yuqi-api        uvicorn backend.app.main:app
  yuqi-worker     ARQ worker
  yuqi-scheduler  ARQ cron scheduler
  yuqi-asr-gateway  Node (现有, 改调 FastAPI 内部 API)
  yuqi-oss-scanner  Node (现有, 改调 FastAPI 内部 API)
```

## 环境隔离（测试 vs 正式）

| 项 | 测试 | 正式 |
|---|---|---|
| API 端口 | 9100 | 9000 |
| PostgreSQL | yuqi_test | yuqi_prod |
| Redis | DB 1 | DB 0 |
| OSS 前缀/Bucket | 不同 | 生产桶 |
| 密钥 | 测试密钥 | 生产密钥 |
| 日志目录 | /var/log/yuqi/test | /var/log/yuqi/prod |
| 验证码 | 允许固定/日志验证码 | 禁止 |
| seed | 允许 (ALLOW_DEMO_SEED=true) | 拒绝 |

## 部署脚本（`deploy/scripts/`）

- `check-env.sh` 部署前环境检查；`install.sh` 首次安装（Python 3.12 venv、依赖、DB 建库）；
- `build.sh` 构建前端；`migrate.sh` 执行 Alembic（失败即停止发布）；
- `backup.sh` 备份 PG + OSS 清单；`deploy-test.sh` / `deploy-production.sh`；
- `rollback.sh` 保留上一发布版本并支持回滚；`health-check.sh` 健康检查失败自动回滚。

## Nginx / PM2 配置

- `deploy/nginx/yuqi-test.conf` / `deploy/nginx/yuqi-production.conf`（HTTP→HTTPS、SPA fallback、上传大小、安全头、代理 IP、静态长缓存/HTML 禁缓存、不暴露内部端口）。
- `deploy/pm2/ecosystem.test.config.cjs` / `ecosystem.production.config.cjs`（PM2 用 `--update-env` 更新环境、`pm2 save` 保存状态、日志切割）。

## 切换顺序（PocketBase → PostgreSQL，正式环境）

备份 PB → 停旧写入 → PG 迁移 → 迁移校验 → 数量/关系对比 → 切管理端 API → 切 Scanner/ASR 网关内部 API → 全链路验收 → 改 Nginx → PB 只读回滚期 → 稳定后停 PB 进程 → 不自动删旧库。

> 本机无真实服务器权限/环境变量：只交付脚本与测试环境验证，**正式切换未执行**。
