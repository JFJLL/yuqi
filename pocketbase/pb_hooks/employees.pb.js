/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/employees.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: name:text, phone:text, role:text, store:relation, status:text
// 路由: list,get,create,update,delete
// list filter 字段: store,status,role
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("employees") } catch (_) { existing = null }
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
      addField({ name: 'name', type: 'text', required: true, max: 60 })
      addField({ name: 'phone', type: 'text', max: 30 })
      addField({ name: 'role', type: 'text', max: 30 })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'stores' })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("employees collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "employees",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true, max: 60 },
          { name: 'phone', type: 'text', max: 30 },
          { name: 'role', type: 'text', max: 30 },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("employees collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("employees bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/employees?page=1&perPage=50&sort=-created&store=...&status=...&role=...
routerAdd("GET", "/api/employees", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("employees") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "employees",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 60 },
          { name: 'phone', type: 'text', max: 30 },
          { name: 'role', type: 'text', max: 30 },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("employees")
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
    if (query.store !== undefined && query.store !== "") {
      filterParts.push("store = {:store}")
      params.store = String(query.store)
    }
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    if (query.role !== undefined && query.role !== "") {
      filterParts.push("role = {:role}")
      params.role = String(query.role)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("employees", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("employees", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("employees list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/employees/{id}
routerAdd("GET", "/api/employees/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("employees", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/employees  body 字段: name, phone, role, store, status
routerAdd("POST", "/api/employees", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("employees") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "employees",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 60 },
          { name: 'phone', type: 'text', max: 30 },
          { name: 'role', type: 'text', max: 30 },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("employees")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    rec.set("phone", body.phone === undefined || body.phone === null ? "" : String(body.phone))
    rec.set("role", body.role === undefined || body.role === null ? "" : String(body.role))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("employees create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/employees/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/employees/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("employees", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("name" in body) rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    if ("phone" in body) rec.set("phone", body.phone === undefined || body.phone === null ? "" : String(body.phone))
    if ("role" in body) rec.set("role", body.role === undefined || body.role === null ? "" : String(body.role))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/employees/{id}
routerAdd("DELETE", "/api/employees/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("employees", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
