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

## 阶段二：组织/员工/设备/动态绑定/知情同意/Excel 导入 — 已完成

**产出**
- [x] 模型: OrganizationNode(树形), Employee(唯一 employee_no, 手机号存储明文+展示脱敏), Device(唯一 device_code), DeviceEmployeeBinding(动态绑定, 单活跃约束, 解绑=软删除), RecordingConsent(知情同意), ImportBatch/ImportRow, MigrationBatch/MigrationItem
- [x] API: 组织树 / 员工 CRUD+服务端分页+筛选(keyword/job_title/region)+手机号脱敏 / 设备 CRUD+绑定信息联查 / 绑定·解绑 / summary+audit 事件 / Excel 导入(模板下载+校验+分批导入+回滚)
- [x] 审计: 操作审计统一落库(含 resource_id), 设备事件表可查
- [x] 迁移工具链: `export_legacy_snapshot.py`(PocketBase 快照导出) → `migrate_pocketbase_to_postgres.py`(幂等迁移: 稳定 legacy_id + migration_batches/items 跟踪 + dry-run) → `verify_migration.py`(校验+回滚)
- [x] 前端迁移: 门店员工页(服务端分页/筛选/脱敏/新增编辑) / 设备绑定页(分页+绑定解绑走 API) / 设备运行页(summary 卡片+审计事件表) / `src/lib/v1.ts` typed client
- [x] 迁移: 0002 `org device and imports`(含 PG 部分唯一索引, env.py 已排除 autogenerate 比对)

**门禁**
- 后端: ruff ✅ / mypy ✅ / pytest 48 passed ✅ / alembic upgrade+check ✅
- 前端: lint ✅ / typecheck ✅ / test 13 passed ✅ / build ✅
- PocketBase → PostgreSQL 迁移脚本: dry-run/commit/rollback 幂等测试 ✅

## 阶段三：文件接入 / 对象存储 / 会话 / 文本版本 / ASR Provider — 已完成

**产出**
- [x] 模型 (迁移 0003): `audio_files` / `conversations` / `transcript_segments` / `text_versions` / `processing_jobs` (DATA_MIGRATION 三层拆分落地)
- [x] 对象存储 Provider: 本地 FS (开发/测试) + S3/OSS 兼容 (boto3 懒加载, 线程池), 路径穿越防护, key 约定 `{tenant}/{audio_id}/{name}`
- [x] ASR Provider: `MockAsrProvider` (内存确定性) / `HttpAsrProvider` (私有网关 Bearer 提交+轮询)
- [x] 接入模块: 上传落库 → 创建 ASR 任务 → 队列 (内存同步/ARQ 双实现) → 会话+片段+版本落库; 重试/软删除
- [x] API: `GET /recordings`(服务端分页+关键词/日期/门店/员工/质检/ASR 状态过滤+数据范围) / `GET /recordings/{id}` / `POST /recordings/upload`(multipart, 200MB 限制, 格式白名单) / retry / PATCH transcript(生成新文本版本) / versions / DELETE(软删除+审计) / summary(队列卡片服务端聚合)
- [x] 内部 API (X-Service-Token): `POST /internal/ingest/audio`(OSS Scanner 幂等登记, 自动解析活跃绑定员工/门店) / `POST /internal/asr/callback`(网关推送转写结果)
- [x] 前端迁移: 录音转写页服务端分页 + 详情对话框走 v1 API (编辑保存生成版本) + 上传走 v1 multipart + 软删除

**门禁**
- 后端: ruff ✅ / mypy ✅ / pytest 62 passed ✅ (新增 14: recordings 上传/详情/过滤/范围/权限/版本/重试/删除/内部端点 + providers) / alembic upgrade+check ✅
- 前端: lint ✅ / typecheck ✅ / test 17 passed ✅ (新增 Records 页 4 项) / build ✅
- ASR mock 全链路 (上传→转写→会话→版本) 有 API 测试覆盖; 生产 ASR/OSS 未连接 (无服务器权限)

