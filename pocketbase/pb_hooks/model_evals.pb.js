/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/model_evals.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: scenario:text, accuracy:text, note:text, progress:number, status:text
// 路由: list,get,create,update,delete
// list filter 字段: (none)
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("model_evals") } catch (_) { existing = null }
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
      addField({ name: 'scenario', type: 'text', required: true, max: 80 })
      addField({ name: 'accuracy', type: 'text', max: 20 })
      addField({ name: 'note', type: 'text', max: 300 })
      addField({ name: 'progress', type: 'number' })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("model_evals collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "model_evals",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'scenario', type: 'text', required: true, max: 80 },
          { name: 'accuracy', type: 'text', max: 20 },
          { name: 'note', type: 'text', max: 300 },
          { name: 'progress', type: 'number' },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("model_evals collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("model_evals bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/model_evals?page=1&perPage=50&sort=-created
routerAdd("GET", "/api/model_evals", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("model_evals") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "model_evals",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'scenario', type: 'text', required: true, max: 80 },
          { name: 'accuracy', type: 'text', max: 20 },
          { name: 'note', type: 'text', max: 300 },
          { name: 'progress', type: 'number' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("model_evals")
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
    // no list_filter_fields configured
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("model_evals", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("model_evals", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("model_evals list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/model_evals/{id}
routerAdd("GET", "/api/model_evals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("model_evals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/model_evals  body 字段: scenario, accuracy, note, progress, status
routerAdd("POST", "/api/model_evals", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("model_evals") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "model_evals",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'scenario', type: 'text', required: true, max: 80 },
          { name: 'accuracy', type: 'text', max: 20 },
          { name: 'note', type: 'text', max: 300 },
          { name: 'progress', type: 'number' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("model_evals")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("scenario", body.scenario === undefined || body.scenario === null ? "" : String(body.scenario))
    rec.set("accuracy", body.accuracy === undefined || body.accuracy === null ? "" : String(body.accuracy))
    rec.set("note", body.note === undefined || body.note === null ? "" : String(body.note))
    rec.set("progress", (body.progress === undefined || body.progress === null) ? 0 : Number(body.progress))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("model_evals create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/model_evals/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/model_evals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("model_evals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("scenario" in body) rec.set("scenario", body.scenario === undefined || body.scenario === null ? "" : String(body.scenario))
    if ("accuracy" in body) rec.set("accuracy", body.accuracy === undefined || body.accuracy === null ? "" : String(body.accuracy))
    if ("note" in body) rec.set("note", body.note === undefined || body.note === null ? "" : String(body.note))
    if ("progress" in body) rec.set("progress", (body.progress === undefined || body.progress === null) ? 0 : Number(body.progress))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/model_evals/{id}
routerAdd("DELETE", "/api/model_evals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("model_evals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
