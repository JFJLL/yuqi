# Yuqi 智能工牌销售合规系统

Yuqi 是面向门店销售场景的智能工牌销售合规与员工闭环管理系统。

当前已完成一期轻量闭环：

录音/转写 → 风险识别 → 人工复核 → 员工申诉/整改 → 报表与审计

> **重要说明**：系统识别结果仅为“疑似风险”，最终判断由授权管理人员人工复核完成。

---

## 1. 一期目标与核心链路

一期轻量闭环完整实现以下核心数据链：

```text
audio_file
  ↓
session
  ↓
transcript / transcript_segments
  ↓
risk_segments
  ↓
issue (疑似问题)
  ↓
人工复核 (通过 / 标记误报关闭)
  ↓
员工移动端推送
  ↓
员工申诉 / 整改任务 (退回重提 / 确认关闭)
  ↓
报表统计与审计日志
```

### 一期包含功能
- **多租户与组织权限**：租户隔离、区域、门店、员工档案、角色与数据范围（`ALL` / `ORG_TREE` / `STORE` / `SELF` / `AUDITOR` 只读）。
- **工牌设备与知情同意**：工牌设备档案、店长审批设备动态绑定、员工端录音制度知情确认。
- **音频与转写链路**：OSS 录音扫描对账、私有 ASR 网关、Mock ASR 测试模式、HMAC 短期上传令牌。
- **疑似风险分析**：内置 8 类销售合规规则、关键词/正则/组合匹配、原转写证据片段与时间戳锚定。
- **管理复核与员工闭环**：管理端复核判定、误报关闭、员工移动端 H5 查看、发起申诉、补充申诉材料、整改凭证提交、店长退回与确认关闭。
- **报表与审计**：服务端指标聚合概览、带操作人水印的受限导出、全链路敏感操作审计日志。
- **任务与运维**：PocketBase `processing_jobs` 任务表、Node.js Business Worker、PM2 进程管理、Nginx 反向代理配置与部署脚本。

---

## 2. 一期 8 类合规规则

1. **PRESCRIPTION_DRUG_SALES**（处方药违规销售）
2. **MEDICAL_INSURANCE_VIOLATION**（医保话术违规）
3. **EXAGGERATED_EFFICACY**（夸大疗效）
4. **IRRATIONAL_MEDICATION_ADVICE**（不合理用药建议）
5. **CONTRAINDICATION_NOT_ASKED**（禁忌症未询问）
6. **INDUCED_OVER_PURCHASE**（诱导超量购买）
7. **SERVICE_ATTITUDE**（服务态度问题）
8. **INSUFFICIENT_CONSULTATION_INFO**（问诊信息不足）

---

## 3. 技术架构

```text
React 19 + TypeScript + Vite
            ↓
       PocketBase
  ├─ SQLite 存储
  ├─ Auth 认证体系
  ├─ JSVM Hooks 权限与路由
  └─ Migrations 迁移管理
            ↓
     processing_jobs
            ↓
    ASR Gateway
  ├─ ASR HTTP Gateway
  ├─ ASR Poller
  └─ Embedded Business Worker (可扩容独立 Worker)
            ↓
       OSS Scanner
```

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + 响应式员工 H5 布局。
- **后端**：PocketBase v0.40.0 + JSVM Hooks 原生数据接口与权限守卫。
- **存储**：PocketBase 内置 SQLite。
 - **任务队列**：`processing_jobs` 数据库任务表 + 内嵌 Business Worker（支持独立 Worker 扩容、原子领取、指数退避、故障恢复）。
 - **转写网关**：Node.js 私有 ASR 网关（同时承载 ASR HTTP 转发、ASR 任务轮询与内嵌业务任务消费循环）。
 - **进程与部署**：PM2 管理（默认 3 进程：`yuqi-pb`、`yuqi-asr-gateway`、`yuqi-oss-scanner`）、Nginx 反向代理、一键部署/备份/回滚脚本。

> **架构约束**：一期完全基于轻量原生栈，**不依赖** Python、FastAPI、PostgreSQL、Redis、RabbitMQ、Docker 或 Kubernetes。

---

## 4. 项目目录结构

