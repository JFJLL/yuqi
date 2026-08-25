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
- [x] 阶段 3: 数据库任务表 + Node Worker (server/business-worker.mjs, PM2 yuqi-business-worker)
- [x] 阶段 4: 接通并加固 OSS/ASR (upload-token, HMAC, mock ASR, 内部服务鉴权)
- [x] 阶段 5: RuleRiskAnalyzer (8 类规则, keyword/regex/combination, 证据时间锚点)
- [x] 阶段 6: 管理端复核/申诉/整改闭环 (复核, 申诉, 补充, 退回, 确认, 事件溯源)
- [x] 阶段 7: 员工移动端 (/employee/*, 响应式, 验证码登录, 申诉, 整改, 知情同意)
- [x] 阶段 8: 报表/审计/保留 (服务端聚合报表 + 受限导出 + 审计视图, 本机验证通过)
- [x] 阶段 9: PM2/Nginx 部署脚本 (ecosystem.config.cjs, deploy/scripts/*, nginx 配置)
- [x] 种子数据 scripts/seed-phase1-demo.mjs (1 租户, 3 门店, 12 员工, 10 设备, 200+ 会话/音频, 1500+ 分段, 60+ 问题, 幂等安全)
- [x] 测试: 单测 18 项 + 集成 25 场景 + 2 条 E2E 完整贯通链路全数通过
- [x] 最终报告 (PHASE1_LITE_FINAL_REPORT.md, 状态: MERGE CANDIDATE)

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

## 阶段 3 验证记录 (2026-08-24)

- processing_jobs 集合 + 内部任务路由 (/api/yuqi/internal/jobs/*, X-Yuqi-Service-Token 鉴权):
  enqueue(幂等键)/claim(原子条件 UPDATE 领取+锁超时)/success/retry/fail;
- v0.40 JSVM 无 $app.db().transactional, 原子领取改用单条条件 UPDATE (SQLite 单语句原子);
- server/business-worker.mjs (PM2 进程名 yuqi-business-worker): 轮询领取→执行→回写,
  失败指数退避, max_attempts 进入 FAILED; 通过 YUQI_PB_URL/YUQI_SERVICE_TOKEN 连接;
- server/rule-analyzer.mjs: 纯 Node 规则分析器 (KEYWORD_ANY/ALL/REGEX/COMBINATION), 可单测;
- risk_rules 增 created_by/updated_by 字段迁移; 规则修改生成 risk_rule_versions 快照;
- init-builtin 8 条内置规则 (处方药/医保话术/夸大疗效/不合理用药/禁忌症/诱导超量/服务态度/问诊信息);
- 设备活跃绑定唯一性: 部分唯一索引 (tenant+device WHERE status='ACTIVE');
- 实测: 会话→入队→Worker 分析→risk_segments+issues 落库→SUCCEEDED;
  同版本重复分析 0 新建(幂等); 新 analysis_version 正常生成新问题。

## 阶段 4 验证记录 (2026-08-24)

- asr-gateway.mjs 加固: X-Yuqi-Upload-Token 短期一次性上传令牌 (HMAC-SHA256 签名验证
  + nonce 消费防重放 + 过期/篡改/复用拒绝); Mock 模式 (YUQI_ASR_MOCK=1) 走同一套落库链路;
  转写成功后创建/更新 session + 写 transcript_segments (sequence 幂等) + 自动入队 RISK_ANALYSIS;
  ASR 失败只写失败不写“无问题”; 错误信息脱敏; 上传大小/扩展名限制;
- oss-scanner.mjs: 所有 PB 请求带 X-Yuqi-Service-Token (内部身份);
- 修复: v0.40 createJWT 第三参为秒 (传纳秒导致 exp 溢出为负); empty date 字段判空需 String() 包裹;
- 新增 tests/helpers/pb_bootstrap.py: 幂等引导 (superuser→tenant→region/store/employee→app_users→scopes),
  供集成测试复用;
- 实测通过: 登录→申请上传令牌→网关 Mock 转写 202→session/segments/RISK_ANALYSIS 生成→
  Worker 执行→2 个疑似问题 (MEDICAL_INSURANCE_VIOLATION HIGH, INDUCED_OVER_PURCHASE MEDIUM)
  + 2 个 risk_segments (含 start_ms/end_ms 时间锚点), 初始 review=PENDING + employee_visibility=HIDDEN;
  令牌复用/缺失/篡改均 403。

## 阶段 8 验证记录 (2026-08-24)

- GET /api/reports/overview: 服务端聚合 (录音/转写/会话/疑似问题/风险分布/最终有效/误报/
  申诉通过率/整改完成率/门店排行/员工分布/设备在线率/ASR 成功率/分析任务成功率/逾期整改),
  全部带 tenant+时间范围+数据范围; 浏览器不拉全量;
- GET /api/reports/export/issues: CSV 导出, 头信息含租户名称/操作人/操作账号/导出时间/数据范围/
  请求ID + “系统识别结果仅为疑似风险，最终判断由授权管理人员完成。”说明; 写 audit_logs(report_export);
- GET /api/yuqi/transcripts/{id}/view: 完整转写查看 (ADMIN/COMPLIANCE/REGION_MANAGER/STORE_MANAGER+范围),
  写 audit_logs(transcript_view);
- GET /api/yuqi/audio/{id}/play: 音频访问 (tenant 隔离, audio_files 无 store/employee 字段),
  写 audit_logs(audio_play);
- 实测: 报表数字与种子数据一致 (4 issues: 2 最终有效/1 误报/1 待复核; 申诉通过率 50%;
  整改完成率 50%; 设备在线率 50%; 分析成功率 75%); 店长报表 scope=STORE;
  未登录 401; 员工角色 403; 导出含操作人信息; 转写查看/音频播放审计落库。

## 提交历史 (按序)

- chore: establish lightweight phase one baseline
- fix: restrict legacy demo and sensitive routes
- (阶段 1-2) feat: add pocketbase authentication, tenant context and guarded CRUD
- (阶段 1-2) feat: add phase one workflow routes (review/appeal/rectification/device/employee)
- (阶段 1-2) fix: lock collection api rules and harden legacy hooks
- (阶段 3+5) feat: add processing jobs, node business worker and rule based risk analysis
- chore: add asr mock transcript fixture and ignore python caches
- (阶段 8) feat: add server side reports scoped export and audit views
