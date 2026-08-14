/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/transcripts.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device:text, employee:relation, store:relation, summary:text, full_text:text, qc_result:text, occurred_at:date
// 路由: list,get,create,update,delete
// list filter 字段: store,employee,qc_result
// list 默认排序: -occurred_at

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("transcripts") } catch (_) { existing = null }
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
      addField({ name: 'device', type: 'text', max: 60 })
      addField({ name: 'employee', type: 'relation', max: 1, collectionId: 'employees' })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'stores' })
      addField({ name: 'summary', type: 'text', max: 500 })
      addField({ name: 'full_text', type: 'text', max: 8000 })
      addField({ name: 'qc_result', type: 'text', max: 20 })
      addField({ name: 'occurred_at', type: 'date' })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("transcripts collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "transcripts",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 8000 },
          { name: 'qc_result', type: 'text', max: 20 },
          { name: 'occurred_at', type: 'date' },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("transcripts collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("transcripts bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/transcripts?page=1&perPage=50&sort=-created&store=...&employee=...&qc_result=...
routerAdd("GET", "/api/transcripts", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("transcripts") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "transcripts",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 8000 },
          { name: 'qc_result', type: 'text', max: 20 },
          { name: 'occurred_at', type: 'date' },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("transcripts")
  }
  try {
    ensureCollLocal()
    var info = e.requestInfo()
    var query = info.query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-occurred_at")
    var filterParts = []
    var params = {}
    if (query.store !== undefined && query.store !== "") {
      filterParts.push("store = {:store}")
      params.store = String(query.store)
    }
    if (query.employee !== undefined && query.employee !== "") {
      filterParts.push("employee = {:employee}")
      params.employee = String(query.employee)
    }
    if (query.qc_result !== undefined && query.qc_result !== "") {
      filterParts.push("qc_result = {:qc_result}")
      params.qc_result = String(query.qc_result)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("transcripts", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("transcripts", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("transcripts list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/transcripts/{id}
routerAdd("GET", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/transcripts  body 字段: device, employee, store, summary, full_text, qc_result, occurred_at
routerAdd("POST", "/api/transcripts", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("transcripts") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "transcripts",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 8000 },
          { name: 'qc_result', type: 'text', max: 20 },
          { name: 'occurred_at', type: 'date' },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("transcripts")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
    rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    rec.set("summary", body.summary === undefined || body.summary === null ? "" : String(body.summary))
    rec.set("full_text", body.full_text === undefined || body.full_text === null ? "" : String(body.full_text))
    rec.set("qc_result", body.qc_result === undefined || body.qc_result === null ? "" : String(body.qc_result))
    rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("transcripts create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/transcripts/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("device" in body) rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
    if ("employee" in body) rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("summary" in body) rec.set("summary", body.summary === undefined || body.summary === null ? "" : String(body.summary))
    if ("full_text" in body) rec.set("full_text", body.full_text === undefined || body.full_text === null ? "" : String(body.full_text))
    if ("qc_result" in body) rec.set("qc_result", body.qc_result === undefined || body.qc_result === null ? "" : String(body.qc_result))
    if ("occurred_at" in body) rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/transcripts/{id}
routerAdd("DELETE", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