```text
yuqi/
├── src/                    # 前端代码 (React SPA 管理端 + 员工端 H5)
│   ├── components/         # 业务组件与通用 UI
│   ├── layouts/            # 管理端布局与员工端独立移动端布局
│   ├── pages/              # 各业务模块页面 (巡检/任务/申诉/报表/设置/员工端等)
│   └── lib/                # PocketBase 客户端、认证状态与工具函数
├── server/                 # 后台 Node.js 服务
│   ├── asr-gateway.mjs     # ASR 转写网关
│   ├── business-worker.mjs # 业务后台 Worker (风险分析/SLA扫描/审计对账)
│   ├── oss-scanner.mjs     # OSS 音频文件扫描与同步服务
│   └── rule-analyzer.mjs   # 8 类销售合规规则引擎
├── pocketbase/             # PocketBase 后端配置
│   ├── pb_hooks/           # JSVM 路由与权限守卫 (_lib/guards.js, configs.js 等)
│   └── pb_migrations/      # 集合结构与唯一索引迁移脚本
├── shared/                 # 前后端共享规则定义
├── scripts/                # 工具脚本 (demo seed / ASR 健康检查 / 密钥检查等)
├── tests/                  # 自动化测试套件 (unit / integration / e2e / deploy)
├── deploy/                 # 部署、Nginx 配置与运维脚本
└── docs/                   # 一期架构设计、安全规范与验收报告
```

---

## 5. 本地服务与端口映射

| 服务 | 端口 | 说明 |
|---|---|---|
| Vite 前端开发服务 | `8040` | Web 访问入口：`http://localhost:8040` |
| PocketBase 后端服务 | `7040` | 数据与认证接口：`http://127.0.0.1:7040` |
| ASR Gateway 网关服务 | `18084` | 音频上传与转写网关：`http://127.0.0.1:18084` |

Vite 内置反向代理：
- `/__pb/*` → 自动代理至 `http://127.0.0.1:7040`
- `/__asr/*` → 自动代理至 `http://127.0.0.1:18084`

---

## 6. Windows 本地快速预览指南

### 6.1 安装依赖与确认 PocketBase

```powershell
pnpm install
Test-Path .\pocketbase\pocketbase.exe
```

### 6.2 启动本地 PocketBase

```powershell
$env:YUQI_ENV="test"
$env:NODE_ENV="test"
$env:YUQI_SERVICE_TOKEN="local-dev-token"
$env:YUQI_SERVICE_TENANT_CODE="demo"
$env:YUQI_UPLOAD_TOKEN_SECRET="local-dev-secret"
$env:YUQI_DEV_FIXED_CODE="123456"

$pbData="$env:TEMP\yuqi-preview-pb"
New-Item -ItemType Directory -Force $pbData | Out-Null

# 初始化本地 PocketBase 超级管理员
$adminCred = "YuqiLocal2026!"
.\pocketbase\pocketbase.exe superuser upsert admin@demo.local $adminCred `
  "--dir=$pbData" `
  "--hooksDir=.\pocketbase\pb_hooks" `
  "--migrationsDir=.\pocketbase\pb_migrations"

# 启动 PocketBase
.\pocketbase\pocketbase.exe serve `
  --http=127.0.0.1:7040 `
  "--dir=$pbData" `
  "--hooksDir=.\pocketbase\pb_hooks" `
  "--migrationsDir=.\pocketbase\pb_migrations"
```

> **安全提示**：上述凭证仅用于本地 dev/test 环境预览，严禁用于生产环境。

### 6.3 注入演示数据 (Seed)

打开新的终端窗口：

```powershell
$env:YUQI_ENV="test"
$env:YUQI_PB_URL="http://127.0.0.1:7040"
$env:YUQI_SUPERUSER_EMAIL="admin@demo.local"
$demoCred = "Passw0rd-Local"
$env:YUQI_SUPERUSER_PASSWORD = $adminCred
$env:YUQI_DEMO_ADMIN_PASSWORD = $demoCred

pnpm seed
```

`pnpm seed` 自动创建全套演示数据：
- 1 个演示租户、2 个区域、4 家门店、12 名员工、10 台工牌设备与绑定历史。
- 200 条音频元数据、200 个会话、约 1600 条转写分段。
- 8 类合规规则、60+ 条疑似问题（覆盖待复核、申诉中、整改中、退回、逾期与关闭等各种状态）。
- 生产环境（`NODE_ENV=production`）强制拒绝运行 seed。

### 6.4 启动前端应用

打开新的终端窗口：

```powershell
pnpm dev
```

浏览器访问：`http://localhost:8040`

