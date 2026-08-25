# 一期轻量闭环 · 测试报告 (TEST REPORT)

**分支**: `codex/yuqi-phase1-lite-pocketbase-v1`
**测试时间**: 2026-08-25
**状态**: `MERGE CANDIDATE`

---

## 一、测试体系与分层

| 测试层级 | 命令 | 工具/框架 | 覆盖范围 | 结果 |
|---|---|---|---|---|
| A. Node 单元测试 | `pnpm test` | Vitest v4.1 | 8 类内置规则真实正反用例 (56+ cases)、正则回溯防御、时间锚点、时序安全签名比较 | **42/42 PASS** |
| B. PB API 集成测试 | `pnpm test:integration` | Node.js Test Runner | 25 项核心业务与多租户数据范围安全场景 + 2 条端到端闭环 Flow | **27/27 PASS** |
| C. 进程级自动 E2E | `pnpm test:e2e` | Node.js Test Runner | 真实启动 PB + ASR Gateway + Business Worker 子进程全链路自动化 | **1/1 PASS** |
| D. 前端与代码质量门禁 | `pnpm typecheck` / `lint` / `lint:secrets` / `build` | TSC + ESLint + Custom Scanner + Vite | TypeScript 类型检查、代码规范、密钥扫描、生产打包 | **ALL PASS (0 Errors)** |
| E. 部署脚本静态验证 | `pnpm test:deploy` | Node.js Test Runner + Bash | 部署脚本 bash -n 语法、首次部署安全、PM2 online 校验、ENV 解析 | **6/6 PASS** |
| F. 生产服务器部署 | `deploy/scripts/deploy-production.sh` | Bash + PM2 | 生产服务器部署执行 | **NOT EXECUTED (无生产 SSH 权限)** |

---

## 二、A. Node 单元测试详情 (42 项)

### 1. 规则分析器与唯一定义 (`server/rule-analyzer.test.mjs`, 35 项)
- **规则定义一致性**: 验证 `shared/phase1-risk-rules.json`、`server/rule-analyzer.mjs` 与 `pocketbase/pb_hooks/_generated/risk-rules.js` 完全一致 (8 类规则 code/version/pattern/advice/recommended_expression 一致)。
- **8 类内置规则真实验收 (Table-Driven 56+ Cases)**:
  1. `PRESCRIPTION_DRUG_SALES` (处方药违规销售, HIGH): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  2. `MEDICAL_INSURANCE_VIOLATION` (医保话术违规, HIGH): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  3. `EXAGGERATED_EFFICACY` (夸大疗效, MEDIUM): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  4. `IRRATIONAL_MEDICATION_ADVICE` (不合理用药建议, MEDIUM): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  5. `CONTRAINDICATION_NOT_ASKED` (禁忌症未询问, MEDIUM): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  6. `INDUCED_OVER_PURCHASE` (诱导超量购买, MEDIUM): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  7. `SERVICE_ATTITUDE` (服务态度问题, LOW): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
  8. `INSUFFICIENT_CONSULTATION_INFO` (问诊信息不足, LOW): 3 个真实正向命中、3 个负向不命中、1 个排除不命中。
- **引擎边界能力**:
  - `KEYWORD_ALL` 全部条件命中测试。
  - `REGEX` 正则匹配与复杂灾难性回溯安全防御测试。
  - `COMBINATION` all+any+not 组合逻辑与前后相邻窗口 (window=±1) 跨句命中测试。
  - 单会话多规则并发命中生成独立 issue 测试。
  - 证据文本精确截取、时间锚点 (`start_ms`/`end_ms`) 与说话人保留测试。
  - `enabled=false` 禁用规则不参与分析测试。
  - 同输入重复分析结果确定性与幂等测试。
  - 未命中规则不生成冗余无问题记录测试。

### 2. ASR 网关安全与上传 Token (`server/asr-gateway.test.mjs`, 7 项)
- `safeSignatureEqual`: `crypto.timingSafeEqual` 时序安全比较与长度不匹配防御。
- `verifyUploadToken`: 有效签名验证通过。
- `verifyUploadToken`: 载荷内容篡改拒绝。
- `verifyUploadToken`: 签名篡改拒绝。
- `verifyUploadToken`: 签名长度缺失 (少1字节) 拒绝。
- `verifyUploadToken`: 过期令牌拒绝。
- `verifyUploadToken`: 非 `asr_upload` 用途令牌拒绝。

---

## 三、B. PocketBase HTTP API 集成测试 (27 项)

### 1. 核心场景集成测试 (`tests/integration/phase1-scenarios.test.mjs`, 25 项)
1. **未登录访问拦截**: `/api/yuqi/auth/me` 返回 401，`/api/stores` 返回 401，底层 `/api/collections/*` 规则锁定返回 403。
2. **跨租户访问隔离**: 其他租户访问当前租户资源统一返回 404/403。
3. **跨门店隔离 (店长)**: A 店店长查看或复核 B 店问题返回 404/403。
4. **区域经理与店长完整数据范围隔离矩阵**:
   - 区域经理: 本大区门店 (200)、员工 (200)、音频 (200)、转写 (200)、ASR任务 (200)；跨大区资源统一 404。
   - 店长: 本店音频 (200)、转写 (200)；跨店资源统一 404。
   - 员工: 禁止读取 `/api/audio_files` (403)、`/api/transcripts` (403)、管理报表 (403)。
   - 审计员: 门店列表 (200)，禁止创建/更新/删除 (403)。
