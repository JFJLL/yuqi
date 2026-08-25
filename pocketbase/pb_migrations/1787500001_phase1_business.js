/// <reference path="../pb_data/types.d.ts" />
// 1787500001_phase1_business.js — 一期业务集合
// sessions / transcript_segments / risk_rules / risk_rule_versions / risk_segments /
// issues / rectifications / issue_events / notifications / recording_consents /
// processing_jobs / upload_tokens, 以及 regions.parent 与 appeals 升级。

function fieldExists(collection, name) {
  try {
    return !!collection.fields.getByName(name)
  } catch (_) {
    return false
  }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

function ensureCollection(app, name, build) {
  let existing = null
  try {
    existing = app.findCollectionByNameOrId(name)
  } catch (_) {
    existing = null
  }
  if (existing) {
    const changed = build(existing, true)
    if (changed) app.save(existing)
    return existing
  }
  const collection = new Collection({
    type: "base",
    name,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [],
  })
  build(collection, false)
  app.save(collection)
  return collection
}

function tenantField(app) {
  return { name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }
}

function rel(name, collectionName, maxSelect, appRef) {
  // v0.40 要求 relation 的 collectionId 必须是真实集合 ID (不接受名称)
  let id = collectionName
  if (appRef) {
    try {
      id = appRef.findCollectionByNameOrId(collectionName).id
    } catch (_) {}
  }
  return { name, type: "relation", maxSelect: maxSelect || 1, collectionId: id }
}

function addAutodates(c) {
  let changed = false
  changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
  changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
  return changed
}

migrate((app) => {
  try {
    // ---- 历史 hook 自动创建的集合 (迁移先行, 避免迁移期关系目标缺失) ----
    ensureCollection(app, "audio_files", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "object_key", type: "text", max: 400, required: true }) || ch
      ch = ensureField(c, { name: "file_name", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "device_sn", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "size", type: "number" }) || ch
      ch = ensureField(c, { name: "oss_last_modified", type: "date" }) || ch
      ch = ensureField(c, { name: "started_at", type: "date" }) || ch
      ch = ensureField(c, { name: "ended_at", type: "date" }) || ch
      ch = ensureField(c, { name: "chunk", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "attempts", type: "number" }) || ch
      ch = ensureField(c, { name: "next_retry_at", type: "date" }) || ch
      ch = ensureField(c, { name: "transcript", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "asr_job", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "error_message", type: "text", max: 1000 }) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_audio_files_object_key` ON `audio_files` (`object_key`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })
    ensureCollection(app, "asr_jobs", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "remote_job_id", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "transcript", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "device", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "employee", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "store", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "audio_name", type: "text", max: 180 }) || ch
      ch = ensureField(c, { name: "audio_size", type: "number" }) || ch
      ch = ensureField(c, { name: "audio_sha256", type: "text", max: 64 }) || ch
      ch = ensureField(c, { name: "metadata_json", type: "json" }) || ch
      ch = ensureField(c, { name: "submitted_at", type: "date" }) || ch
      ch = ensureField(c, { name: "started_at", type: "date" }) || ch
      ch = ensureField(c, { name: "finished_at", type: "date" }) || ch
      ch = ensureField(c, { name: "last_polled_at", type: "date" }) || ch
      ch = ensureField(c, { name: "result_imported_at", type: "date" }) || ch
      ch = ensureField(c, { name: "occurred_at", type: "date" }) || ch
      ch = ensureField(c, { name: "attempts", type: "number" }) || ch
      ch = ensureField(c, { name: "error_code", type: "text", max: 80 }) || ch
      ch = ensureField(c, { name: "error_message", type: "text", max: 1000 }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    ensureCollection(app, "compliance_rules", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "name", type: "text", max: 80, required: true }) || ch
      ch = ensureField(c, { name: "risk", type: "text", max: 10 }) || ch
      ch = ensureField(c, { name: "description", type: "text", max: 300 }) || ch
      ch = ensureField(c, { name: "enabled", type: "bool" }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    ensureCollection(app, "knowledge_items", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "category", type: "text", max: 30 }) || ch
      ch = ensureField(c, { name: "name", type: "text", max: 80, required: true }) || ch
      ch = ensureField(c, { name: "rule", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    ensureCollection(app, "model_evals", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "scenario", type: "text", max: 80, required: true }) || ch
      ch = ensureField(c, { name: "accuracy", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "note", type: "text", max: 300 }) || ch
      ch = ensureField(c, { name: "progress", type: "number" }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    ensureCollection(app, "sync_logs", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "type", type: "text", max: 30 }) || ch
      ch = ensureField(c, { name: "object", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "store", type: "text", max: 80 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "result", type: "text", max: 300 }) || ch
      ch = ensureField(c, { name: "occurred_at", type: "date" }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    ensureCollection(app, "app_settings", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "key", type: "text", max: 60, required: true }) || ch
      ch = ensureField(c, { name: "value", type: "text", max: 2000 }) || ch
      ch = addAutodates(c) || ch
      return ch
    })

    // ---- sessions (自引用字段需二次保存) ----
    const sessions = ensureCollection(app, "sessions", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("audio_file", "audio_files", 1, app)) || ch
      ch = ensureField(c, rel("transcript", "transcripts", 1, app)) || ch
      ch = ensureField(c, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(c, rel("store", "stores", 1, app)) || ch
      ch = ensureField(c, { name: "device_sn", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "device", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "started_at", type: "date" }) || ch
      ch = ensureField(c, { name: "ended_at", type: "date" }) || ch
      ch = ensureField(c, { name: "duration_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "transcript_version", type: "number" }) || ch
      ch = ensureField(c, { name: "version", type: "number" }) || ch
      ch = addAutodates(c) || ch
      return ch
    })
    if (!fieldExists(sessions, "parent_session")) {
      sessions.fields.add(new Field({ name: "parent_session", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("sessions").id }))
      sessions.fields.add(new Field({ name: "source_session", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("sessions").id }))
      app.save(sessions)
    }

    // ---- transcript_segments ----
    ensureCollection(app, "transcript_segments", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("session", "sessions", 1, app)) || ch
      ch = ensureField(c, rel("transcript", "transcripts", 1, app)) || ch
      ch = ensureField(c, { name: "version", type: "number" }) || ch
      ch = ensureField(c, { name: "sequence", type: "number" }) || ch
      ch = ensureField(c, { name: "start_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "end_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "speaker", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "speaker_role", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "text", type: "text", max: 5000 }) || ch
      ch = ensureField(c, { name: "confidence", type: "number" }) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_ts_session_seq` ON `transcript_segments` (`session`, `version`, `sequence`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })

    // ---- risk_rules ----
    ensureCollection(app, "risk_rules", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "code", type: "text", required: true, max: 60 }) || ch
      ch = ensureField(c, { name: "name", type: "text", required: true, max: 120 }) || ch
      ch = ensureField(c, { name: "category", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "risk_level", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "match_type", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "pattern_json", type: "json" }) || ch
      ch = ensureField(c, { name: "advice", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "recommended_expression", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "enabled", type: "bool" }) || ch
      ch = ensureField(c, { name: "version", type: "number" }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, rel("created_by", "app_users", 1, app)) || ch
      ch = ensureField(c, rel("updated_by", "app_users", 1, app)) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_risk_rules_tenant_code` ON `risk_rules` (`tenant`, `code`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })

    // ---- risk_rule_versions ----
    ensureCollection(app, "risk_rule_versions", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("rule", "risk_rules", 1, app)) || ch
      ch = ensureField(c, { name: "version", type: "number" }) || ch
      ch = ensureField(c, { name: "snapshot_json", type: "json" }) || ch
      ch = ensureField(c, rel("created_by", "app_users", 1, app)) || ch
      ch = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || ch
      return ch
    })

    // ---- risk_segments ----
    ensureCollection(app, "risk_segments", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("session", "sessions", 1, app)) || ch
      ch = ensureField(c, rel("transcript", "transcripts", 1, app)) || ch
      ch = ensureField(c, { name: "transcript_version", type: "number" }) || ch
      ch = ensureField(c, rel("rule", "risk_rules", 1, app)) || ch
      ch = ensureField(c, { name: "rule_code", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "rule_version", type: "number" }) || ch
      ch = ensureField(c, { name: "analysis_version", type: "number" }) || ch
      ch = ensureField(c, { name: "sequence", type: "number" }) || ch
      ch = ensureField(c, { name: "start_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "end_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "speaker", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "text", type: "text", max: 5000 }) || ch
      ch = ensureField(c, { name: "risk_level", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "advice", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "recommended_expression", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "evidence_json", type: "json" }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_risk_seg_key` ON `risk_segments` (`tenant`, `session`, `transcript_version`, `rule_code`, `analysis_version`, `sequence`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })

    // ---- issues ----
    ensureCollection(app, "issues", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("session", "sessions", 1, app)) || ch
      ch = ensureField(c, rel("transcript", "transcripts", 1, app)) || ch
      ch = ensureField(c, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(c, rel("store", "stores", 1, app)) || ch
      ch = ensureField(c, rel("rule", "risk_rules", 1, app)) || ch
      ch = ensureField(c, { name: "rule_code", type: "text", max: 60 }) || ch
      ch = ensureField(c, { name: "rule_version", type: "number" }) || ch
      ch = ensureField(c, { name: "transcript_version", type: "number" }) || ch
      ch = ensureField(c, { name: "analysis_version", type: "number" }) || ch
      ch = ensureField(c, { name: "risk_level", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "title", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "summary", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "evidence_text", type: "text", max: 5000 }) || ch
      ch = ensureField(c, { name: "start_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "end_ms", type: "number" }) || ch
      ch = ensureField(c, { name: "advice", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "recommended_expression", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "analysis_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "review_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "employee_visibility", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "employee_view_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "appeal_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "rectification_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "close_status", type: "text", max: 20 }) || ch
      ch = ensureField(c, rel("reviewed_by", "app_users", 1, app)) || ch
      ch = ensureField(c, { name: "reviewed_at", type: "date" }) || ch
      ch = ensureField(c, { name: "review_comment", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "pushed_to_employee", type: "bool" }) || ch
      ch = ensureField(c, { name: "pushed_at", type: "date" }) || ch
      ch = ensureField(c, { name: "is_false_positive", type: "bool" }) || ch
      ch = ensureField(c, { name: "closed_at", type: "date" }) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_issues_key` ON `issues` (`tenant`, `session`, `transcript_version`, `rule_code`, `analysis_version`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })

    // ---- rectifications ----
    ensureCollection(app, "rectifications", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("issue", "issues", 1, app)) || ch
      ch = ensureField(c, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(c, rel("store", "stores", 1, app)) || ch
      ch = ensureField(c, { name: "title", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "remediation_type", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "requirements", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "due_at", type: "date" }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "submission_text", type: "text", max: 4000 }) || ch
      ch = ensureField(c, { name: "evidence_file", type: "text", max: 500 }) || ch
      ch = ensureField(c, { name: "submitted_at", type: "date" }) || ch
      ch = ensureField(c, rel("confirmed_by", "app_users", 1, app)) || ch
      ch = ensureField(c, { name: "confirmed_at", type: "date" }) || ch
      ch = ensureField(c, { name: "confirmation_comment", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "retry_count", type: "number" }) || ch
      ch = addAutodates(c) || ch
      return ch
    })

    // ---- issue_events ----
    ensureCollection(app, "issue_events", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("issue", "issues", 1, app)) || ch
      ch = ensureField(c, { name: "event_type", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "from_status", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "to_status", type: "text", max: 40 }) || ch
      ch = ensureField(c, rel("actor", "app_users", 1, app)) || ch
      ch = ensureField(c, { name: "actor_name", type: "text", max: 120 }) || ch
      ch = ensureField(c, { name: "comment", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "detail_json", type: "json" }) || ch
      ch = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || ch
      return ch
    })

    // ---- notifications ----
    ensureCollection(app, "notifications", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("user", "app_users", 1, app)) || ch
      ch = ensureField(c, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(c, { name: "title", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "body", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "type", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "link", type: "text", max: 200 }) || ch
      ch = ensureField(c, { name: "is_read", type: "bool" }) || ch
      ch = ensureField(c, { name: "read_at", type: "date" }) || ch
      ch = addAutodates(c) || ch
      return ch
    })

    // ---- recording_consents ----
    ensureCollection(app, "recording_consents", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(c, rel("store", "stores", 1, app)) || ch
      ch = ensureField(c, rel("device", "devices", 1, app)) || ch
      ch = ensureField(c, { name: "agreed", type: "bool" }) || ch
      ch = ensureField(c, { name: "content_version", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "agreed_at", type: "date" }) || ch
      ch = ensureField(c, { name: "ip", type: "text", max: 60 }) || ch
      ch = addAutodates(c) || ch
      return ch
    })

    // ---- processing_jobs ----
    ensureCollection(app, "processing_jobs", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, { name: "job_type", type: "text", required: true, max: 40 }) || ch
      ch = ensureField(c, { name: "business_key", type: "text", max: 120 }) || ch
      ch = ensureField(c, { name: "idempotency_key", type: "text", required: true, max: 160 }) || ch
      ch = ensureField(c, { name: "status", type: "text", max: 20 }) || ch
      ch = ensureField(c, { name: "priority", type: "number" }) || ch
      ch = ensureField(c, { name: "attempts", type: "number" }) || ch
      ch = ensureField(c, { name: "max_attempts", type: "number" }) || ch
      ch = ensureField(c, { name: "next_retry_at", type: "date" }) || ch
      ch = ensureField(c, { name: "locked_by", type: "text", max: 80 }) || ch
      ch = ensureField(c, { name: "locked_at", type: "date" }) || ch
      ch = ensureField(c, { name: "started_at", type: "date" }) || ch
      ch = ensureField(c, { name: "finished_at", type: "date" }) || ch
      ch = ensureField(c, { name: "error_code", type: "text", max: 80 }) || ch
      ch = ensureField(c, { name: "error_message", type: "text", max: 2000 }) || ch
      ch = ensureField(c, { name: "payload_json", type: "json" }) || ch
      ch = ensureField(c, { name: "result_json", type: "json" }) || ch
      ch = ensureField(c, { name: "request_id", type: "text", max: 80 }) || ch
      ch = addAutodates(c) || ch
      if (!c.indexes || c.indexes.length === 0) {
        try {
          c.indexes = ["CREATE UNIQUE INDEX `idx_pj_idem` ON `processing_jobs` (`tenant`, `idempotency_key`)"]
          ch = true
        } catch (_) {}
      }
      return ch
    })

    // ---- upload_tokens ----
    ensureCollection(app, "upload_tokens", (c) => {
      let ch = false
      ch = ensureField(c, tenantField(app)) || ch
      ch = ensureField(c, rel("user", "app_users", 1, app)) || ch
      ch = ensureField(c, { name: "nonce", type: "text", max: 80 }) || ch
      ch = ensureField(c, { name: "action", type: "text", max: 40 }) || ch
      ch = ensureField(c, { name: "expires_at", type: "date" }) || ch
      ch = ensureField(c, { name: "used_at", type: "date" }) || ch
      ch = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || ch
      return ch
    })

    // ---- regions.parent (升级) ----
    {
      const regions = app.findCollectionByNameOrId("regions")
      if (!fieldExists(regions, "parent")) {
        regions.fields.add(new Field({ name: "parent", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("regions").id }))
        app.save(regions)
      }
    }

    // ---- appeals 升级 (独立申诉历史) ----
    {
      const appeals = app.findCollectionByNameOrId("appeals")
      let ch = false
      ch = ensureField(appeals, tenantField(app)) || ch
      ch = ensureField(appeals, rel("employee", "employees", 1, app)) || ch
      // 一期申诉引用新闭环 issues (保留既有 issue → inspection_issues 关系不变)
      ch = ensureField(appeals, rel("issue_ref", "issues", 1, app)) || ch
      ch = ensureField(appeals, { name: "supplementary_text", type: "text", max: 4000 }) || ch
      ch = ensureField(appeals, { name: "supplementary_file", type: "text", max: 500 }) || ch
      ch = ensureField(appeals, { name: "review_comment", type: "text", max: 2000 }) || ch
      ch = ensureField(appeals, { name: "submitted_at", type: "date" }) || ch
      ch = ensureField(appeals, { name: "created", type: "autodate", onCreate: true }) || ch
      ch = ensureField(appeals, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || ch
      if (ch) app.save(appeals)
    }

    console.log("PHASE1_BUSINESS: collections ready")
  } catch (err) {
    console.log("PHASE1_BUSINESS_FAIL: " + JSON.stringify(String(err && err.message || err)))
    throw err
  }
}, (app) => {
  // 不删除既有数据
})