---

## 7. 演示账号与系统入口

### 7.1 管理端登录 (`http://localhost:8040/login`)

| 角色 | 账号 | 密码 | 数据范围 |
|---|---|---|---|
| 系统管理员 (ADMIN) | `admin@demo.local` | `Passw0rd!` | 全租户数据 |
| 合规专员 (COMPLIANCE) | `compliance@demo.local` | `Passw0rd!` | 全租户数据 |
| 华东区域经理 (REGION_MANAGER) | `rm_hd@demo.local` | `Passw0rd!` | 仅华东大区及其下属门店 |
| 华南区域经理 (REGION_MANAGER) | `rm_hn@demo.local` | `Passw0rd!` | 仅华南大区及其下属门店 |
| 门店店长 (STORE_MANAGER) | `sm_1@demo.local` | `Passw0rd!` | 仅第一门店 |

> 注：业务系统账号（`app_users`）与 PocketBase superuser 管理员相互隔离。

### 7.2 员工移动端登录 (`http://localhost:8040/employee/login`)

| 员工 | 手机号 | 测试验证码 | 说明 |
|---|---|---|---|
| 演示员工 01 | `13800000001` | `123456` | 关联静安旗舰店 |
| 演示员工 02 | `13800000002` | `123456` | 关联徐汇分店 |

员工移动端支持功能：
- 首页待办概览与统计
- 我的疑似问题列表与证据详情（仅查看已推送问题）
- 发起申诉与补充材料
- 整改任务确认、凭证上传与重新提交
- 工牌设备绑定申请与解绑
- 录音制度知情同意确认
- 消息中心与个人档案

### 7.3 系统主要页面入口

- **管理端**：
  - `/`（合规大盘 / 工作台）
  - `/org`（组织与员工档案）
  - `/devices`（工牌设备管理）
  - `/device-ops`（设备运行监控）
  - `/records`（录音与会话管理）
  - `/inspection`（合规巡检与疑似问题复核）
  - `/knowledge`（合规知识库）
  - `/tasks`（整改任务跟进）
  - `/appeals`（申诉复核中心）
  - `/reports`（合规报表与受限导出）
  - `/logs`（接口与同步日志）
  - `/settings`（合规规则库与系统配置）
- **员工端**：
  - `/employee/home`（工作台）
  - `/employee/issues`（我的问题）
  - `/employee/appeals`（申诉记录）
  - `/employee/rectifications`（整改任务）
  - `/employee/notifications`（消息中心）
  - `/employee/device`（设备绑定）
  - `/employee/consent`（知情同意）
  - `/employee/profile`（个人中心）

---

## 8. Mock ASR 与 Worker 异步链路启动

若需体验从音频提交到 Mock 转写、自动入队、Worker 异步分析生成问题的完整动态过程：

### 8.1 默认模式：启动 ASR Gateway (内嵌 Business Worker 循环)
```powershell
$env:YUQI_ENV="test"
$env:POCKETBASE_URL="http://127.0.0.1:7040"
$env:YUQI_SERVICE_TOKEN="local-dev-token"
$env:YUQI_SERVICE_TENANT_CODE="demo"
$env:YUQI_UPLOAD_TOKEN_SECRET="local-dev-secret"
$env:YUQI_ASR_MOCK="1"
$env:YUQI_ASR_GATEWAY_PORT="18084"
$env:YUQI_EMBEDDED_WORKER="1"

pnpm asr:gateway
```

### 8.2 独立模式：单独启动 Business Worker (扩容 / 独立调试)
```powershell
$env:YUQI_PB_URL="http://127.0.0.1:7040"
$env:YUQI_SERVICE_TOKEN="local-dev-token"
$env:YUQI_WORKER_POLL_MS="1000"

pnpm worker
```

---

## 9. 常用开发与测试命令

```bash
# 开发与服务
pnpm dev               # 启动 Vite 前端
pnpm asr:gateway       # 启动 ASR Gateway
pnpm worker            # 启动 Business Worker
pnpm seed              # 注入本地演示数据

# 质量与代码规范
pnpm lint              # ESLint 检查
pnpm typecheck         # TypeScript 类型编译检查
pnpm lint:secrets      # 敏感密钥硬编码扫描

# 测试套件
pnpm test              # 单元测试 (Vitest, 42 tests)
pnpm test:integration  # 集成测试 (Node test runner, 29 tests)
pnpm test:e2e          # 子进程自动化端到端测试
pnpm test:deploy       # 部署脚本静态与行为测试

# 生产构建与全量门禁
pnpm build             # 前端打包构建
pnpm verify            # 一键全量门禁 (lint + typecheck + secrets + tests + build + diff)
```

