# 智能工牌销售合规系统 · 一期实施计划 (PHASE1_IMPLEMENTATION_PLAN)

> 依据: `智能工牌销售合规系统-一期方案-V1.md` (最高优先级) + 本仓库 `gpt智能工牌方案.md` (仅参考)
> 分支: `codex/yuqi-phase1-closed-loop-v1`
> 起始 SHA: `f8f22f7263f2ed2d380c6332f48b2794c7e6b394` (origin/main)

## 一、一期目标链路（验收主线）

```
租户与组织建档 → 员工与设备建档 → 动态绑定 → 厂商推送/OSS/后台上传进入系统
→ 文件登记与幂等 → 会话与转写片段落库 → 规则识别疑似风险 → 生成疑似问题单
→ 管理人员复核 → 员工查看/申诉/整改 → 店长确认关闭 → 看板/报表/审计同步更新
```

口径: 机器结果一律表述为「疑似风险 / 风险提示 / 改进建议」，最终判定由授权管理人员完成。

## 二、阶段划分与验收门槛

| 阶段 | 内容 | 验收门槛 |
|---|---|---|
| 0 基线审计 | 代码/安全/数据现状审计、实施文档、demo seed 封禁、lint 校准 | 管理端可构建；seed 默认拒绝；文档齐备 |
| 1 平台底座 | FastAPI + PostgreSQL + Alembic + Redis/ARQ、认证、RBAC、管理端登录与路由守卫 | 管理端必须先登录；跨租户/跨数据范围测试通过；空库迁移成功 |
| 2 组织与设备 | 组织树、员工、设备、动态绑定历史、知情同意、Excel 导入、PocketBase 迁移脚本 | 绑定冲突有 DB 约束；手机号脱敏；导入幂等；迁移幂等 |
| 3 接入与转写 | 三条入口、对象存储 Provider、会话/文本版本/转写片段(分区)、AsrProvider(Mock+私有) | 文件幂等；重放防护；Mock ASR 全链路；软删除 |
| 4 规则与分析 | 8 类风险规则、RuleRiskAnalyzer、异步分析任务、风险片段、疑似问题、人工复核 | 规则真实命中；分析幂等；问题状态拆分；风险分流 |
| 5 员工闭环 | 员工 H5、短信验证码登录、申诉、整改、站内通知、SLA | 员工仅见本人；申诉不删原结果；问题最终关闭 |
| 6 报表交付 | 服务端报表、水印导出、审计覆盖、保留策略、集成签名 API、PM2/Nginx、切换工具 | 报表为服务端计算；导出带水印+审计；部署脚本存在且可重复 |

## 三、执行规则

- 每个阶段: 完成功能 → 增加测试 → 运行门禁 → 修复 → 更新 `docs/PROGRESS.md` → 逻辑清晰 commit → 进入下一阶段。
- 前端门禁: `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`。
- 后端门禁: `ruff check backend` / `mypy backend` / `pytest` / `alembic check` / `python -m compileall backend`。
- 禁止: 删除测试、注释鉴权、写死租户/用户、前端假数据、模型失败时生成“无问题”、把模拟问题当真实输出、提交密钥。
- 本机无 PostgreSQL/Redis: PostgreSQL/Redis 集成测试标记为 `postgresql`/`redis` 并跳过，报告中如实列出（见 `docs/TEST_REPORT.md`），不得以 SQLite 冒充。

## 四、环境与版本记录

| 项 | 值 |
|---|---|
| Node | v24.11.1 |
| pnpm | 10.33.0 |
| Python(uv) | 3.12.13 (cpython-3.12.13-windows-x86_64) |
| PostgreSQL | 本机未安装 (集成测试未执行) |
| Redis | 本机未安装 (Worker 集成测试未执行) |
| 起始分支 | main @ f8f22f7 |
| 起始 SHA | f8f22f7263f2ed2d380c6332f48b2794c7e6b394 |
| origin/main SHA | f8f22f7263f2ed2d380c6332f48b2794c7e6b394 |
| 工作区 | 仅 `.freebuff/` 未跟踪（非本项目文件，未提交） |
| PocketBase 本地数据 | 不存在 `pb_data`（仅 hooks/migrations 源码） |
