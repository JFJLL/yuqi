# 一期轻量闭环 · 数据模型 (DATA MODEL)

PocketBase (SQLite) 集合。所有业务集合带 `tenant` (relation → tenants)。

## 新增集合

### tenants
id, code, name, status, created, updated

### app_users (Auth Collection)
- tenant (relation)
- employee (relation → employees, 员工账号必填)
- display_name (text)
- role_code (text): SUPER_ADMIN/ADMIN/COMPLIANCE/REGION_MANAGER/STORE_MANAGER/EMPLOYEE/AUDITOR
- status (text): ACTIVE/DISABLED
- assigned_org (relation → regions)
- assigned_store (relation → stores)
- last_login_at (date)
- token_version (number, 会话失效用: 登出/改密时 +1)
- mobile (text, 员工登录用)
- email (系统字段), password (系统字段)

### user_data_scopes
tenant, user (relation → app_users), scope_type (ALL/ORG_TREE/STORE/SELF), org_node (relation → regions), store (relation → stores), status

### sms_codes
tenant, mobile, code_hash, expires_at, failed_attempts, sent_at, consumed_at, request_ip, status (ACTIVE/USED/EXPIRED/FAILED)

### audit_logs
tenant, actor (relation → app_users), actor_name, action, target_type, target_id, detail_json, ip, request_id, created

### sessions
tenant, audio_file (relation → audio_files), transcript (relation → transcripts), employee, store, device, device_sn, status, started_at, ended_at, duration_ms, transcript_version, parent_session, source_session, version, created

### transcript_segments
tenant, session (relation → sessions), transcript (relation → transcripts), version, sequence, start_ms, end_ms, speaker, speaker_role, text, confidence, created
(唯一: session+version+sequence；新转写完成后同步写, 旧 transcripts.segments_json 保留兼容并幂等回填)

### risk_rules
tenant, code, name, category, risk_level, match_type (KEYWORD_ANY/KEYWORD_ALL/REGEX/COMBINATION), pattern_json, advice, recommended_expression, enabled, version, status, created_by, updated_by, created, updated

### risk_rule_versions
tenant, rule (relation → risk_rules), version, snapshot_json, created_by, created

### risk_segments
tenant, session, transcript, transcript_version, rule (relation → risk_rules), rule_code, rule_version, analysis_version, sequence, start_ms, end_ms, speaker, text, risk_level, advice, recommended_expression, evidence_json, status, created
(幂等: tenant+session+transcript_version+rule_code+analysis_version)

### issues
tenant, session, transcript, employee, store, rule (relation → risk_rules), rule_code, rule_version, analysis_version, risk_level, title, summary, evidence_text, start_ms, end_ms, advice, recommended_expression,
analysis_status (PENDING/SUCCEEDED/FAILED),
review_status (PENDING/APPROVED/DISMISSED),
employee_visibility (HIDDEN/VISIBLE),
employee_view_status,
appeal_status (NONE/PENDING/NEEDS_MORE_INFO/APPROVED/REJECTED/CANCELLED),
rectification_status (NONE/PENDING/SUBMITTED/NEEDS_REVISION/CONFIRMED/OVERDUE/CANCELLED),
close_status (OPEN/CLOSED),
reviewed_by, reviewed_at, review_comment, pushed_to_employee, pushed_at, created, updated

### appeals (扩展现有 appeals 集合, 不覆盖历史)
tenant, issue (relation → issues), employee, reason, supplementary_text, supplementary_file, status (PENDING/NEEDS_MORE_INFO/APPROVED/REJECTED/CANCELLED), reviewer, review_comment, submitted_at, reviewed_at, created
(申诉为独立集合, 保留完整历史, 补充内容不覆盖原申诉)

### rectifications
tenant, issue (relation → issues), employee, store, title, remediation_type, requirements, due_at, status (PENDING/SUBMITTED/NEEDS_REVISION/CONFIRMED/OVERDUE/CANCELLED), submission_text, evidence_file, submitted_at, confirmed_by, confirmed_at, confirmation_comment, retry_count, created

### issue_events
tenant, issue, event_type, from_status, to_status, actor, actor_name, comment, detail_json, created
(所有状态变化必须写 issue_events)

### notifications
tenant, user (relation → app_users), employee, title, body, type, link, is_read, read_at, created

### recording_consents
tenant, employee, store, device, agreed, content_version, agreed_at, ip, created

### processing_jobs
tenant, job_type, business_key, idempotency_key, status (QUEUED/RUNNING/RETRYING/SUCCEEDED/FAILED/CANCELLED), priority, attempts, max_attempts, next_retry_at, locked_by, locked_at, started_at, finished_at, error_code, error_message, payload_json, result_json, request_id, created, updated
(唯一: tenant+idempotency_key)

## 既有集合 (保留, 增加 tenant, 不清空不删)

regions, stores, employees, devices, device_bindings, audio_files, asr_jobs, transcripts, inspection_issues (legacy), rectify_tasks (legacy), appeals (升级), compliance_rules (legacy), sync_logs, device_logs, knowledge_items, model_evals, app_settings

## 关系与流转

audio_files → sessions (1:1 一期) → transcript_segments → risk_segments → issues
issues 状态字段拆分见上。员工端仅可见: review_status=APPROVED && employee_visibility=VISIBLE && employee=本人。
