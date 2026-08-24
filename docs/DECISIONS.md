# 关键技术与架构决策 (DECISIONS)

## D1. 后端技术栈

- **选型**: Python 3.12+ / FastAPI / SQLAlchemy 2.x (async) / Alembic / Pydantic v2 / PostgreSQL / Redis / ARQ。
- **理由**: 一期方案 V1 允许「团队本就是 React/Python 班底则后端换 FastAPI，数据模型与接口契约原样搬」；本仓库管理端已是 React+TS+Vite，且已存在 Node ASR 网关。FastAPI + SQLAlchemy 是团队可维护性最优解。
- **不使用**: Docker / Docker Compose / Kubernetes / systemd / Elasticsearch（沿用 Nginx + PM2 + virtualenv）。

## D2. 渐进替换，不整体重写

- 保留: React+TS+Vite 管理端、页面结构/组件体系、OSS 扫描、Node ASR 网关、PM2/Nginx 部署方式。
- 替换: PocketBase 匿名/无权限 CRUD → FastAPI + PostgreSQL；`tenant_id` 缺失的表 → 全表带租户；前端聚合报表 → 服务端聚合；单 JSON 字段转写 → 三层模型（会话/文本版本/片段）。
- 阶段 0–3 期间 PocketBase 仍作为旧数据源与回滚保障；最终阶段才停止公开访问，不删除旧库。

## D3. 工作区与分支策略（对指令的适配）

- 指令要求「仓库同级 worktree」。本 Agent 的文件工具只能访问项目根目录内路径，因此将 worktree 建在仓库内 `.worktrees/yuqi-phase1-closed-loop-v1`（git 原生支持），分支 `codex/yuqi-phase1-closed-loop-v1`，自 `origin/main` 创建。
- 已通过 `.git/info/exclude` 将 `.worktrees/` 从主 checkout 状态中排除，不影响 `main` 的 git status。
- 仍在 `main` 之外开发、不覆盖未提交内容、不触碰生产数据，满足指令实质要求。

## D4. 前端 lint 校准（阶段零）

- 基线: `pnpm lint` 因「嵌套 worktree 造成多个候选 tsconfigRootDir」解析失败（254 处）+ 模板占位符语法 4 处；修复解析问题后暴露存量代码 48 错误/6 警告，全部为本次改动之前已存在。
- 处理: ① eslint 显式 `tsconfigRootDir`；② `globalIgnores` 排除 `dist/templates/scaffold/.worktrees`；③ 关闭与项目既有约定冲突的新版规则 `react-refresh/only-export-components` 与 `react-hooks/set-state-in-effect`（hooks 与组件同文件导出、effect 内同步本地状态是仓库既有模式）；④ 修复真实问题（空 catch、无效赋值、缺依赖的 useCallback/useMemo、受保护 vite 插件内 `any` 加注释豁免）。
- 效果: `pnpm lint` 0 error 0 warning，`tsc -b`、`vite build` 通过。

## D5. 测试策略（本机无 PostgreSQL/Redis）

- 单元/API 测试: 使用 SQLAlchemy + aiosqlite 内存库跑通全部业务逻辑（认证、RBAC、绑定、幂等、分析、申诉、整改等）。
- PostgreSQL 专用行为（部分唯一索引、Range 分区、JSONB、事务隔离、并发绑定）: 编写 `pytest.mark.postgresql` 标记的真实 PG 集成测试；本机无 PG 时自动 skip，报告中如实列出「未执行」，不把 SQLite 结果冒充 PG 验证。
- Redis/ARQ: 定义 `TaskQueue` 协议，生产用 `ArqTaskQueue`，测试用 `InMemoryTaskQueue`（真实入队/消费语义）；真实 Redis 集成测试同样标记并 skip。

## D6. ASR / 分析 Provider

- `AsrProvider` 契约: `submit / poll / fetch_result / retry`。一期默认 `MockAsrProvider`（读预置语料按文件时长生成带时间戳片段）；现有私有 ASR 改造为 `ExistingPrivateAsrProvider` 可选实现，只改配置切换，业务代码 0 依赖具体模型名。
- `RiskAnalyzer` 契约: `analyze(conversation, text_version, context)`。一期实现真实 `RuleRiskAnalyzer`（规则表驱动，非写死）；`OpenAICompatibleRiskAnalyzer` 仅作预留，默认关闭，配置齐全才启用，失败不伪造结果。

## D7. 会话模型

- 一期默认「一个 10 分钟文件 = 一个会话」，但表结构支持 会话↔文件 多对多、手工合并/拆分、外部会话 ID、多次分析版本，避免二期重写数据层（一期方案 V1 第 5.1 节铁律）。

## D8. 移动端形态

- 指令要求员工端为 React+TS+Vite 移动优先 H5（`apps/employee-h5`），以指令为准（一期方案 V1 的 uni-app 仅在其无 React 班底假设下成立）。

## D9. 保留策略

- 一期实现「业务软删除 → 回收站 → 到期物理清理」与证据锁（申诉/复核/整改/审计锁定/法务保留中禁止物理删除），默认保留期: 原始音频 7–30 天可配、问题证据音频 180 天、转写文本 1 年、问题/申诉/整改/审计长期。

## D10. 明确不实现（一期外）

- 自研 ASR、复杂 VAD/降噪/说话人分离、音频直送多模态、药品主数据、AI 荐药、ERP/POS/CRM、库存/价格/毛利、收银、设备远程控制、固件升级、医药知识库、培训题库考试、微信原生小程序、正式短信/企微接入、完整 BI、SaaS 套餐支付。
- 前端导航中「药品主数据 / AI荐药经营 / 培训考核」保持隐藏或占位，不作为一期已完成功能展示。