---

## 10. ASR 导入原子性与完成标记语义

系统中的 `asr_jobs.result_imported_at` 字段具有严格的 **Completion Marker** 语义：
- 只有当 `transcripts` 内容更新、`sessions` 创建、`transcript_segments` 分段写入以及 `RISK_ANALYSIS` 任务入队全部成功持久化后，网关才会写入 `result_imported_at` 并将 `status` 置为 `succeeded`。
- 若下游持久化任一步骤失败：`status` 保持为 `queued`，`error_code` 置为 `downstream_persist_failed`，`result_imported_at` 保持为空，异常正常上抛，确保网关在下一轮轮询中自动重试并恢复数据。
- `sessions` 与 `transcript_segments` 支持局部写入恢复幂等与联合唯一索引保护。

---

## 11. 数据安全与隔离机制

- **租户隔离**：所有业务表均包含 `tenant` 关系，接口强校验操作人租户上下文。
- **数据范围隔离**：
  - `REGION_MANAGER`：仅可见指定区域子树内的门店、员工、录音与问题。
  - `STORE_MANAGER`：仅可见当前归属门店数据。
  - `EMPLOYEE`：仅可见本人已推送问题与本人整改任务，禁止调用全量通用 CRUD 接口。
  - `AUDITOR`：全租户只读，禁止任何写操作。
- **唯一性与防重**：
  - `audio_files`：`UNIQUE(tenant, object_key)`。
  - `sessions`：`UNIQUE(tenant, transcript)`。
  - `device_bindings`：活动绑定唯一。
- **证据保护锁**：当录音或会话关联未关闭的疑似问题时，禁止直接删除源文件与转写。

---

## 12. 生产部署说明

- **部署入口**：`ENV=production bash deploy/scripts/deploy-production.sh`
- **部署流程**：环境预检 → PocketBase 数据备份 (`pb_data`) → 前端构建 → PM2 进程热重载 → Nginx 配置检查与重载 → 端到端健康检查。
- **生产 ASR 准入**：生产健康检查严格校验 `mode=private` 且 `asr_configured=true`，拒绝 `mock` 或 `degraded` 状态。

> **当前交付状态**：
> - Phase 1 Lite: **`MERGE CANDIDATE`**
> - Production Deployment: **`NOT EXECUTED`**（本地开发环境已通过部署脚本自动化测试，待运维人员在目标 Linux 服务器执行实际部署）。

---

## 13. 一期范围外功能 (Out of Scope)

以下功能不在一期范围内，禁止在一期引入：
- 大语言模型（LLM）语义分析与二次判断
- 自动化药品推荐与处方审核
- 医疗诊断建议生成
- 第三方 ERP/HIS 深度实时双向对接
- 在线培训、题库与考试认证系统
- 智能工牌硬件固件反向控制与 OTA
- 默认生产商业短信运营商接入（一期采用开发验证码与接口插槽）

---

## 14. 相关设计与验收文档

- [PHASE1_LITE_DATA_MODEL.md](docs/PHASE1_LITE_DATA_MODEL.md) — 数据模型与集合字段定义
- [PHASE1_LITE_DECISIONS.md](docs/PHASE1_LITE_DECISIONS.md) — 核心技术与架构决策记录
- [PHASE1_LITE_SECURITY.md](docs/PHASE1_LITE_SECURITY.md) — 权限矩阵与安全防护规范
- [PHASE1_LITE_DEPLOYMENT.md](docs/PHASE1_LITE_DEPLOYMENT.md) — 部署架构与运维操作手册
- [PHASE1_LITE_PROGRESS.md](docs/PHASE1_LITE_PROGRESS.md) — 各阶段实施进度跟踪
- [PHASE1_LITE_TEST_REPORT.md](docs/PHASE1_LITE_TEST_REPORT.md) — 自动化测试套件执行报告
- [PHASE1_LITE_FINAL_REPORT.md](docs/PHASE1_LITE_FINAL_REPORT.md) — 最终合并验收报告
