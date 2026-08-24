# 数据迁移 (DATA_MIGRATION): PocketBase → PostgreSQL

## 原则

- 迁移只读源数据，**不删除** PocketBase 任何数据；PocketBase 保留为回滚保障。
- 使用 `legacy_id` 去重，脚本可重复运行（幂等）。
- 支持 `--dry-run`；输出源/目标数量、未迁移/失败/关系缺失记录；写入迁移批次号。
- 迁移失败整体可回滚（事务内执行，批次记录回滚标记）。
- 本地无 PocketBase 真实数据（无 `pb_data`），脚本使用 `seed` 生成的模拟数据验证；**生产迁移未执行**（无服务器权限）。

## 表映射

| PocketBase | PostgreSQL | 说明 |
|---|---|---|
| regions | organization_nodes (node_type=REGION) | 机构树根→租户 |
| stores | organization_nodes + stores | 门店节点 + 门店档案 |
| employees | employees | 保留 legacy_id、关联门店/区域 |
| devices | devices | 保留 legacy_id |
| device_bindings | device_bindings | 绑定历史 |
| transcripts | audio_files + conversations + text_versions + transcript_segments | 单 JSON 字段拆分为三层模型 |
| inspection_issues | issues (source=LEGACY_IMPORT) + risk_segments(可空) | 单 state 拆分为多状态字段 |
| rectify_tasks | rectifications | 状态映射 |
| appeals | appeals | 状态映射 |
| compliance_rules | risk_rules (rule_set 默认) | 规则迁入版本表 |
| audio_files | audio_files | 直接对应 |
| asr_jobs | processing_jobs | 任务记录 |
| sync_logs / device_logs | audit_logs / integration_request_logs | 审计化 |

## 状态映射（旧单状态 → 新多状态）

- 旧 `inspection_issues.state`（待整改/申诉中/已完成…）→ `issues.{review_status, employee_view_status, appeal_status, remediation_status, close_status}` 按规则展开，来源标 `LEGACY_IMPORT`，并保留 `legacy_state` 原文。

## 脚本

- `backend/scripts/export_legacy_snapshot.py` — 从 PocketBase 导出 JSON 快照（备份保障）。
- `backend/scripts/migrate_pocketbase_to_postgres.py` — 执行迁移（支持 `--dry-run`、`--snapshot` 指定快照）。
- `backend/scripts/verify_migration.py` — 对比源/目标数量与关键关系完整性。

## 验证与回滚

1. 备份 PocketBase 数据与文件；
2. 快照导出 → 迁移（dry-run）→ 迁移 → 校验（数量+关系）；
3. 校验不通过则回滚批次（脚本内置 `--rollback-batch <id>`）。
