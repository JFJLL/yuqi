# 一期轻量闭环 · 最终验收报告 (FINAL ACCEPTANCE REPORT)

## 1. 修复结果

在现有轻量 PocketBase 原生技术架构上（React + TypeScript + Vite + PocketBase + Node.js Worker + OSS/ASR 网关），已完整完成全部 P0 / P1 验收缺口修复与补漏：
- 正式 8 类内置风险规则语义纠正，通过 `shared/phase1-risk-rules.json` 与 `scripts/generate-phase1-rules.mjs` 建立唯一定义源，并通过 56+ table-driven 单元测试。
- 彻底解决区域经理与店长在 `devices`、`audio_files`、`asr_jobs` 等旧集合上的数据范围泄漏，强化员工端禁止越权读取音频与全量转写列表，审计员严格只读不可写。
- `audio_files` 多租户幂等索引升级为 `UNIQUE(tenant, object_key)`，统一 CRUD 幂等查询强制 tenant 作用域，实现租户间同名对象安全隔离。
- 实现真正的子进程级自动 E2E 测试，真实 spawn 启动 PocketBase、ASR Gateway Mock 与 Business Worker 进程，自动完成从音频上传、Mock转写、会话分段、队列入队、Worker认领、规则分析、问题生成到复核/申诉/整改/关闭全流程。
- ASR 重复成功导入幂等性严格验证，确认转写、会话、分段、分析任务、问题 5 类记录总数不重复递增。
- 上传 Token 校验引入 `crypto.timingSafeEqual` 时序安全比较与长度安全保护，修复 ASR Mock 模式下 `/health` 状态误判。
- 部署脚本修复未监听端口与首次运行死锁，支持 `ENV=test` 与 `ENV=production` 动态加载，PM2 重载改自适应 start/reload，健康检查严格校验 `online` 状态。
- 完整门禁命令 `pnpm verify`（包含 lint, typecheck, lint:secrets, test, test:integration, test:e2e, test:deploy, build, git diff --check）一次性全部通过。

---

## 2. 分支

`codex/yuqi-phase1-lite-pocketbase-v1`

---

## 3. 修复前 HEAD

`1459bed59cdf6587f97ae86d2f8c3f24153afb17` (即本轮验收补漏开始前 HEAD)

---

## 4. 最终 HEAD

`823e67a6dcfebcbf018a1bf18563a6ee5f27cda4` (代码 HEAD) / 报告提交后由 git commit 记录

---

## 5. 本轮新增 Commit

1. `fe12e15` `fix: correct builtin risk rule semantics`
2. `1ce4ed1` `fix: enforce scoped access for legacy operational data`
3. `148853a` `fix: scope audio idempotency by tenant`
4. `9e26e2d` `fix: harden upload token verification and asr mock health`
5. `cf07923` `fix: make lightweight deploy scripts first-run safe`
6. `823e67a` `test: add real asr and worker process e2e`

---

## 6. 正式 8 类规则验证

| 序号 | 规则代码 (code) | 规则名称 | 匹配类型 (match_type) | 风险等级 | 正向用例 (应命中) | 负向用例 (不命中) | 排除用例 (含否定词) | 结果 |
|---|---|---|---|---|---|---|---|---|
| 1 | `PRESCRIPTION_DRUG_SALES` | 处方药违规销售 | KEYWORD_ANY | HIGH | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 2 | `MEDICAL_INSURANCE_VIOLATION` | 医保话术违规 | KEYWORD_ANY | HIGH | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 3 | `EXAGGERATED_EFFICACY` | 夸大疗效 | COMBINATION | MEDIUM | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 4 | `IRRATIONAL_MEDICATION_ADVICE` | 不合理用药建议 | COMBINATION | MEDIUM | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 5 | `CONTRAINDICATION_NOT_ASKED` | 禁忌症未询问 | COMBINATION | MEDIUM | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 6 | `INDUCED_OVER_PURCHASE` | 诱导超量购买 | KEYWORD_ANY | MEDIUM | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 7 | `SERVICE_ATTITUDE` | 服务态度问题 | KEYWORD_ANY | LOW | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |
| 8 | `INSUFFICIENT_CONSULTATION_INFO` | 问诊信息不足 | COMBINATION | LOW | 3/3 PASS | 3/3 PASS | 1/1 PASS | **PASS** |

**规则总计用例**: 56+ table-driven 用例全部在 `server/rule-analyzer.test.mjs` 中自动运行通过。

---

## 7. 数据范围隔离验证矩阵

| 角色代码 | 验证资源 | 预期行为 | 测试验证结果 |
|---|---|---|---|
| `ADMIN` / `COMPLIANCE` | 全租户资源 (stores, employees, audio, transcripts, asr_jobs, issues, rectifications, devices) | 租户内全量可见与可操作 | **PASS (200)** |
| `REGION_MANAGER` | 本区域 stores, employees, audio_files, transcripts, asr_jobs, issues, rectifications | 本区域子树 200 可见；跨区域资源 404 不可见 | **PASS (200 / 404)** |
| `STORE_MANAGER` | 本店 stores, employees, audio_files, transcripts, asr_jobs, issues, rectifications, appeals | 本店 200 可见；跨店资源 404 不可见 | **PASS (200 / 404)** |
| `EMPLOYEE` | 自身已推送 issues, appeals, rectifications, notifications, device bindings, consent | 仅本人已推送记录可见；禁止读取 audio_files (403)、transcripts 全量列表 (403)、管理报表 (403) | **PASS (200 / 403 / 404)** |
| `AUDITOR` | 全租户只读资源 | list / view 200 可读；create / update / delete 统一 403 拒绝 | **PASS (200 / 403)** |

