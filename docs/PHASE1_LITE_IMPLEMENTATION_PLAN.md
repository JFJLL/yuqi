# 一期轻量闭环 · 实施计划 (IMPLEMENTATION PLAN)

目标: 在现有 React + PocketBase + Node.js 技术栈上，实现一期闭环:
建档 → 设备绑定 → 音频上传(OSS/后台) → ASR 转写 → 规则分析 → 人工复核 → 推送员工 → 申诉/整改 → 关闭 → 看板/报表/审计。

## 阶段划分

| 阶段 | 内容 | 关键产出 | 建议提交 |
|---|---|---|---|
| 0 | 基线审计 + 安全止血 | 审计表、docs、secrets 脚本、seed 开关、lint/typecheck/build 基线 | chore: establish lightweight phase one baseline / fix: restrict legacy demo and sensitive routes |
| 1 | PocketBase 原生登录、租户、权限 | tenants/app_users/user_data_scopes/sms_codes/audit_logs；统一守卫；管理端登录；员工验证码 | feat: add pocketbase authentication and tenant context / feat: implement user scoped permissions / feat: add admin and employee login flows |
| 2 | 一期轻量数据模型 | sessions/transcript_segments/risk_rules/risk_rule_versions/risk_segments/issues/appeals/rectifications/issue_events/notifications/recording_consents/processing_jobs；tenant 回填 | feat: add lightweight phase one business collections |
| 3 | 数据库任务表 + Node Worker | processing_jobs + server/business-worker.mjs (PM2: yuqi-business-worker) | feat: add pocketbase backed processing jobs / feat: add node business worker |
| 4 | 接通并加固 OSS/ASR | service token、上传 Token、成功写 session/segments、自动入队 RISK_ANALYSIS、Mock 模式 | feat: secure existing oss and asr integrations / feat: persist sessions and transcript segments / feat: enqueue risk analysis after transcription |
| 5 | RuleRiskAnalyzer | 8 类规则、risk_segments/issues、版本化幂等 | feat: implement rule based suspected risk analysis |
| 6 | 管理端复核/申诉/整改 | issue 复核、申诉复核、整改闭环、数据范围 | feat: add issue appeal and rectification workflow |
| 7 | 员工移动端 | /employee/* 路由 + EmployeeLayout + 自助服务 | feat: add employee mobile self service |
| 8 | 报表/审计/保留 | 服务端聚合报表、导出带审计、证据锁、保留策略 | feat: add reports audit and evidence retention |
| 9 | PM2/Nginx 部署 | ecosystem + nginx + deploy 脚本 + backup/rollback | chore: add lightweight deployment and rollback |

## 关键约束

- 禁止 Python/PostgreSQL/Redis/ARQ/Celery/RabbitMQ/Java/Docker/K8s。
- 不删除现有 oss-scanner/asr-gateway/audio_files/transcripts/asr_jobs/inspection_issues/rectify_tasks。
- 所有机器结果表述为"疑似风险"，界面/导出统一提示语。
- 每阶段: 测试 → lint → typecheck → build → git diff --check → 更新 PROGRESS → 提交。
- 全部门禁与贯通链路真实通过才可写 MERGE CANDIDATE。

## 验收链路 (两条)

1. 管理员登录 → 建组织门店 → 建员工 → 建设备 → 员工确认录音制度 → 绑定 → 上传音频 → ASR/Mock 转写 → session+segments → RISK_ANALYSIS 任务 → 命中规则 → 疑似 issue → 合规复核通过 → 推送员工 → 员工登录 → 查看问题 → 申诉 → 店长驳回 → 整改 → 退回 → 重提 → 确认 → 关闭 → 看板更新 → 导出带操作人 → audit_logs 可查。
2. 疑似问题 → 复核通过 → 员工申诉 → 申诉成立 → 原始命中保留 → 有效问题数减少 → 误报数增加 → 申诉通过率更新。
