// pb_hooks/_lib/configs.js — 业务集合 CRUD 配置表
// 由 business.pb.js 的守卫路由按集合名分发使用。

const STAFF_READ = ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"]
const MGMT_WRITE = ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"]
const ORG_READ = ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "AUDITOR"]

// 租户内全量 (无门店字段集合)
const tenantOnlyOverrides = {
  ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }),
  STORE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }),
  SELF: (ctx) => ({ filter: "id = {:none}", params: { none: "-" } }),
}

module.exports = {
  regions: {
    name: "regions",
    roles: { list: ORG_READ, view: ORG_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
    scope: {
      storeField: "id",
      storeType: "text",
      employeeField: "id",
      employeeType: "text",
      scopeFilterOverrides: {
        ORG_TREE: (ctx) => {
          const g2 = require(`${__hooks}/_lib/guards.js`)
          const ids = g2.regionSubtreeIds(ctx.scope.orgNode)
          if (ids.length === 0 || (ids.length === 1 && !ids[0])) return { filter: "id = {:none}", params: { none: "-" } }
          const parts = []
          const params = {}
          for (let i = 0; i < ids.length; i++) {
            parts.push("id = {:r" + i + "}")
            params["r" + i] = ids[i]
          }
          return { filter: "(" + parts.join(" || ") + ")", params }
        },
        STORE: (ctx) => ({ filter: "id = {:none}", params: { none: "-" } }),
        SELF: (ctx) => ({ filter: "id = {:none}", params: { none: "-" } }),
      },
    },
    filters: ["name", "code"],
    fields: {
      name: { type: "text", max: 60, required: true },
      code: { type: "text", max: 40 },
      parent: { type: "relation" },
      status: { type: "text", max: 20 },
    },
    audit: { create: "region_create", update: "region_update", delete: "region_delete" },
  },

 stores: {
   name: "stores",
   roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
   scope: {
      storeField: "id",
     storeType: "relation",
     employeeField: "id",
     employeeType: "relation",
     scopeFilterOverrides: {
        ORG_TREE: (ctx) => {
          const g2 = require(`${__hooks}/_lib/guards.js`)
          const ids = g2.regionSubtreeIds(ctx.scope.orgNode)
          if (ids.length === 0 || (ids.length === 1 && !ids[0])) return { filter: "id = {:none}", params: { none: "-" } }
          const parts = []
          const params = {}
          for (let i = 0; i < ids.length; i++) {
            parts.push("region = {:r" + i + "}")
            params["r" + i] = ids[i]
          }
          return { filter: "(" + parts.join(" || ") + ")", params }
        },
       STORE: (ctx) => ({ filter: "id = {:sid}", params: { sid: ctx.scope.store } }),
       SELF: (ctx) => ({ filter: "id = {:none}", params: { none: "-" } }),
     },
   },
   filters: ["name", "region"],
    fields: {
      name: { type: "text", max: 80, required: true },
      region: { type: "relation" },
      address: { type: "text", max: 200 },
      status: { type: "text", max: 20 },
    },
    audit: { create: "store_create", update: "store_update", delete: "store_delete" },
  },

  employees: {
    name: "employees",
    roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
    scope: { storeField: "store", storeType: "relation", employeeField: "id", employeeType: "relation" },
    filters: ["name", "phone", "role", "status", "store"],
    fields: {
      name: { type: "text", max: 60, required: true },
      phone: { type: "text", max: 30 },
      role: { type: "text", max: 30 },
      store: { type: "relation" },
      status: { type: "text", max: 20 },
    },
    audit: { create: "employee_create", update: "employee_update", delete: "employee_delete" },
  },

  devices: {
    name: "devices",
    roles: { list: ORG_READ, view: ORG_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["device_no", "type", "status"],
    fields: {
      device_no: { type: "text", max: 60, required: true },
      type: { type: "text", max: 20 },
      status: { type: "text", max: 20 },
      power: { type: "number" },
      texts_today: { type: "number" },
      last_online_at: { type: "date" },
    },
    audit: { create: "device_create", update: "device_update", delete: "device_delete" },
  },

  device_bindings: {
    name: "device_bindings",
    roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
    scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
    filters: ["device", "employee", "store", "status"],
    fields: {
      device: { type: "relation", required: true },
      employee: { type: "relation", required: true },
      store: { type: "relation" },
      effective_date: { type: "date" },
      status: { type: "text", max: 20 },
      request_by: { type: "text", max: 40 },
      approved_by: { type: "text", max: 40 },
      approved_at: { type: "date" },
    },
    audit: { create: "binding_create", update: "binding_update", delete: "binding_delete" },
  },

  device_logs: {
    name: "device_logs",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: {
      storeField: "device",
      storeType: "relation",
      employeeField: "device",
      employeeType: "relation",
      scopeFilterOverrides: { ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }) },
    },
    filters: ["device", "type", "status"],
    fields: {
      device: { type: "relation" },
      type: { type: "text", max: 20 },
      content: { type: "text", max: 500 },
      status: { type: "text", max: 20 },
      occurred_at: { type: "date" },
    },
    audit: { create: "device_log_create", update: "device_log_update", delete: "device_log_delete" },
  },

 audio_files: {
   name: "audio_files",
    roles: { list: ORG_READ, view: ORG_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
   scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
   filters: ["object_key", "file_name", "device_sn", "status"],
   idempotentKey: "object_key",
    fields: {
      object_key: { type: "text", max: 400, required: true },
      file_name: { type: "text", max: 200 },
      device_sn: { type: "text", max: 60 },
      size: { type: "number" },
      oss_last_modified: { type: "date" },
      started_at: { type: "date" },
      ended_at: { type: "date" },
      chunk: { type: "text", max: 20 },
      status: { type: "text", max: 20 },
      attempts: { type: "number" },
     next_retry_at: { type: "date" },
     transcript: { type: "text", max: 20 },
     asr_job: { type: "text", max: 20 },
     error_message: { type: "text", max: 1000 },
   },
    beforeDelete: (e, ctx, rec) => {
      let sessions = []
      try {
        sessions = $app.findRecordsByFilter("sessions", "audio_file = {:af}", "", 10, 0, { af: rec.id })
      } catch (_) {
        sessions = []
      }
      for (let i = 0; i < sessions.length; i++) {
        let issues = []
        try {
          issues = $app.findRecordsByFilter("issues", "session = {:s}", "", 1, 0, { s: sessions[i].id })
        } catch (_) {}
        if (issues && issues.length > 0) {
          throw new BadRequestError("音频关联会话已被疑似问题引用，处于证据锁定状态禁止删除")
        }
      }
    },
   audit: { create: "audio_file_create", update: "audio_file_update", delete: "audio_file_delete" },
 },

 asr_jobs: {
    name: "asr_jobs",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
    scope: { storeField: "store", storeType: "text", employeeField: "employee", employeeType: "text" },
    filters: ["remote_job_id", "transcript", "status", "device", "employee", "store", "audio_name"],
    filterMap: {
      active: (v) => (v === "1" ? { filter: "(status = {:a1} || status = {:a2})", params: { a1: "queued", a2: "running" } } : null),
    },
    fields: {
      remote_job_id: { type: "text", max: 40 },
      transcript: { type: "text", max: 20 },
      status: { type: "text", max: 20 },
      device: { type: "text", max: 60 },
      employee: { type: "text", max: 40 },
      store: { type: "text", max: 40 },
      audio_name: { type: "text", max: 180 },
      audio_size: { type: "number" },
      audio_sha256: { type: "text", max: 64 },
      metadata_json: { type: "json" },
      submitted_at: { type: "date" },
      started_at: { type: "date" },
      finished_at: { type: "date" },
      last_polled_at: { type: "date" },
      result_imported_at: { type: "date" },
      occurred_at: { type: "date" },
      attempts: { type: "number" },
      error_code: { type: "text", max: 80 },
      error_message: { type: "text", max: 1000 },
    },
    audit: { create: "asr_job_create", update: "asr_job_update", delete: "asr_job_delete" },
  },

 transcripts: {
   name: "transcripts",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE"], delete: ["SUPER_ADMIN", "ADMIN"] },
   scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
   filters: ["device", "employee", "store", "status", "source", "asr_status", "qc_result", "asr_job"],
    fields: {
      device: { type: "text", max: 60 },
      employee: { type: "relation" },
      store: { type: "relation" },
      summary: { type: "text", max: 500 },
      full_text: { type: "text", max: 100000 },
      qc_result: { type: "text", max: 20 },
      occurred_at: { type: "date" },
      asr_status: { type: "text", max: 20 },
      audio_name: { type: "text", max: 180 },
      source: { type: "text", max: 20 },
      model: { type: "text", max: 80 },
      asr_job: { type: "text", max: 20 },
     segments_json: { type: "json" },
     speaker_aliases: { type: "json" },
     marks_json: { type: "json" },
   },
    beforeDelete: (e, ctx, rec) => {
      let issues = []
      try {
        issues = $app.findRecordsByFilter("issues", "transcript = {:t}", "", 1, 0, { t: rec.id })
      } catch (_) {
        issues = []
      }
      if (issues && issues.length > 0) {
        throw new BadRequestError("转写已被疑似问题引用，处于证据锁定状态禁止删除")
      }
      let insp = []
      try {
        insp = $app.findRecordsByFilter("inspection_issues", "transcript = {:t}", "", 1, 0, { t: rec.id })
      } catch (_) {
        insp = []
      }
      if (insp && insp.length > 0) {
        throw new BadRequestError("转写已被巡检问题引用，处于证据锁定状态禁止删除")
      }
    },
   audit: { create: "transcript_create", update: "transcript_update", delete: "transcript_delete" },
 },

 inspection_issues: {
    name: "inspection_issues",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", ...MGMT_WRITE], update: ["SERVICE", ...MGMT_WRITE], delete: ["SUPER_ADMIN", "ADMIN"] },
    scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
    filters: ["transcript", "employee", "store", "issue_type", "risk", "state"],
    fields: {
      transcript: { type: "relation" },
      employee: { type: "relation" },
      store: { type: "relation" },
      issue_type: { type: "text", max: 60 },
      risk: { type: "text", max: 10 },
      state: { type: "text", max: 20 },
      quote: { type: "text", max: 1000 },
      advice: { type: "text", max: 1000 },
      occurred_at: { type: "date" },
    },
    audit: { create: "inspection_issue_create", update: "inspection_issue_update", delete: "inspection_issue_delete" },
  },

  rectify_tasks: {
    name: "rectify_tasks",
    roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN"] },
    scope: { storeField: "store", storeType: "relation", employeeField: "owner", employeeType: "relation" },
    filters: ["owner", "store", "source_issue", "state"],
    fields: {
      title: { type: "text", max: 200, required: true },
      owner: { type: "relation" },
      store: { type: "relation" },
      source_issue: { type: "relation" },
      due_date: { type: "date" },
      progress: { type: "number" },
      state: { type: "text", max: 20 },
    },
    audit: { create: "rectify_task_create", update: "rectify_task_update", delete: "rectify_task_delete" },
  },

  appeals: {
    name: "appeals",
    roles: {
      list: STAFF_READ,
      view: STAFF_READ,
      create: ["SERVICE"],
      update: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE"],
      delete: [],
    },
    scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
    filters: ["issue", "issue_ref", "employee", "status"],
    fields: {
      issue: { type: "relation" },
      issue_ref: { type: "relation" },
      employee: { type: "relation" },
      reason: { type: "text", max: 1000 },
      supplementary_text: { type: "text", max: 4000 },
      supplementary_file: { type: "text", max: 500 },
      status: { type: "text", max: 20 },
      reviewer: { type: "text", max: 60 },
      review_comment: { type: "text", max: 2000 },
      submitted_at: { type: "date" },
      reviewed_at: { type: "date" },
    },
    audit: { create: "appeal_create", update: "appeal_update" },
  },

  compliance_rules: {
    name: "compliance_rules",
    roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: MGMT_WRITE },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["name", "risk", "enabled"],
    fields: {
      name: { type: "text", max: 80, required: true },
      risk: { type: "text", max: 10 },
      description: { type: "text", max: 300 },
      enabled: { type: "bool" },
    },
    audit: { create: "compliance_rule_create", update: "compliance_rule_update", delete: "compliance_rule_delete" },
  },

  knowledge_items: {
    name: "knowledge_items",
    roles: { list: ORG_READ, view: ORG_READ, create: ["SUPER_ADMIN", "ADMIN"], update: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["category", "name", "status"],
    fields: {
      category: { type: "text", max: 30 },
      name: { type: "text", max: 80, required: true },
      rule: { type: "text", max: 200 },
      status: { type: "text", max: 20 },
    },
    audit: { create: "knowledge_create", update: "knowledge_update", delete: "knowledge_delete" },
  },

  model_evals: {
    name: "model_evals",
    roles: { list: ORG_READ, view: ORG_READ, create: ["SUPER_ADMIN", "ADMIN"], update: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["scenario", "status"],
    fields: {
      scenario: { type: "text", max: 80, required: true },
      accuracy: { type: "text", max: 20 },
      note: { type: "text", max: 300 },
      progress: { type: "number" },
      status: { type: "text", max: 20 },
    },
    audit: { create: "model_eval_create", update: "model_eval_update", delete: "model_eval_delete" },
  },

  sync_logs: {
    name: "sync_logs",
    roles: { list: ORG_READ, view: ORG_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: { storeField: "store", storeType: "text", employeeField: "store", employeeType: "text" },
    filters: ["type", "object", "store", "status"],
    fields: {
      type: { type: "text", max: 30 },
      object: { type: "text", max: 200 },
      store: { type: "text", max: 80 },
      status: { type: "text", max: 20 },
      result: { type: "text", max: 300 },
      occurred_at: { type: "date" },
    },
    audit: { create: "sync_log_create", update: "sync_log_update", delete: "sync_log_delete" },
  },

  app_settings: {
    name: "app_settings",
    roles: { list: ["SUPER_ADMIN", "ADMIN"], view: ["SUPER_ADMIN", "ADMIN"], create: ["SUPER_ADMIN", "ADMIN"], update: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["key"],
    fields: {
      key: { type: "text", max: 60, required: true },
      value: { type: "text", max: 2000 },
    },
    audit: { create: "app_setting_create", update: "app_setting_update", delete: "app_setting_delete" },
  },

 sessions: {
   name: "sessions",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
   scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
   filters: ["audio_file", "transcript", "employee", "store", "device_sn", "status"],
    fields: {
      audio_file: { type: "relation" },
      transcript: { type: "relation" },
      employee: { type: "relation" },
      store: { type: "relation" },
      device_sn: { type: "text", max: 60 },
      device: { type: "text", max: 60 },
      status: { type: "text", max: 20 },
      started_at: { type: "date" },
      ended_at: { type: "date" },
      duration_ms: { type: "number" },
      transcript_version: { type: "number" },
     parent_session: { type: "relation" },
     source_session: { type: "relation" },
     version: { type: "number" },
   },
    beforeDelete: (e, ctx, rec) => {
      let issues = []
      try {
        issues = $app.findRecordsByFilter("issues", "session = {:s}", "", 1, 0, { s: rec.id })
      } catch (_) {}
      if (issues && issues.length > 0) {
        throw new BadRequestError("会话已被疑似问题引用，处于证据锁定状态禁止删除")
      }
    },
   audit: { create: "session_create", update: "session_update", delete: "session_delete" },
 },

 transcript_segments: {
    name: "transcript_segments",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: {
      storeField: "session",
      storeType: "relation",
      employeeField: "session",
      employeeType: "relation",
      scopeFilterOverrides: { ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }) },
    },
    filters: ["session", "transcript", "version"],
    fields: {
      session: { type: "relation" },
      transcript: { type: "relation" },
      version: { type: "number" },
      sequence: { type: "number" },
      start_ms: { type: "number" },
      end_ms: { type: "number" },
      speaker: { type: "text", max: 60 },
      speaker_role: { type: "text", max: 40 },
      text: { type: "text", max: 5000 },
      confidence: { type: "number" },
    },
    audit: { create: "segment_create", update: "segment_update", delete: "segment_delete" },
  },

  risk_rules: {
    name: "risk_rules",
    roles: { list: STAFF_READ, view: STAFF_READ, create: MGMT_WRITE, update: MGMT_WRITE, delete: ["SUPER_ADMIN", "ADMIN"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["code", "name", "category", "risk_level", "match_type", "enabled", "status"],
    fields: {
      code: { type: "text", max: 60, required: true },
      name: { type: "text", max: 120, required: true },
      category: { type: "text", max: 40 },
      risk_level: { type: "text", max: 20 },
      match_type: { type: "text", max: 20 },
      pattern_json: { type: "json" },
      advice: { type: "text", max: 2000 },
      recommended_expression: { type: "text", max: 2000 },
      enabled: { type: "bool" },
      version: { type: "number" },
      status: { type: "text", max: 20 },
    },
    audit: { create: "risk_rule_create", update: "risk_rule_update", delete: "risk_rule_delete" },
  },

  risk_rule_versions: {
    name: "risk_rule_versions",
    roles: { list: ORG_READ, view: ORG_READ, create: ["SERVICE", ...MGMT_WRITE], update: ["SERVICE"], delete: [] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["rule", "version"],
    fields: {
      rule: { type: "relation" },
      version: { type: "number" },
      snapshot_json: { type: "json" },
    },
    audit: { create: "risk_rule_version_create" },
  },

  risk_segments: {
    name: "risk_segments",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE"], update: ["SERVICE"], delete: [] },
    scope: {
      storeField: "session",
      storeType: "relation",
      employeeField: "session",
      employeeType: "relation",
      scopeFilterOverrides: { ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }) },
    },
    filters: ["session", "transcript", "rule", "rule_code", "analysis_version", "transcript_version"],
    fields: {
      session: { type: "relation" },
      transcript: { type: "relation" },
      transcript_version: { type: "number" },
      rule: { type: "relation" },
      rule_code: { type: "text", max: 60 },
      rule_version: { type: "number" },
      analysis_version: { type: "number" },
      sequence: { type: "number" },
      start_ms: { type: "number" },
      end_ms: { type: "number" },
      speaker: { type: "text", max: 60 },
      text: { type: "text", max: 5000 },
      risk_level: { type: "text", max: 20 },
      advice: { type: "text", max: 2000 },
      recommended_expression: { type: "text", max: 2000 },
      evidence_json: { type: "json" },
      status: { type: "text", max: 20 },
    },
    audit: { create: "risk_segment_create" },
  },

 issues: {
   name: "issues",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE"], update: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE"], delete: ["SUPER_ADMIN", "ADMIN"] },
   scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
    filters: ["session", "transcript", "employee", "store", "rule", "rule_code", "risk_level", "review_status", "analysis_status", "appeal_status", "rectification_status", "close_status"],
    fields: {
      session: { type: "relation" },
      transcript: { type: "relation" },
      employee: { type: "relation" },
      store: { type: "relation" },
      rule: { type: "relation" },
      rule_code: { type: "text", max: 60 },
      rule_version: { type: "number" },
      transcript_version: { type: "number" },
      analysis_version: { type: "number" },
      risk_level: { type: "text", max: 20 },
      title: { type: "text", max: 200 },
      summary: { type: "text", max: 2000 },
      evidence_text: { type: "text", max: 5000 },
      start_ms: { type: "number" },
      end_ms: { type: "number" },
      advice: { type: "text", max: 2000 },
      recommended_expression: { type: "text", max: 2000 },
      analysis_status: { type: "text", max: 20 },
      review_status: { type: "text", max: 20 },
      employee_visibility: { type: "text", max: 20 },
      employee_view_status: { type: "text", max: 20 },
      appeal_status: { type: "text", max: 20 },
      rectification_status: { type: "text", max: 20 },
      close_status: { type: "text", max: 20 },
      review_comment: { type: "text", max: 2000 },
      reviewed_at: { type: "date" },
      pushed_to_employee: { type: "bool" },
     pushed_at: { type: "date" },
     is_false_positive: { type: "bool" },
     closed_at: { type: "date" },
   },
    beforeDelete: (e, ctx, rec) => {
      const appealStatus = String(rec.get("appeal_status") || "")
      const rectStatus = String(rec.get("rectification_status") || "")
      if (appealStatus === "PENDING" || appealStatus === "NEEDS_MORE_INFO" ||
          rectStatus === "PENDING" || rectStatus === "SUBMITTED" || rectStatus === "NEEDS_REVISION") {
        throw new BadRequestError("问题处于申诉或整改进行中，证据已锁定禁止删除")
      }
    },
   audit: { create: "issue_create", update: "issue_update" },
 },

 rectifications: {
    name: "rectifications",
    roles: {
      list: STAFF_READ,
      view: STAFF_READ,
      create: ["SERVICE", ...MGMT_WRITE],
      update: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE"],
      delete: [],
    },
    scope: { storeField: "store", storeType: "relation", employeeField: "employee", employeeType: "relation" },
    filters: ["issue", "employee", "store", "status"],
    fields: {
      issue: { type: "relation" },
      employee: { type: "relation" },
      store: { type: "relation" },
      title: { type: "text", max: 200 },
      remediation_type: { type: "text", max: 40 },
      requirements: { type: "text", max: 2000 },
      due_at: { type: "date" },
      status: { type: "text", max: 20 },
      submission_text: { type: "text", max: 4000 },
      evidence_file: { type: "text", max: 500 },
      submitted_at: { type: "date" },
      confirmation_comment: { type: "text", max: 2000 },
      confirmed_at: { type: "date" },
      retry_count: { type: "number" },
    },
    audit: { create: "rectification_create", update: "rectification_update" },
  },

  issue_events: {
    name: "issue_events",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE"], update: ["SERVICE"], delete: [] },
    scope: {
      storeField: "issue",
      storeType: "relation",
      employeeField: "issue",
      employeeType: "relation",
      scopeFilterOverrides: { ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }) },
    },
    filters: ["issue", "event_type"],
    fields: {
      issue: { type: "relation" },
      event_type: { type: "text", max: 40 },
      from_status: { type: "text", max: 40 },
      to_status: { type: "text", max: 40 },
      comment: { type: "text", max: 2000 },
      detail_json: { type: "json" },
      actor_name: { type: "text", max: 120 },
    },
    audit: { create: "issue_event_create" },
  },

  notifications: {
    name: "notifications",
    roles: {
      list: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE", "EMPLOYEE"],
      view: ["SERVICE", "SUPER_ADMIN", "ADMIN", "COMPLIANCE", "EMPLOYEE"],
      create: ["SERVICE"],
      update: ["SERVICE", "EMPLOYEE"],
      delete: ["SERVICE"],
    },
    scope: {
      storeField: "id",
      storeType: "text",
      employeeField: "employee",
      employeeType: "relation",
      scopeFilterOverrides: {
        SELF: (ctx) => ({ filter: "user = {:uid}", params: { uid: ctx.user.id } }),
        ORG_TREE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }),
        STORE: (ctx) => ({ filter: "tenant = {:t}", params: { t: ctx.tenantId } }),
      },
      assertVisibleOverride: (e, ctx, rec) => {
        if (ctx.roleCode === "EMPLOYEE" && String(rec.get("user") || "") !== ctx.user.id) {
          throw new NotFoundError("记录不存在")
        }
      },
    },
    filters: ["user", "employee", "type", "is_read"],
    fields: {
      user: { type: "relation" },
      employee: { type: "relation" },
      title: { type: "text", max: 200 },
      body: { type: "text", max: 2000 },
      type: { type: "text", max: 40 },
      link: { type: "text", max: 200 },
      is_read: { type: "bool" },
      read_at: { type: "date" },
    },
    audit: { create: "notification_create" },
  },

  recording_consents: {
    name: "recording_consents",
    roles: { list: STAFF_READ, view: STAFF_READ, create: ["SERVICE", "EMPLOYEE", "SUPER_ADMIN", "ADMIN"], update: ["SERVICE", "EMPLOYEE", "SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
    scope: {
      storeField: "store",
      storeType: "relation",
      employeeField: "employee",
      employeeType: "relation",
      scopeFilterOverrides: {
        SELF: (ctx) => ({ filter: "employee = {:e}", params: { e: ctx.scope.employee } }),
      },
      assertVisibleOverride: (e, ctx, rec) => {
        if (ctx.roleCode === "EMPLOYEE" && String(rec.get("employee") || "") !== String(ctx.user.get("employee") || "")) {
          throw new NotFoundError("记录不存在")
        }
      },
    },
    filters: ["employee", "store", "device"],
    fields: {
      employee: { type: "relation" },
      store: { type: "relation" },
      device: { type: "relation" },
      agreed: { type: "bool" },
      content_version: { type: "text", max: 40 },
      agreed_at: { type: "date" },
      ip: { type: "text", max: 60 },
    },
    audit: { create: "consent_create", update: "consent_update" },
  },

  processing_jobs: {
    name: "processing_jobs",
    roles: { list: ["SUPER_ADMIN", "ADMIN", "AUDITOR"], view: ["SUPER_ADMIN", "ADMIN", "AUDITOR"], create: ["SERVICE"], update: ["SERVICE"], delete: ["SERVICE"] },
    scope: { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text", scopeFilterOverrides: tenantOnlyOverrides },
    filters: ["job_type", "status", "business_key", "idempotency_key"],
    fields: {
      job_type: { type: "text", max: 40, required: true },
      business_key: { type: "text", max: 120 },
      idempotency_key: { type: "text", max: 160, required: true },
      status: { type: "text", max: 20 },
      priority: { type: "number" },
      attempts: { type: "number" },
      max_attempts: { type: "number" },
      next_retry_at: { type: "date" },
      locked_by: { type: "text", max: 80 },
      locked_at: { type: "date" },
      started_at: { type: "date" },
      finished_at: { type: "date" },
      error_code: { type: "text", max: 80 },
      error_message: { type: "text", max: 2000 },
      payload_json: { type: "json" },
      result_json: { type: "json" },
      request_id: { type: "text", max: 80 },
    },
    audit: { create: "processing_job_create", update: "processing_job_update" },
  },
}
