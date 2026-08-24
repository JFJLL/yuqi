# 阶段进度 (PROGRESS)

> 每阶段完成后更新本文件。测试与门禁结果以 `docs/TEST_REPORT.md` 为准。

## 阶段零：基线审计与风险封存 — 已完成

**审计结论（证据见 CURRENT_ARCHITECTURE.md / SECURITY_MODEL.md）**
- 前端: React 19 + Vite 8 + Tailwind/Radix，15 个导航模块；`药品主数据/AI荐药经营/培训考核` 为占位（一期隐藏）。
- 后端现状: PocketBase 自定义 hook 路由（`/api/admin/*`、各 collection CRUD），**无鉴权校验**；`POST /api/admin/seed` 会清空 7 张业务表后写入演示数据，**可匿名调用**；`/api/admin/sync` 返回假同步时间。
- 数据: 本地无 `pb_data`（无真实数据）；生产服务器数据未触碰。
- 前端: 46 处 `perPage=200/500` 浏览器拉全量后聚合（工作台、报表、巡检、申诉、设备等）。
- 高风险入口: 全部 collection 的 delete 路由（硬删除）；上传/重试/同步接口无权限校验。
- 密钥: 均通过环境变量加载（`deploy/asr-gateway.env.example` 模板），仓库无真实密钥；Node 网关日志已对 Bearer 脱敏。
- 门禁基线: `pnpm build` 通过；`pnpm lint` 因配置问题失败（已修复，见 DECISIONS D4）；无 `typecheck`/`test` 脚本（已补）。

**阶段零产出**
- [x] worktree + 分支 + 基线记录（D3 记录了 worktree 内嵌仓库的适配）
- [x] 实施文档 9 份 + 旧路由弃用清单
- [x] lint/typecheck 校准（0 error / 0 warning），补 `typecheck`/`test` 脚本
- [x] demo seed 封禁（`ALLOW_DEMO_SEED` 默认 false + 超级管理员 + `X-Seed-Confirm: 1`）
- [x] 密钥检查脚本 + pre-commit hook（`scripts/check-secrets.sh`）
- [x] 原管理端构建通过；ASR/OSS Node 代码未改动

**阶段零门禁**: `pnpm lint` ✅ / `pnpm typecheck` ✅ / `pnpm build` ✅；未触碰生产数据。

## 阶段一：正式后端、安全底座与管理员登录 — 已完成

**产出**
- [x] `backend/`: FastAPI + SQLAlchemy 2.x(async) + Alembic + Pydantic v2 + ARQ worker/scheduler
- [x] 分环境配置 + 校验 (`.env.example`), 结构化日志 + 请求 ID + 日志脱敏, 统一错误响应, OpenAPI
- [x] `/health/live` `/health/ready`; 核心表 UUID 主键 + UTC + tenant_id + 软删除
- [x] 认证: Argon2id, Access(15min JWT, 含 token_version) + Refresh(可撤销/轮换/HttpOnly Cookie), 登录限流, 登录日志, 改密/重置/停用
- [x] RBAC: 8 默认角色模板 + 权限 + 数据范围 (TenantContext/PermissionService/DataScopeService)
- [x] 管理端: 登录页 / 路由守卫 / 403 / 404 / 修改密码 / 退出 / 权限菜单 / 当前用户与租户
- [x] openapi-typescript 自动生成 `src/lib/api.gen.ts` (`scripts/export_openapi.py` + `pnpm gen:api`)
- [x] 测试: 后端 23 项 (登录/限流/轮换/退出/停用/跨租户/权限/改密/密码哈希/数据范围), 前端 8 项

**门禁**
- 后端: ruff ✅ / mypy ✅ / pytest 23 passed ✅ / alembic 空库升级 ✅ / compileall ✅
- 前端: lint ✅ / typecheck ✅ / test 8 passed ✅ / build ✅
- PostgreSQL/Redis 集成测试: 未执行 (本机无服务), 已留标记测试
