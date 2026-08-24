# 旧 PocketBase 路由弃用清单 (LEGACY_POCKETBASE_ROUTES)

> 用途: 迁移期跟踪即将被 FastAPI 替换/封禁的 PocketBase 路由。阶段零不直接改生产 Nginx/不停用 PocketBase；切换在最终阶段执行。

## 高风险（阶段零已处理）

| 路由 | 风险 | 处置 |
|---|---|---|
| `POST /api/admin/seed` | 清空 7 张业务表后写演示数据；无鉴权 | ✅ 已封禁: `ALLOW_DEMO_SEED=true` + 超级管理员 + `X-Seed-Confirm: 1`；生产默认拒绝 |

## 待替换（迁移期只读或内部）

| 路由 / 用途 | 风险 | 处置计划 |
|---|---|---|
| `/api/admin/dashboard/summary` | 服务端 JS 聚合、无鉴权 | 阶段六由 FastAPI `/api/v1/reports/*` 替换 |
| `/api/admin/sync` | 返回假同步时间（无真实请求） | 阶段三由真实对账/扫描任务替换后废弃 |
| 各 collection REST CRUD（regions/stores/employees/devices/device_bindings/device_logs/transcripts/inspection_issues/rectify_tasks/appeals/audio_files/asr_jobs/sync_logs/compliance_rules/knowledge_items/model_evals/app_settings） | rules=null 仅管理员可写，但 hook 路由无鉴权、硬删除 | 阶段一–五逐步由 FastAPI 迁移；切换完成后移除 `/__pb` 公网暴露 |
| `/api/transcripts/{id}` DELETE 等 | 生产硬删除核心业务证据 | 阶段三改为软删除 + 证据锁 |

## 迁移完成后动作

1. Nginx 移除 `/__pb` location；
2. PocketBase 只保留只读回滚期，稳定后停止进程；
3. **不删除** PocketBase 数据与备份。
