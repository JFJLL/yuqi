# 一期轻量闭环 · 安全设计 (SECURITY)

## 认证

- 管理端/员工端统一使用 PocketBase 原生 Auth Collection `app_users`。
- 登录: POST /api/yuqi/auth/login (用户名+密码) 与 POST /api/yuqi/auth/employee/login (手机号+短信验证码)。
- Token: PocketBase 原生 auth token (记录签名), 服务端通过 `$apis.recordAuthResponse` 签发, 不自造弱 JWT。
- 刷新: 原生 auth-refresh; 会话失效: `app_users.token_version` 递增 + 守卫比对 token `iat`。
- 浏览器仅保存 app_users 角色 Token (localStorage), **绝不保存超级管理员密码/Token**。

## 员工验证码 (sms_codes)

- 60s 禁止重复发送; 每手机号每小时限次; 最多失败 5 次; 使用即失效; 过期失效。
- 固定验证码仅 dev/test (env `YUQI_DEV_FIXED_CODE`); production 该值必须为空且 `YUQI_ENV=production` 时强制拒绝固定码。
- 生产未配置真实 SmsProvider → 返回明确错误 "短信服务未配置", 不自动启用固定码。
- 员工必须存在、状态在职, app_users 必须关联 employee, 停职/离职/停用不得登录。

## 授权与数据范围

- 统一守卫模块 `pocketbase/pb_hooks/_lib/guards.js` (JSVM require 内联, 避免多份不一致逻辑)。
- requireAuth / requireRole / requirePermission / getTenantFromAuth / assertTenant / assertStoreVisible / assertEmployeeVisible / buildScopeFilter / writeAuditLog。
- 角色矩阵:

| 角色 | 全租户 | 区域树 | 本店 | 本人 | 只读 |
|---|---|---|---|---|---|
| SUPER_ADMIN | ✔ (含系统管理) | | | | |
| ADMIN | ✔ | | | | |
| COMPLIANCE | ✔ (复核/申诉/整改确认) | | | | |
| REGION_MANAGER | | ✔ 分配区域及子组织 | | | |
| STORE_MANAGER | | | ✔ 本店 | | |
| EMPLOYEE | | | | ✔ 本人已推送问题 | |
| AUDITOR | 按 assigned scope | | | | ✔ 只读 |

- 列表/详情/写操作/复核/关闭/导出/全量转写/音频播放 全部走 buildScopeFilter, 杜绝"列表受限但知道 ID 可直接写"。
- 跨 tenant/跨门店/跨员工访问统一 404/403, 不泄露资源是否存在。
- tenant 只来自认证用户或内部服务身份, 前端请求中的 tenant 参数被忽略。

## 内部服务

- ASR Gateway / OSS Scanner / Business Worker 通过 `X-Yuqi-Service-Token` 访问内部路由; Token 从环境变量读取, 不入 Git。
- 服务身份固定 tenant (env `YUQI_SERVICE_TENANT_CODE`), 不得由调用方任意指定。
- 上传凭证: 登录管理员向 `/api/yuqi/upload-token` 申请短期一次性 Token (HMAC-SHA256, 含 user/tenant/expiry/nonce/action), ASR Gateway 校验。
- 浏览器不得获得长期内部 Service Token。

## 审计与日志

- 写操作/登录/登出/查看全量转写/音频播放下载/导出/规则修改/分析重跑/复核/申诉/整改/绑定解绑/删除 全部写 audit_logs。
- 日志脱敏: Token、Cookie、密码、OSS Secret、ASR 错误信息中的凭据; `safeMessage` 统一 Bearer [redacted]。
- `scripts/check-secrets.mjs` 门禁: 拒绝真实密钥进入 Git; 拒绝 Python/Redis/PostgreSQL 技术栈痕迹。

## 删除与保留

- 默认软删除; 问题/申诉/整改进行中禁止删除证据; 被 issue 引用的转写/音频进入证据锁。
- 原始音频生命周期由 OSS 生命周期管理; 一期只做保留策略配置、到期检查与安全删除入口, 不做大规模物理清理。