5. **员工数据本人隔离**: 员工仅可读取属于本人且已推送的问题，跨员工直查返回 404。
6. **待复核问题不可见**: 初始 `PENDING` 状态问题不出现在员工端。
7. **设备活跃绑定唯一性**: 同一时刻同一设备只允许一个 `ACTIVE` 绑定，并发重复绑定拒绝。
8. **多租户 `object_key` 幂等隔离**: 租户 A 与租户 B 相同 `object_key` 独立存在互不影响；同租户重复插入返回 `duplicate: true` 及自身记录。
9. **真实 ASR 重复成功导入幂等**: 同一 ASR 任务执行两次成功导入，`transcripts`、`sessions`、`transcript_segments`、`processing_jobs`、`issues` 5 类记录总数不增加。
10. **处理任务幂等**: 相同 `idempotency_key` 任务入队返回 `duplicate: true`。
11. **八类规则真实话术单元命中**: 覆盖处方药、医保、夸大疗效、用药剂量、禁忌症、超量购买、服务态度、问诊信息。
12. **多问题生成**: 一会话触发多规则产生对应数量独立 issue。
13. **时间锚点留存**: `start_ms` / `end_ms` / `speaker` 精确落库。
14. **申诉成立闭环**: 申诉核准后问题保留原始规则命中标记，状态更新为 `APPROVED` 与 `CLOSED`。
15. **申诉驳回进入整改**: 申诉驳回后问题状态更新为 `REJECTED`。
16. **申诉补充再次提交**: `needs_more_info` 后员工补充说明，状态恢复为 `PENDING`。
17. **整改退回与重提**: 店长要求修改后员工重新提交，`retry_count` 递增为 1。
18. **整改确认结案**: 店长确认整改合格，整改状态 `CONFIRMED`，问题状态 `CLOSED`。
19. **服务端报表聚合**: `/api/reports/overview` 统计总数、有效数、完成率、门店排行。
20. **受限导出与免责声明**: CSV 导出包含系统免责声明与操作人标识，记录 `audit_logs`。
21. **转写查看审计**: 查看完整转写记录 `transcript_view` 审计。
22. **证据锁阻止删除**: 被 issue 引用的转写与会话禁止删除 (返回 400)。
23. **Worker 崩溃任务恢复**: 超时锁原子重新领取。
24. **固定验证码生产禁用**: 生产环境未配置短信返回 503 `sms_not_configured`。
25. **Demo Seed 幂等性**: 重复运行 seed 脚本不产生重复门店和问题。

### 2. 端到端闭环 Flows (`tests/integration/phase1-e2e-flow.test.mjs`, 2 项)
- **Flow 1: 销售合规全链路贯通闭环**: 创建 -> 录音 -> 转写 -> 规则分析 -> 复核 -> 推送 -> 申诉驳回 -> 整改下发 -> 退回重提 -> 确认关闭 -> 报表审计。
- **Flow 2: 申诉成立闭环**: 疑似问题 -> 复核推送 -> 申诉成立 -> 原始命中保留 -> 有效问题扣减 -> 误报统计更新。

---

## 四、C. 进程级自动 E2E 测试 (`tests/e2e/phase1-subprocess-e2e.test.mjs`)

- **启动进程**: 真实 spawn 启动 PocketBase (临时端口)、ASR Gateway (Mock 模式、临时端口)、Business Worker 独立子进程。
- **自动流程**:
  1. 管理员登录建档 (组织、员工、设备、知情同意审批)。
  2. 管理员申请一次性上传 Token。
  3. POST 音频 fixture 到 ASR Gateway `/api/asr/jobs`。
  4. Gateway 自动生成转写并入队 `processing_jobs`。
  5. Worker 自动领取并执行规则分析，自动生成 `risk_segments` 与 `issues`。
  6. 自动复核、推送、员工登录、申诉、驳回、整改、退回、重提、确认关闭。
  7. 验证报表更新与 `audit_logs` 完整记录。
- **断言**: 进程级各层数据完全自发流转，无代码硬编码 mock 注入，测试通过。

---

## 五、D. 前端与代码质量门禁

- **TypeScript 类型检查**: `pnpm typecheck` (0 Errors)。
- **ESLint 代码规范**: `pnpm lint` (0 Errors)。
- **密钥与违禁技术栈扫描**: `pnpm lint:secrets` (0 Leaks)。
- **前端生产构建**: `pnpm build` (HTML/CSS/JS 生成成功，大小合规)。

---

## 六、E. 部署脚本静态验证 (`tests/deploy/deploy-scripts.test.mjs`)

1. 所有脚本具有标准 `#!/usr/bin/env bash` 与 `set -euo pipefail`。
2. `bash -n` 语法校验全部通过。
3. `check-env.sh` 支持 `ENV=test` 检查 `.env.test` 与 `ENV=production` 检查 `.env.production`。
4. 端口未监听时输出 info 不阻断首次部署。
5. `deploy.sh` 首次部署使用 `pm2 start`，后续使用 `pm2 reload`。
6. `health-check.sh` 严格校验 PM2 状态为 online，非 online 状态判定失败。

---

## 七、F. 生产服务器部署

- **状态**: `NOT EXECUTED`
- **原因**: 当前运行环境为本地开发/测试环境，未提供生产服务器 SSH/部署权限。
- **部署就绪性**: 部署脚本工具集已全部就绪 (`deploy/scripts/*`、`ecosystem.config.cjs`)，通过所有静态预检。

---

## 八、总结与合并建议

所有 P0 修复、数据范围加固、多租户幂等、真实进程级 E2E 测试及完整门禁命令全数通过。分支代码干净，达到合并候选标准。

**最终状态**: `MERGE CANDIDATE`
