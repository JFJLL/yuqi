/// <reference path="../pb_data/types.d.ts" />
// 1787500004_phase1_rules_fields.js — risk_rules 审计字段 + processing_jobs 索引

function fieldExists(collection, name) {
  try {
    return !!collection.fields.getByName(name)
  } catch (_) {
    return false
  }
}

migrate((app) => {
  try {
    // risk_rules: created_by / updated_by
    const rules = app.findCollectionByNameOrId("risk_rules")
    let changed = false
    if (!fieldExists(rules, "created_by")) {
      rules.fields.add(new Field({ name: "created_by", type: "text", max: 40 }))
      changed = true
    }
    if (!fieldExists(rules, "updated_by")) {
      rules.fields.add(new Field({ name: "updated_by", type: "text", max: 40 }))
      changed = true
    }
    if (changed) app.save(rules)

    // processing_jobs: 唯一索引 idempotency_key
    const jobs = app.findCollectionByNameOrId("processing_jobs")
    try {
      jobs.indexes = ["CREATE UNIQUE INDEX idx_processing_jobs_idem ON processing_jobs (`idempotency_key`)"]
      app.save(jobs)
    } catch (err) {
      console.log("PHASE1_RULES_FIELDS: jobs index skip: " + String(err && err.message || err))
    }

    // device_bindings: 同设备仅一条 ACTIVE (SQLite 部分唯一索引)
    const bindings = app.findCollectionByNameOrId("device_bindings")
    try {
      bindings.indexes = ["CREATE UNIQUE INDEX idx_device_binding_active ON device_bindings (`device`) WHERE `status` = 'ACTIVE'"]
      app.save(bindings)
    } catch (err) {
      console.log("PHASE1_RULES_FIELDS: binding index skip: " + String(err && err.message || err))
    }
    console.log("PHASE1_RULES_FIELDS: done")
  } catch (err) {
    console.log("PHASE1_RULES_FIELDS_FAIL: " + JSON.stringify(String(err && err.message || err)))
    throw err
  }
}, (app) => {
  return true
})