## 阶段四：规则库 / RiskAnalyzer / 风险片段 / 疑似问题 / 人工复核 — 已完成

**产出**
- [x] 模型 (迁移 0004): `risk_rules`(版本化) / `risk_rule_versions`(快照) / `risk_segments`(命中片段) / `issues`(多状态: review/appeal/remediation/close/employee_view) / `rectifications`
- [x] RiskAnalyzer: 启用规则关键词扫描转写片段 → 风险片段 + 疑似问题 (一会话/规则一条, 幂等防重复)
- [x] 规则库 API: CRUD + 版本快照 + 启停 (rules:manage), 修改自动递增版本
- [x] 疑似问题 API: 列表(服务端分页+风险/状态/类型/关键词/门店/员工过滤+数据范围) / 详情(含命中片段) / 复核通过·驳回 / 关闭 / 推送整改 (issue:review / issue:close / rectify:confirm)
- [x] 重跑分析 `POST /analysis/rerun` (analysis:rerun, 单会话或全量 READY 会话)
- [x] 证据锁: 被疑似问题引用的录音禁止删除
- [x] 前端: 合规巡检页服务端分页 + 复核/驳回/关闭/推送整改 + 重跑分析按钮; 知识库页改造为合规规则库 (新增/编辑/启停/版本历史)

**门禁**
- 后端: ruff ✅ / mypy ✅ / pytest 67 passed ✅ (新增 5: 规则 CRUD+版本 / 分析→问题→复核→整改→关闭全流程 / 驳回+证据锁 / 权限 / 门店范围) / alembic upgrade+check ✅
- 前端: lint ✅ / typecheck ✅ / test 24 passed ✅ (新增 Inspection 3 项 + Knowledge 规则库 4 项) / build ✅
- 分析引擎基于关键词规则; LLM 规则分析为预留 (LLM_ENABLED 默认关闭)

## 阶段五：员工自服务 / 申诉 / 整改闭环 / 通知 / SLA — 已完成

**产出**
- [x] 模型 (迁移 0005): `notifications`(通知: 整改派发/逾期/驳回/申诉结果/整改确认) + `rectifications` 升级字段 (overdue_at / escalated_at / escalation_count)
- [x] 员工自服务 API (employee.self:view/appeal/rectify): `GET /me/issues` / `POST /me/issues/{id}/appeal` / `GET /me/rectifications` / `POST /me/rectifications/{id}/submit` (仅限本人数据)
- [x] 管理端闭环: `POST /issues/{id}/appeal-review`(appeal:review) / `GET /appeals`(申诉队列) / `POST /rectifications/{id}/confirm`(rectify:confirm, 通过/驳回) / `GET /rectifications` + summary / PATCH 跟进(截止日期+进度)
- [x] 通知 API: `GET /notifications` / `GET /notifications/unread-count` / `POST /notifications/read`(单条/全部)
- [x] SLA 扫描 (scheduler 每 30 分钟): 整改逾期 → 置 overdue + 通知员工与店长; 连续逾期 2 次 → 升级店长, 3 次 → 升级合规专员
- [x] 前端: 整改任务页 (服务端分页+统计卡片+跟进对话框+确认/驳回对话框) / 申诉复核页 (队列+复核工作台+状态筛选+分页) / 顶栏通知中心 (未读徽标+全部已读+点击已读)
- [x] 状态机优先级: 驳回 > 申诉中 > 申诉通过/已关闭 > 待复核 > 待整改 (issue_display_state)

**门禁**
- 后端: ruff ✅ / mypy ✅ / pytest 71 passed ✅ (新增 4: 员工仅本人数据/申诉→复核/提交整改→确认/通知+SLA 扫描) / alembic upgrade+check ✅ (全新库验证)
- 前端: lint ✅ / typecheck ✅ / test 30 passed ✅ (新增 Tasks 3 项 + Appeals 3 项) / build ✅
- 员工 H5 页面未单独建前端应用; 自服务 API 齐备, 由后续移动端/小程序接入 (一期管理端内置员工角色视图可登录)
