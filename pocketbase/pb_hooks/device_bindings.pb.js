/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/device_bindings.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device:relation, employee:relation, store:relation, effective_date:date, status:text
// 路由: list,get,create,update,delete
// list filter 字段: status
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("device_bindings") } catch (_) { existing = null }
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
      addField({ name: 'device', type: 'relation', collectionId: 'pbc_2153001328' })
      addField({ name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' })
      addField({ name: 'store', type: 'relation', collectionId: 'pbc_3800236418' })
      addField({ name: 'effective_date', type: 'date' })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("device_bindings collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "device_bindings",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device', type: 'relation', collectionId: 'pbc_2153001328' },
          { name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', collectionId: 'pbc_3800236418' },
          { name: 'effective_date', type: 'date' },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("device_bindings collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("device_bindings bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/device_bindings?page=1&perPage=50&sort=-created&status=...
routerAdd("GET", "/api/device_bindings", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("device_bindings") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "device_bindings",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'relation', collectionId: 'pbc_2153001328' },
          { name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', collectionId: 'pbc_3800236418' },
          { name: 'effective_date', type: 'date' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("device_bindings")
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
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("device_bindings", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("device_bindings", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("device_bindings list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/device_bindings/{id}
routerAdd("GET", "/api/device_bindings/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("device_bindings", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/device_bindings  body 字段: device, employee, store, effective_date, status
routerAdd("POST", "/api/device_bindings", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("device_bindings") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "device_bindings",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'relation', collectionId: 'pbc_2153001328' },
          { name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', collectionId: 'pbc_3800236418' },
          { name: 'effective_date', type: 'date' },
          { name: 'status', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("device_bindings")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
    rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    rec.set("effective_date", body.effective_date === undefined || body.effective_date === null ? "" : String(body.effective_date))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("device_bindings create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/device_bindings/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/device_bindings/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("device_bindings", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("device" in body) rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
    if ("employee" in body) rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("effective_date" in body) rec.set("effective_date", body.effective_date === undefined || body.effective_date === null ? "" : String(body.effective_date))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/device_bindings/{id}
routerAdd("DELETE", "/api/device_bindings/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("device_bindings", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
