# 当前架构 (CURRENT_ARCHITECTURE)

## 改造前（基线，来自 git@f8f22f7 审计）

```
[React 19 + TS + Vite 管理端]
   ├── PocketBase SDK 直连 /__pb (Nginx 反代 → 127.0.0.1:7040)
   │     ├── pb_hooks/*.pb.js 自定义路由 (无鉴权): /api/admin/dashboard/summary, /api/admin/seed, /api/admin/sync
   │     └── 各 collection REST CRUD (rules=null, 硬删除)
   ├── /__asr (Nginx → 127.0.0.1:18084 Node ASR 网关, 服务端 Token 调私有 ASR)
   └── Node OSS Scanner (定时 ListObjects → 写 PocketBase audio_files → 提交 ASR)
```

- 核心业务表（PocketBase）: regions, stores, employees, transcripts(单 JSON 全量文本), inspection_issues(单 state 字段), rectify_tasks, appeals, devices, device_bindings, device_logs, sync_logs, audio_files, asr_jobs, compliance_rules 等。
- 均无 `tenant_id`；隔离依赖前端传参；统计在前端聚合（`perPage=500`）。
- 部署: PM2 (`yuqi-pb`, `yuqi-asr-gateway`, `yuqi-oss-scanner`) + Nginx 静态托管 dist。

## 改造后（目标）

```
[React 管理端]  ──┐
[员工 H5]       ──┼── /api/v1 (Nginx → FastAPI :9000)
                  │        ├── PostgreSQL (tenant_id 贯穿, 联合索引以 tenant 开头)
                  │        ├── Redis + ARQ Worker/Scheduler
                  │        └── Provider 层: AsrProvider / RiskAnalyzer / ObjectStorageProvider / SmsProvider / NotificationProvider / TaskQueue
                  ├── Node ASR Gateway / OSS Scanner ── 内部 Service Token 调 FastAPI 内部 API (不再直写 PocketBase)
                  └── PocketBase ── 仅迁移期旧数据源, 最终停止公开访问
```

- 管理端: React + TS + Vite + React Router + Tailwind/Radix；登录/守卫/权限菜单；服务端分页。
- 员工端: `apps/employee-h5` React + TS + Vite 移动优先 H5。
- 后端: `backend/` FastAPI 模块化单体 + ARQ Worker + Scheduler。
- 部署: Nginx + PM2 (`yuqi-api`, `yuqi-worker`, `yuqi-scheduler`, `yuqi-asr-gateway`, `yuqi-oss-scanner`)。

## 模块边界

- `app/api` 路由 → `app/services` 业务服务 → `app/repositories` 数据访问（统一注入 tenant/数据范围）→ `app/models` SQLAlchemy。
- 认证: `app/modules/auth`（Argon2id、Access+Refresh Token、登录限流、会话撤销）。
- 权限: `roles/permissions/role_permissions/user_roles/role_data_scopes`，数据范围 全部/指定组织及子级/本门店/仅本人。
- 领域模块: tenants/organizations/users/employees/devices/ingestion/conversations/analysis/issues/appeals/remediation/reports/audit/integrations。
