/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/knowledge_items.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: category:text, name:text, rule:text, status:text
// 路由: list,get,create,update,delete
// list filter 字段: category,status
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("knowledge_items") } catch (_) { existing = null }
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
      addField({ name: 'category', type: 'text', max: 30 })
      addField({ name: 'name', type: 'text', required: true, max: 80 })
      addField({ name: 'rule', type: 'text', max: 200 })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("knowledge_items collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "knowledge_items",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'category', type: 'text', max: 30 },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'rule', type: 'text', max: 200 },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("knowledge_items collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("knowledge_items bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/knowledge_items?page=1&perPage=50&sort=-created&category=...&status=...
routerAdd("GET", "/api/knowledge_items", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("knowledge_items") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "knowledge_items",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'category', type: 'text', max: 30 },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'rule', type: 'text', max: 200 },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("knowledge_items")
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
    if (query.category !== undefined && query.category !== "") {
      filterParts.push("category = {:category}")
      params.category = String(query.category)
    }
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("knowledge_items", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("knowledge_items", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("knowledge_items list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/knowledge_items/{id}
routerAdd("GET", "/api/knowledge_items/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("knowledge_items", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/knowledge_items  body 字段: category, name, rule, status
routerAdd("POST", "/api/knowledge_items", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("knowledge_items") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "knowledge_items",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'category', type: 'text', max: 30 },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'rule', type: 'text', max: 200 },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("knowledge_items")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("category", body.category === undefined || body.category === null ? "" : String(body.category))
    rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    rec.set("rule", body.rule === undefined || body.rule === null ? "" : String(body.rule))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("knowledge_items create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/knowledge_items/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/knowledge_items/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("knowledge_items", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("category" in body) rec.set("category", body.category === undefined || body.category === null ? "" : String(body.category))
    if ("name" in body) rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    if ("rule" in body) rec.set("rule", body.rule === undefined || body.rule === null ? "" : String(body.rule))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/knowledge_items/{id}
routerAdd("DELETE", "/api/knowledge_items/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("knowledge_items", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
