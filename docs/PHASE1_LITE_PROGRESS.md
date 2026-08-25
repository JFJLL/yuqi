# 一期轻量闭环 · 进度跟踪 (PROGRESS)

FINAL_ASR_ATOMIC_FIX_START_SHA=5ecf2c4100086cdef0d32ac098e878f589f24762

基线: origin/main @ `f8f22f7263f2ed2d380c6332f48b2794c7e6b394`
分支: `codex/yuqi-phase1-lite-pocketbase-v1`

## 环境基线 (阶段零记录)

- Node: v24.11.1
- pnpm: 10.33.0
- PocketBase 二进制: v0.40.0 (本地 windows_amd64; 服务器 linux_amd64 由 start-linux.sh 下载)
- PM2 进程: yuqi-pb (127.0.0.1:7040), yuqi-asr-gateway (127.0.0.1:18084), yuqi-oss-scanner, yuqi-business-worker
- Nginx: deploy/nginx/yuqi.red-magic.cn.conf (SSL, /__pb → 7040, /__asr → 18084, dist 静态)
- 端口: 7040 PB, 18084 ASR Gateway, 18082 frp 回环(远端 ASR), 18083 本机 ASR, 8040 Vite dev
- 构建基线: typecheck 通过; lint 0 错误通过; 生产 PocketBase 数据未触碰(无服务器权限)

## 实施阶段跟踪

- [x] 阶段 0: 代码与安全基线审计 (敏感路由收拢, 密钥扫描, demo seed 锁)
- [x] 阶段 1: PocketBase 原生登录与数据范围 (app_users, user_data_scopes, sms_codes, 统一守卫)
- [x] 阶段 2: 一期轻量数据模型 (sessions, transcript_segments, risk_rules, issues, appeals, rectifications)
- [x] 阶段 3: 数据库任务表与 Node Worker (processing_jobs, server/business-worker.mjs, 原子领取/重试)
- [x] 阶段 4: 保留并接通现有 OSS 与 ASR (oss-scanner 强化, asr-gateway 鉴权与转写落库)
- [x] 阶段 5: RuleRiskAnalyzer (8 类规则, keyword/regex/combination, 证据时间锚点)
- [x] 阶段 6: 管理端复核/申诉/整改闭环 (复核, 申诉, 补充, 退回, 确认, 事件溯源)
- [x] 阶段 7: 员工移动端 (/employee/*, 响应式, 验证码登录, 申诉, 整改, 知情同意)
- [x] 阶段 8: 报表/审计/保留 (服务端聚合报表 + 受限导出 + 审计视图)
- [x] 阶段 9: PM2/Nginx 部署脚本 (ecosystem.config.cjs, deploy/scripts/*, 环境自适应与健康检查)
- [x] 最终合并前补丁:
  - [x] P0: transcript_segments & risk_segments 组织树与门店数据范围隔离加固
  - [x] P0: 真实调用 asr-gateway importSucceededJob 两次的 6 类数据 ASR 幂等测试 (+0 严格断言)
  - [x] P1: 生产 ASR 健康检查拒绝 degraded/unconfigured/mock 假通过 (check-asr-health.mjs)
  - [x] 门禁: pnpm verify 全量通过
- [x] 最终报告 (PHASE1_LITE_FINAL_REPORT.md, 状态: MERGE CANDIDATE)

## 本轮补丁: ASR 导入原子完成语义最终修复 (Final ASR Import Atomicity Fix)

- [x] 调整 importSucceededJob 提交顺序: transcript -> persistSessionAndSegments -> asr_job result_imported_at -> sync_log
- [x] 下游持久化失败状态处理: 不吞异常, status=queued, error_code=downstream_persist_failed, result_imported_at 保持为空
- [x] 增加 (tenant, transcript) 会话唯一索引与幂等保护 (1787500008_phase1_session_unique.js)
- [x] 覆盖故障注入 (Test A)、失败恢复 (Test B)、半完成幂等恢复 (Test C) 与完整重放 (Test D) 集成测试

## 最终交付状态
状态: MERGE CANDIDATE (ASR 导入原子完成语义最终修复与全量门禁已通过)
