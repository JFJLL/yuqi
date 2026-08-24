# 安全模型 (SECURITY_MODEL)

## 认证

- 管理端: 账号或手机号 + 密码，密码 Argon2id 哈希；登录失败限流（5 次/15 分钟滑动窗口）；登录日志；账号启用/停用。
- 员工端: 手机号 + 验证码（`SmsProvider`，一期 `MockSmsProvider`，生产禁用固定验证码）；验证码过期 5 分钟、发送频率限制、验证失败次数限制；停职/离职员工禁止登录。
- Token: 短期 Access Token (JWT, 15 分钟) + 可撤销/可轮换 Refresh Token；退出后立即失效；密码重置后旧会话全部失效；生产走安全 Cookie (HttpOnly/Secure/SameSite) + CSRF 防护；可信代理头配置。

## 授权 (RBAC)

- 默认角色: 平台超级管理员 / 客户管理员 / 总部合规专员 / 区域经理 / 店长 / 复核人员 / 普通员工 / 只读审计人员。
- `permissions` + `role_permissions` + `user_roles`；`role_data_scopes` 定义数据范围（全部组织 / 指定组织及子级 / 本门店 / 仅本人）。
- 前端菜单隐藏不替代后端权限校验；每个 API 端点校验 `PermissionService`。

## 租户隔离

- 所有核心业务表含 `tenant_id`；联合索引以 `tenant_id` 开头。
- 客户端**不得**自行指定有效 `tenant_id`：`TenantContext` 取自已认证会话，repository/service 统一注入租户条件。
- 跨租户对象 ID 访问一律返回 404（不泄露存在性）；数据范围在服务端执行。

## 文件与对象存储

- 数据库只保存 object_key/哈希/元数据；前端使用临时签名上传；下载/播放使用短时签名 URL；不暴露永久公网地址。
- 上传校验: 类型（音频 MP3/WAV/M4A）、大小、SHA-256 哈希；对象键带租户隔离前缀；防路径穿越。

## 审计

- 播放/下载/查看全文/导出/修改文本/重跑分析/改规则/发布规则/删除/恢复/调绑定/看申诉证据 均写 `audit_logs`（tenant_id, actor_id, action, resource_type, resource_id, request_id, ip, user_agent, before/after snapshot）。
- 日志脱敏: Bearer Token、密码、API Key、OSS Secret 一律 redact。

## 集成 API

- 所有 `/api/v1/integrations/*` 使用独立 `client_id` + 密钥 + 时间戳 + Nonce + HMAC 签名 + 幂等键 + 重放限制 + 请求日志 + 可选 IP 白名单 + 密钥轮换。

## 阶段零已修复

1. `POST /api/admin/seed` 封禁: `ALLOW_DEMO_SEED` 默认 false（生产拒绝）+ 仅 PocketBase 超级管理员 + 必须携带 `X-Seed-Confirm: 1` 二次确认。
2. 密钥提交检查脚本 + pre-commit hook（`scripts/check-secrets.sh`）。
3. 旧 PocketBase 路由弃用清单（`docs/LEGACY_POCKETBASE_ROUTES.md`），迁移期后移除公网暴露。
