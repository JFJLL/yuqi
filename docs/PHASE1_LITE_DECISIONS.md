# 一期轻量闭环 · 技术决策记录 (DECISIONS)

分支: `codex/yuqi-phase1-lite-pocketbase-v1`
基线: `f8f22f7263f2ed2d380c6332f48b2794c7e6b394` (origin/main)
重型参考分支(只读): `codex/yuqi-phase1-closed-loop-v1` @ `1959ef159bb31ede8674e3ceac84949f72cafdb4`

## 一、架构决策 (本提示词优先级最高)

1. **保留 React + PocketBase + Node.js**。管理端与员工端共用同一 React/Vite 工程。
2. **不引入 Python、PostgreSQL、Redis**。不引入 FastAPI/SQLAlchemy/Alembic/ARQ/Celery/RabbitMQ/Java/Spring/MySQL/Docker/K8s。
3. **单服务器一期使用数据库任务表 (processing_jobs) + Node Worker (PM2: yuqi-business-worker)**，不使用 Redis 队列。
4. **保留已有 OSS 扫描 (server/oss-scanner.mjs) 和真实 ASR (server/asr-gateway.mjs + 远端 ASR 服务)**，只做安全/tenant/触发增强，不重写 ASR 模型。
5. **一期不开发大模型分析**。不做 LLM 规则推理。
6. **一期 RiskAnalyzer 使用规则库 (risk_rules)**：关键词/正则/组合匹配，输出疑似风险片段与疑似问题。
7. **一期只服务一个试点租户**，但核心数据模型保留 `tenant` 字段，迁移回填默认租户，后续可扩展多租户。
8. **员工 H5 与管理端使用同一 React 工程**，不同布局与路由 (`/employee/*`)，不新建 Vue/uni-app。
9. **重型分支不合并、不 cherry-pick、不拷贝 backend/ 与 Python/PostgreSQL/Redis 相关代码**，仅作为 UI 与业务交互参考，逐文件人工审查。
10. **不进行生产数据破坏性迁移**。tenant 回填只加字段、只补默认值，不清空、不改 ID、不破坏既有关系。

## 二、术语统一

所有机器识别结果统一称为：**疑似风险 / 疑似问题 / 风险提示 / 改进建议**。
界面与导出中不得直接写"已确认违规"。统一提示语：

> 系统识别结果仅为疑似风险，最终判断由授权管理人员完成。

## 三、权限模型

- 认证: PocketBase 原生 Auth Collection `app_users` + 原生 Token (auth-with-password / auth-refresh / 服务端 recordAuthResponse)。
- 角色: `SUPER_ADMIN / ADMIN / COMPLIANCE / REGION_MANAGER / STORE_MANAGER / EMPLOYEE / AUDITOR`。
- 数据范围: `user_data_scopes` 绑定到用户 (ALL / ORG_TREE / STORE / SELF)。
  禁止把具体 store_id 挂到共享角色模板；A 店店长与 B 店店长共用 `STORE_MANAGER` 角色，数据范围互不影响。
- tenant 一律来自认证用户 (或内部服务身份)，前端不得传入任意 tenant_id。

## 四、后台任务

- processing_jobs 表 + Node Worker。原子领取、锁超时恢复、idempotency_key 去重、失败指数退避、超过 max_attempts 置 FAILED。
- 内部路由一律要求 `X-Yuqi-Service-Token` (环境变量注入，不入 Git)。

## 五、ASR/OSS

- 上传凭证: 登录管理员向 PocketBase 请求短期上传 Token (HMAC 签名, 含 user/tenant/expiry/nonce/action)，ASR Gateway 验证后接收。
- 测试环境可用 Mock 转写 (tests/fixtures/transcripts/*.json)，生产禁止把 Mock 结果伪装成真实 ASR。

## 六、浏览器安全

- 浏览器不保存 PocketBase 超级管理员密码/Token；前端使用 app_users 角色 Token (受租户/角色/范围约束)，Token 过期走 auth-refresh。