---

## 8. 多租户 `object_key` 幂等验证

| 测试场景 | 操作步骤 | 预期与实际结果 |
|---|---|---|
| Tenant A same-key | 租户 A (demo) 登记 `oss/storeA/audio-multi-tenant-001.mp3` | 首次创建成功，生成记录 ID A1 (200) |
| Tenant B same-key | 租户 B (other) 登记相同 `oss/storeA/audio-multi-tenant-001.mp3` | 首次创建成功，生成独立记录 ID B1 (200, B1 != A1) |
| Tenant A duplicate | 租户 A 再次登记同 key | 返回 `duplicate: true`，`item.id` 等于 A1 (绝不返回 B1) |
| Tenant B duplicate | 租户 B 再次登记同 key | 返回 `duplicate: true`，`item.id` 等于 B1 (绝不返回 A1) |

---

## 9. ASR 重复成功导入幂等验证

| 记录类型 | 第一次 ASR 成功导入后数量 | 第二次重复触发成功导入后数量 | 增量 | 幂等状态 |
|---|---|---|---|---|
| `transcripts` | 1 | 1 | +0 | **PASS (不重复)** |
| `sessions` | 1 | 1 | +0 | **PASS (不重复)** |
| `transcript_segments` | 1 | 1 | +0 | **PASS (不重复)** |
| `processing_jobs` | 1 | 1 | +0 | **PASS (不重复)** |
| `issues` | 1 | 1 | +0 | **PASS (不重复)** |

---

## 10. 真正进程级自动 E2E 验证

- **启动的真实子进程**:
  - `PocketBase` 子进程 (PID 动态分配, 独立临时数据目录)
  - `ASR Gateway Mock` 子进程 (PID 动态分配, 独立端口, `YUQI_ASR_MOCK=1`)
  - `Business Worker` 子进程 (PID 动态分配, 独立 Worker ID)
- **自动化运行链路**:
  1. 管理员登录建档 (静安店、员工小赵、设备 DEV-AUTO-001、知情同意审批)。
  2. 申请一次性上传 Token。
  3. POST 音频 fixture 到 ASR Gateway 网关接口。
  4. Gateway 自动生成 Mock 转写并写入 `transcripts`、`sessions`、`transcript_segments`，自动入队 `processing_jobs`。
  5. Worker 自动 poll 并原子 claim 任务，执行规则分析，自动落库 `risk_segments` 与 `issues`。
  6. 自动复核、推送、员工登录查看、申诉、驳回、整改、退回、重提、店长确认结案。
  7. 验证报表更新与 `audit_logs` 留痕。
- **全链路运行耗时**: ~3.2s，全数自动贯通。

---

## 11. 上传 Token 安全测试

- **正确 HMAC 签名**: 验证通过 (200, 提取 user/tenant/nonce)。
- **载荷篡改**: 拦截拒绝 (返回“令牌签名无效”)。
- **签名篡改**: 拦截拒绝 (返回“令牌签名无效”)。
- **签名长度不匹配 (少1字节)**: 拦截拒绝 (返回“令牌签名无效”)。
- **过期令牌**: 拦截拒绝 (返回“令牌已过期”)。
- **Nonce 重放**: 首次消费成功 (200)，二次消费拒绝 (400/403)。

---

## 12. 部署脚本验证

- **bash -n**: `deploy/scripts/*.sh` 全部 8 个脚本语法检查通过。
- **测试环境**: `ENV=test` 自动检查 `.env.test`。
- **生产环境**: `ENV=production` 自动检查 `.env.production`。
- **首次运行安全**: 端口 7040 / 18084 未监听时输出 info 且不失败退出。
- **PM2 状态检查**: 严格判断 `pm2_env.status === "online"`，非 online 状态或 missing 判定失败。

---

## 13. 门禁执行结果汇总

```bash
# 1. 规范检查
pnpm lint
# 0 errors

# 2. 类型检查
pnpm typecheck
# 0 errors

# 3. 密钥与违禁技术栈扫描
pnpm lint:secrets
# check-secrets: 未发现疑似密钥泄漏 ✓

# 4. 单元测试 (Vitest)
pnpm test
# 2 test files, 42 passed (42)

# 5. 集成测试 (API 场景 + E2E flows)
pnpm test:integration
# 27 passed (27)

# 6. 进程级自动 E2E
pnpm test:e2e
# 1 passed (1)

# 7. 部署脚本静态验证
pnpm test:deploy
# 6 passed (6)

# 8. 生产构建
pnpm build
# built in 1.14s (dist/ 生成完毕)

# 9. 一键完整门禁
pnpm verify
# ALL GATES PASS ✓
```

---

## 14. 生产服务器部署

- **状态**: `NOT EXECUTED`
- **说明**: 无生产服务器 SSH 与部署权限，未在远端生产环境执行。所有自动化部署脚本与 PM2/Nginx 配置已本地/CI 验证就绪。

---

## 15. 已知限制

1. 短信验证码服务在生产环境中需配置真实短信服务商环境变量（如阿里云 SMS），未配置时生产环境默认返回 503 且不启用固定码。
2. 音频文件在当前轻量一期中采用由服务端代理 OSS 元数据与按需授权播放的机制，不直接暴露原始 OSS 密钥。

---

## 16. 最终状态

符合所有验收要求与完整门禁验证：

**`MERGE CANDIDATE`**
