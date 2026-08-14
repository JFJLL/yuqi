/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/compliance_rules.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: name:text, risk:text, description:text, enabled:bool
// 路由: list,get,create,update,delete
// list filter 字段: risk
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("compliance_rules") } catch (_) { existing = null }
    if (existing) {
      var changed = false
      function hasField(name) {
        try { return !!existing.fields.getByName(name) } catch (_) {}
        try {
          for (var i = 0; i < existing.fields.length; i++) {
            if (String(existing.fields[i].name) === String(name)) return true
          }
        } catch (_) {}
        return false
      }
      function addField(def) {
        if (hasField(def.name)) return
        try { existing.fields.add(new Field(def)); changed = true } catch (_) {}
      }
      addField({ name: 'name', type: 'text', required: true, max: 80 })
      addField({ name: 'risk', type: 'text', max: 10 })
      addField({ name: 'description', type: 'text', max: 300 })
      addField({ name: 'enabled', type: 'bool' })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("compliance_rules collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "compliance_rules",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'risk', type: 'text', max: 10 },
          { name: 'description', type: 'text', max: 300 },
          { name: 'enabled', type: 'bool' },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("compliance_rules collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("compliance_rules bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/compliance_rules?page=1&perPage=50&sort=-created&risk=...
routerAdd("GET", "/api/compliance_rules", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("compliance_rules") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "compliance_rules",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'risk', type: 'text', max: 10 },
          { name: 'description', type: 'text', max: 300 },
          { name: 'enabled', type: 'bool' },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("compliance_rules")
  }
  try {
    ensureCollLocal()
    var info = e.requestInfo()
    var query = info.query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-created")
    var filterParts = []
    var params = {}
    if (query.risk !== undefined && query.risk !== "") {
      filterParts.push("risk = {:risk}")
      params.risk = String(query.risk)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("compliance_rules", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("compliance_rules", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("compliance_rules list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/compliance_rules/{id}
routerAdd("GET", "/api/compliance_rules/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("compliance_rules", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/compliance_rules  body 字段: name, risk, description, enabled
routerAdd("POST", "/api/compliance_rules", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("compliance_rules") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "compliance_rules",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'risk', type: 'text', max: 10 },
          { name: 'description', type: 'text', max: 300 },
          { name: 'enabled', type: 'bool' },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("compliance_rules")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    rec.set("risk", body.risk === undefined || body.risk === null ? "" : String(body.risk))
    rec.set("description", body.description === undefined || body.description === null ? "" : String(body.description))
    rec.set("enabled", !!body.enabled)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("compliance_rules create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/compliance_rules/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/compliance_rules/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("compliance_rules", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("name" in body) rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    if ("risk" in body) rec.set("risk", body.risk === undefined || body.risk === null ? "" : String(body.risk))
    if ("description" in body) rec.set("description", body.description === undefined || body.description === null ? "" : String(body.description))
    if ("enabled" in body) rec.set("enabled", !!body.enabled)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/compliance_rules/{id}
routerAdd("DELETE", "/api/compliance_rules/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("compliance_rules", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
