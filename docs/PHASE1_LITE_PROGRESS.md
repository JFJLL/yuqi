# 一期轻量闭环 · 进度跟踪 (PROGRESS)

基线: origin/main @ `f8f22f7263f2ed2d380c6332f48b2794c7e6b394`
分支: `codex/yuqi-phase1-lite-pocketbase-v1`

## 环境基线 (阶段零记录)

- Node: v24.11.1
- pnpm: 10.33.0
- PocketBase 二进制: v0.40.0 (本地 windows_amd64; 服务器 linux_amd64 由 start-linux.sh 下载)
- PM2 进程: yuqi-pb (127.0.0.1:7040), yuqi-asr-gateway (127.0.0.1:18084), yuqi-oss-scanner
- Nginx: deploy/nginx/yuqi.red-magic.cn.conf (SSL, /__pb → 7040, /__asr → 18084, dist 静态)
- 端口: 7040 PB, 18084 ASR Gateway, 18082 frp 回环(远端 ASR), 18083 本机 ASR, 8040 Vite dev
- 构建基线: typecheck 通过; lint 修复既有 59 错误后通过; 生产 PocketBase 数据未触碰(无服务器权限)

## 阶段零审计表 (路由安全基线)

| 路由 | 匿名可访问 | 读 tenant | 校验角色 | 校验门店/本人 | 写审计 | 幂等 | 测试 | 一期处置 |
|---|---|---|---|---|---|---|---|---|
| /api/<collection> CRUD (17 集合) | 是(历史) | 否 | 否 | 否 | 否 | 部分(object_key) | 否 | 阶段一重写为守卫路由+tenant+范围+审计 |
| /api/admin/dashboard/summary | 是 | 否 | 否 | 否 | 否 | 否 | 否 | 阶段八重写为服务端报表(带范围) |
| /api/admin/sync | 是 | 否 | 否 | 否 | 否 | 否 | 否 | 重写为受保护内部/登录路由 |
| /api/admin/seed | 是 | 否 | 否 | 否 | 否 | 是(清空重写) | 否 | 已加环境开关默认 403, 阶段六删除 |
| /api/asr/jobs* (ASR Gateway) | 是 | 否 | 否 | 否 | sync_logs | 否 | 否 | 阶段四加上传 Token+服务 Token |
| /api/transcripts?active=1 等轮询 | 是 | 否 | 否 | 否 | 否 | 否 | 否 | 阶段四要求 X-Yuqi-Service-Token |
| /api/audio_files object_key 幂等 | 是 | 否 | 否 | 否 | 否 | 是 | 否 | 阶段四保留幂等+内部鉴权 |
| /api/llm/models, /api/aigc/* | 是(未注册路由) | - | - | - | - | - | - | 一期不启用 AI, 页面保留降级提示 |

## 阶段进度

- [x] 阶段 0: 基线审计 + 安全止血 (docs/审计表/check-secrets/seed 开关/lint 基线)
- [x] 阶段 1: PocketBase 原生登录、租户、权限 (后端: migrations + guards + auth + 守卫 CRUD, 本机验证通过)
- [x] 阶段 2: 一期轻量数据模型 (后端集合已建, 规则已锁死; 前端接入待阶段 6/7)
- [ ] 阶段 3: 数据库任务表 + Node Worker
- [ ] 阶段 4: 接通并加固 OSS/ASR
- [ ] 阶段 5: RuleRiskAnalyzer
- [ ] 阶段 6: 管理端复核/申诉/整改闭环 (后端路由已就绪, 待前端接入)
- [ ] 阶段 7: 员工移动端
- [ ] 阶段 8: 报表/审计/保留
- [ ] 阶段 9: PM2/Nginx 部署脚本
- [ ] 种子数据 scripts/seed-phase1-demo.mjs
- [ ] 测试: 单测 + 集成 25 场景
- [ ] 最终报告

## 阶段 1-2 后端验证记录 (2026-08-24)

- PocketBase v0.40.0 本地实测: routerAdd((e)=>e.json()) 兼容; auth collection + 原生 Token 可用;
- JSVM 经验: 所有 hook 文件共享顶层作用域(同名顶层 const/function 会冲突); routerAdd handler 无法访问词法闭包
  (顶层 const/var/function 在 handler 内全部 undefined), 唯一可靠模式 = handler 函数体内 require() 模块。
  因此所有守卫/辅助逻辑已移入 pb_hooks/_lib/*.js 模块。
- v0.40 API 规则语义: `null` = 锁定(403), `""` = 公开。全部业务集合规则已统一为 null, 直接访问
  /api/collections/*/records 均 403; 前端业务数据一律走受保护自定义路由。
- 浏览器自动弹出安装页问题: 根因 = serve 时无 superuser; 修复 = 先 `superuser upsert` 再 serve, 不再弹窗。
- 本机验证通过: 管理员登录/错误密码/登出/改密/me/看板 401 与 200; 员工验证码发送(dev 固定码)、
  验证码登录、验证码复用拒绝、生产环境固定码禁用(503 sms_not_configured);
  未登录访问业务数据 401/403; 跨集合锁定 35 个集合。

## 提交历史 (按序)

- chore: establish lightweight phase one baseline
- fix: restrict legacy demo and sensitive routes
- (阶段 1-2) feat: add pocketbase authentication, tenant context and guarded CRUD
- (阶段 1-2) feat: add phase one workflow routes (review/appeal/rectification/device/employee)
- (阶段 1-2) fix: lock collection api rules and harden legacy hooks
