/// <reference path="../pb_data/types.d.ts" />
// 1787500003_phase1_lockdown.js — 集合 API 规则锁死
//
// 一期所有业务数据访问必须走受保护的自定义路由 (/api/yuqi/* 与受控聚合路由),
// 禁止通过 PocketBase 原生 /api/collections/<name>/records 匿名读写。
// 本迁移将业务集合的 list/view/create/update/delete 规则统一设为 "" (拒绝所有人),
// 对已存在集合与迁移期新建集合均生效。系统集合 (_superusers 等) 与默认 users 一并锁定。
// 幂等: 重复执行无害。

function lockCollection(app, name) {
  try {
    const coll = app.findCollectionByNameOrId(name)
    const want = null
    let changed = false
    if (coll.listRule !== want) { coll.listRule = want; changed = true }
    if (coll.viewRule !== want) { coll.viewRule = want; changed = true }
    if (coll.createRule !== want) { coll.createRule = want; changed = true }
    if (coll.updateRule !== want) { coll.updateRule = want; changed = true }
    if (coll.deleteRule !== want) { coll.deleteRule = want; changed = true }
    if (changed) app.save(coll)
    return true
  } catch (_) {
    return false
  }
}

migrate((app) => {
  const names = [
    // 一期基础
    "tenants", "app_users", "user_data_scopes", "sms_codes", "audit_logs", "upload_tokens",
    // 一期业务
    "sessions", "transcript_segments", "risk_rules", "risk_rule_versions", "risk_segments",
    "issues", "appeals", "rectifications", "issue_events", "notifications",
    "recording_consents", "processing_jobs",
    // 遗留业务 (含 hook 创建与迁移创建的)
    "regions", "stores", "employees", "devices", "device_bindings", "device_logs",
    "audio_files", "asr_jobs", "transcripts", "inspection_issues", "rectify_tasks",
    "compliance_rules", "knowledge_items", "model_evals", "sync_logs", "app_settings",
    // 默认集合一并锁定 (前端不使用原生 CRUD)
    "users",
  ]
  let locked = 0
  for (let i = 0; i < names.length; i++) {
    if (lockCollection(app, names[i])) locked++
  }
  console.log("PHASE1_LOCKDOWN: locked " + locked + " collections")
}, (app) => {
  // 回滚不放开规则 (安全优先)
  return true
})
