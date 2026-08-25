/// <reference path="../pb_data/types.d.ts" />
// 1787500005_phase1_demo_flag.js — 为演示数据标记增加 demo 布尔字段 (幂等)

function fieldExists(collection, name) {
  try {
    return !!collection.fields.getByName(name)
  } catch (_) {
    return false
  }
}

migrate((app) => {
  const names = [
    "tenants", "app_users", "regions", "stores", "employees", "devices", "device_bindings",
    "audio_files", "asr_jobs", "transcripts", "sessions", "transcript_segments",
    "risk_rules", "risk_rule_versions", "risk_segments", "issues", "appeals",
    "rectifications", "issue_events", "notifications", "recording_consents",
    "processing_jobs", "upload_tokens", "audit_logs", "app_settings",
  ]
  let changed = 0
  for (const name of names) {
    let collection = null
    try {
      collection = app.findCollectionByNameOrId(name)
    } catch (_) {
      collection = null
    }
    if (!collection) continue
    if (!fieldExists(collection, "demo")) {
      collection.fields.add(new Field({ name: "demo", type: "bool" }))
      app.save(collection)
      changed++
    }
  }
  console.log("PHASE1_DEMO_FLAG: demo field ensured on " + changed + " collections")
}, (app) => {
  // 不删除字段
})
