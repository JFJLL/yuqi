# 测试报告 (TEST_REPORT)

> 只记录实际执行结果；未执行的项明确标注「未执行」。

## 环境

- 本机: Windows (Git Bash), Node v24.11.1, pnpm 10.33.0, Python 3.12 (uv)。
- 数据库: aiosqlite (pytest) / 本地开发 SQLite; **PostgreSQL 集成测试未执行** (本机无 PG)。
- Redis: 未安装 → **Redis Worker/ARQ 集成测试未执行** (队列有内存同步实现兜底并有 API 层测试覆盖)。

## 前端门禁 (全部通过)

| 检查 | 命令 | 结果 |
|---|---|---|
| lint | `pnpm lint` | 通过 (0 error / 0 warning) |
| typecheck | `pnpm typecheck` (tsc -b --noEmit) | 通过 |
| 单元测试 | `pnpm test` (Vitest + Testing Library) | **35 passed** |
| 构建 | `pnpm build` (tsc -b && vite build) | 通过 |

### 前端测试清单 (35)

| 页面 | 覆盖 |
|---|---|
| OrgPage (3) | 组织树渲染 / 新增节点 / 分页触发重载 |
| DevicesPage (3) | 设备列表 / 绑定流程 / 解绑 |
| RecordsPage (4) | 列表 / 详情分段 / 上传 multipart / 软删除 |
| InspectionPage (3) | 问题列表 / 复核通过 / 重跑分析 |
| KnowledgePage (4) | 规则列表 / 新增规则 / 启停 / 版本历史 |
| TasksPage (3) | 整改列表+统计 / 跟进更新 / 确认提交 |
| AppealsPage (3) | 申诉队列 / 通过 / 驳回 |
| ReportsPage (2) | 统计卡片+区域表格 / 报表详情要点 |
| SettingsPage (3) | 规则开关 / 保留策略表单 / 保存 |

## 后端测试 (pytest, aiosqlite)

| 组 | 结果 |
|---|---|
| ruff check (app + tests) | 通过 |
| mypy app | 通过 (76 files, no issues) |
| pytest 全量 | **79 passed** |
| alembic upgrade head (全新库 0001→0006) | 通过 |
| alembic check (模型 vs 迁移) | 通过, 无漂移 |
| PostgreSQL 集成 (`pytest -m postgresql`) | 未执行 (本机无 PG, 已标记 skip) |
| Redis Worker 集成 (`pytest -m redis`) | 未执行 (本机无 Redis, 已标记 skip) |

### 后端测试覆盖 (79)

- auth/rbac: 登录/刷新/登出、权限矩阵、数据范围 (店长门店/员工本人/跨租户 404)
- org/imports: 组织树、员工门店、Excel 导入幂等与失败工作簿
- devices: 建档/绑定/解绑/换绑历史/绑定申请复核/同意书
- recordings (14): 上传 → ASR(mock) → 会话+片段+文本版本 → 重试幂等 → 软删除证据锁 → 列表过滤与数据范围 → internal 上传/回调
- providers: 对象存储 (local/mock) 与 ASR mock 提交
- analysis (5+): 规则 CRUD+版本、RiskAnalyzer → 问题 → 复核 → 整改 → 关闭全流程、驳回、权限、门店范围
- employee (4): 仅本人数据、申诉→复核、提交整改→确认、通知 + SLA 扫描升级
- reports (8): 报表总览、区域聚合、门店范围限制、审计列表/权限、设置读写、保留清理证据锁、工作台 summary + tab

## 端到端链路 (mock, 有测试覆盖)

上传录音 → 登记 audio_files → 队列 (内存同步) → ASR mock 完成 → 会话/片段/文本版本落库 → RiskAnalyzer 命中规则 → 疑似问题 → 人工复核 → 推送整改 → 员工提交 → 管理端确认 → 通知; 超期 → SLA 升级; 录音超保留期 → 定时清理 (证据锁)。

## 未覆盖 / 未执行

- 生产 OSS / 真实 ASR 网关 / 真实 ARQ + Redis: 无服务器与密钥, 未连接 (Provider 抽象 + mock 全链路已测)
- PostgreSQL / Redis 集成测试: 本机未安装
- 部署脚本 (deploy/scripts/*): 已交付并校验语法, 未在真实服务器执行
- 浏览器端手工验收: 未执行 (可由 seed_demo.py 造数后人工走查)
